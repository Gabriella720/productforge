import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useData, useTranslation } from '../context/DataContext';
import { 
  Plus, Trash2, Edit2, Save, X, LogOut, Layout, 
  BookOpen, User, Upload, Download, Megaphone, Image as ImageIcon, ArrowLeft,
  ChevronLeft, Eye, BarChart3, TrendingUp, Users, MousePointer2, Clock, Globe, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';
import { isAnalyticsSyncConfigured, syncPendingVisits, getRecordVisitorLabel } from '../utils/analyticsApi';
import {
  embedImagesIntoMarkdown,
  isImageUploadFile,
  processMarkdownUpload,
  renderMarkdownToHtml,
  isMarkdownFormat,
} from '../utils/markdown';
import { applyBlogLocalePatch, buildBlogPublishPayload } from '../utils/blogEditor';
import BlogContent from '../components/BlogContent';
import SortableList from '../components/SortableList';
import { sortByOrder } from '../utils/sortOrder';

// TinyMCE self-hosted configuration
import 'tinymce/tinymce';
import 'tinymce/models/dom';
import 'tinymce/themes/silver/theme';
import 'tinymce/icons/default/icons';
import 'tinymce/plugins/advlist';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/link';
import 'tinymce/plugins/image';
import 'tinymce/plugins/charmap';
import 'tinymce/plugins/preview';
import 'tinymce/plugins/anchor';
import 'tinymce/plugins/searchreplace';
import 'tinymce/plugins/visualblocks';
import 'tinymce/plugins/code';
import 'tinymce/plugins/fullscreen';
import 'tinymce/plugins/insertdatetime';
import 'tinymce/plugins/media';
import 'tinymce/plugins/table';
import 'tinymce/plugins/help';
import 'tinymce/plugins/wordcount';
import 'tinymce/plugins/emoticons';
import 'tinymce/plugins/visualchars';

// Import CSS
import 'tinymce/skins/ui/oxide/skin.min.css';
import 'tinymce/skins/ui/oxide/content.min.css';
import 'tinymce/skins/content/default/content.min.css';

const base64EncodeUtf8 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const publishJsonToRepo = async ({ token, owner, repo, branch, path, content }) => {
  const b = (branch || 'main').toString();
  const p = (path || 'src/site-data.json').toString();
  const apiPath = p.split('/').map(encodeURIComponent).join('/');
  const repoUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const getUrl = `${repoUrl}/contents/${apiPath}?ref=${encodeURIComponent(b)}`;

  let sha;
  const getRes = await fetch(getUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing?.sha;
  }

  const putUrl = `${repoUrl}/contents/${apiPath}`;
  const putBody = {
    message: `Update site data (${new Date().toISOString()})`,
    content: base64EncodeUtf8(content),
    branch: b
  };
  if (sha) putBody.sha = sha;

  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(putBody)
  });
  if (!putRes.ok) {
    const text = await putRes.text();
    return { ok: false, error: `${putRes.status} ${text}` };
  }

  const result = await putRes.json();
  return { ok: true, commitUrl: result?.commit?.html_url || '' };
};

const Admin = () => {
  const { 
    projects, addProject, updateProject, deleteProject, reorderProjects,
    blogPosts, addBlogPost, updateBlogPost, deleteBlogPost, reorderBlogPosts,
    aboutInfo, updateAboutInfo,
    siteNotice, updateSiteNotice,
    analytics,
    analyticsLoading,
    reloadAnalytics,
    exportData,
    logout 
  } = useData();
  const t = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('projects');
  const [publishState, setPublishState] = useState('idle');
  const [publishInfo, setPublishInfo] = useState('');
  const initialSnapshotRef = useRef(null);
  const lastPublishedSnapshotRef = useRef(null);
  const publishTimerRef = useRef(null);
  
  // State for single-post editing view
  const [blogView, setBlogView] = useState('list'); // 'list' or 'edit'
  const [editingPost, setEditingPost] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const tabs = [
    { id: 'projects', label: t('admin.manageProjects'), icon: <Layout className="w-4 h-4 mr-2" /> },
    { id: 'blog', label: t('admin.manageBlog'), icon: <BookOpen className="w-4 h-4 mr-2" /> },
    { id: 'about', label: t('admin.manageAbout'), icon: <User className="w-4 h-4 mr-2" /> },
    { id: 'notice', label: 'Notice', icon: <Megaphone className="w-4 h-4 mr-2" /> },
    { id: 'analytics', label: t('admin.analytics'), icon: <BarChart3 className="w-4 h-4 mr-2" /> },
    { id: 'backup', label: 'Data Backup', icon: <Download className="w-4 h-4 mr-2" /> },
  ];

  const startEditBlog = (post) => {
    setEditingPost(post);
    setBlogView('edit');
  };

  const startAddBlog = () => {
    setEditingPost({ 
      i18n: {
        en: { title: '', description: '', content: '', contentFormat: 'html' },
        zh: { title: '', description: '', content: '', contentFormat: 'html' }
      },
      tag: '', 
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), 
      readTime: '', 
      image: '',
      views: 0,
      likes: 0,
      shares: 0,
      comments: []
    });
    setBlogView('edit');
  };

  useEffect(() => {
    const ownerSaved = (localStorage.getItem('ghOwner') || '').trim();
    const repoSaved = (localStorage.getItem('ghRepo') || '').trim();
    if (ownerSaved && repoSaved) return;
    try {
      const host = window.location.host;
      const path = window.location.pathname || '/';
      if (!host.endsWith('github.io')) return;
      const owner = host.replace(/\.github\.io$/, '');
      const repo = path.split('/').filter(Boolean)[0] || '';
      if (!ownerSaved && owner) localStorage.setItem('ghOwner', owner);
      if (!repoSaved && repo) localStorage.setItem('ghRepo', repo);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (initialSnapshotRef.current) return;
    try {
      initialSnapshotRef.current = JSON.stringify({ projects, blogPosts, aboutInfo, siteNotice, language: localStorage.getItem('language') || 'en' });
    } catch {
      initialSnapshotRef.current = '';
    }
  }, [projects, blogPosts, aboutInfo, siteNotice]);

  useEffect(() => {
    if (!exportData) return;
    const token = (sessionStorage.getItem('ghToken') || '').trim();
    const owner = (localStorage.getItem('ghOwner') || '').trim();
    const repo = (localStorage.getItem('ghRepo') || '').trim();
    const branch = (localStorage.getItem('ghBranch') || 'main').trim();
    const path = (localStorage.getItem('ghPath') || 'src/site-data.json').trim();

    let snapshot = '';
    try {
      snapshot = JSON.stringify({ projects, blogPosts, aboutInfo, siteNotice, language: localStorage.getItem('language') || 'en' });
    } catch {
      snapshot = '';
    }

    if (initialSnapshotRef.current === snapshot) return;
    if (lastPublishedSnapshotRef.current === snapshot) return;

    if (!token || !owner || !repo) {
      setPublishState('error');
      setPublishInfo('Missing GitHub token or repo info. Set it in Data Backup.');
      return;
    }

    if (publishTimerRef.current) window.clearTimeout(publishTimerRef.current);
    publishTimerRef.current = window.setTimeout(async () => {
      setPublishState('publishing');
      setPublishInfo('');
      try {
        const content = exportData();
        const res = await publishJsonToRepo({ token, owner, repo, branch, path, content });
        if (!res.ok) {
          setPublishState('error');
          setPublishInfo(res.error || 'publish_failed');
          return;
        }
        lastPublishedSnapshotRef.current = snapshot;
        setPublishState('published');
        setPublishInfo(res.commitUrl || '');
      } catch {
        setPublishState('error');
        setPublishInfo('publish_failed');
      }
    }, 1200);

    return () => {
      if (publishTimerRef.current) window.clearTimeout(publishTimerRef.current);
    };
  }, [projects, blogPosts, aboutInfo, siteNotice, exportData]);

  return (
    <div className="max-w-6xl mx-auto px-4 pt-12 pb-24">
      <style>{`
        /* Remove TinyMCE warning */
        .tox-notifications-container { display: none !important; }
        .tox-statusbar__branding { display: none !important; }
      `}</style>
      {blogView === 'list' ? (
        <>
          <div className="flex items-center justify-between mb-12">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-text-main">{t('admin.dashboard')}</h1>
              {publishState !== 'idle' && (
                <div className="text-xs text-text-muted font-semibold">
                  {publishState === 'publishing' && 'Publishing to GitHub...'}
                  {publishState === 'published' && (publishInfo ? `Published: ${publishInfo}` : 'Published to GitHub')}
                  {publishState === 'error' && `Publish failed: ${publishInfo || ''}`}
                </div>
              )}
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center text-text-muted hover:text-red-500 transition-colors font-medium"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('admin.logout')}
            </button>
          </div>

          <div className="flex space-x-1 bg-white p-1 rounded-xl border border-border-soft mb-12 shadow-sm w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-brand text-white shadow-md'
                    : 'text-text-muted hover:text-brand hover:bg-brand/5'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[2rem] border border-border-soft p-8 shadow-sm">
            {activeTab === 'projects' && (
              <ProjectManager 
                projects={projects} 
                onAdd={addProject} 
                onUpdate={updateProject} 
                onDelete={deleteProject}
                onReorder={reorderProjects}
              />
            )}
            {activeTab === 'blog' && (
              <BlogList 
                posts={blogPosts} 
                onStartEdit={startEditBlog}
                onStartAdd={startAddBlog}
                onDelete={deleteBlogPost}
                onReorder={reorderBlogPosts}
              />
            )}
            {activeTab === 'about' && (
              <AboutManager 
                info={aboutInfo} 
                onUpdate={updateAboutInfo} 
              />
            )}
            {activeTab === 'notice' && (
              <NoticeManager notice={siteNotice} onUpdate={updateSiteNotice} />
            )}
            {activeTab === 'analytics' && (
              <AnalyticsDashboard
                analytics={analytics}
                loading={analyticsLoading}
                onRefresh={reloadAnalytics}
              />
            )}
            {activeTab === 'backup' && (
              <DataBackup />
            )}
          </div>
        </>
      ) : (
        <BlogEditor 
          post={editingPost} 
          onSave={(data) => {
            if (editingPost.id) {
              updateBlogPost(data);
            } else {
              addBlogPost(data);
            }
            setBlogView('list');
          }} 
          onCancel={() => setBlogView('list')} 
        />
      )}
    </div>
  );
};

const RANGE_OPTIONS = [
  { id: '1d', labelKey: 'range1d', ms: 24 * 60 * 60 * 1000, bucket: 'hour' },
  { id: '7d', labelKey: 'range7d', ms: 7 * 24 * 60 * 60 * 1000, bucket: 'day' },
  { id: '30d', labelKey: 'range30d', ms: 30 * 24 * 60 * 60 * 1000, bucket: 'day' },
  { id: '90d', labelKey: 'range90d', ms: 90 * 24 * 60 * 60 * 1000, bucket: 'day' },
];

const pad2 = (n) => String(n).padStart(2, '0');

const toLocalDateKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const toLocalHourKey = (ts) => {
  const d = new Date(ts);
  return `${toLocalDateKey(ts)} ${pad2(d.getHours())}:00`;
};

const buildTrendBuckets = (rangeId, now, records) => {
  const config = RANGE_OPTIONS.find((r) => r.id === rangeId) || RANGE_OPTIONS[1];
  const cutoff = now - config.ms;
  const filtered = records.filter((r) => Number(r.timestamp) > cutoff);

  if (config.bucket === 'hour') {
    const buckets = {};
    for (let i = 23; i >= 0; i--) {
      const key = toLocalHourKey(now - i * 60 * 60 * 1000);
      buckets[key] = 0;
    }
    filtered.forEach((record) => {
      const key = toLocalHourKey(record.timestamp);
      if (buckets[key] !== undefined) buckets[key]++;
    });
    return { data: Object.entries(buckets).map(([date, count]) => ({ date, count })), subtitle: 'last24h' };
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round(config.ms / dayMs);
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    buckets[toLocalDateKey(now - i * dayMs)] = 0;
  }
  filtered.forEach((record) => {
    const key = toLocalDateKey(record.timestamp);
    if (buckets[key] !== undefined) buckets[key]++;
  });
  return {
    data: Object.entries(buckets).map(([date, count]) => ({ date, count })),
    subtitle: `last${days}d`,
  };
};

const CHART_HEIGHT = 256;

const VisitorTrendChart = ({ data, maxCount, formatLabel, viewsLabel }) => {
  const [hoverIndex, setHoverIndex] = useState(null);
  const width = 1000;
  const height = 280;
  const padX = 24;
  const padY = 24;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const n = data.length;

  if (!n) {
    return <p className="text-sm text-text-muted text-center py-16">—</p>;
  }

  const points = data.map((d, i) => {
    const x = padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const ratio = maxCount > 0 ? d.count / maxCount : 0;
    const y = padY + innerH - ratio * innerH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[n - 1].x} ${padY + innerH} L ${points[0].x} ${padY + innerH} Z`;

  return (
    <div className="relative" style={{ height: CHART_HEIGHT }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Visitor trend chart"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padY + innerH * (1 - tick);
          return (
            <line
              key={tick}
              x1={padX}
              y1={y}
              x2={width - padX}
              y2={y}
              stroke="currentColor"
              className="text-border-soft"
              strokeWidth="1"
              strokeDasharray="4 6"
              opacity="0.35"
            />
          );
        })}
        <path d={areaPath} className="fill-brand/15" />
        <path
          d={linePath}
          fill="none"
          className="stroke-brand"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 7 : 4}
              className="fill-brand stroke-white stroke-[2px] cursor-pointer"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          </g>
        ))}
      </svg>
      {hoverIndex != null && points[hoverIndex] && (
        <div
          className="absolute pointer-events-none bg-text-main text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-10"
          style={{
            left: `${(points[hoverIndex].x / width) * 100}%`,
            top: `${(points[hoverIndex].y / height) * 100}%`,
            transform: 'translate(-50%, -120%)',
          }}
        >
          {points[hoverIndex].count} {viewsLabel} ({points[hoverIndex].date})
        </div>
      )}
      <div className="flex justify-between mt-2 px-1">
        <span className="text-[10px] text-text-muted font-bold">{formatLabel(data[0]?.date || '')}</span>
        <span className="text-[10px] text-text-muted font-bold">{formatLabel(data[data.length - 1]?.date || '')}</span>
      </div>
    </div>
  );
};

const formatLogLocation = (record) => {
  if (!record) return '';
  const loc = (record.location || '').trim();
  if (loc) return loc;
  return [record.city, record.region, record.country].filter(Boolean).join(', ');
};

const LogReferrerCell = ({ referrer }) => {
  const value = (referrer || '').trim() || 'Direct';
  if (value === 'Direct') {
    return (
      <td className="px-6 py-4 text-text-muted italic whitespace-nowrap align-top">
        Direct
      </td>
    );
  }
  return (
    <td className="px-6 py-4 align-top min-w-[200px] max-w-[360px]">
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        title={value}
        className="text-brand text-xs hover:underline break-all whitespace-normal leading-relaxed"
      >
        {value}
      </a>
    </td>
  );
};

const LogLocationCell = ({ record }) => {
  const text = formatLogLocation(record);
  if (!text) {
    return <td className="px-6 py-4 text-text-muted whitespace-nowrap">—</td>;
  }
  return (
    <td className="px-6 py-4 text-text-muted align-top min-w-[120px] max-w-[220px]">
      <span title={text} className="break-words whitespace-normal text-xs leading-relaxed">
        {text}
      </span>
    </td>
  );
};

const AnalyticsDashboard = ({ analytics, loading, onRefresh }) => {
  const t = useTranslation();
  const [range, setRange] = useState('7d');
  const [now, setNow] = useState(() => Date.now());
  const [syncState, setSyncState] = useState('idle');
  const [syncMessage, setSyncMessage] = useState('');

  const rangeConfig = RANGE_OPTIONS.find((r) => r.id === range) || RANGE_OPTIONS[1];
  const syncConfigured = isAnalyticsSyncConfigured();

  useEffect(() => {
    setNow(Date.now());
    onRefresh?.();
  }, []);

  useEffect(() => {
    setNow(Date.now());
  }, [range, analytics.length]);

  const filteredRecords = useMemo(() => {
    const cutoff = now - rangeConfig.ms;
    return analytics
      .filter((r) => r.timestamp > cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [analytics, now, rangeConfig.ms]);

  const { data: trendData, subtitle: trendSubtitle } = useMemo(
    () => buildTrendBuckets(range, now, analytics),
    [range, now, analytics]
  );

  const totalViews = filteredRecords.length;
  const newViews = useMemo(
    () => analytics.filter((r) => r.timestamp > now - 24 * 60 * 60 * 1000).length,
    [analytics, now]
  );
  const uniqueUsers = useMemo(
    () => new Set(filteredRecords.map((r) => r.visitorId || r.ip || `${r.userAgent}|${r.screenSize}`)).size,
    [filteredRecords]
  );

  const maxCount = Math.max(...trendData.map((d) => d.count), 1);

  const handleSync = async () => {
    setSyncState('syncing');
    setSyncMessage('');
    const result = await syncPendingVisits();
    await onRefresh?.();
    if (result.ok) {
      setSyncState('done');
      setSyncMessage(t('admin.analyticsSyncOk'));
    } else {
      setSyncState('error');
      setSyncMessage(
        result.reason === 'no_token'
          ? t('admin.analyticsSyncNoToken')
          : t('admin.analyticsSyncFail')
      );
    }
  };

  const formatTrendLabel = (label) => {
    if (range === '1d' && label.includes(' ')) return label.split(' ')[1] || label;
    return label.slice(5);
  };

  const trendSubtitleText =
    trendSubtitle === 'last24h' ? t('admin.analyticsLast24h') : t(`admin.analytics${trendSubtitle}`);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center px-2 flex-wrap">
        <h2 className="text-xl font-bold text-text-main">{t('admin.analyticsTitle')}</h2>
        <div className="flex bg-bg-main p-1 rounded-xl border border-border-soft">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                range === r.id ? 'bg-white text-brand shadow-sm' : 'text-text-muted hover:text-brand'
              }`}
            >
              {t(`admin.${r.labelKey}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onRefresh?.()}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border-soft text-text-muted hover:text-brand disabled:opacity-50"
        >
          {loading ? t('admin.analyticsRefreshing') : t('admin.analyticsRefresh')}
        </button>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncState === 'syncing'}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand text-white hover:opacity-90 disabled:opacity-50"
        >
          {syncState === 'syncing' ? t('admin.analyticsSyncing') : t('admin.analyticsSync')}
        </button>
      </div>

      {!syncConfigured && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mx-2">
          {t('admin.analyticsSyncHint')}
        </p>
      )}
      {syncMessage && (
        <p className={`text-sm px-4 py-2 mx-2 rounded-xl ${syncState === 'error' ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50'}`}>
          {syncMessage}
        </p>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard icon={<Eye className="w-5 h-5" />} label={t('admin.analyticsTotalViews')} value={loading ? '…' : totalViews} color="blue" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label={t('admin.analyticsNew24h')} value={loading ? '…' : newViews} color="green" />
        <StatCard icon={<Users className="w-5 h-5" />} label={t('admin.analyticsUnique')} value={loading ? '…' : uniqueUsers} color="purple" />
        <StatCard icon={<MousePointer2 className="w-5 h-5" />} label={t('admin.analyticsInRange')} value={loading ? '…' : filteredRecords.length} color="orange" />
      </div>

      {/* Simple Trend Chart */}
      <div className="bg-bg-main/30 border border-border-soft rounded-3xl p-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-bold text-text-main flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-brand" />
            {t('admin.analyticsTrend')}
          </h3>
          <span className="text-xs text-text-muted font-medium">{trendSubtitleText}</span>
        </div>
        
        {trendData.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-16">{t('admin.analyticsNoData')}</p>
        ) : (
          <VisitorTrendChart
            data={trendData}
            maxCount={maxCount}
            formatLabel={formatTrendLabel}
            viewsLabel={t('admin.analyticsViews')}
          />
        )}      </div>

      {/* Recent Activity Table */}
      <div className="bg-white border border-border-soft rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border-soft flex items-center justify-between">
          <h3 className="font-bold text-text-main flex items-center">
            <Clock className="w-5 h-5 mr-2 text-brand" />
            {t('admin.analyticsLogs')} ({filteredRecords.length})
          </h3>
        </div>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-bg-main/50 text-[10px] uppercase tracking-widest text-text-muted font-bold sticky top-0">
              <tr>
                <th className="px-6 py-4">{t('admin.analyticsColTime')}</th>
                <th className="px-6 py-4">{t('admin.analyticsColVisitor')}</th>
                <th className="px-6 py-4">{t('admin.analyticsColIp')}</th>
                <th className="px-6 py-4">{t('admin.analyticsColLocation')}</th>
                <th className="px-6 py-4">{t('admin.analyticsColDevice')}</th>
                <th className="px-6 py-4">{t('admin.analyticsColPage')}</th>
                <th className="px-6 py-4">{t('admin.analyticsColReferrer')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft text-sm">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-text-muted">
                    {t('admin.analyticsNoData')}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-bg-main/30 transition-colors">
                  <td className="px-6 py-4 text-text-muted whitespace-nowrap">{new Date(record.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4 text-text-main font-medium whitespace-nowrap">
                    {getRecordVisitorLabel(record)}
                    {record.visitorId && (
                      <span className="block text-[10px] text-text-muted font-normal mt-0.5">{record.visitorId}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-text-main whitespace-nowrap font-mono text-xs">
                    {record.ip || '—'}
                  </td>
                  <LogLocationCell record={record} />
                  <td className="px-6 py-4 text-text-main text-xs whitespace-nowrap">
                    {[record.browser, record.os, record.device].filter(Boolean).join(' · ') || record.platform || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-brand break-all">{record.page}</div>
                    {record.entityName && (
                      <div className="text-xs text-text-muted mt-0.5 max-w-[200px] truncate">{record.entityName}</div>
                    )}
                    {record.eventType === 'click' && record.action && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-bold uppercase">
                        {t(`admin.analyticsAction_${record.action}`) || record.action}
                      </span>
                    )}
                  </td>
                  <LogReferrerCell referrer={record.referrer} />
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100"
  };
  return (
    <div className={`p-6 border rounded-3xl ${colors[color]} shadow-sm`}>
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-white/80 rounded-2xl shadow-sm">{icon}</div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">{label}</p>
          <p className="text-2xl font-black">{value}</p>
        </div>
      </div>
    </div>
  );
};

const DataBackup = () => {
  const { exportData, importData } = useData();
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [ghToken, setGhToken] = useState(() => sessionStorage.getItem('ghToken') || '');
  const [ghOwner, setGhOwner] = useState(() => localStorage.getItem('ghOwner') || '');
  const [ghRepo, setGhRepo] = useState(() => localStorage.getItem('ghRepo') || '');
  const [ghBranch, setGhBranch] = useState(() => localStorage.getItem('ghBranch') || 'main');
  const [ghPath, setGhPath] = useState(() => localStorage.getItem('ghPath') || 'src/site-data.json');

  useEffect(() => {
    if (ghOwner && ghRepo) return;
    try {
      const host = window.location.host;
      const path = window.location.pathname || '/';
      if (host.endsWith('github.io')) {
        const owner = host.replace(/\.github\.io$/, '');
        const repo = path.split('/').filter(Boolean)[0] || '';
        if (!ghOwner) setGhOwner(owner);
        if (!ghRepo) setGhRepo(repo);
      }
    } catch {
      // ignore
    }
  }, [ghOwner, ghRepo]);

  useEffect(() => {
    if (ghOwner) localStorage.setItem('ghOwner', ghOwner);
  }, [ghOwner]);

  useEffect(() => {
    if (ghRepo) localStorage.setItem('ghRepo', ghRepo);
  }, [ghRepo]);

  useEffect(() => {
    if (ghBranch) localStorage.setItem('ghBranch', ghBranch);
  }, [ghBranch]);

  useEffect(() => {
    if (ghPath) localStorage.setItem('ghPath', ghPath);
  }, [ghPath]);

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productforge-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Exported current data as JSON file.');
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importData(reader.result);
      setMessage(ok ? 'Import successful. Data updated locally.' : 'Import failed. Invalid JSON.');
    };
    reader.readAsText(file);
  };

  const publishToGitHub = async () => {
    const token = (ghToken || '').trim();
    const owner = (ghOwner || '').trim();
    const repo = (ghRepo || '').trim();
    const branch = (ghBranch || '').trim() || 'main';
    const path = (ghPath || '').trim() || 'src/site-data.json';

    if (!token) {
      setMessage('Missing GitHub token.');
      return;
    }
    if (!owner || !repo) {
      setMessage('Missing owner/repo.');
      return;
    }

    sessionStorage.setItem('ghToken', token);
    setIsPublishing(true);
    setMessage('');

    try {
      const content = exportData();
      const res = await publishJsonToRepo({ token, owner, repo, branch, path, content });
      if (!res.ok) {
        setMessage(`Publish failed: ${res.error || ''}`.slice(0, 220));
        return;
      }
      setMessage(res.commitUrl ? `Published. Commit: ${res.commitUrl}` : 'Published to GitHub successfully.');
    } catch {
      setMessage('Publish failed due to network or permission error.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-main">Data Backup & Restore</h2>
      </div>
      <div className="bg-bg-main/50 p-8 rounded-[2rem] border border-border-soft space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleExport}
            className="px-6 py-3 bg-brand text-white rounded-xl font-semibold hover:bg-brand-hover transition-all"
          >
            Export JSON
          </button>
          <input
            type="file"
            accept="application/json"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 border border-brand text-brand rounded-xl font-semibold hover:bg-brand/5 transition-all"
          >
            Import JSON
          </button>
        </div>
        <p className="text-sm text-text-muted">
          Export 会下载当前浏览器本地的数据（项目、博客、关于我、语言）。Import 会覆盖当前浏览器的对应数据。
          图片建议使用公共 URL 或将文件放入仓库的 public/uploads 并使用 /productforge/uploads/文件名 的路径。
        </p>
        <div className="bg-white p-6 rounded-2xl border border-border-soft space-y-4">
          <div className="text-sm font-bold uppercase tracking-widest text-text-muted">Publish To GitHub</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-text-main mb-2">Owner</label>
              <input
                value={ghOwner}
                onChange={e => setGhOwner(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-border-soft rounded-xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all text-text-main"
                placeholder="gabriella720"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-main mb-2">Repo</label>
              <input
                value={ghRepo}
                onChange={e => setGhRepo(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-border-soft rounded-xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all text-text-main"
                placeholder="productforge"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-main mb-2">Branch</label>
              <input
                value={ghBranch}
                onChange={e => setGhBranch(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-border-soft rounded-xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all text-text-main"
                placeholder="main"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-main mb-2">File Path</label>
              <input
                value={ghPath}
                onChange={e => setGhPath(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-border-soft rounded-xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all text-text-main"
                placeholder="src/site-data.json"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-main mb-2">GitHub Token</label>
            <input
              value={ghToken}
              onChange={e => setGhToken(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-border-soft rounded-xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all text-text-main"
              placeholder="ghp_... or github_pat_..."
            />
            <div className="mt-2 text-[11px] text-text-muted font-medium">
              Token 仅保存在当前浏览器会话（sessionStorage），建议使用 Fine-grained token，仅授予该仓库 Contents: Read and write。
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={publishToGitHub}
              disabled={isPublishing}
              className="px-6 py-3 bg-brand text-white rounded-xl font-semibold hover:bg-brand-hover transition-all disabled:opacity-60"
            >
              {isPublishing ? 'Publishing...' : 'Publish JSON to Repo'}
            </button>
          </div>
        </div>
        {message && <div className="text-sm font-semibold text-brand">{message}</div>}
      </div>
    </div>
  );
};

const ImageUpload = ({ label, hint, value, onChange }) => {
  const fileInputRef = useRef(null);
  const [textValue, setTextValue] = useState(value || '');

  useEffect(() => {
    setTextValue(value || '');
  }, [value]);

  const normalizeUrl = (raw) => {
    const v = (raw || '').trim();
    if (!v) return '';
    if (v.startsWith('data:') || v.startsWith('blob:') || v.startsWith('http://') || v.startsWith('https://')) return v;
    const base = import.meta.env.BASE_URL || '/';
    let p = v.replace(/^\/?public\//, '');
    if (p.startsWith(base)) return p;
    p = p.replace(/^\/+/, '');
    if (base.endsWith('/')) return `${base}${p}`;
    return `${base}/${p}`;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTextValue(reader.result);
        onChange(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-text-main mb-1">{label}</label>
      {hint && <p className="text-xs text-text-muted mb-2">{hint}</p>}
      <div className="flex items-start space-x-4">
        <div className="flex-grow">
          <input 
            type="text"
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onBlur={() => {
              const next = normalizeUrl(textValue);
              setTextValue(next);
              onChange(next);
            }}
            className="w-full px-4 py-2 bg-white border border-border-soft rounded-xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all mb-3 text-text-main"
            placeholder="Image URL (https://...) or /productforge/uploads/filename.png"
          />
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current.click()}
            className="flex items-center px-4 py-2 border border-brand text-brand rounded-xl text-sm font-semibold hover:bg-brand/5 transition-all"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Local Image
          </button>
          <p className="mt-2 text-[10px] text-text-muted font-medium">
            Tip: For GitHub Pages, put images in <code className="bg-bg-main px-1 rounded">public/uploads/</code> and use <code className="bg-bg-main px-1 rounded">/productforge/uploads/filename.png</code> (do not include <code className="bg-bg-main px-1 rounded">public/</code>)
          </p>
        </div>
        {textValue && (
          <div className="w-24 h-24 border border-border-soft rounded-xl overflow-hidden flex-shrink-0 bg-bg-main shadow-sm">
            <img src={normalizeUrl(textValue)} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
};

const ProjectManager = ({ projects, onAdd, onUpdate, onDelete, onReorder }) => {
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const t = useTranslation();

  const normalizeExternalUrl = (raw) => {
    const v = (raw || '').trim();
    if (!v || v === '#') return '';
    const unhash = v.replace(/^#+/, '');
    if (!unhash) return '';
    if (/^https?:\/\//i.test(unhash)) return unhash;
    if (/^(mailto:|tel:)/i.test(unhash)) return unhash;
    if (unhash.startsWith('/')) return unhash;
    if (/^www\./i.test(unhash)) return `https://${unhash}`;
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(unhash)) return `https://${unhash}`;
    return unhash;
  };

  const startEdit = (project) => {
    setEditingId(project.id);
    setFormData({ ...project, tags: project.tags.join(', ') });
    setIsAdding(false);
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({ title: '', description: '', tags: '', image: '', codeUrl: '', demoUrl: '' });
  };

  const handleSave = () => {
    const projectData = {
      ...formData,
      demoUrl: normalizeExternalUrl(formData.demoUrl),
      codeUrl: normalizeExternalUrl(formData.codeUrl),
      tags: typeof formData.tags === 'string' ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : formData.tags
    };

    if (isAdding) {
      onAdd(projectData);
      setIsAdding(false);
    } else {
      onUpdate(projectData);
      setEditingId(null);
    }
  };

  const sortedProjects = useMemo(() => sortByOrder(projects), [projects]);
  const isReorderingDisabled = editingId !== null || isAdding;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-xl font-bold text-text-main">{t('admin.manageProjects')}</h2>
          <p className="text-sm text-text-muted mt-1">{t('admin.dragToReorder')}</p>
        </div>
        <button 
          onClick={startAdd}
          className="flex items-center px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-hover transition-all shadow-md hover:shadow-brand/20 active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('admin.addProject')}
        </button>
      </div>

      <SortableList
        items={sortedProjects}
        onReorder={onReorder}
        disabled={isReorderingDisabled}
        className="space-y-4"
        itemClassName="border border-border-soft rounded-2xl p-6 hover:border-brand/30 transition-colors bg-bg-main/50"
        renderItem={(project) => (
          <>
            {editingId === project.id ? (
              <div className="space-y-4">
                <Input label="Title" value={formData.title} onChange={v => setFormData({...formData, title: v})} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Demo URL" value={formData.demoUrl} onChange={v => setFormData({...formData, demoUrl: v})} />
                  <Input label="Code URL" value={formData.codeUrl} onChange={v => setFormData({...formData, codeUrl: v})} />
                </div>
                <Input label="Tags (comma separated)" value={formData.tags} onChange={v => setFormData({...formData, tags: v})} />
                <ImageUpload label="Project Image" value={formData.image} onChange={v => setFormData({...formData, image: v})} />
                <div>
                  <label className="block text-sm font-semibold text-text-main mb-2">Description</label>
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-2 bg-white border border-border-soft rounded-xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none h-24 transition-all"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 text-text-muted hover:text-text-main font-medium">Cancel</button>
                  <button onClick={handleSave} className="px-6 py-2 bg-brand text-white rounded-lg font-semibold hover:bg-brand-hover transition-all">Save</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-4">
                    <img src={project.image} alt="" className="w-16 h-16 rounded-xl object-cover shadow-sm ring-1 ring-border-soft" />
                    <div>
                      <h3 className="font-bold text-text-main text-lg">{project.title}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {project.tags.map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 bg-brand/10 text-brand rounded-full font-bold uppercase tracking-wider">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => startEdit(project)} className="p-2 text-text-muted hover:text-brand hover:bg-brand/5 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(project.id)} className="p-2 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <p className="text-text-muted text-sm line-clamp-2 mb-4">{project.description}</p>
              </div>
            )}
          </>
        )}
      />

        {isAdding && (
          <div className="border-2 border-dashed border-brand/30 rounded-2xl p-6 bg-brand/5">
            <div className="space-y-4">
              <Input label="Title" value={formData.title} onChange={v => setFormData({...formData, title: v})} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Demo URL" value={formData.demoUrl} onChange={v => setFormData({...formData, demoUrl: v})} />
                <Input label="Code URL" value={formData.codeUrl} onChange={v => setFormData({...formData, codeUrl: v})} />
              </div>
              <Input label="Tags (comma separated)" value={formData.tags} onChange={v => setFormData({...formData, tags: v})} />
              <ImageUpload label="Project Image" value={formData.image} onChange={v => setFormData({...formData, image: v})} />
              <div>
                <label className="block text-sm font-semibold text-text-main mb-2">Description</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-border-soft rounded-xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none h-24 transition-all"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-text-muted hover:text-text-main font-medium">Cancel</button>
                <button onClick={handleSave} className="px-6 py-2 bg-brand text-white rounded-lg font-semibold hover:bg-brand-hover transition-all">Add Project</button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

const BlogList = ({ posts, onStartEdit, onStartAdd, onDelete, onReorder }) => {
  const t = useTranslation();
  const { language } = useData();
  const getTitle = (post) => post?.i18n?.[language]?.title || post?.i18n?.en?.title || post?.title || '';
  const sortedPosts = useMemo(() => sortByOrder(posts), [posts]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-xl font-bold text-text-main">{t('admin.manageBlog')}</h2>
          <p className="text-sm text-text-muted mt-1">{t('admin.dragToReorder')}</p>
        </div>
        <button 
          onClick={onStartAdd}
          className="flex items-center px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-hover transition-all shadow-md hover:shadow-brand/20 active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('admin.addPost')}
        </button>
      </div>

      <SortableList
        items={sortedPosts}
        onReorder={onReorder}
        className="space-y-4"
        itemClassName="p-5 bg-bg-main/50 border border-border-soft rounded-2xl hover:border-brand/30 transition-all group"
        renderItem={(post) => (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-5 min-w-0">
              <img src={post.image} alt="" className="w-20 h-20 rounded-xl object-cover shadow-sm ring-1 ring-border-soft group-hover:ring-brand/20 transition-all shrink-0" />
              <div className="min-w-0">
                <h3 className="font-bold text-text-main text-lg group-hover:text-brand transition-colors truncate">{getTitle(post)}</h3>
                <p className="text-text-muted text-sm font-medium mt-1">{post.date}</p>
              </div>
            </div>
            <div className="flex space-x-2 shrink-0">
              <button 
                onClick={() => onStartEdit(post)}
                className="p-2.5 text-text-muted hover:text-brand hover:bg-brand/5 rounded-xl transition-all"
              >
                <Edit2 className="w-4.5 h-4.5" />
              </button>
              <button 
                onClick={() => onDelete(post.id)}
                className="p-2.5 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        )}
      />
    </div>
  );
};

const BlogEditor = ({ post, onSave, onCancel }) => {
  const [formData, setFormData] = useState({ ...post });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const mdInputRef = useRef(null);
  const mdImagesRef = useRef(null);
  const { language } = useData();
  const [activeLang, setActiveLang] = useState(language || 'en');
  const t = useTranslation();

  useEffect(() => {
    setFormData({ ...post });
    setUploadNotice('');
  }, [post]);

  useEffect(() => {
    setActiveLang(language || 'en');
  }, [post?.id, language]);

  useEffect(() => {
    const i18n = formData.i18n && typeof formData.i18n === 'object' ? formData.i18n : null;
    if (i18n?.en && i18n?.zh) return;
    const title = (formData.title || '').toString();
    const description = (formData.description || '').toString();
    const content = (formData.content || '').toString();
    const legacyFormat = formData.contentFormat === 'markdown' || isMarkdownFormat(undefined, content)
      ? 'markdown'
      : 'html';
    setFormData(prev => ({
      ...prev,
      i18n: {
        en: { title, description, content, contentFormat: legacyFormat },
        zh: { title, description, content, contentFormat: legacyFormat }
      }
    }));
  }, [formData.i18n, formData.title, formData.description, formData.content]);

  const langData = formData.i18n?.[activeLang] || { title: '', description: '', content: '', contentFormat: 'html' };
  const isMarkdownMode = langData.contentFormat === 'markdown';

  const setLangField = (field, value) => {
    setFormData((prev) => applyBlogLocalePatch(prev, activeLang, { [field]: value }));
  };

  const setEditorMode = (mode) => {
    const nextFormat = mode === 'markdown' ? 'markdown' : 'html';
    const currentContent = langData.content || '';

    if (nextFormat === 'html' && langData.contentFormat === 'markdown') {
      setFormData((prev) =>
        applyBlogLocalePatch(prev, activeLang, {
          content: renderMarkdownToHtml(currentContent),
          contentFormat: 'html',
        })
      );
      return;
    }

    setLangField('contentFormat', nextFormat);
  };

  const showImportNotice = (warnings = []) => {
    setUploadNotice(
      warnings.length
        ? `${t('admin.importSuccess')} · ${warnings.join(' ')}`
        : t('admin.importSuccess')
    );
  };

  const handleMarkdownFile = async (e) => {
    const mdFile = e.target.files?.[0];
    e.target.value = '';
    if (!mdFile) return;

    try {
      const { markdown, meta, warnings } = await processMarkdownUpload(mdFile, []);
      applyMarkdownImport(markdown, meta);
      showImportNotice(warnings);
    } catch {
      setUploadNotice(t('admin.markdownUploadFailed'));
    }
  };

  const handleImageImport = async (e) => {
    const imageFiles = Array.from(e.target.files || []).filter(isImageUploadFile);
    e.target.value = '';
    if (!imageFiles.length) {
      setUploadNotice(t('admin.markdownNoImagesSelected'));
      return;
    }

    const sourceContent = (formData.i18n?.[activeLang]?.content || formData.content || '').trim();
    if (!sourceContent) {
      setUploadNotice(t('admin.markdownNoContentForImages'));
      return;
    }

    try {
      const { markdown, warnings } = await embedImagesIntoMarkdown(sourceContent, imageFiles);
      setFormData((prev) =>
        applyBlogLocalePatch(prev, activeLang, { content: markdown, contentFormat: 'markdown' })
      );
      showImportNotice(warnings);
    } catch {
      setUploadNotice(t('admin.markdownUploadFailed'));
    }
  };

  const applyMarkdownImport = (markdown, meta) => {
    setFormData((prev) => {
      const current = prev.i18n?.[activeLang] || {};
      return applyBlogLocalePatch(prev, activeLang, {
        content: markdown,
        contentFormat: 'markdown',
        title: current.title?.trim() ? current.title : (meta?.title || current.title || ''),
        description: current.description?.trim()
          ? current.description
          : (meta?.description || current.description || ''),
      });
    });
  };

  return (
    <div className="min-h-screen bg-bg-main -mx-4 px-4 pb-24 animate-in fade-in duration-500 relative">
      {/* 1. Header Bar */}
      <div className="fixed top-16 left-0 right-0 bg-white border-b border-border-soft z-50 px-4 shadow-sm">
        <div className="max-w-5xl mx-auto h-16 flex items-center justify-between">
          <button 
            onClick={onCancel}
            className="flex items-center text-text-muted hover:text-text-main transition-colors font-semibold"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            {t('admin.exitEditor')}
          </button>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center px-4 py-2 text-text-muted hover:text-brand font-semibold transition-colors"
            >
              <Eye className="w-4 h-4 mr-2" />
              {t('admin.preview')}
            </button>
            <button 
              onClick={() => {
                const now = new Date();
                const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                onSave(buildBlogPublishPayload(formData, activeLang, { date: dateStr }));
              }}
              className="flex items-center px-8 py-2.5 bg-brand text-white rounded-xl font-bold hover:bg-brand-hover transition-all shadow-md hover:shadow-brand/20"
            >
              <Save className="w-4 h-4 mr-2" />
              {t('admin.publish')}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto pt-12">
        {/* 2. Metadata Settings */}
        <div className="bg-white rounded-[2rem] border border-border-soft p-10 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm font-bold text-text-muted uppercase tracking-widest">Content Language</div>
            <div className="flex bg-bg-main p-1 rounded-xl border border-border-soft">
              {[
                { id: 'en', label: 'EN' },
                { id: 'zh', label: '中文' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setActiveLang(opt.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeLang === opt.id ? 'bg-white text-brand shadow-sm' : 'text-text-muted hover:text-brand'
                  }`}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <input 
            type="text"
            value={langData.title}
            onChange={e => setLangField('title', e.target.value)}
            placeholder="Enter Title..."
            className="w-full text-4xl font-bold text-text-main border-none outline-none mb-10 placeholder:text-gray-200"
          />
          
          <ImageUpload
            label={t('admin.coverImageLabel')}
            hint={t('admin.coverImageHint')}
            value={formData.image}
            onChange={v => setFormData({...formData, image: v})}
          />
          
          <div className="mt-8">
            <label className="block text-sm font-semibold text-text-main mb-3">Summary (For card list)</label>
            <textarea 
              value={langData.description}
              onChange={e => setLangField('description', e.target.value)}
              className="w-full px-5 py-4 bg-bg-main/50 border border-border-soft rounded-2xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none h-28 transition-all resize-none text-text-main"
              placeholder="A brief introduction to your post..."
            />
          </div>

          <div className="mt-8 pt-8 border-t border-border-soft">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <div className="text-sm font-semibold text-text-main">{t('admin.markdownUpload')}</div>
                <p className="text-xs text-text-muted mt-1 max-w-xl">{t('admin.markdownUploadHint')}</p>
              </div>
              <div className="flex bg-bg-main p-1 rounded-xl border border-border-soft">
                <button
                  type="button"
                  onClick={() => setEditorMode('markdown')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isMarkdownMode ? 'bg-white text-brand shadow-sm' : 'text-text-muted hover:text-brand'
                  }`}
                >
                  Markdown
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('html')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    !isMarkdownMode ? 'bg-white text-brand shadow-sm' : 'text-text-muted hover:text-brand'
                  }`}
                >
                  Rich Text
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={mdInputRef}
                type="file"
                accept=".md,.markdown,text/markdown,text/plain"
                onChange={handleMarkdownFile}
                className="hidden"
              />
              <input
                ref={mdImagesRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageImport}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => mdInputRef.current?.click()}
                className="inline-flex items-center px-4 py-2 border border-brand text-brand rounded-xl text-sm font-semibold hover:bg-brand/5 transition-all"
              >
                <FileText className="w-4 h-4 mr-2" />
                {t('admin.markdownChooseFile')}
              </button>
              <button
                type="button"
                onClick={() => mdImagesRef.current?.click()}
                className="inline-flex items-center px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-hover transition-all shadow-sm"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                {t('admin.markdownImportImages')}
              </button>
            </div>
            {uploadNotice && (
              <p className="mt-3 text-xs font-medium text-brand bg-brand/5 border border-brand/10 rounded-xl px-4 py-3">
                {uploadNotice}
              </p>
            )}
          </div>
        </div>

        {/* 3. Content editor */}
        <div className="bg-white rounded-[2rem] border border-border-soft shadow-sm overflow-hidden">
          {isMarkdownMode ? (
            <div className="p-6">
              <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-3">
                Markdown Source
              </label>
              <textarea
                value={langData.content}
                onChange={(e) => setLangField('content', e.target.value)}
                className="w-full min-h-[600px] px-5 py-4 bg-bg-main/30 border border-border-soft rounded-2xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none font-mono text-sm leading-relaxed text-text-main resize-y"
                placeholder="# Title&#10;&#10;Write or upload markdown..."
              />
            </div>
          ) : (
          <Editor
            init={{
              height: 600,
              menubar: true,
              license_key: 'gpl',
              plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount',
                'emoticons', 'visualchars'
              ],
              font_size_formats: '12px 14px 16px 18px 20px 24px 28px 32px 36px',
              toolbar: 'undo redo | blocks fontsize | ' +
                'bold italic forecolor backcolor | alignleft aligncenter ' +
                'alignright alignjustify | bullist numlist outdent indent | ' +
                'lineheight letterspacing | link image | removeformat | help',
              content_style: `
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                  font-size: 18px; 
                  line-height: 1.8; 
                  color: #1F2937;
                  padding: 40px;
                }
                h1, h2, h3, h4, h5, h6 { color: #111827; font-weight: 800; margin-top: 1.5em; }
                p { margin-bottom: 1.2em; }
                img { max-width: 100%; height: auto; border-radius: 1rem; }
                ol, ul { padding-left: 1.5em !important; margin-bottom: 1.2em !important; }
                li { padding-left: 0.2em !important; margin-bottom: 0.6em !important; }
                ol { list-style-type: decimal !important; }
              `,
              branding: false,
              promotion: false,
              skin: false, // Disable loading skin from CDN
              content_css: false,
              formats: {
                letterspacing_1: { inline: 'span', styles: { 'letter-spacing': '1px' } },
                letterspacing_2: { inline: 'span', styles: { 'letter-spacing': '2px' } },
                letterspacing_4: { inline: 'span', styles: { 'letter-spacing': '4px' } },
              },
              setup: (editor) => {
                editor.ui.registry.addMenuButton('letterspacing', {
                  text: 'Letter Spacing',
                  fetch: (callback) => {
                    const items = [
                      { type: 'menuitem', text: 'Normal', onAction: () => {
                        editor.formatter.remove('letterspacing_1');
                        editor.formatter.remove('letterspacing_2');
                        editor.formatter.remove('letterspacing_4');
                      }},
                      { type: 'menuitem', text: 'Wide (1px)', onAction: () => editor.formatter.apply('letterspacing_1') },
                      { type: 'menuitem', text: 'Wider (2px)', onAction: () => editor.formatter.apply('letterspacing_2') },
                      { type: 'menuitem', text: 'Widest (4px)', onAction: () => editor.formatter.apply('letterspacing_4') },
                    ];
                    callback(items);
                  }
                });
              }
            }}
            value={langData.content}
            onEditorChange={(content) => setLangField('content', content)}
          />
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8">
          <div className="absolute inset-0 bg-text-main/40 backdrop-blur-md" onClick={() => setIsPreviewOpen(false)}></div>
          <div className="relative bg-bg-main w-full max-w-4xl h-full max-h-[90vh] overflow-y-auto rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-border-soft p-6 flex items-center justify-between z-10">
              <h3 className="font-bold text-text-main text-lg">Content Preview</h3>
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="p-2.5 hover:bg-brand/5 text-text-muted hover:text-brand rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 md:p-16">
              <div className="max-w-3xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-bold text-text-main mb-8 leading-tight">
                  {langData.title || 'Untitled Post'}
                </h1>

                <div className="rich-text-preview prose prose-slate max-w-none prose-headings:text-text-main prose-p:text-text-main/90 prose-img:rounded-3xl">
                  <BlogContent
                    content={langData.content}
                    contentFormat={langData.contentFormat}
                    className="text-text-main/90 text-lg leading-relaxed"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        /* 1. RESET QUILL'S INTERNAL LAYOUT TO PREVENT FLIPPING */
        .editor-instance .quill {
          display: flex !important;
          flex-direction: column !important;
        }

        /* 2. HIDE THE AUTO-GENERATED TOOLBAR (IN CASE QUILL INJECTS ONE) */
        .editor-instance .ql-toolbar.ql-snow:not(#toolbar) {
          display: none !important;
        }
        
        /* 3. ENSURE OUR CUSTOM TOOLBAR IS ALWAYS ON TOP */
        #toolbar {
          display: flex !important;
          flex-wrap: wrap !important;
          order: 1 !important;
          border: none !important;
          border-bottom: 1px solid #E5E7EB !important;
          padding: 16px 24px !important;
          background: #ffffff !important;
          position: sticky !important;
          top: 144px !important; 
          z-index: 40 !important;
          border-radius: 2rem 2rem 0 0 !important;
          min-height: 50px !important;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05) !important;
        }

        /* Fix the dropdown labels and arrows */
        .ql-snow .ql-picker.ql-header .ql-picker-label::before {
          content: 'Normal' !important;
        }
        .ql-snow .ql-picker.ql-header .ql-picker-label[data-value="1"]::before {
          content: 'Heading 1' !important;
        }
        .ql-snow .ql-picker.ql-header .ql-picker-label[data-value="2"]::before {
          content: 'Heading 2' !important;
        }
        .ql-snow .ql-picker.ql-header .ql-picker-label[data-value="3"]::before {
          content: 'Heading 3' !important;
        }

        /* Dropdown items in the list */
        .ql-snow .ql-picker.ql-header .ql-picker-item::before {
          content: attr(data-label) !important;
        }
        .ql-snow .ql-picker.ql-header .ql-picker-item[data-value="1"]::before {
          content: 'Heading 1' !important;
        }
        .ql-snow .ql-picker.ql-header .ql-picker-item[data-value="2"]::before {
          content: 'Heading 2' !important;
        }
        .ql-snow .ql-picker.ql-header .ql-picker-item[data-value="3"]::before {
          content: 'Heading 3' !important;
        }
        .ql-snow .ql-picker.ql-header .ql-picker-item:not([data-value])::before {
          content: 'Normal' !important;
        }

        /* Ensure picker labels have enough space */
        .ql-snow .ql-picker.ql-header {
          width: 120px !important;
        }
        
        .ql-snow .ql-picker.ql-header .ql-picker-label {
          padding-left: 8px !important;
          padding-right: 24px !important;
        }

        /* Show tooltips/labels for other pickers if needed */
        .ql-snow .ql-picker.ql-size .ql-picker-label::before { content: 'Size' !important; }
        .ql-snow .ql-picker.ql-font .ql-picker-label::before { content: 'Font' !important; }

        /* Color and Background picker icons fix */
        .ql-snow .ql-color .ql-picker-label svg,
        .ql-snow .ql-background .ql-picker-label svg {
          margin-top: 4px !important;
        }

        /* Ensure all SVG icons are visible */
        .ql-toolbar .ql-formats button svg {
          display: inline-block !important;
          width: 18px !important;
          height: 18px !important;
        }

        /* 4. EDITOR CONTAINER BELOW TOOLBAR */
        .editor-container {
          order: 2 !important;
          background: white !important;
          border-radius: 0 0 2rem 2rem !important;
        }

        .editor-instance .ql-container.ql-snow {
          border: none !important;
          min-height: 500px !important;
        }

        .editor-instance .ql-editor {
          padding: 40px 50px !important;
          font-size: 18px !important;
          line-height: 1.8 !important;
          color: #1F2937 !important;
          min-height: 500px !important;
        }

        /* Fix List Indentation and Numbering */
        .editor-instance .ql-editor ol, 
        .editor-instance .ql-editor ul {
          padding-left: 1.5em !important;
          margin-bottom: 1em !important;
        }

        .editor-instance .ql-editor li {
          padding-left: 0.5em !important;
          margin-bottom: 0.5em !important;
        }

        /* Ensure ordered lists use decimal numbering */
        .editor-instance .ql-editor ol {
          list-style-type: decimal !important;
        }

        /* Custom Toolbar Icons and Picker Styles */
        .ql-snow .ql-stroke { stroke: #6B7280 !important; }
        .ql-snow .ql-fill { fill: #6B7280 !important; }
        .ql-snow .ql-picker { color: #6B7280 !important; }
        
        #toolbar .ql-formats {
          margin-right: 20px !important;
          display: flex !important;
          align-items: center !important;
        }

        .ql-snow.ql-toolbar button:hover .ql-stroke, 
        .ql-snow.ql-toolbar button:hover .ql-fill { 
          stroke: #3B82F6 !important; 
          fill: #3B82F6 !important;
        }

        /* Preview Styles */
        .rich-text-content h1, .rich-text-content h2, .rich-text-content h3 {
          color: #1F2937;
          font-weight: 800;
          margin-top: 2.5em;
          margin-bottom: 1em;
        }
        .rich-text-content p { margin-bottom: 1.8em; }
        .rich-text-content img { border-radius: 2rem; margin: 2.5em 0; }
        
        /* Preview List Styling */
        .rich-text-content ol, .rich-text-content ul {
          padding-left: 1.5em !important;
          margin-bottom: 1.5em !important;
          list-style-position: outside !important;
        }
        .rich-text-content ol { list-style-type: decimal !important; }
        .rich-text-content ul { list-style-type: disc !important; }
        .rich-text-content li { margin-bottom: 0.8em !important; padding-left: 0.5em !important; }
      `}</style>
    </div>
  );
};

const AboutManager = ({ info, onUpdate }) => {
  const [formData, setFormData] = useState({ ...info, highlights: info.highlights || [] });
  const t = useTranslation();

  const handleSave = () => {
    onUpdate({ ...formData });
    alert('About Me information saved successfully!');
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-bold text-text-main">{t('admin.manageAbout')}</h2>
        <button 
          onClick={handleSave}
          className="flex items-center px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-hover transition-all shadow-md hover:shadow-brand/20 active:scale-95"
        >
          <Save className="w-4 h-4 mr-2" />
          {t('admin.saveChanges')}
        </button>
      </div>

      <div className="bg-bg-main/50 p-8 rounded-[2rem] border border-border-soft space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Input label="Name" value={formData.name} onChange={v => setFormData({...formData, name: v})} />
          <Input label="Tagline (Hero section)" value={formData.tagline} onChange={v => setFormData({...formData, tagline: v})} />
          <div className="md:col-span-2">
            <Input label="Role/Sub-headline" value={formData.role} onChange={v => setFormData({...formData, role: v})} />
          </div>
          <ImageUpload label="Profile Image" value={formData.profileImage} onChange={v => setFormData({...formData, profileImage: v})} />
          <ImageUpload label="WeChat QR Code" value={formData.socials.wechat} onChange={v => setFormData({...formData, socials: {...formData.socials, wechat: v}})} />
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-text-main mb-3">Highlights (Cards)</label>
            <div className="space-y-4">
              {(formData.highlights || []).map((card, idx) => (
                <div key={card.id || idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-white border border-border-soft rounded-2xl">
                  <div className="md:col-span-4">
                    <Input label="Value" value={card.value || ''} onChange={v => {
                      const next = [...(formData.highlights || [])];
                      next[idx] = { ...next[idx], value: v };
                      setFormData({ ...formData, highlights: next });
                    }} />
                  </div>
                  <div className="md:col-span-5">
                    <Input label="Label" value={card.label || ''} onChange={v => {
                      const next = [...(formData.highlights || [])];
                      next[idx] = { ...next[idx], label: v };
                      setFormData({ ...formData, highlights: next });
                    }} />
                  </div>
                  <div className="md:col-span-2">
                    <Input label="Value px" type="number" value={(card.valueFontSize ?? 40).toString()} onChange={v => {
                      const n = parseInt(v, 10);
                      const next = [...(formData.highlights || [])];
                      next[idx] = { ...next[idx], valueFontSize: Number.isFinite(n) ? n : undefined };
                      setFormData({ ...formData, highlights: next });
                    }} />
                  </div>
                  <div className="md:col-span-1">
                    <Input label="Label px" type="number" value={(card.labelFontSize ?? 14).toString()} onChange={v => {
                      const n = parseInt(v, 10);
                      const next = [...(formData.highlights || [])];
                      next[idx] = { ...next[idx], labelFontSize: Number.isFinite(n) ? n : undefined };
                      setFormData({ ...formData, highlights: next });
                    }} />
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <button
                      onClick={() => {
                        const next = (formData.highlights || []).filter((_, i) => i !== idx);
                        setFormData({ ...formData, highlights: next });
                      }}
                      className="w-full px-3 py-3 text-red-500 hover:bg-red-50 rounded-2xl font-semibold transition-all"
                    >
                      <Trash2 className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  const next = [...(formData.highlights || [])];
                  next.push({ id: Date.now(), value: '', label: '', valueFontSize: 40, labelFontSize: 14 });
                  setFormData({ ...formData, highlights: next });
                }}
                className="inline-flex items-center px-5 py-3 bg-white border border-border-soft rounded-2xl text-text-main font-semibold hover:border-brand/30 hover:bg-brand/5 transition-all"
              >
                <Plus className="w-4 h-4 mr-2 text-brand" />
                Add Card
              </button>
            </div>
          </div>
          <Input label="GitHub Link" value={formData.socials.github} onChange={v => setFormData({...formData, socials: {...formData.socials, github: v}})} />
          <Input label="Email Link" value={formData.socials.email} onChange={v => setFormData({...formData, socials: {...formData.socials, email: v}})} />
        </div>
      </div>
    </div>
  );
};

const NoticeManager = ({ notice, onUpdate }) => {
  const [formData, setFormData] = useState({ ...notice });
  const t = useTranslation();

  useEffect(() => {
    setFormData({ ...notice });
  }, [notice]);

  const handleSave = () => {
    onUpdate({
      enabled: !!formData.enabled,
      zh: formData.zh || '',
      en: formData.en || ''
    });
    alert('Notice saved successfully!');
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-bold text-text-main">Notice</h2>
        <button
          onClick={handleSave}
          className="flex items-center px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-hover transition-all shadow-md hover:shadow-brand/20 active:scale-95"
        >
          <Save className="w-4 h-4 mr-2" />
          {t('admin.saveChanges')}
        </button>
      </div>

      <div className="bg-bg-main/50 p-8 rounded-[2rem] border border-border-soft space-y-6">
        <label className="flex items-center space-x-3 text-sm font-semibold text-text-main">
          <input
            type="checkbox"
            checked={!!formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="w-4 h-4 accent-[#3B82F6]"
          />
          <span>Enable announcement on Home</span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-text-main mb-3">中文公告</label>
            <textarea
              value={formData.zh || ''}
              onChange={(e) => setFormData({ ...formData, zh: e.target.value })}
              className="w-full px-5 py-4 bg-white border border-border-soft rounded-2xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none h-36 transition-all text-text-main resize-none"
              placeholder="网站正在更新中，部分内容尚未更新。"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-main mb-3">English Notice</label>
            <textarea
              value={formData.en || ''}
              onChange={(e) => setFormData({ ...formData, en: e.target.value })}
              className="w-full px-5 py-4 bg-white border border-border-soft rounded-2xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none h-36 transition-all text-text-main resize-none"
              placeholder="The website is under updates. Some content may be incomplete."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, value, onChange, type = "text" }) => (
  <div>
    <label className="block text-sm font-semibold text-text-main mb-3">{label}</label>
    <input 
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-5 py-3 bg-white border border-border-soft rounded-2xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all text-text-main"
    />
  </div>
);

export default Admin;
