import React from 'react';
import { Github, ExternalLink, Layers } from 'lucide-react';
import { useData, useTranslation } from '../context/DataContext';
import { buildProjectPath } from '../utils/analyticsPaths';
import { getProjectLocaleBlock } from '../utils/projectLocale';

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

const ProjectCard = ({ project, language, trackEvent, t }) => {
  const { title, description, tags } = getProjectLocaleBlock(project, language);

  const trackProject = (action) => {
    trackEvent({
      page: buildProjectPath(project, action),
      eventType: action ? 'click' : 'pageview',
      action: action || 'view',
      entityType: 'project',
      entityId: project.id,
      entityName: title || project.title,
    });
  };

  return (
    <div className="group border border-border-soft rounded-[2.5rem] overflow-hidden bg-white hover:shadow-[0_30px_60px_rgba(59,130,246,0.1)] transition-all duration-500 hover:-translate-y-2">
      <div className="relative overflow-hidden aspect-video">
        <img
          src={project.image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-brand/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      <div className="p-10">
        <div className="flex flex-wrap gap-2 mb-6">
          {(tags || []).map((tag) => (
            <span
              key={tag}
              className="px-4 py-1.5 bg-brand/5 text-brand text-[10px] font-black rounded-full border border-brand/10 uppercase tracking-widest"
            >
              {tag}
            </span>
          ))}
        </div>

        <h2
          className="text-3xl font-black text-text-main mb-4 group-hover:text-brand transition-colors duration-300 tracking-tight cursor-pointer"
          onClick={() => trackProject()}
        >
          {title}
        </h2>

        <p className="text-text-muted mb-10 leading-relaxed font-medium text-lg group-hover:text-text-main/80 transition-colors duration-300">
          {description}
        </p>

        <div className="flex items-center space-x-8 pt-8 border-t border-border-soft">
          {normalizeExternalUrl(project.codeUrl) && (
            <a
              href={normalizeExternalUrl(project.codeUrl)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackProject('github')}
              className="inline-flex items-center text-sm font-bold text-text-main hover:text-brand transition-colors duration-300"
            >
              <Github className="mr-2 w-5 h-5" />
              {t('projects.code')}
            </a>
          )}
          {normalizeExternalUrl(project.demoUrl) && (
            <a
              href={normalizeExternalUrl(project.demoUrl)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackProject('demo')}
              className="inline-flex items-center text-sm font-bold text-text-main hover:text-brand transition-colors duration-300"
            >
              <ExternalLink className="mr-2 w-5 h-5" />
              {t('projects.demo')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

const Projects = () => {
  const { projects, trackEvent, language } = useData();
  const t = useTranslation();

  return (
    <div className="max-w-6xl mx-auto px-4 pt-16 pb-24">
      <div className="mb-20">
        <div className="inline-flex items-center px-4 py-2 bg-brand/5 border border-brand/10 rounded-full text-brand text-xs font-bold tracking-widest uppercase mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Layers className="w-3.5 h-3.5 mr-2" />
          {t('projects.badge')}
        </div>

        <h1 className="text-5xl md:text-6xl font-black text-text-main mb-6 tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
          {t('nav.projects')}
        </h1>

        <p className="text-xl text-text-muted max-w-3xl leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          {t('projects.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-400">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            language={language}
            trackEvent={trackEvent}
            t={t}
          />
        ))}
      </div>
    </div>
  );
};

export default Projects;
