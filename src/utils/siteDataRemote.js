import { getGitHubPublishConfig } from './githubPublish';

export const getSiteDataRemoteUrl = (config) => {
  const owner = (config?.owner || '').trim();
  const repo = (config?.repo || '').trim();
  const branch = (config?.branch || 'main').trim();
  const path = (config?.path || 'src/site-data.json').trim();
  if (!owner || !repo) return '';
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${path.split('/').map(encodeURIComponent).join('/')}`;
};

export const parseExportedAt = (payload) => {
  const raw = payload?.exportedAt;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
};

export const fetchRemoteSiteData = async (config = getGitHubPublishConfig()) => {
  const url = getSiteDataRemoteUrl(config);
  if (!url) return null;
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return data && typeof data === 'object' ? data : null;
    } catch {
      console.warn('remote site-data.json is invalid JSON', { bytes: text.length });
      return null;
    }
  } catch {
    return null;
  }
};
