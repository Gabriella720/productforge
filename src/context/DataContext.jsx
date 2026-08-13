import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { translations } from '../translations';
import siteData from '../site-data.json';
import {
  refreshAnalyticsSnapshot,
  queueVisitForSync,
  scheduleAnalyticsSync,
  createVisitRecord,
  shouldTrackPath,
  syncPendingVisits,
  mergeVisits,
  getCachedVisits,
  getPendingVisits,
  setPendingVisits,
  onAnalyticsSyncComplete,
  flushAnalyticsSync,
} from '../utils/analyticsApi';
import { resolveAnalyticsPath } from '../utils/analyticsPaths';
import { detectContentLanguage } from '../utils/blogLocale';
import { clearBlogLocaleCache } from '../utils/blogEditor';
import { ensureOrderFields, reorderArray, sortByOrder, preserveOrder } from '../utils/sortOrder';
import { clearGitHubTokenSession } from '../utils/githubPublish';
import { fetchRemoteSiteData, parseExportedAt } from '../utils/siteDataRemote';
import {
  cancelScheduledSiteDataSync,
  markSiteDataSynced,
  scheduleSiteDataSync,
  syncSiteDataToGitHub,
  isSiteDataSyncConfigured,
} from '../utils/siteDataSync';

const normalizeProjectTags = (tags) =>
  (Array.isArray(tags) ? tags : []).map((t) => String(t).trim()).filter(Boolean);

const normalizeProject = (project) => {
  const base = project && typeof project === 'object' ? project : {};
  const i18nRaw = base.i18n && typeof base.i18n === 'object' ? base.i18n : {};
  const i18nEn = i18nRaw.en && typeof i18nRaw.en === 'object' ? i18nRaw.en : {};
  const i18nZh = i18nRaw.zh && typeof i18nRaw.zh === 'object' ? i18nRaw.zh : {};
  const fallbackTags = normalizeProjectTags(base.tags);

  let en = {
    title: (i18nEn.title ?? base.title ?? '').toString(),
    description: (i18nEn.description ?? base.description ?? '').toString(),
    tags: normalizeProjectTags(i18nEn.tags?.length ? i18nEn.tags : fallbackTags),
  };

  let zh = {
    title: (i18nZh.title ?? '').toString(),
    description: (i18nZh.description ?? '').toString(),
    tags: normalizeProjectTags(i18nZh.tags),
  };

  if (!en.title && !en.description && !en.tags.length) {
    en = {
      title: (base.title ?? '').toString(),
      description: (base.description ?? '').toString(),
      tags: fallbackTags,
    };
  }

  const zhEmpty = !zh.title && !zh.description && !zh.tags.length;
  if (zhEmpty) {
    zh = { ...en };
  }

  return {
    ...base,
    i18n: { en, zh },
    title: en.title,
    description: en.description,
    tags: en.tags,
    order: preserveOrder(base),
  };
};

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const useTranslation = () => {
  const { language } = useData();
  return (path) => {
    const keys = path.split('.');
    let result = translations[language];
    for (const key of keys) {
      if (result && result[key]) {
        result = result[key];
      } else {
        return path;
      }
    }
    return result;
  };
};

const initialProjects = Array.isArray(siteData?.projects) ? siteData.projects : [];
const initialBlogPosts = Array.isArray(siteData?.blogPosts) ? siteData.blogPosts : [];
const BLOG_POSTS_CACHE_KEY = 'blogPostsPublishedCache';
const SITE_NOTICE_CACHE_KEY = 'siteNoticePublishedCache';

const readSiteNoticeCache = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SITE_NOTICE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const shouldUsePublishedLocalCache = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.includes('/admin');
};

const mergeBlogPostsById = (basePosts, cachedPosts) => {
  const map = new Map((basePosts || []).map((p) => [p.id, p]));
  (cachedPosts || []).forEach((p) => {
    if (p && p.id != null) map.set(p.id, p);
  });
  return ensureOrderFields(Array.from(map.values()));
};

const initialAboutInfo = siteData?.aboutInfo && typeof siteData.aboutInfo === 'object' ? siteData.aboutInfo : {
  name: '',
  role: '',
  tagline: '',
  profileImage: '',
  highlights: [],
  socials: { github: '', wechat: '', email: '' }
};
const initialSiteNotice = siteData?.siteNotice && typeof siteData.siteNotice === 'object' ? siteData.siteNotice : {
  id: 1,
  enabled: false,
  zh: '',
  en: ''
};

export const DataProvider = ({ children }) => {
  const safeParseJson = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const draftKey = 'adminDraftSiteData';

  const shouldLoadAdminDraft = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname || '';
    return localStorage.getItem('isAdmin') === 'true' && path.includes('/admin');
  };

  const draftRaw = shouldLoadAdminDraft() ? localStorage.getItem(draftKey) : null;
  const draft = draftRaw ? safeParseJson(draftRaw) : null;

  const normalizeBlogPost = (post) => {
    const base = post && typeof post === 'object' ? post : {};
    const i18nRaw = base.i18n && typeof base.i18n === 'object' ? base.i18n : {};
    const i18nEn = i18nRaw.en && typeof i18nRaw.en === 'object' ? i18nRaw.en : {};
    const i18nZh = i18nRaw.zh && typeof i18nRaw.zh === 'object' ? i18nRaw.zh : {};

    const fallbackTitle = (base.title ?? '').toString();
    const fallbackDesc = (base.description ?? '').toString();
    const fallbackContent = (base.content ?? '').toString();

    let en = {
      title: (i18nEn.title ?? '').toString(),
      description: (i18nEn.description ?? '').toString(),
      content: (i18nEn.content ?? '').toString(),
      contentFormat: i18nEn.contentFormat === 'markdown' ? 'markdown' : 'html',
    };

    let zh = {
      title: (i18nZh.title ?? '').toString(),
      description: (i18nZh.description ?? '').toString(),
      content: (i18nZh.content ?? '').toString(),
      contentFormat: i18nZh.contentFormat === 'markdown' ? 'markdown' : 'html',
    };

    if (!en.title && !en.content) {
      en = {
        title: fallbackTitle,
        description: fallbackDesc,
        content: fallbackContent,
        contentFormat: i18nEn.contentFormat === 'markdown' ? 'markdown' : 'html',
      };
    }

    const enLang = detectContentLanguage(`${en.title} ${en.description} ${en.content}`);
    const zhLang = detectContentLanguage(`${zh.title} ${zh.description} ${zh.content}`);
    const zhEmpty = !zh.title && !zh.description && !zh.content;

    // Articles saved in EN tab but written in Chinese; ZH may be empty or old English templates
    if (enLang === 'zh' && (zhEmpty || zhLang === 'en')) {
      zh = { ...en };
    } else if (zhLang === 'zh' && !en.content && !en.title) {
      en = { ...zh };
    } else if (zhEmpty) {
      zh = {
        title: fallbackTitle,
        description: fallbackDesc,
        content: fallbackContent,
        contentFormat: i18nZh.contentFormat === 'markdown' ? 'markdown' : en.contentFormat,
      };
    }

    const primary = detectContentLanguage(`${zh.title} ${zh.content}`) === 'zh' ? zh : en;

    return {
      ...base,
      i18n: { en, zh },
      title: primary.title || fallbackTitle,
      description: primary.description || fallbackDesc,
      content: primary.content || fallbackContent,
      contentFormat: primary.contentFormat || 'html',
      order: preserveOrder(base),
    };
  };

  const normalizeAboutInfo = (info) => {
    const base = info && typeof info === 'object' ? info : {};
    const highlightsRaw = Array.isArray(base.highlights) ? base.highlights : [];
    const highlights = (highlightsRaw.length ? highlightsRaw : initialAboutInfo.highlights).map((h, idx) => ({
      id: typeof h.id === 'number' ? h.id : (Date.now() + idx),
      value: (h.value ?? '').toString(),
      label: (h.label ?? '').toString(),
      valueFontSize: typeof h.valueFontSize === 'number' ? h.valueFontSize : undefined,
      labelFontSize: typeof h.labelFontSize === 'number' ? h.labelFontSize : undefined,
    }));

    return {
      ...initialAboutInfo,
      ...base,
      highlights,
      socials: { ...initialAboutInfo.socials, ...(base.socials || {}) },
    };
  };

  const normalizeSiteNotice = (notice) => {
    const base = notice && typeof notice === 'object' ? notice : {};
    return {
      ...initialSiteNotice,
      ...base,
      id: typeof base.id === 'number' ? base.id : initialSiteNotice.id,
      enabled: typeof base.enabled === 'boolean' ? base.enabled : initialSiteNotice.enabled,
      zh: typeof base.zh === 'string' ? base.zh : initialSiteNotice.zh,
      en: typeof base.en === 'string' ? base.en : initialSiteNotice.en
    };
  };

  const [projects, setProjects] = useState(() => {
    const raw = Array.isArray(draft?.projects) ? draft.projects : initialProjects;
    return ensureOrderFields(raw.map(normalizeProject));
  });

  const [blogPosts, setBlogPosts] = useState(() => {
    const base = initialBlogPosts.map(normalizeBlogPost);
    if (typeof window === 'undefined') return ensureOrderFields(base);
    if (!shouldUsePublishedLocalCache()) return ensureOrderFields(base);
    try {
      const raw = localStorage.getItem(BLOG_POSTS_CACHE_KEY);
      if (!raw) return ensureOrderFields(base);
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return ensureOrderFields(base);
      return mergeBlogPostsById(base, parsed.map(normalizeBlogPost));
    } catch {
      return ensureOrderFields(base);
    }
  });

  const [aboutInfo, setAboutInfo] = useState(() => {
    const base = draft?.aboutInfo && typeof draft.aboutInfo === 'object' ? draft.aboutInfo : initialAboutInfo;
    return normalizeAboutInfo(base);
  });

  const [siteNotice, setSiteNotice] = useState(() => {
    if (!shouldUsePublishedLocalCache()) {
      return normalizeSiteNotice(initialSiteNotice);
    }
    const cached = readSiteNoticeCache();
    if (cached) return normalizeSiteNotice(cached);
    const base = draft?.siteNotice && typeof draft.siteNotice === 'object' ? draft.siteNotice : initialSiteNotice;
    return normalizeSiteNotice(base);
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('isAdmin') === 'true';
  });

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || draft?.language || siteData?.language || 'en';
  });

  const [analytics, setAnalytics] = useState(() => getCachedVisits());
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const analyticsLoadedRef = useRef(false);
  const [siteDataSync, setSiteDataSync] = useState({ status: 'idle', message: '', commitUrl: '', lastSyncedAt: '' });
  const [adminHydrationReady, setAdminHydrationReady] = useState(false);
  const autoSyncBaselineRef = useRef(null);
  const adminEntrySnapshotRef = useRef(null);
  const lastAppliedRemoteAtRef = useRef(parseExportedAt(siteData));
  const rebaselineAutoSyncRef = useRef(() => {});

  const reloadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await refreshAnalyticsSnapshot();
      setAnalytics(data);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (analyticsLoadedRef.current) return;
    analyticsLoadedRef.current = true;
    const legacy = localStorage.getItem('analytics');
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length) {
          setPendingVisits(mergeVisits(getPendingVisits(), parsed));
        }
      } catch {
        // ignore
      }
      localStorage.removeItem('analytics');
    }
    (async () => {
      setAnalyticsLoading(true);
      try {
        const data = await refreshAnalyticsSnapshot();
        setAnalytics(data);
        await syncPendingVisits();
        const refreshed = await refreshAnalyticsSnapshot();
        setAnalytics(refreshed);
      } finally {
        setAnalyticsLoading(false);
      }
    })();
  }, []);

  useEffect(() => onAnalyticsSyncComplete((merged) => {
    if (merged) setAnalytics(merged);
  }), []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        flushAnalyticsSync();
        return;
      }
      if (isAdmin) void reloadAnalytics();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isAdmin, reloadAnalytics]);

  useEffect(() => {
    if (!isAdmin) return undefined;

    const poll = () => {
      void reloadAnalytics();
    };
    poll();
    const intervalId = window.setInterval(poll, 20000);
    return () => window.clearInterval(intervalId);
  }, [isAdmin, reloadAnalytics]);

  useEffect(() => {
    try {
      localStorage.setItem(BLOG_POSTS_CACHE_KEY, JSON.stringify(blogPosts));
    } catch {
      // ignore quota errors; admin draft may still hold data while editing
    }
  }, [blogPosts]);

  useEffect(() => {
    try {
      localStorage.setItem(SITE_NOTICE_CACHE_KEY, JSON.stringify(siteNotice));
    } catch {
      // ignore quota errors; admin draft may still hold data while editing
    }
  }, [siteNotice]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('isAdmin', isAdmin);
    if (!isAdmin) clearGitHubTokenSession();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/admin')) return;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    const parsed = safeParseJson(raw);
    if (!parsed || typeof parsed !== 'object') return;
    if (Array.isArray(parsed.projects)) setProjects(ensureOrderFields(parsed.projects.map(normalizeProject)));
    if (Array.isArray(parsed.blogPosts)) setBlogPosts(ensureOrderFields(parsed.blogPosts.map(normalizeBlogPost)));
    if (parsed.aboutInfo && typeof parsed.aboutInfo === 'object') setAboutInfo(normalizeAboutInfo(parsed.aboutInfo));
    if (typeof parsed.language === 'string') setLanguage(parsed.language);
  }, [isAdmin]);
  const login = (password) => {
    if (password !== 'admin123') return false;
    setIsAdmin(true);
    return true;
  };

  const logout = () => {
    clearGitHubTokenSession();
    setIsAdmin(false);
  };

  const updateAboutInfo = (newInfo) => {
    setAboutInfo(normalizeAboutInfo(newInfo));
  };

  const updateSiteNotice = (notice) => {
    setSiteNotice((prev) => {
      const merged = { ...prev, ...notice };
      const contentChanged = (
        (notice.zh !== undefined && notice.zh !== prev.zh)
        || (notice.en !== undefined && notice.en !== prev.en)
      );
      return normalizeSiteNotice({
        ...merged,
        id: contentChanged ? Date.now() : merged.id,
      });
    });
  };

  const addProject = (project) => {
    const newProject = normalizeProject({ ...project, id: Date.now(), order: 0 });
    setProjects((prev) => ensureOrderFields([newProject, ...(Array.isArray(prev) ? prev : [])]));
  };

  const updateProject = (updatedProject) => {
    const next = normalizeProject(updatedProject);
    setProjects(prev => (Array.isArray(prev) ? prev.map(p => p.id === next.id ? next : p) : prev));
  };

  const deleteProject = (id) => {
    setProjects((prev) => ensureOrderFields((Array.isArray(prev) ? prev : []).filter((p) => p.id !== id)));
  };

  const reorderProjects = (fromIndex, toIndex) => {
    setProjects((prev) => reorderArray(sortByOrder(Array.isArray(prev) ? prev : []), fromIndex, toIndex));
  };

  const addBlogPost = (post) => {
    const newPost = normalizeBlogPost({ ...post, id: Date.now(), order: 0 });
    setBlogPosts((prev) => ensureOrderFields([newPost, ...(Array.isArray(prev) ? prev : [])]));
  };

  const updateBlogPost = (updatedPost) => {
    const next = normalizeBlogPost(updatedPost);
    clearBlogLocaleCache(next.id);
    setBlogPosts(prev => (Array.isArray(prev) ? prev.map(p => p.id === next.id ? next : p) : prev));
  };

  const deleteBlogPost = (id) => {
    setBlogPosts((prev) => ensureOrderFields((Array.isArray(prev) ? prev : []).filter((p) => p.id !== id)));
  };

  const reorderBlogPosts = (fromIndex, toIndex) => {
    setBlogPosts((prev) => reorderArray(sortByOrder(Array.isArray(prev) ? prev : []), fromIndex, toIndex));
  };

  const addComment = (postId, comment) => {
    setBlogPosts(posts => posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          comments: [...(post.comments || []), { ...comment, id: Date.now() }]
        };
      }
      return post;
    }));
  };

  const incrementLike = (postId) => {
    setBlogPosts(posts => posts.map(post => {
      if (post.id === postId) {
        return { ...post, likes: (post.likes || 0) + 1 };
      }
      return post;
    }));
  };

  const incrementShare = (postId) => {
    setBlogPosts(posts => posts.map(post => {
      if (post.id === postId) {
        return { ...post, shares: (post.shares || 0) + 1 };
      }
      return post;
    }));
  };

  const incrementView = (postId) => {
    setBlogPosts(posts => posts.map(post => {
      if (post.id === postId) {
        return { ...post, views: (post.views || 0) + 1 };
      }
      return post;
    }));
  };

  const pushVisit = useCallback(async (page, meta = {}) => {
    if (!page || !shouldTrackPath(page)) return;

    const dedupeKey = `${meta.eventType || 'pageview'}:${page}`;
    const now = Date.now();
    const lastAt = sessionStorage.getItem('analyticsLastAt');
    const lastKey = sessionStorage.getItem('analyticsLastKey');
    if (lastAt && lastKey === dedupeKey && now - parseInt(lastAt, 10) < 800) return;

    sessionStorage.setItem('analyticsLastAt', now.toString());
    sessionStorage.setItem('analyticsLastKey', dedupeKey);

    const visitData = await createVisitRecord(page, meta);
    queueVisitForSync(visitData);
    setAnalytics((prev) => mergeVisits([visitData, ...prev]).slice(0, 10000));
    scheduleAnalyticsSync();
  }, []);

  const recordVisit = useCallback((pathname) => {
    const page = resolveAnalyticsPath(pathname, { projects, blogPosts, language });
    void pushVisit(page, { eventType: 'pageview' });
  }, [projects, blogPosts, language, pushVisit]);

  const trackEvent = useCallback((payload) => {
    const page = payload?.page;
    if (!page) return;
    void pushVisit(page, {
      eventType: payload.eventType || 'click',
      action: payload.action || '',
      entityType: payload.entityType || '',
      entityId: payload.entityId,
      entityName: payload.entityName || '',
    });
  }, [pushVisit]);

  const applySiteDataPayload = useCallback((data) => {
    if (!data || typeof data !== 'object') return false;
    if (data.projects) {
      const arr = Array.isArray(data.projects) ? data.projects : [];
      setProjects(ensureOrderFields(arr.map(normalizeProject)));
    }
    if (data.blogPosts) {
      const arr = Array.isArray(data.blogPosts) ? data.blogPosts : [];
      setBlogPosts(ensureOrderFields(arr.map(normalizeBlogPost)));
    }
    if (data.aboutInfo) setAboutInfo(normalizeAboutInfo(data.aboutInfo));
    if (data.siteNotice) setSiteNotice(normalizeSiteNotice(data.siteNotice));
    if (data.language) setLanguage(data.language);
    return true;
  }, []);

  const applyRemoteIfNewer = useCallback((remote) => {
    if (!remote) return;
    const remoteAt = parseExportedAt(remote);
    if (remoteAt <= lastAppliedRemoteAtRef.current) return;
    applySiteDataPayload(remote);
    lastAppliedRemoteAtRef.current = remoteAt;
    if (isAdmin) {
      window.setTimeout(() => rebaselineAutoSyncRef.current(), 0);
    }
  }, [applySiteDataPayload, isAdmin]);

  const exportData = useCallback(() => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects,
      blogPosts,
      aboutInfo,
      siteNotice,
      language
    };
    return JSON.stringify(payload, null, 2);
  }, [projects, blogPosts, aboutInfo, siteNotice, language]);

  const buildDataSnapshot = useCallback(() => JSON.stringify({
    projects, blogPosts, aboutInfo, siteNotice, language,
  }), [projects, blogPosts, aboutInfo, siteNotice, language]);

  const rebaselineAutoSync = useCallback(() => {
    const snapshot = buildDataSnapshot();
    autoSyncBaselineRef.current = snapshot;
    markSiteDataSynced(snapshot);
  }, [buildDataSnapshot]);

  useEffect(() => {
    rebaselineAutoSyncRef.current = rebaselineAutoSync;
  }, [rebaselineAutoSync]);

  useEffect(() => {
    if (!isAdmin) {
      setAdminHydrationReady(false);
      adminEntrySnapshotRef.current = null;
      autoSyncBaselineRef.current = null;
      cancelScheduledSiteDataSync();
      setSiteDataSync({ status: 'idle', message: '', commitUrl: '', lastSyncedAt: '' });
      return undefined;
    }

    adminEntrySnapshotRef.current = buildDataSnapshot();
    setAdminHydrationReady(false);
    setSiteDataSync({ status: 'idle', message: '', commitUrl: '', lastSyncedAt: '' });
    const timer = window.setTimeout(() => {
      const current = buildDataSnapshot();
      const hadEditsDuringHydration = current !== adminEntrySnapshotRef.current;
      setAdminHydrationReady(true);
      if (hadEditsDuringHydration && isSiteDataSyncConfigured()) {
        scheduleSiteDataSync(exportData, current, setSiteDataSync);
      } else {
        rebaselineAutoSync();
      }
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [isAdmin, rebaselineAutoSync, buildDataSnapshot, exportData]);

  const applyPreparedSiteData = useCallback((preparedContent) => {
    if (!preparedContent) return;
    try {
      const parsed = JSON.parse(preparedContent);
      applySiteDataPayload(parsed);
    } catch {
      // ignore
    }
  }, [applySiteDataPayload]);

  const manualSyncSiteData = useCallback(async () => {
    const content = exportData();
    const snapshot = buildDataSnapshot();
    setSiteDataSync({ status: 'syncing', message: '正在同步到 GitHub…' });
    try {
      const res = await syncSiteDataToGitHub(content);
      if (!res.ok) {
        setSiteDataSync({ status: 'error', message: res.error || '同步失败。' });
        return res;
      }
      applyPreparedSiteData(res.preparedContent);
      let nextSnapshot = snapshot;
      if (res.preparedContent) {
        try {
          const parsed = JSON.parse(res.preparedContent);
          nextSnapshot = JSON.stringify({
            projects: parsed.projects,
            blogPosts: parsed.blogPosts,
            aboutInfo: parsed.aboutInfo,
            siteNotice: parsed.siteNotice,
            language: parsed.language,
          });
        } catch {
          nextSnapshot = snapshot;
        }
      }
      markSiteDataSynced(nextSnapshot);
      autoSyncBaselineRef.current = nextSnapshot;
      const imageHint = res.uploadedImages
        ? `（${res.uploadedImages} 张配图已上传至 public/uploads）`
        : '';
      setSiteDataSync({
        status: 'synced',
        message: `已同步，访客刷新后即可看到最新内容。${imageHint}`,
        commitUrl: res.commitUrl || '',
        lastSyncedAt: new Date().toISOString(),
      });
      return res;
    } catch {
      setSiteDataSync({ status: 'error', message: '同步失败，请检查网络。' });
      return { ok: false };
    }
  }, [exportData, buildDataSnapshot, applyPreparedSiteData]);

  useEffect(() => {
    if (!isAdmin) return;
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        projects,
        blogPosts,
        aboutInfo,
        siteNotice,
        language
      };
      localStorage.setItem(draftKey, JSON.stringify(payload, null, 2));
    } catch {
      // ignore
    }
  }, [isAdmin, projects, blogPosts, aboutInfo, siteNotice, language]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await fetchRemoteSiteData();
      if (cancelled || !remote) return;

      const bundledAt = parseExportedAt(siteData);
      const remoteAt = parseExportedAt(remote);
      if (remoteAt <= bundledAt) return;

      if (isAdmin) {
        const draft = safeParseJson(localStorage.getItem(draftKey));
        const draftAt = parseExportedAt(draft);
        if (draftAt >= remoteAt) return;
      }

      applyRemoteIfNewer(remote);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, applyRemoteIfNewer]);

  useEffect(() => {
    if (isAdmin) return undefined;

    const poll = () => {
      fetchRemoteSiteData().then(applyRemoteIfNewer);
    };
    poll();

    const intervalId = window.setInterval(poll, 90000);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAdmin, applyRemoteIfNewer]);

  useEffect(() => {
    if (!isAdmin || !adminHydrationReady) return undefined;

    const snapshot = buildDataSnapshot();
    if (autoSyncBaselineRef.current === null) {
      rebaselineAutoSync();
      return undefined;
    }
    if (autoSyncBaselineRef.current === snapshot) return undefined;

    scheduleSiteDataSync(exportData, snapshot, (status) => {
      setSiteDataSync(status);
      if (status.status === 'synced') {
        applyPreparedSiteData(status.preparedContent);
        try {
          const parsed = status.preparedContent ? JSON.parse(status.preparedContent) : null;
          autoSyncBaselineRef.current = parsed
            ? JSON.stringify({
              projects: parsed.projects,
              blogPosts: parsed.blogPosts,
              aboutInfo: parsed.aboutInfo,
              siteNotice: parsed.siteNotice,
              language: parsed.language,
            })
            : snapshot;
        } catch {
          autoSyncBaselineRef.current = snapshot;
        }
      }
    });
    return undefined;
  }, [isAdmin, adminHydrationReady, buildDataSnapshot, exportData, applyPreparedSiteData, rebaselineAutoSync]);

  const importData = (json) => {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      return applySiteDataPayload(data);
    } catch {
      return false;
    }
  };

  return (
    <DataContext.Provider value={{
      projects, addProject, updateProject, deleteProject, reorderProjects,
      blogPosts, addBlogPost, updateBlogPost, deleteBlogPost, reorderBlogPosts,
      addComment, incrementLike, incrementShare, incrementView,
      aboutInfo, updateAboutInfo,
      siteNotice, updateSiteNotice,
      isAdmin, login, logout,
      language, setLanguage,
      analytics, analyticsLoading, recordVisit, trackEvent, reloadAnalytics,
      exportData, importData, siteDataSync, manualSyncSiteData
    }}>
      {children}
    </DataContext.Provider>
  );
};
