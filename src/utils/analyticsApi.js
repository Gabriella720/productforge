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
  const token = (
    import.meta.env.VITE_GITHUB_ANALYTICS_TOKEN ||
    sessionStorage.getItem('ghToken') ||
    ''
  ).trim();
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

const dedupeVisits = (visits) => {
  const map = new Map();
  for (const v of visits) {
    if (!v || typeof v !== 'object') continue;
    const id = v.id ?? v.timestamp;
    if (id == null) continue;
    map.set(String(id), v);
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
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
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
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res;
};

export const mergeVisits = (...lists) => dedupeVisits(lists.flat());

export const loadAllAnalytics = async () => {
  const [deployed, pending, cached] = await Promise.all([
    fetchDeployedAnalytics(),
    Promise.resolve(getPendingVisits()),
    Promise.resolve(getCachedVisits()),
  ]);
  const merged = mergeVisits(deployed, cached, pending);
  setCachedVisits(merged);
  return merged;
};

export const refreshAnalyticsFromGitHub = async () => {
  const config = getAnalyticsConfig();
  if (!config.token) {
    return loadAllAnalytics();
  }
  try {
    const { visits } = await fetchRepoAnalytics(config);
    const pending = getPendingVisits();
    const merged = mergeVisits(visits, pending);
    setCachedVisits(merged);
    return merged;
  } catch {
    return loadAllAnalytics();
  }
};

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

export const scheduleAnalyticsSync = (delayMs = 3000) => {
  if (!isAnalyticsSyncConfigured()) return;
  if (syncTimer) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncTimer = null;
    syncPendingVisits();
  }, delayMs);
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

const getVisitorNetworkContext = async () => {
  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached) {
      const parsed = safeParse(cached, null);
      if (parsed?.expires > Date.now()) return parsed.data;
    }
  } catch {
    // ignore
  }

  try {
    const res = await fetch('https://ipwho.is/', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.success) return null;
    const data = {
      ip: json.ip || '',
      country: json.country || '',
      region: json.region || '',
      city: json.city || '',
      isp: json.connection?.isp || json.isp || '',
    };
    sessionStorage.setItem(
      GEO_CACHE_KEY,
      JSON.stringify({ expires: Date.now() + 30 * 60 * 1000, data })
    );
    return data;
  } catch {
    return null;
  }
};

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

export const createVisitRecord = async (page) => {
  const visitorId = getOrCreateVisitorId();
  const displayName = getVisitorDisplayName();
  const { browser, os, device } = parseUserAgent(navigator.userAgent);
  const geo = await getVisitorNetworkContext();

  return {
    id: Date.now(),
    timestamp: Date.now(),
    page,
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
