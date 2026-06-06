import React from 'react';
import { Github, ExternalLink } from 'lucide-react';
import { useData, useTranslation } from '../context/DataContext';
import { buildProjectPath } from '../utils/analyticsPaths';
import { getProjectLocaleBlock } from '../utils/projectLocale';
import { sortByOrder } from '../utils/sortOrder';

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
  const demoHref = normalizeExternalUrl(project.demoUrl);

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
    <div className="group flex flex-col h-full border border-border-soft rounded-2xl overflow-hidden bg-white hover:shadow-[0_20px_40px_rgba(59,130,246,0.1)] transition-all duration-500 hover:-translate-y-1">
      <div className="relative overflow-hidden aspect-[16/10] shrink-0">
        {demoHref ? (
          <a
            href={demoHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackProject('demo')}
            className="block w-full h-full"
            aria-label={`${title} — ${t('projects.demo')}`}
          >
            <img
              src={project.image}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          </a>
        ) : (
          <img
            src={project.image}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        )}
        <div className="absolute inset-0 bg-brand/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      </div>

      <div className="flex flex-col flex-1 p-5">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(tags || []).map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 bg-brand/5 text-brand text-[9px] font-black rounded-full border border-brand/10 uppercase tracking-widest"
            >
              {tag}
            </span>
          ))}
        </div>

        <h2 className="text-lg font-black mb-2 tracking-tight leading-snug">
          {demoHref ? (
            <a
              href={demoHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackProject('demo')}
              className="text-text-main group-hover:text-brand transition-colors duration-300 cursor-pointer"
            >
              {title}
            </a>
          ) : (
            <span className="text-text-main">{title}</span>
          )}
        </h2>

        <p className="text-text-muted mb-4 leading-relaxed font-medium text-sm line-clamp-3 group-hover:text-text-main/80 transition-colors duration-300">
          {description}
        </p>

        <div className="mt-auto flex items-center gap-4 pt-4 border-t border-border-soft">
          {normalizeExternalUrl(project.codeUrl) && (
            <a
              href={normalizeExternalUrl(project.codeUrl)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackProject('github')}
              className="inline-flex items-center text-xs font-bold text-text-main hover:text-brand transition-colors duration-300"
            >
              <Github className="mr-1.5 w-4 h-4" />
              {t('projects.code')}
            </a>
          )}
          {normalizeExternalUrl(project.demoUrl) && (
            <a
              href={normalizeExternalUrl(project.demoUrl)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackProject('demo')}
              className="inline-flex items-center text-xs font-bold text-text-main hover:text-brand transition-colors duration-300"
            >
              <ExternalLink className="mr-1.5 w-4 h-4" />
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
    <div className="max-w-6xl mx-auto px-4 pt-8 pb-12 lg:min-h-[calc(100vh-5rem)] lg:flex lg:flex-col">
      <div className="mb-8 lg:mb-10 shrink-0">
        <h1 className="text-3xl md:text-4xl font-black text-text-main mb-3 tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
          {t('nav.projects')}
        </h1>

        <p className="text-base text-text-muted max-w-2xl leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          {t('projects.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 lg:flex-1 lg:items-stretch animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-400">
        {sortByOrder(projects).map((project) => (
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
