import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Code, BookOpen, Brain } from 'lucide-react';
import { useData, useTranslation } from '../context/DataContext';

const Home = () => {
  const { aboutInfo } = useData();
  const t = useTranslation();

  return (
    <div className="max-w-6xl mx-auto px-4 pt-12 sm:pt-14 md:pt-16 pb-16 sm:pb-20 md:pb-24">
      {/* Hero Section */}
      <div className="text-center mb-10 sm:mb-12 md:mb-16 relative">
        {/* Subtle background decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] sm:w-[480px] sm:h-[480px] md:w-[600px] md:h-[600px] bg-brand/5 rounded-full blur-3xl -z-10 animate-pulse duration-[10000ms]"></div>
        
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-text-main mb-4 sm:mb-5 md:mb-6 tracking-tighter animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
          {aboutInfo.name}
        </h1>
        
        <p className="text-base sm:text-lg md:text-xl text-text-muted mb-8 sm:mb-9 md:mb-10 max-w-[42rem] mx-auto leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-12 duration-700 delay-200">
          {aboutInfo.tagline}
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 animate-in fade-in slide-in-from-bottom-16 duration-700 delay-300">
          <Link
            to="/projects"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 sm:px-10 py-3.5 sm:py-4 bg-brand text-white rounded-2xl font-bold hover:bg-brand-hover transition-all duration-300 shadow-xl shadow-brand/20 hover:shadow-brand/30 hover:-translate-y-1 active:scale-95"
          >
            {t('home.viewProjects')}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
          <Link
            to="/about"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 sm:px-10 py-3.5 sm:py-4 border-2 border-brand/20 bg-white/50 backdrop-blur-sm text-brand rounded-2xl font-bold hover:bg-brand/5 hover:border-brand/40 transition-all duration-300 hover:-translate-y-1 active:scale-95"
          >
            {t('home.aboutMe')}
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-20 duration-1000 delay-500">
        <Card
          icon={Code}
          title={t('home.projectsTitle')}
          description={t('home.projectsDesc')}
          link="/projects"
          linkLabel={t('home.explore')}
        />
        <Card
          icon={BookOpen}
          title={t('home.blogTitle')}
          description={t('home.blogDesc')}
          link="/blog"
          linkLabel={t('home.readMore')}
        />
        <Card
          icon={Brain}
          title={t('home.aboutTitle')}
          description={t('home.aboutDesc')}
          link="/about"
          linkLabel={t('home.learnMore')}
        />
      </div>
    </div>
  );
};
const Card = ({ icon: Icon, title, description, link, linkLabel }) => (
  <div className="group p-6 sm:p-7 border border-border-soft rounded-[2rem] bg-white hover:border-brand/30 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(59,130,246,0.08)] relative overflow-hidden">
    <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 blur-3xl -z-10 group-hover:bg-brand/10 transition-colors duration-500"></div>
    <div className="w-12 h-12 bg-bg-main group-hover:bg-brand rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 shadow-sm group-hover:shadow-xl group-hover:shadow-brand/20 group-hover:-rotate-6">
      <Icon className="w-6 h-6 text-brand group-hover:text-white transition-all duration-500" />
    </div>
    <h3 className="text-xl font-bold text-text-main mb-3 group-hover:text-brand transition-colors duration-300 tracking-tight">{title}</h3>
    <p className="text-text-muted mb-6 leading-relaxed font-medium group-hover:text-text-main/80 transition-colors duration-300 text-sm sm:text-base">
      {description}
    </p>
    <Link
      to={link}
      className="inline-flex items-center text-sm font-bold text-brand group-hover:text-brand-hover transition-all duration-300"
    >
      <span className="relative">
        {linkLabel}
        <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-brand transition-all duration-300 group-hover:w-full"></span>
      </span>
      <ArrowRight className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-2" />
    </Link>
  </div>
);

export default Home;
