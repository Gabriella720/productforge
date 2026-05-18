import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import {
  getPrimaryProjectSource,
  getProjectLocaleBlock,
  hasManualProjectLocale,
  isProjectLocaleValid,
  needsProjectAutoTranslation,
} from '../utils/projectLocale';
import { translateProjectFields } from '../utils/translateService';

const CACHE_VERSION = 'v2';
const cacheKey = (projectId, lang) => `projectResolved:${CACHE_VERSION}:${projectId}:${lang}`;

export const useProjectLocale = (project) => {
  const { language } = useData();
  const [state, setState] = useState({
    title: '',
    description: '',
    tags: [],
    loading: false,
    isAutoTranslated: false,
    error: null,
  });

  useEffect(() => {
    if (!project) return undefined;

    let cancelled = false;
    const projectId = project.id;

    const apply = (payload) => {
      if (!cancelled) setState((prev) => ({ ...prev, ...payload }));
    };

    const applyFromJson = () => {
      const block = getProjectLocaleBlock(project, language);
      apply({
        title: block.title,
        description: block.description,
        tags: block.tags,
        loading: false,
        isAutoTranslated: false,
        error: null,
      });
    };

    const run = async () => {
      if (hasManualProjectLocale(project, language) || !needsProjectAutoTranslation(project, language)) {
        applyFromJson();
        return;
      }

      const source = getPrimaryProjectSource(project);

      const cachedRaw = localStorage.getItem(cacheKey(projectId, language));
      if (cachedRaw) {
        try {
          const parsed = JSON.parse(cachedRaw);
          if (isProjectLocaleValid(parsed, language, source)) {
            apply({
              title: parsed.title,
              description: parsed.description,
              tags: parsed.tags || [],
              loading: false,
              isAutoTranslated: true,
              error: null,
            });
            return;
          }
          localStorage.removeItem(cacheKey(projectId, language));
        } catch {
          localStorage.removeItem(cacheKey(projectId, language));
        }
      }

      apply({ title: '', description: '', tags: [], loading: true, isAutoTranslated: false, error: null });

      try {
        const translated = await translateProjectFields(
          {
            title: source.title,
            description: source.description,
            tags: source.tags,
          },
          source.lang,
          language
        );

        if (cancelled) return;

        if (!isProjectLocaleValid(translated, language, source)) {
          throw new Error('translate_invalid_result');
        }

        try {
          localStorage.setItem(cacheKey(projectId, language), JSON.stringify(translated));
        } catch {
          // ignore
        }
        apply({
          ...translated,
          loading: false,
          isAutoTranslated: true,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        const fallback = getProjectLocaleBlock(project, language);
        apply({
          ...fallback,
          loading: false,
          isAutoTranslated: false,
          error: e?.message || 'translate_failed',
        });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [project, language]);

  return state;
};
