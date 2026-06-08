import { getGitHubHeaders, getStoredGitHubToken } from './githubPublish';

const PENDING_KEY = 'analyticsPendingSync';
const CACHE_KEY = 'analyticsCache';
const MAX_RECORDS = 10000;

const base64EncodeUtf8 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

export const getAnalyticsConfig = () => {
  const token = getStoredGitHubToken();
  const owner = (
    import.meta.env.VITE_GITHUB_ANALYTICS_OWNER ||
    localStorage.getItem('ghOwner') ||
    'Gabriella720'
  ).trim();
  const repo = (
    import.meta.env.VITE_GITHUB_ANALYTICS_REPO ||
    localStorage.getItem('ghRepo') ||
    'productforge'
  ).trim();
  const branch = (
    import.meta.env.VITE_GITHUB_ANALYTICS_BRANCH ||
    localStorage.getItem('ghBranch') ||
    'main'
  ).trim();
  const path = (
    import.meta.env.VITE_GITHUB_ANALYTICS_PATH ||
    'public/analytics.json'
  ).trim();
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

const fetchRepoAnalytics = async (config) => {
  const { token, owner, repo, branch, path } = config;
  if (!token) return { visits: [], sha: null };
  const apiPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${apiPath}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: getGitHubHeaders(token) });
  if (res.status === 404) return { visits: [], sha: null };
  if (!res.ok) throw new Error(`github_fetch_${res.status}`);
  const json = await res.json();
  const content = json.content ? atob(json.content.replace(/\n/g, '')) : '[]';
  return { visits: normalizeVisits(safeParse(content, [])), sha: json.sha || null };
};

const putRepoAnalytics = async (config, visits, sha) => {
  const { token, owner, repo, branch, path } = config;
  const apiPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${apiPath}`;
  const body = {
    message: `Update analytics (${new Date().toISOString()})`,
    content: base64EncodeUtf8(JSON.stringify(dedupeVisits(visits).slice(0, MAX_RECORDS), null, 2)),
    branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...getGitHubHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
};

export const mergeVisits = (...lists) => dedupeVisits(lists.flat());

const fetchAuthoritativeAnalytics = async (config = getAnalyticsConfig()) => {
  const remote = await fetchRemoteAnalytics(config);
  if (remote.length) return remote;

  if (config.token) {
    try {
      const { visits } = await fetchRepoAnalytics(config);
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

export const syncPendingVisits = async () => {
  if (syncInFlight) return syncInFlight;
  const config = getAnalyticsConfig();
  if (!config.token) return { ok: false, reason: 'no_token' };

  syncInFlight = (async () => {
    const pending = getPendingVisits();
    if (!pending.length) return { ok: true, synced: 0 };

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const { visits: remote, sha } = await fetchRepoAnalytics(config);
        const merged = mergeVisits(remote, pending);
        const res = await putRepoAnalytics(config, merged, sha);
        if (res.ok) {
          setPendingVisits([]);
          setCachedVisits(merged);
          return { ok: true, synced: pending.length };
        }
        if (res.status === 409) continue;
        return { ok: false, reason: `github_put_${res.status}` };
      } catch (e) {
        if (attempt === 3) return { ok: false, reason: e?.message || 'sync_failed' };
      }
    }
    return { ok: false, reason: 'conflict' };
  })();

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
