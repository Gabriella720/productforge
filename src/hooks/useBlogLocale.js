import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import {
  getLocaleBlock,
  getPrimarySourceLocale,
  isResolvedLocaleValid,
  needsAutoTranslation,
} from '../utils/blogLocale';
import { translateBlogFields } from '../utils/translateService';

const CACHE_VERSION = 'v5';
const postCacheKey = (postId, lang) => `blogResolved:${CACHE_VERSION}:${postId}:${lang}`;

const readCachedLocale = (postId, lang, source, includeContent) => {
  if (typeof window === 'undefined' || postId == null) return null;
  const cachedRaw = localStorage.getItem(postCacheKey(postId, lang));
  if (!cachedRaw) return null;
  try {
    const parsed = JSON.parse(cachedRaw);
    if (!isResolvedLocaleValid(parsed, lang, source)) return null;
    return {
      title: parsed.title || '',
      description: parsed.description || '',
      content: includeContent ? (parsed.content || '') : '',
      contentFormat: parsed.contentFormat || source.contentFormat || 'html',
      loading: false,
      isAutoTranslated: true,
      error: null,
    };
  } catch {
    return null;
  }
};

const getInitialLocaleState = (post, lang, includeContent) => {
  if (!post) {
    return {
      title: '',
      description: '',
      content: '',
      contentFormat: 'html',
      loading: false,
      isAutoTranslated: false,
      error: null,
    };
  }

  const source = getPrimarySourceLocale(post);
  if (!needsAutoTranslation(post, lang)) {
    const direct = getLocaleBlock(post, lang);
    const display = direct.content || direct.title ? direct : source;
    return {
      title: display.title || source.title || '',
      description: display.description || source.description || '',
      content: includeContent ? (display.content || source.content || '') : '',
      contentFormat: display.contentFormat || source.contentFormat || 'html',
      loading: false,
      isAutoTranslated: false,
      error: null,
    };
  }

  const cached = readCachedLocale(post.id, lang, source, includeContent);
  if (cached) return cached;

  return {
    title: '',
    description: '',
    content: '',
    contentFormat: source.contentFormat || 'html',
    loading: true,
    isAutoTranslated: false,
    error: null,
  };
};

const withContentFallback = (fields, source, includeContent) => {
  const contentFormat = fields.contentFormat || source.contentFormat || 'html';
  if (!includeContent) return { ...fields, content: '', contentFormat };
  const content = (fields.content || '').trim() || source.content || '';
  return { ...fields, content, contentFormat };
};

export const useBlogLocale = (post, options = {}) => {
  const { includeContent = true } = options;
  const { language } = useData();
  const [state, setState] = useState(() => getInitialLocaleState(post, language, includeContent));

  useEffect(() => {
    if (!post) return undefined;

    let cancelled = false;
    const postId = post.id;
    const source = getPrimarySourceLocale(post);

    const apply = (payload) => {
      if (!cancelled) setState((prev) => ({ ...prev, ...payload }));
    };

    const applyResolved = (fields, { autoTranslated = false, error = null, loading = false }) => {
      const resolved = withContentFallback(fields, source, includeContent);
      apply({
        title: resolved.title || source.title,
        description: resolved.description || source.description,
        content: resolved.content,
        contentFormat: resolved.contentFormat || source.contentFormat || 'html',
        loading,
        isAutoTranslated: autoTranslated,
        error,
      });
    };

    const run = async () => {
      if (!needsAutoTranslation(post, language)) {
        const direct = getLocaleBlock(post, language);
        const display = direct.content || direct.title ? direct : source;
        applyResolved(display, { autoTranslated: false });
        return;
      }

      const cached = readCachedLocale(postId, language, source, includeContent);
      if (cached) {
        apply({
          title: cached.title,
          description: cached.description,
          content: cached.content,
          contentFormat: cached.contentFormat,
          loading: false,
          isAutoTranslated: true,
          error: null,
        });
        return;
      }

      apply({
        title: '',
        description: '',
        content: '',
        contentFormat: 'html',
        loading: true,
        isAutoTranslated: false,
        error: null,
      });

      try {
        const translated = await translateBlogFields(
          {
            title: source.title,
            description: source.description,
            content: includeContent ? source.content : '',
          },
          source.lang,
          language
        );

        if (cancelled) return;

        const resolved = withContentFallback(translated, source, includeContent);
        if (!isResolvedLocaleValid(resolved, language, source)) {
          throw new Error('translate_invalid_result');
        }

        try {
          localStorage.setItem(postCacheKey(postId, language), JSON.stringify({
            ...resolved,
            sourceTitle: source.title || '',
          }));
        } catch {
          // ignore
        }
        applyResolved(resolved, { autoTranslated: true });
      } catch (e) {
        if (cancelled) return;
        applyResolved(source, {
          autoTranslated: false,
          error: e?.message || 'translate_failed',
        });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [post, language, includeContent]);

  return state;
};
