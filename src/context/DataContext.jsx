import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../translations';
import siteData from '../site-data.json';

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
  const draftRaw = (localStorage.getItem('isAdmin') === 'true') ? localStorage.getItem(draftKey) : null;
  const draft = draftRaw ? safeParseJson(draftRaw) : null;

  const normalizeBlogPost = (post) => {
    const base = post && typeof post === 'object' ? post : {};
    const i18nRaw = base.i18n && typeof base.i18n === 'object' ? base.i18n : {};
    const i18nEn = i18nRaw.en && typeof i18nRaw.en === 'object' ? i18nRaw.en : {};
    const i18nZh = i18nRaw.zh && typeof i18nRaw.zh === 'object' ? i18nRaw.zh : {};

    const fallbackTitle = (base.title ?? '').toString();
    const fallbackDesc = (base.description ?? '').toString();
    const fallbackContent = (base.content ?? '').toString();

    const en = {
      title: (i18nEn.title ?? fallbackTitle).toString(),
      description: (i18nEn.description ?? fallbackDesc).toString(),
      content: (i18nEn.content ?? fallbackContent).toString(),
    };

    const zh = {
      title: (i18nZh.title ?? fallbackTitle).toString(),
      description: (i18nZh.description ?? fallbackDesc).toString(),
      content: (i18nZh.content ?? fallbackContent).toString(),
    };

    return {
      ...base,
      i18n: { en, zh },
      title: en.title,
      description: en.description,
      content: en.content,
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
    return Array.isArray(draft?.projects) ? draft.projects : initialProjects;
  });

  const [blogPosts, setBlogPosts] = useState(() => {
    const arr = Array.isArray(draft?.blogPosts) ? draft.blogPosts : initialBlogPosts;
    return Array.isArray(arr) ? arr.map(normalizeBlogPost) : initialBlogPosts.map(normalizeBlogPost);
  });

  const [aboutInfo, setAboutInfo] = useState(() => {
    const base = draft?.aboutInfo && typeof draft.aboutInfo === 'object' ? draft.aboutInfo : initialAboutInfo;
    return normalizeAboutInfo(base);
  });

  const [siteNotice, setSiteNotice] = useState(() => {
    const base = draft?.siteNotice && typeof draft.siteNotice === 'object' ? draft.siteNotice : initialSiteNotice;
    return normalizeSiteNotice(base);
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('isAdmin') === 'true';
  });

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || draft?.language || siteData?.language || 'en';
  });

  const [analytics, setAnalytics] = useState(() => {
    const saved = localStorage.getItem('analytics');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('analytics', JSON.stringify(analytics));
  }, [analytics]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('isAdmin', isAdmin);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    const parsed = safeParseJson(raw);
    if (!parsed || typeof parsed !== 'object') return;
    if (Array.isArray(parsed.projects)) setProjects(parsed.projects);
    if (Array.isArray(parsed.blogPosts)) setBlogPosts(parsed.blogPosts.map(normalizeBlogPost));
    if (parsed.aboutInfo && typeof parsed.aboutInfo === 'object') setAboutInfo(normalizeAboutInfo(parsed.aboutInfo));
    if (parsed.siteNotice && typeof parsed.siteNotice === 'object') setSiteNotice(normalizeSiteNotice(parsed.siteNotice));
    if (typeof parsed.language === 'string') setLanguage(parsed.language);
  }, [isAdmin]);
  const login = (password) => {
    if (password === 'admin123') {
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdmin(false);
  };

  const updateAboutInfo = (newInfo) => {
    setAboutInfo(normalizeAboutInfo(newInfo));
  };

  const updateSiteNotice = (notice) => {
    setSiteNotice(normalizeSiteNotice({ ...notice, id: Date.now() }));
  };

  const addProject = (project) => {
    const newProject = { ...project, id: Date.now() };
    setProjects(prev => [newProject, ...(Array.isArray(prev) ? prev : [])]);
  };

  const updateProject = (updatedProject) => {
    setProjects(prev => (Array.isArray(prev) ? prev.map(p => p.id === updatedProject.id ? updatedProject : p) : prev));
  };

  const deleteProject = (id) => {
    setProjects(prev => (Array.isArray(prev) ? prev.filter(p => p.id !== id) : prev));
  };

  const addBlogPost = (post) => {
    const newPost = normalizeBlogPost({ ...post, id: Date.now() });
    setBlogPosts(prev => [newPost, ...(Array.isArray(prev) ? prev : [])]);
  };

  const updateBlogPost = (updatedPost) => {
    const next = normalizeBlogPost(updatedPost);
    setBlogPosts(prev => (Array.isArray(prev) ? prev.map(p => p.id === next.id ? next : p) : prev));
  };

  const deleteBlogPost = (id) => {
    setBlogPosts(prev => (Array.isArray(prev) ? prev.filter(p => p.id !== id) : prev));
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

  const recordVisit = (page) => {
    // Basic rate limiting to prevent double recording in StrictMode or rapid navigation
    const now = Date.now();
    const lastVisit = sessionStorage.getItem('lastVisit');
    const lastPage = sessionStorage.getItem('lastPage');
    
    if (lastVisit && (now - parseInt(lastVisit) < 1000) && lastPage === page) return;
    
    sessionStorage.setItem('lastVisit', now.toString());
    sessionStorage.setItem('lastPage', page);

    const visitData = {
      id: now,
      timestamp: now,
      page: page,
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      referrer: document.referrer || 'Direct'
    };

    setAnalytics(prev => {
      const updated = [visitData, ...prev];
      // Keep only last 10000 records to prevent localStorage overflow
      return updated.slice(0, 10000);
    });
  };

  const exportData = () => {
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
  };

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

  const importData = (json) => {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      if (data.projects) setProjects(data.projects);
      if (data.blogPosts) {
        const arr = Array.isArray(data.blogPosts) ? data.blogPosts : [];
        setBlogPosts(arr.map(normalizeBlogPost));
      }
      if (data.aboutInfo) setAboutInfo(data.aboutInfo);
      if (data.siteNotice) setSiteNotice(data.siteNotice);
      if (data.language) setLanguage(data.language);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <DataContext.Provider value={{
      projects, addProject, updateProject, deleteProject,
      blogPosts, addBlogPost, updateBlogPost, deleteBlogPost,
      addComment, incrementLike, incrementShare, incrementView,
      aboutInfo, updateAboutInfo,
      siteNotice, updateSiteNotice,
      isAdmin, login, logout,
      language, setLanguage,
      analytics, recordVisit,
      exportData, importData
    }}>
      {children}
    </DataContext.Provider>
  );
};
