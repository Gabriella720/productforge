import React, { useState } from 'react';
import { Github, Mail, MessageCircle, X } from 'lucide-react';
import { useData, useTranslation } from '../context/DataContext';

const About = () => {
  const { aboutInfo } = useData();
  const t = useTranslation();
  const [showWeChat, setShowWeChat] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 pt-16 pb-24 relative">
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

      {/* Highlights Cards */}
      <section className="animate-in fade-in slide-in-from-bottom-10 duration-700 delay-150">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {(aboutInfo.highlights || []).map((card) => (
            <div
              key={card.id}
              className="bg-white border border-border-soft rounded-2xl p-7 text-center shadow-sm hover:shadow-lg hover:shadow-brand/5 transition-all"
            >
              <div className="text-4xl font-black text-text-main tracking-tight">
                {card.value}
              </div>
              <div className="mt-2 text-sm font-semibold text-text-muted">
                {card.label}
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
