import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useData, useTranslation } from '../context/DataContext';
import { LogOut, Megaphone, Settings, Languages, X } from 'lucide-react';
import logoImg from '../assets/logo.png';

const Logo = () => (
  <div className="relative flex items-center justify-center w-12 h-12 group-hover:scale-110 transition-transform duration-500">
    <img src={logoImg} alt="Logo" className="w-full h-full object-contain" />
  </div>
);

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, logout, language, setLanguage, siteNotice } = useData();
  const t = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    const saved = localStorage.getItem('dismissedSiteNoticeId');
    return saved ? parseInt(saved, 10) : null;
  });

  useEffect(() => {
    const saved = localStorage.getItem('dismissedSiteNoticeId');
    const v = saved ? parseInt(saved, 10) : null;
    setDismissed(v);
  }, [siteNotice?.id]);
  
  const navItems = [
    { name: t('nav.projects'), path: '/projects' },
    { name: t('nav.blog'), path: '/blog' },
    { name: t('nav.about'), path: '/about' }
  ];

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-border-soft z-50 transition-all duration-300 relative">
      <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-4 group">
          <Logo />
          <div className="flex flex-col justify-center">
            <span className="text-xl font-black text-text-main group-hover:text-brand transition-all duration-300 tracking-tight leading-none mb-1">
              ProductForge
            </span>
            <span className="text-[11px] text-text-muted font-bold tracking-tight opacity-70 group-hover:text-brand/70 transition-all duration-300 leading-none">
              Forging AI Products from Ideas to Reality
            </span>
          </div>
        </Link>
        <nav className="flex items-center space-x-10">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`text-sm font-semibold transition-all duration-300 relative group py-2 ${
                location.pathname === item.path
                  ? 'text-brand'
                  : 'text-text-muted hover:text-brand'
              }`}
            >
              {item.name}
              <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-brand transform origin-left transition-transform duration-300 ${
                location.pathname === item.path ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
              }`} />
            </Link>
          ))}
          
          <div className="flex items-center space-x-5 pl-8 border-l border-border-soft">
            <button
              onClick={toggleLanguage}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl border border-border-soft bg-white/50 text-text-muted hover:text-brand hover:border-brand/30 hover:bg-brand/5 transition-all duration-300 text-xs font-bold tracking-wider"
              title={language === 'en' ? 'Switch to Chinese' : '切换为英文'}
            >
              <Languages className="w-4 h-4" />
              <span>{language === 'en' ? 'ZH' : 'EN'}</span>
            </button>

            {isAdmin && (
              <div className="flex items-center space-x-2">
                <Link 
                  to="/admin" 
                  className={`p-2.5 rounded-xl transition-all duration-300 ${
                    location.pathname.startsWith('/admin') 
                      ? 'bg-brand/10 text-brand shadow-sm shadow-brand/10' 
                      : 'text-text-muted hover:bg-brand/5 hover:text-brand hover:scale-110'
                  }`}
                  title="Admin Dashboard"
                >
                  <Settings className="w-5 h-5" />
                </Link>
                <button 
                  onClick={handleLogout}
                  className="p-2.5 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-300 hover:scale-110"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
      {siteNotice?.enabled && dismissed !== siteNotice?.id && (
        <div className="absolute left-0 right-0 top-full">
          <div className="bg-brand/5 border-b border-border-soft">
            <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/10 text-brand text-xs font-black tracking-widest shrink-0">
                  <Megaphone className="w-3.5 h-3.5" />
                  {language === 'zh' ? '公告' : 'NOTICE'}
                </span>
                <div className="text-sm font-semibold text-text-main/90 break-words leading-snug">
                  {language === 'zh' ? siteNotice.zh : siteNotice.en}
                </div>
              </div>
              <button
                onClick={() => {
                  localStorage.setItem('dismissedSiteNoticeId', String(siteNotice.id));
                  setDismissed(siteNotice.id);
                }}
                className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-white/60 transition-all shrink-0"
                title={language === 'zh' ? '关闭' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
