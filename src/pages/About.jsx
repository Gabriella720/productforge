import React, { useState } from 'react';
import { Github, Mail, Briefcase, GraduationCap, MessageCircle, X } from 'lucide-react';
import { useData, useTranslation } from '../context/DataContext';

const About = () => {
  const { aboutInfo } = useData();
  const t = useTranslation();
  const [showWeChat, setShowWeChat] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 pt-32 pb-24 relative">
      {/* Profile Header */}
      <div className="text-center mb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="relative inline-block mb-10 group">
          <div className="absolute inset-0 bg-brand/20 rounded-full blur-2xl group-hover:bg-brand/30 transition-all duration-500 -z-10 animate-pulse"></div>
          <div className="w-40 h-40 mx-auto rounded-full overflow-hidden border-8 border-white shadow-2xl ring-1 ring-border-soft group-hover:scale-105 transition-transform duration-500">
            <img 
              src={aboutInfo.profileImage} 
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-black text-text-main mb-6 tracking-tight">
          {aboutInfo.name}
        </h1>
        
        <p className="text-xl md:text-2xl text-text-muted mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
          {aboutInfo.role}
        </p>
        
        <div className="flex items-center justify-center space-x-6">
          {aboutInfo.socials.github && (
            <SocialButton icon={<Github className="w-6 h-6" />} href={aboutInfo.socials.github} />
          )}
          {aboutInfo.socials.wechat && (
            <button 
              onClick={() => setShowWeChat(true)}
              className="w-14 h-14 bg-white border border-border-soft rounded-2xl flex items-center justify-center text-text-muted hover:text-brand hover:border-brand/40 hover:bg-brand/5 hover:shadow-xl hover:shadow-brand/10 transition-all duration-500 hover:-translate-y-1"
              title="WeChat"
            >
              <MessageCircle className="w-6 h-6" />
            </button>
          )}
          {aboutInfo.socials.email && (
            <SocialButton icon={<Mail className="w-6 h-6" />} href={aboutInfo.socials.email} />
          )}
        </div>
      </div>

      {/* WeChat Modal */}
      {showWeChat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-text-main/20 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setShowWeChat(false)}
          ></div>
          <div className="relative bg-white p-12 rounded-[3rem] shadow-[0_30px_100px_rgba(59,130,246,0.15)] max-w-sm w-full animate-in zoom-in-95 duration-500 ring-1 ring-border-soft">
            <button 
              onClick={() => setShowWeChat(false)}
              className="absolute top-8 right-8 p-3 text-text-muted hover:text-brand hover:bg-brand/5 rounded-2xl transition-all duration-300"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-center">
              <h3 className="text-2xl font-black text-text-main mb-10 tracking-tight">{t('blogDetail.scanWeChat')}</h3>
              <div className="bg-bg-main p-8 rounded-[2rem] border border-border-soft mb-8 inline-block mx-auto shadow-inner relative group">
                <div className="absolute inset-0 bg-brand/5 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
                <img 
                  src={aboutInfo.socials.wechat} 
                  alt="WeChat QR Code" 
                  className="w-48 h-48 object-contain rounded-2xl shadow-sm"
                />
              </div>
              <p className="text-text-muted font-bold text-sm tracking-widest uppercase opacity-80">
                {t('blogDetail.weChatConnect')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Background Section */}
      <section className="mb-24 bg-white border border-border-soft rounded-[3rem] p-12 shadow-xl shadow-brand/5 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
        <h2 className="text-3xl font-black text-text-main mb-10 flex items-center tracking-tight">
          <span className="w-3 h-10 bg-brand rounded-full mr-5 shadow-lg shadow-brand/20" />
          {t('about.background')}
        </h2>
        <div className="space-y-8 text-text-main/80 leading-relaxed text-lg font-medium">
          {aboutInfo.background.map((para, idx) => (
            <p key={idx}>{para}</p>
          ))}
        </div>
      </section>

      {/* Experience Section */}
      <section className="mb-24 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-400">
        <div className="flex items-center space-x-6 mb-12 px-6">
          <div className="p-4 bg-brand/10 rounded-[1.5rem] shadow-lg shadow-brand/5">
            <Briefcase className="w-8 h-8 text-brand" />
          </div>
          <h2 className="text-3xl font-black text-text-main tracking-tight">{t('about.experience')}</h2>
        </div>
        
        <div className="space-y-16 border-l-4 border-bg-main ml-12 pl-12 relative">
          {aboutInfo.experiences.map((exp, idx) => (
            <div key={idx} className="relative group animate-in fade-in slide-in-from-left-4 duration-700" style={{ transitionDelay: `${600 + idx * 100}ms` }}>
              <div className="absolute -left-[66px] top-2 w-8 h-8 rounded-full bg-white border-8 border-brand shadow-xl shadow-brand/20 group-hover:scale-125 transition-transform duration-500 z-10" />
              <div className="mb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                  <h3 className="text-2xl font-black text-text-main group-hover:text-brand transition-colors duration-300 tracking-tight">
                    {exp.company}
                  </h3>
                  <span className="inline-flex px-4 py-1.5 bg-brand/5 border border-brand/10 rounded-full text-xs font-black text-brand uppercase tracking-widest shadow-sm">
                    {exp.period}
                  </span>
                </div>
                <p className="text-lg font-bold text-brand/80 mb-6 uppercase tracking-wider">{exp.role}</p>
                <p className="text-text-muted leading-relaxed font-medium text-lg bg-bg-main/30 p-6 rounded-[2rem] border border-border-soft group-hover:border-brand/20 group-hover:bg-white group-hover:shadow-xl group-hover:shadow-brand/5 transition-all duration-500">
                  {exp.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Education Section */}
      <section className="animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-600">
        <div className="flex items-center space-x-6 mb-12 px-6">
          <div className="p-4 bg-brand/10 rounded-[1.5rem] shadow-lg shadow-brand/5">
            <GraduationCap className="w-8 h-8 text-brand" />
          </div>
          <h2 className="text-3xl font-black text-text-main tracking-tight">{t('about.education')}</h2>
        </div>
        
        <div className="space-y-16 border-l-4 border-bg-main ml-12 pl-12 relative">
          {aboutInfo.education.map((edu, idx) => (
            <div key={idx} className="relative group animate-in fade-in slide-in-from-left-4 duration-700" style={{ transitionDelay: `${800 + idx * 100}ms` }}>
              <div className="absolute -left-[66px] top-2 w-8 h-8 rounded-full bg-white border-8 border-brand shadow-xl shadow-brand/20 group-hover:scale-125 transition-transform duration-500 z-10" />
              <div className="mb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                  <h3 className="text-2xl font-black text-text-main group-hover:text-brand transition-colors duration-300 tracking-tight">
                    {edu.school}
                  </h3>
                  <span className="inline-flex px-4 py-1.5 bg-brand/5 border border-brand/10 rounded-full text-xs font-black text-brand uppercase tracking-widest shadow-sm">
                    {edu.period}
                  </span>
                </div>
                <p className="text-lg font-bold text-brand/80 mb-6 uppercase tracking-wider">{edu.degree}</p>
                <p className="text-text-muted leading-relaxed font-medium text-lg bg-bg-main/30 p-6 rounded-[2rem] border border-border-soft group-hover:border-brand/20 group-hover:bg-white group-hover:shadow-xl group-hover:shadow-brand/5 transition-all duration-500">
                  {edu.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const SocialButton = ({ icon, href }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="w-14 h-14 bg-white border border-border-soft rounded-2xl flex items-center justify-center text-text-muted hover:text-brand hover:border-brand/40 hover:bg-brand/5 hover:shadow-xl hover:shadow-brand/10 transition-all duration-500 hover:-translate-y-1"
  >
    {icon}
  </a>
);

export default About;
