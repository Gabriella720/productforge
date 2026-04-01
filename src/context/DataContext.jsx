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

  const [projects, setProjects] = useState(() => initialProjects);

  const [blogPosts, setBlogPosts] = useState(() => {
    return initialBlogPosts.map(normalizeBlogPost);
  });

  const [aboutInfo, setAboutInfo] = useState(() => {
    return normalizeAboutInfo(initialAboutInfo);
  });

  const [siteNotice, setSiteNotice] = useState(() => {
    return normalizeSiteNotice(initialSiteNotice);
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('isAdmin') === 'true';
  });

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || siteData?.language || 'en';
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
    setProjects([newProject, ...projects]);
  };

  const updateProject = (updatedProject) => {
    setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const deleteProject = (id) => {
    setProjects(projects.filter(p => p.id !== id));
  };

  const addBlogPost = (post) => {
    const newPost = normalizeBlogPost({ ...post, id: Date.now() });
    setBlogPosts([newPost, ...blogPosts]);
  };

  const updateBlogPost = (updatedPost) => {
    const next = normalizeBlogPost(updatedPost);
    setBlogPosts(blogPosts.map(p => p.id === next.id ? next : p));
  };

  const deleteBlogPost = (id) => {
    setBlogPosts(blogPosts.filter(p => p.id !== id));
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
