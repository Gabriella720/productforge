import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../translations';

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

const initialProjects = [
  {
    id: 1,
    title: "Neural Style Transfer Application",
    description: "A deep learning application that applies artistic styles to photographs using convolutional neural networks. Implemented with TensorFlow and optimized for real-time processing.",
    tags: ["Deep Learning", "TensorFlow", "Computer Vision", "Python"],
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800",
    codeUrl: "#",
    demoUrl: "#"
  },
  {
    id: 2,
    title: "Natural Language Processing Pipeline",
    description: "End-to-end NLP pipeline for sentiment analysis and text classification. Achieved 94% accuracy on multi-class classification tasks using transformer-based models.",
    tags: ["NLP", "BERT", "PyTorch", "Transformers"],
    image: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&q=80&w=800",
    codeUrl: "#"
  }
];

const initialBlogPosts = [
  {
    id: 1,
    title: "Understanding Transformer Architecture in Modern NLP",
    description: "A deep dive into the attention mechanism and how transformers revolutionized natural language processing tasks across various domains.",
    content: `The transformer architecture has fundamentally changed the landscape of natural language processing. Introduced in the seminal paper "Attention Is All You Need" by Vaswani et al., transformers have become the foundation for modern language models.

### The Attention Mechanism
At the heart of the transformer is the self-attention mechanism, which allows the model to weigh the importance of different words in a sentence when processing each word. Unlike recurrent neural networks (RNNs), transformers can process all words in parallel, significantly speeding up training.

### Key Components
The transformer consists of several key components:
- **Multi-Head Attention**: Allows the model to focus on different aspects of the input simultaneously
- **Position Encoding**: Provides information about word order since the model processes input in parallel
- **Feed-Forward Networks**: Process the attention outputs through dense layers
- **Layer Normalization**: Stabilizes training and improves convergence

### Impact on Modern NLP
Transformers have enabled the development of powerful models like BERT, GPT, and T5. These models have achieved state-of-the-art results across a wide range of NLP tasks, from question answering to text generation.
The scalability of transformers has also led to the era of large language models, with models containing billions of parameters demonstrating emergent capabilities in reasoning, coding, and creative tasks.

### Conclusion
Understanding transformer architecture is essential for anyone working in modern NLP. As the field continues to evolve, transformers remain the dominant paradigm, with ongoing research exploring ways to make them more efficient and capable.`,
    date: "March 15, 2026",
    views: 2453,
    likes: 187,
    shares: 42,
    image: "https://images.unsplash.com/photo-1620712943543-bcc4638d9980?auto=format&fit=crop&q=80&w=800",
    comments: [
      {
        id: 1,
        author: "Alex Chen",
        date: "Mar 16, 2026",
        content: "Great article! The explanation of multi-head attention was particularly clear. I've been implementing transformers in my research and this helped clarify some concepts.",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100"
      }
    ]
  },
  {
    id: 2,
    title: "Efficient Training Strategies for Large Language Models",
    description: "Exploring techniques like gradient accumulation, mixed precision training, and distributed computing for training state-of-the-art models.",
    content: "Training large language models (LLMs) requires immense computational resources. To make this process more efficient, researchers use several key strategies. Gradient accumulation allows for effectively larger batch sizes without increasing memory usage per step. Mixed precision training (using FP16 instead of FP32) speeds up computations and reduces memory footprint, while distributed data parallel (DDP) techniques allow training across hundreds or thousands of GPUs.",
    date: "Mar 10, 2026",
    views: 3127,
    likes: 245,
    shares: 68,
    image: "https://images.unsplash.com/photo-1591453089816-0fbb971b454c?auto=format&fit=crop&q=80&w=800",
    comments: []
  },
  {
    id: 3,
    title: "Computer Vision Trends in 2026",
    description: "Latest developments in object detection, image segmentation, and the convergence of vision and language models for multimodal understanding.",
    content: "In 2026, computer vision has moved beyond simple classification. Multimodal models that bridge vision and language are now the standard, enabling more natural interaction with visual data. Techniques like Vision Transformers (ViT) have largely superseded traditional CNNs for large-scale tasks, and real-time 3D reconstruction from single images has become a practical reality for mobile devices.",
    date: "Mar 5, 2026",
    views: 1896,
    likes: 156,
    shares: 35,
    image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&q=80&w=800",
    comments: []
  }
];

const initialAboutInfo = {
  name: "Yusheng Jia",
  role: "AI Researcher & Machine Learning Engineer specializing in deep learning, computer vision, and natural language processing.",
  tagline: "Product Manager, AI Builder, try to build an awesome Life",
  profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300",
  highlights: [
    { id: 1, value: "80+", label: "Products Served", valueFontSize: 40, labelFontSize: 14 },
    { id: 2, value: "3 Years", label: "Practical Experience", valueFontSize: 40, labelFontSize: 14 },
    { id: 3, value: "Significant", label: "Business Growth Results", valueFontSize: 36, labelFontSize: 14 }
  ],
  socials: {
    github: "#",
    wechat: "", // Store Base64 or URL of QR code
    email: "mailto:hello@example.com"
  }
};

const initialSiteNotice = {
  id: 1,
  enabled: true,
  zh: "网站正在更新中，部分内容尚未更新。",
  en: "The website is under updates. Some content may be incomplete."
};

export const DataProvider = ({ children }) => {
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
    const saved = localStorage.getItem('projects');
    return saved ? JSON.parse(saved) : initialProjects;
  });

  const [blogPosts, setBlogPosts] = useState(() => {
    const saved = localStorage.getItem('blogPosts');
    return saved ? JSON.parse(saved) : initialBlogPosts;
  });

  const [aboutInfo, setAboutInfo] = useState(() => {
    const saved = localStorage.getItem('aboutInfo');
    return normalizeAboutInfo(saved ? JSON.parse(saved) : initialAboutInfo);
  });

  const [siteNotice, setSiteNotice] = useState(() => {
    const saved = localStorage.getItem('siteNotice');
    return normalizeSiteNotice(saved ? JSON.parse(saved) : initialSiteNotice);
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('isAdmin') === 'true';
  });

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'en';
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
    localStorage.setItem('projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('blogPosts', JSON.stringify(blogPosts));
  }, [blogPosts]);

  useEffect(() => {
    localStorage.setItem('aboutInfo', JSON.stringify(normalizeAboutInfo(aboutInfo)));
  }, [aboutInfo]);

  useEffect(() => {
    localStorage.setItem('siteNotice', JSON.stringify(normalizeSiteNotice(siteNotice)));
  }, [siteNotice]);

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
    const newPost = { ...post, id: Date.now() };
    setBlogPosts([newPost, ...blogPosts]);
  };

  const updateBlogPost = (updatedPost) => {
    setBlogPosts(blogPosts.map(p => p.id === updatedPost.id ? updatedPost : p));
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
      if (data.blogPosts) setBlogPosts(data.blogPosts);
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
