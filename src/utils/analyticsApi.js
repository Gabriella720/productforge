import {
  fetchGitHub,
  formatGitHubApiError,
  normalizeGitHubToken,
  parseGitHubError,
} from './githubPublish';

/** Build-time analytics token only — independent from Data Backup session token. */
export const getAnalyticsGitHubToken = () => (
  normalizeGitHubToken(import.meta.env.VITE_GITHUB_ANALYTICS_TOKEN || '')
);

const GITHUB_API = 'https://api.github.com';
const PENDING_KEY = 'analyticsPendingSync';
const CACHE_KEY = 'analyticsCache';
const MAX_RECORDS = 10000;
/** Contents API base64 payload must stay under 1 MB; Git Data API handles larger blobs. */
const CONTENTS_API_MAX_BYTES = 700000;
const GIT_BLOB_MAX_BYTES = 4_500_000;

const base64EncodeUtf8 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

export const getAnalyticsConfig = () => {
  const token = getAnalyticsGitHubToken();
  const owner = (import.meta.env.VITE_GITHUB_ANALYTICS_OWNER || 'Gabriella720').trim();
  const repo = (import.meta.env.VITE_GITHUB_ANALYTICS_REPO || 'productforge').trim();
  const branch = (import.meta.env.VITE_GITHUB_ANALYTICS_BRANCH || 'main').trim();
  const path = (import.meta.env.VITE_GITHUB_ANALYTICS_PATH || 'public/analytics.json').trim();
  return { token, owner, repo, branch, path };
};

export const isAnalyticsSyncConfigured = () => Boolean(getAnalyticsConfig().token);

const safeParse = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const normalizeVisits = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.visits)) return data.visits;
  return [];
};

/** Unique key per visit — never collapse different pages/actions that share a timestamp. */
export const getVisitDedupeKey = (visit) => {
  if (!visit || typeof visit !== 'object') return '';
  const id = visit.id;
  if (id != null && String(id).includes('-')) return String(id);
  return [
    visit.timestamp ?? '',
    visit.page ?? '',
    visit.eventType || 'pageview',
    visit.action || '',
    visit.sessionId || '',
  ].join('|');
};

const dedupeVisits = (visits) => {
  const map = new Map();
  for (const v of visits) {
    const key = getVisitDedupeKey(v);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || (v.timestamp || 0) >= (existing.timestamp || 0)) {
      map.set(key, v);
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
};

export const getPendingVisits = () => {
  const raw = localStorage.getItem(PENDING_KEY);
  return normalizeVisits(safeParse(raw, []));
};

export const setPendingVisits = (visits) => {
  localStorage.setItem(PENDING_KEY, JSON.stringify(visits.slice(0, 500)));
};

export const getCachedVisits = () => {
  const raw = localStorage.getItem(CACHE_KEY);
  return normalizeVisits(safeParse(raw, []));
};

export const setCachedVisits = (visits) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify(dedupeVisits(visits).slice(0, MAX_RECORDS)));
};

export const getAnalyticsRemoteUrl = (config = getAnalyticsConfig()) => {
  const owner = (config?.owner || '').trim();
  const repo = (config?.repo || '').trim();
  const branch = (config?.branch || 'main').trim();
  const path = (config?.path || 'public/analytics.json').trim();
  if (!owner || !repo) return '';
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${path.split('/').map(encodeURIComponent).join('/')}`;
};

/** Latest committed analytics on the default branch (no token required). */
export const fetchRemoteAnalytics = async (config = getAnalyticsConfig()) => {
  const url = getAnalyticsRemoteUrl(config);
  if (!url) return [];
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return normalizeVisits(data);
  } catch {
    return [];
  }
};

export const fetchDeployedAnalytics = async () => {
  const base = import.meta.env.BASE_URL || '/';
  const url = `${base}analytics.json?t=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return normalizeVisits(data);
  } catch {
    return [];
  }
};

const serializeVisits = (visits, maxBytes = GIT_BLOB_MAX_BYTES) => {
  const sorted = dedupeVisits(visits).slice(0, MAX_RECORDS);
  let trimmed = sorted;
  let json = JSON.stringify(trimmed);
  while (json.length > maxBytes && trimmed.length > 50) {
    trimmed = trimmed.slice(0, trimmed.length - 50);
    json = JSON.stringify(trimmed);
  }
  return json;
};

const decodeGitHubContent = async (json, token) => {
  if (json?.content) {
    return atob(json.content.replace(/\n/g, ''));
  }
  if (json?.download_url) {
    const res = await fetch(json.download_url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`github_download_${res.status}`);
    return await res.text();
  }
  return '[]';
};

const fetchRepoAnalytics = async (config, token = config.token) => {
  const { owner, repo, branch, path } = config;
  const normalized = normalizeGitHubToken(token);
  if (!normalized) return { visits: [], sha: null };
  const apiPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${apiPath}?ref=${encodeURIComponent(branch)}`;
  const res = await fetchGitHub(url, normalized);
  if (res.status === 404) return { visits: [], sha: null };
  if (!res.ok) {
    const msg = await parseGitHubError(res);
    throw new Error(formatGitHubApiError(res.status, msg, { step: 'contents' }));
  }
  const json = await res.json();
  const content = await decodeGitHubContent(json, normalized);
  return { visits: normalizeVisits(safeParse(content, [])), sha: json.sha || null };
};

const putRepoAnalyticsViaGitData = async (config, content, token) => {
  const { owner, repo, branch, path } = config;
  const normalized = normalizeGitHubToken(token);
  const repoUrl = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const refRes = await fetchGitHub(`${repoUrl}/git/ref/heads/${encodeURIComponent(branch)}`, normalized);
  if (!refRes.ok) {
    const msg = await parseGitHubError(refRes);
    return { ok: false, status: refRes.status, error: formatGitHubApiError(refRes.status, msg) };
  }
  const refJson = await refRes.json();
  const parentSha = refJson?.object?.sha;
  if (!parentSha) return { ok: false, status: 500, error: '无法读取分支引用。' };

  const parentCommitRes = await fetchGitHub(`${repoUrl}/git/commits/${parentSha}`, normalized);
  if (!parentCommitRes.ok) {
    const msg = await parseGitHubError(parentCommitRes);
    return { ok: false, status: parentCommitRes.status, error: formatGitHubApiError(parentCommitRes.status, msg) };
  }
  const parentCommit = await parentCommitRes.json();

  const blobRes = await fetchGitHub(`${repoUrl}/git/blobs`, normalized, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, encoding: 'utf-8' }),
  });
  if (!blobRes.ok) {
    const msg = await parseGitHubError(blobRes);
    return { ok: false, status: blobRes.status, error: formatGitHubApiError(blobRes.status, msg) };
  }
  const blobJson = await blobRes.json();

  const treeRes = await fetchGitHub(`${repoUrl}/git/trees`, normalized, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: parentCommit.tree.sha,
      tree: [{ path, mode: '100644', type: 'blob', sha: blobJson.sha }],
    }),
  });
  if (!treeRes.ok) {
    const msg = await parseGitHubError(treeRes);
    return { ok: false, status: treeRes.status, error: formatGitHubApiError(treeRes.status, msg) };
  }
  const treeJson = await treeRes.json();

  const commitRes = await fetchGitHub(`${repoUrl}/git/commits`, normalized, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Update analytics (${new Date().toISOString()})`,
      tree: treeJson.sha,
      parents: [parentSha],
    }),
  });
  if (!commitRes.ok) {
    const msg = await parseGitHubError(commitRes);
    return { ok: false, status: commitRes.status, error: formatGitHubApiError(commitRes.status, msg) };
  }
  const commitJson = await commitRes.json();

  const updateRefRes = await fetchGitHub(`${repoUrl}/git/refs/heads/${encodeURIComponent(branch)}`, normalized, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commitJson.sha, force: false }),
  });
  if (!updateRefRes.ok) {
    const msg = await parseGitHubError(updateRefRes);
    return { ok: false, status: updateRefRes.status, error: formatGitHubApiError(updateRefRes.status, msg) };
  }

  return { ok: true, commitUrl: `https://github.com/${owner}/${repo}/commit/${commitJson.sha}` };
};

const putRepoAnalytics = async (config, visits, sha, token = config.token) => {
  const { owner, repo, branch, path } = config;
  const normalized = normalizeGitHubToken(token);
  const content = serializeVisits(visits);
  const apiPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${apiPath}`;

  if (content.length > CONTENTS_API_MAX_BYTES) {
    return putRepoAnalyticsViaGitData(config, content, normalized);
  }

  const body = {
    message: `Update analytics (${new Date().toISOString()})`,
    content: base64EncodeUtf8(content),
    branch,
  };
  if (sha) body.sha = sha;
  const res = await fetchGitHub(url, normalized, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    const result = await res.json();
    return { ok: true, commitUrl: result?.commit?.html_url || '' };
  }
  if (res.status === 422 || res.status === 413) {
    return putRepoAnalyticsViaGitData(config, content, normalized);
  }
  const msg = await parseGitHubError(res);
  return { ok: false, status: res.status, error: formatGitHubApiError(res.status, msg) };
};

export const mergeVisits = (...lists) => dedupeVisits(lists.flat());

const fetchAuthoritativeAnalytics = async (config = getAnalyticsConfig()) => {
  const remote = await fetchRemoteAnalytics(config);
  if (remote.length) return remote;

  if (config.token) {
    try {
      const { visits } = await fetchRepoAnalytics(config, config.token);
      if (visits.length) return visits;
    } catch {
      // fall through to deployed bundle
    }
  }

  return fetchDeployedAnalytics();
};

/** Remote repo data + local pending uploads; cache is only an offline fallback. */
export const refreshAnalyticsSnapshot = async () => {
  const config = getAnalyticsConfig();
  const pending = getPendingVisits();
  const authoritative = await fetchAuthoritativeAnalytics(config);
  let merged = mergeVisits(authoritative, pending);
  if (!merged.length) merged = mergeVisits(getCachedVisits(), pending);
  setCachedVisits(merged);
  return merged;
};

export const loadAllAnalytics = refreshAnalyticsSnapshot;

export const refreshAnalyticsFromGitHub = refreshAnalyticsSnapshot;

let syncInFlight = null;

const uploadAnalyticsSnapshot = async (config, { force = false } = {}) => {
  const token = getAnalyticsGitHubToken();
  if (!token) return { ok: false, reason: 'no_token' };

  const pending = getPendingVisits();
  const cached = getCachedVisits();
  if (!force && !pending.length) {
    return { ok: true, synced: 0, reason: 'nothing_pending' };
  }

  let lastError = 'sync_failed';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const { visits: remote, sha } = await fetchRepoAnalytics(config, token);
      const merged = mergeVisits(remote, pending, cached);
      const putResult = await putRepoAnalytics(config, merged, sha, token);
      if (putResult.ok) {
        setPendingVisits([]);
        setCachedVisits(merged);
        return { ok: true, synced: pending.length, commitUrl: putResult.commitUrl || '' };
      }
      if (putResult.status === 409) continue;
      lastError = putResult.error || `github_put_${putResult.status}`;
    } catch (e) {
      lastError = e?.message || 'sync_failed';
      if (attempt === 3) break;
    }
  }
  return { ok: false, reason: lastError };
};

export const syncPendingVisits = async (options = {}) => {
  if (syncInFlight) return syncInFlight;
  const config = getAnalyticsConfig();

  syncInFlight = uploadAnalyticsSnapshot(config, options);

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
};

export const queueVisitForSync = (visit) => {
  const pending = getPendingVisits();
  pending.unshift(visit);
  setPendingVisits(pending.slice(0, 500));
  const cached = mergeVisits([visit, ...getCachedVisits()]);
  setCachedVisits(cached);
};

let syncTimer = null;
const syncCompleteListeners = new Set();

export const onAnalyticsSyncComplete = (listener) => {
  syncCompleteListeners.add(listener);
  return () => syncCompleteListeners.delete(listener);
};

const notifyAnalyticsSyncComplete = async (result) => {
  let merged = null;
  try {
    merged = await refreshAnalyticsSnapshot();
  } catch {
    merged = null;
  }
  syncCompleteListeners.forEach((listener) => {
    try {
      listener(merged, result);
    } catch {
      // ignore listener errors
    }
  });
};

export const scheduleAnalyticsSync = (delayMs = 1500) => {
  if (!isAnalyticsSyncConfigured()) return;
  if (syncTimer) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncTimer = null;
    void syncPendingVisits().then((result) => notifyAnalyticsSyncComplete(result));
  }, delayMs);
};

export const flushAnalyticsSync = () => {
  if (!isAnalyticsSyncConfigured()) return;
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = null;
  }
  void syncPendingVisits().then((result) => notifyAnalyticsSyncComplete(result));
};

const VISITOR_ID_KEY = 'analyticsVisitorId';
const VISITOR_NAME_KEY = 'visitorDisplayName';
const SESSION_ID_KEY = 'analyticsSessionId';
const GEO_CACHE_KEY = 'analyticsGeoCache';

const parseUserAgent = (ua) => {
  const s = (ua || '').toString();
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Desktop';

  if (/iPhone|iPad|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(s)) {
    device = 'Mobile';
  } else if (/iPad|Android(?!.*Mobile)|Tablet/i.test(s)) {
    device = 'Tablet';
  }

  if (/Edg\//i.test(s)) browser = 'Edge';
  else if (/Chrome\//i.test(s) && !/Edg/i.test(s)) browser = 'Chrome';
  else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = 'Safari';
  else if (/Firefox\//i.test(s)) browser = 'Firefox';

  if (/Windows/i.test(s)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS';
  else if (/Android/i.test(s)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(s)) os = 'iOS';
  else if (/Linux/i.test(s)) os = 'Linux';

  return { browser, os, device };
};

export const getOrCreateVisitorId = () => {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
};

export const getVisitorDisplayName = () => (localStorage.getItem(VISITOR_NAME_KEY) || '').trim();

export const setVisitorDisplayName = (name) => {
  const v = (name || '').trim();
  if (v) localStorage.setItem(VISITOR_NAME_KEY, v.slice(0, 64));
  else localStorage.removeItem(VISITOR_NAME_KEY);
};

const getOrCreateSessionId = () => {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
};

const formatLocation = (geo) => {
  if (!geo) return '';
  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  return parts.join(', ');
};

const GEO_CACHE_TTL_MS = 60 * 60 * 1000;
const GEO_FETCH_TIMEOUT_MS = 4500;

const readGeoCache = () => {
  try {
    for (const store of [localStorage, sessionStorage]) {
      const cached = store.getItem(GEO_CACHE_KEY);
      if (!cached) continue;
      const parsed = safeParse(cached, null);
      if (parsed?.expires > Date.now() && parsed?.data?.ip) return parsed.data;
    }
  } catch {
    // ignore
  }
  return null;
};

const writeGeoCache = (data) => {
  if (!data?.ip) return;
  const payload = JSON.stringify({ expires: Date.now() + GEO_CACHE_TTL_MS, data });
  try {
    localStorage.setItem(GEO_CACHE_KEY, payload);
    sessionStorage.setItem(GEO_CACHE_KEY, payload);
  } catch {
    // ignore quota errors
  }
};

const fetchJsonWithTimeout = async (url, timeoutMs = GEO_FETCH_TIMEOUT_MS) => {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
};

const geoFromIpwho = async () => {
  const json = await fetchJsonWithTimeout('https://ipwho.is/');
  if (!json?.success || !json.ip) return null;
  return {
    ip: json.ip || '',
    country: json.country || '',
    region: json.region || '',
    city: json.city || '',
    isp: json.connection?.isp || json.isp || '',
  };
};

const geoFromIpinfo = async () => {
  const json = await fetchJsonWithTimeout('https://ipinfo.io/json');
  if (!json?.ip) return null;
  return {
    ip: json.ip || '',
    country: json.country || '',
    region: json.region || '',
    city: json.city || '',
    isp: (json.org || '').toString(),
  };
};

const getVisitorNetworkContext = async () => {
  const cached = readGeoCache();
  if (cached) return cached;

  const providers = [geoFromIpwho, geoFromIpinfo];
  for (const provider of providers) {
    try {
      const data = await provider();
      if (data?.ip) {
        writeGeoCache(data);
        return data;
      }
    } catch {
      // try next provider
    }
  }
  return null;
};

/** Warm geo cache early so pageview records include IP/location. */
export const prefetchVisitorNetwork = () => getVisitorNetworkContext();

export const getVisitorLabel = (visitorId) => {
  const id = (visitorId || getOrCreateVisitorId()).toString();
  return `Visitor ${id.slice(-6)}`;
};

export const getRecordVisitorLabel = (record) => {
  if (!record || typeof record !== 'object') return 'Unknown';
  const name = (record.displayName || '').trim();
  if (name) return name;
  if (record.visitorLabel) return record.visitorLabel;
  if (record.visitorId) return getVisitorLabel(record.visitorId);
  return 'Unknown';
};

export const createVisitRecord = async (page, meta = {}) => {
  const visitorId = getOrCreateVisitorId();
  const displayName = getVisitorDisplayName();
  const { browser, os, device } = parseUserAgent(navigator.userAgent);
  const geo = await getVisitorNetworkContext();

  const ts = Date.now();
  return {
    id: `${ts}-${Math.random().toString(36).slice(2, 11)}`,
    timestamp: ts,
    page,
    eventType: meta.eventType || 'pageview',
    action: meta.action || '',
    entityType: meta.entityType || '',
    entityId: meta.entityId != null ? String(meta.entityId) : '',
    entityName: meta.entityName || '',
    visitorId,
    visitorLabel: getVisitorLabel(visitorId),
    displayName,
    sessionId: getOrCreateSessionId(),
    ip: geo?.ip || '',
    country: geo?.country || '',
    region: geo?.region || '',
    city: geo?.city || '',
    location: formatLocation(geo),
    isp: geo?.isp || '',
    browser,
    os,
    device,
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: navigator.platform,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    referrer: document.referrer || 'Direct',
  };
};

export const shouldTrackPath = (pathname) => {
  if (!pathname) return false;
  return !pathname.includes('/admin');
};
