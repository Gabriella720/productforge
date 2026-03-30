import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useData, useTranslation } from '../context/DataContext';
import { 
  Plus, Trash2, Edit2, Save, X, LogOut, Layout, 
  BookOpen, User, Upload, Download, Image as ImageIcon, ArrowLeft,
  ChevronLeft, Eye, BarChart3, TrendingUp, Users, MousePointer2, Clock, Globe
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';

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

const Admin = () => {
  const { 
    projects, addProject, updateProject, deleteProject,
    blogPosts, addBlogPost, updateBlogPost, deleteBlogPost,
    aboutInfo, updateAboutInfo,
    analytics,
    logout 
  } = useData();
  const t = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('projects');
  
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
    { id: 'analytics', label: t('admin.analytics'), icon: <BarChart3 className="w-4 h-4 mr-2" /> },
    { id: 'backup', label: 'Data Backup', icon: <Download className="w-4 h-4 mr-2" /> },
  ];

  const startEditBlog = (post) => {
    setEditingPost(post);
    setBlogView('edit');
  };

  const startAddBlog = () => {
    setEditingPost({ 
      title: '', 
      description: '', 
      content: '', 
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
            <h1 className="text-3xl font-bold text-text-main">{t('admin.dashboard')}</h1>
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
              />
            )}
            {activeTab === 'blog' && (
              <BlogList 
                posts={blogPosts} 
                onStartEdit={startEditBlog}
                onStartAdd={startAddBlog}
                onDelete={deleteBlogPost} 
              />
            )}
            {activeTab === 'about' && (
              <AboutManager 
                info={aboutInfo} 
                onUpdate={updateAboutInfo} 
              />
            )}
            {activeTab === 'analytics' && (
              <AnalyticsDashboard analytics={analytics} />
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

const AnalyticsDashboard = ({ analytics }) => {
  const [range, setRange] = useState('7d'); // '7d', '50d', '90d'
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
  }, [range, analytics.length]);

  const { data, days } = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    let d = 7;
    if (range === '50d') d = 50;
    if (range === '90d') d = 90;

    if (!now) return { data: [], days: d };

    const cutoff = now - (d * dayMs);
    const filtered = analytics.filter(record => record.timestamp > cutoff);

    const grouped = {};
    for (let i = 0; i < d; i++) {
      const date = new Date(now - i * dayMs);
      const key = date.toISOString().split('T')[0];
      grouped[key] = 0;
    }

    filtered.forEach(record => {
      const key = new Date(record.timestamp).toISOString().split('T')[0];
      if (grouped[key] !== undefined) grouped[key]++;
    });

    return { data: Object.entries(grouped).sort().map(([date, count]) => ({ date, count })), days: d };
  }, [analytics, now, range]);

  const totalViews = analytics.length;
  const newViews = useMemo(() => {
    if (!now) return 0;
    return analytics.filter(r => r.timestamp > now - 24 * 60 * 60 * 1000).length;
  }, [analytics, now]);
  const uniqueUsers = new Set(analytics.map(r => r.userAgent + r.screenSize)).size;

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-bold text-text-main">Website Analytics</h2>
        <div className="flex bg-bg-main p-1 rounded-xl border border-border-soft">
          {[
            { id: '7d', label: '1 Week' },
            { id: '50d', label: '50 Days' },
            { id: '90d', label: '3 Months' }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                range === r.id ? 'bg-white text-brand shadow-sm' : 'text-text-muted hover:text-brand'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard icon={<Eye className="w-5 h-5" />} label="Total Views" value={totalViews} color="blue" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="New Views (24h)" value={newViews} color="green" />
        <StatCard icon={<Users className="w-5 h-5" />} label="Unique Users" value={uniqueUsers} color="purple" />
        <StatCard icon={<MousePointer2 className="w-5 h-5" />} label="Avg. Interactivity" value="High" color="orange" />
      </div>

      {/* Simple Trend Chart */}
      <div className="bg-bg-main/30 border border-border-soft rounded-3xl p-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-bold text-text-main flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-brand" />
            Visitor Trend
          </h3>
          <span className="text-xs text-text-muted font-medium">Last {days} days</span>
        </div>
        
        <div className="h-64 flex items-end justify-between space-x-1">
          {data.map((d, i) => (
            <div key={i} className="flex-grow flex flex-col items-center group relative">
              <div 
                className="w-full bg-brand/20 group-hover:bg-brand/40 transition-all rounded-t-md cursor-pointer"
                style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: '4px' }}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-text-main text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-xl">
                  {d.count} views ({d.date})
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-4 px-1">
          <span className="text-[10px] text-text-muted font-bold">{data[0]?.date}</span>
          <span className="text-[10px] text-text-muted font-bold">{data[data.length-1]?.date}</span>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white border border-border-soft rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border-soft flex items-center justify-between">
          <h3 className="font-bold text-text-main flex items-center">
            <Clock className="w-5 h-5 mr-2 text-brand" />
            Recent Access Logs
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-bg-main/50 text-[10px] uppercase tracking-widest text-text-muted font-bold">
              <tr>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Page</th>
                <th className="px-6 py-4">Platform</th>
                <th className="px-6 py-4">Referrer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft text-sm">
              {analytics.slice(0, 10).map((record, i) => (
                <tr key={i} className="hover:bg-bg-main/30 transition-colors">
                  <td className="px-6 py-4 text-text-muted whitespace-nowrap">{new Date(record.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4 font-bold text-brand">{record.page}</td>
                  <td className="px-6 py-4 text-text-main truncate max-w-[150px]">{record.platform || 'Unknown'}</td>
                  <td className="px-6 py-4 text-text-muted italic">{record.referrer}</td>
                </tr>
              ))}
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
        {message && <div className="text-sm font-semibold text-brand">{message}</div>}
      </div>
    </div>
  );
};

const ImageUpload = ({ label, value, onChange }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-text-main mb-2">{label}</label>
      <div className="flex items-start space-x-4">
        <div className="flex-grow">
          <input 
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-border-soft rounded-xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none transition-all mb-3 text-text-main"
            placeholder="Image URL or upload local file"
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
            Tip: For production, manually place images in <code className="bg-bg-main px-1 rounded">public/uploads/</code> and use <code className="bg-bg-main px-1 rounded">/uploads/filename.jpg</code>
          </p>
        </div>
        {value && (
          <div className="w-24 h-24 border border-border-soft rounded-xl overflow-hidden flex-shrink-0 bg-bg-main shadow-sm">
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
};

const ProjectManager = ({ projects, onAdd, onUpdate, onDelete }) => {
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const t = useTranslation();

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

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-bold text-text-main">{t('admin.manageProjects')}</h2>
        <button 
          onClick={startAdd}
          className="flex items-center px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-hover transition-all shadow-md hover:shadow-brand/20 active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('admin.addProject')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map((project) => (
          <div key={project.id} className="border border-border-soft rounded-2xl p-6 hover:border-brand/30 transition-colors bg-bg-main/50">
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
          </div>
        ))}
        
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
    </div>
  );
};

const BlogList = ({ posts, onStartEdit, onStartAdd, onDelete }) => {
  const t = useTranslation();
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-bold text-text-main">{t('admin.manageBlog')}</h2>
        <button 
          onClick={onStartAdd}
          className="flex items-center px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-hover transition-all shadow-md hover:shadow-brand/20 active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('admin.addPost')}
        </button>
      </div>

      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="flex items-center justify-between p-5 bg-bg-main/50 border border-border-soft rounded-2xl hover:border-brand/30 transition-all group">
            <div className="flex items-center space-x-5">
              <img src={post.image} alt="" className="w-20 h-20 rounded-xl object-cover shadow-sm ring-1 ring-border-soft group-hover:ring-brand/20 transition-all" />
              <div>
                <h3 className="font-bold text-text-main text-lg group-hover:text-brand transition-colors">{post.title}</h3>
                <p className="text-text-muted text-sm font-medium mt-1">{post.date}</p>
              </div>
            </div>
            <div className="flex space-x-2">
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
        ))}
      </div>
    </div>
  );
};

const BlogEditor = ({ post, onSave, onCancel }) => {
  const [formData, setFormData] = useState({ ...post });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const t = useTranslation();

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
                
                onSave({ 
                  ...formData, 
                  date: dateStr,
                });
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
          <input 
            type="text"
            value={formData.title}
            onChange={e => setFormData({...formData, title: e.target.value})}
            placeholder="Enter Title..."
            className="w-full text-4xl font-bold text-text-main border-none outline-none mb-10 placeholder:text-gray-200"
          />
          
          <ImageUpload label="Cover Image" value={formData.image} onChange={v => setFormData({...formData, image: v})} />
          
          <div className="mt-8">
            <label className="block text-sm font-semibold text-text-main mb-3">Summary (For card list)</label>
            <textarea 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-5 py-4 bg-bg-main/50 border border-border-soft rounded-2xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none h-28 transition-all resize-none text-text-main"
              placeholder="A brief introduction to your post..."
            />
          </div>
        </div>

        {/* 3. TinyMCE Editor - Powerful alternative to Quill */}
        <div className="bg-white rounded-[2rem] border border-border-soft shadow-sm overflow-hidden">
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
            value={formData.content}
            onEditorChange={(content) => setFormData({ ...formData, content })}
          />
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
                  {formData.title || 'Untitled Post'}
                </h1>

                <div className="rich-text-preview prose prose-slate max-w-none prose-headings:text-text-main prose-p:text-text-main/90 prose-img:rounded-3xl">
                  <div 
                    className="text-text-main/90 text-lg leading-relaxed rich-text-content"
                    dangerouslySetInnerHTML={{ __html: formData.content }}
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
  const [formData, setFormData] = useState({ ...info, background: info.background.join('\n\n') });
  const t = useTranslation();

  const handleSave = () => {
    onUpdate({
      ...formData,
      background: formData.background.split('\n\n').filter(p => p.trim() !== '')
    });
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
            <label className="block text-sm font-semibold text-text-main mb-3">Background (use double newlines for paragraphs)</label>
            <textarea 
              value={formData.background}
              onChange={e => setFormData({...formData, background: e.target.value})}
              className="w-full px-5 py-4 bg-white border border-border-soft rounded-2xl focus:ring-2 focus:ring-brand/10 focus:border-brand outline-none h-64 transition-all text-text-main"
            />
          </div>
          <Input label="GitHub Link" value={formData.socials.github} onChange={v => setFormData({...formData, socials: {...formData.socials, github: v}})} />
          <Input label="Email Link" value={formData.socials.email} onChange={v => setFormData({...formData, socials: {...formData.socials, email: v}})} />
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
