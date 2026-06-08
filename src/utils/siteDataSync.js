import { getGitHubPublishConfig, getStoredGitHubToken, publishJsonToRepo } from './githubPublish';
import { prepareSiteDataForPublish } from './siteDataPrepare';

const DEBOUNCE_MS = 2000;
const MIN_SYNC_INTERVAL_MS = 5000;
let debounceTimer = null;
let syncInFlight = null;
let lastSyncedDataSnapshot = '';
let lastSyncAttemptAt = 0;

export const isSiteDataSyncConfigured = () => {
  const { owner, repo } = getGitHubPublishConfig();
  return Boolean(getStoredGitHubToken() && owner && repo);
};

export const syncSiteDataToGitHub = async (content) => {
  const config = getGitHubPublishConfig();
  if (!config.token) return { ok: false, reason: 'needs_config', error: '请先配置 GitHub Token。' };
  if (!config.owner || !config.repo) {
    return { ok: false, reason: 'needs_config', error: '请填写 Owner 和 Repo。' };
  }

  if (syncInFlight) return syncInFlight;

  const now = Date.now();
  if (now - lastSyncAttemptAt < MIN_SYNC_INTERVAL_MS) {
    return { ok: false, error: '同步过于频繁，请稍后再试。', status: 429 };
  }
  lastSyncAttemptAt = now;

  syncInFlight = (async () => {
    const prepared = await prepareSiteDataForPublish(content, config);
    if (!prepared.ok) return prepared;

    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await publishJsonToRepo({
        ...config,
        content: prepared.content,
        skipAuthCheck: attempt > 0,
      });
      if (res.ok) {
        return {
          ...res,
          uploadedImages: prepared.uploadedImages || 0,
          preparedContent: prepared.content,
        };
      }
      if (res.status === 409 && attempt < 3) continue;
      return res;
    }
    return { ok: false, error: '同步冲突，请稍后重试。', status: 409 };
  })();

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
};

/** Debounced auto-sync after admin edits. */
export const scheduleSiteDataSync = (getContent, dataSnapshot, onStatus) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (dataSnapshot === lastSyncedDataSnapshot) return;

  onStatus?.({ status: 'pending', message: '变更已保存，即将自动同步…' });

  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    if (dataSnapshot === lastSyncedDataSnapshot) return;

    if (!isSiteDataSyncConfigured()) {
      onStatus?.({
        status: 'needs_config',
        message: '请在 Data Backup 手动填写 GitHub Token，之后保存即可自动同步。',
      });
      return;
    }

    onStatus?.({ status: 'syncing', message: '正在同步到 GitHub…' });
    try {
      const content = typeof getContent === 'function' ? getContent() : getContent;
      const res = await syncSiteDataToGitHub(content);
      if (!res.ok) {
        onStatus?.({ status: 'error', message: res.error || '同步失败。' });
        return;
      }
      if (res.preparedContent) {
        try {
          const parsed = JSON.parse(res.preparedContent);
          lastSyncedDataSnapshot = JSON.stringify({
            projects: parsed.projects,
            blogPosts: parsed.blogPosts,
            aboutInfo: parsed.aboutInfo,
            siteNotice: parsed.siteNotice,
            language: parsed.language,
          });
        } catch {
          lastSyncedDataSnapshot = dataSnapshot;
        }
      } else {
        lastSyncedDataSnapshot = dataSnapshot;
      }
      const imageHint = res.uploadedImages
        ? `（${res.uploadedImages} 张配图已上传至 public/uploads）`
        : '';
      onStatus?.({
        status: 'synced',
        message: `已自动同步，访客刷新后即可看到最新内容。${imageHint}`,
        commitUrl: res.commitUrl || '',
        lastSyncedAt: new Date().toISOString(),
        preparedContent: res.preparedContent || '',
      });
    } catch {
      onStatus?.({ status: 'error', message: '同步失败，请检查网络。' });
    }
  }, DEBOUNCE_MS);
};

export const markSiteDataSynced = (dataSnapshot) => {
  lastSyncedDataSnapshot = dataSnapshot;
};

export const cancelScheduledSiteDataSync = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
};
