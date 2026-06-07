import { isMarkdownFormat } from './markdown';

const defaultBlock = () => ({ title: '', description: '', content: '', contentFormat: 'html' });

/** Sync sibling locale when it is empty or still a duplicate of the previous version. */
export const shouldSyncSiblingLocale = (beforeEdited, beforeSibling, siblingBlock) => {
  const sibContent = (siblingBlock?.content || '').trim();
  const sibTitle = (siblingBlock?.title || '').trim();
  if (!sibContent && !sibTitle) return true;
  if (beforeEdited && beforeEdited === beforeSibling) return true;
  if (beforeEdited && sibContent === beforeEdited) return true;
  if (beforeSibling && sibContent === beforeSibling) return true;
  return false;
};

const resolveBlockFormat = (block) => {
  if (block?.contentFormat === 'markdown' || block?.contentFormat === 'html') {
    return block.contentFormat;
  }
  return isMarkdownFormat(undefined, block?.content || '') ? 'markdown' : 'html';
};

/** Apply a patch to one locale, keep top-level fields in sync, and de-duplicate stale sibling copies. */
export const applyBlogLocalePatch = (post, lang, patch) => {
  const prev = post && typeof post === 'object' ? post : {};
  const nextI18n = {
    en: { ...defaultBlock(), ...(prev.i18n?.en || {}) },
    zh: { ...defaultBlock(), ...(prev.i18n?.zh || {}) },
  };

  const beforeEn = (nextI18n.en.content || '').trim();
  const beforeZh = (nextI18n.zh.content || '').trim();
  const beforeEdited = (nextI18n[lang]?.content || '').trim();
  const beforeSibling = lang === 'en' ? beforeZh : beforeEn;

  const nextPatch = { ...patch };
  if (nextPatch.content !== undefined && nextPatch.contentFormat === undefined) {
    nextPatch.contentFormat = resolveBlockFormat({ ...nextI18n[lang], ...nextPatch });
  }

  nextI18n[lang] = { ...nextI18n[lang], ...nextPatch };

  const sibling = lang === 'en' ? 'zh' : 'en';
  if (shouldSyncSiblingLocale(beforeEdited, beforeSibling, nextI18n[sibling])) {
    nextI18n[sibling] = { ...nextI18n[sibling], ...nextPatch };
  }

  nextI18n.en.contentFormat = resolveBlockFormat(nextI18n.en);
  nextI18n.zh.contentFormat = resolveBlockFormat(nextI18n.zh);

  const edited = nextI18n[lang];
  return {
    ...prev,
    i18n: nextI18n,
    title: edited.title ?? prev.title ?? '',
    description: edited.description ?? prev.description ?? '',
    content: edited.content ?? prev.content ?? '',
    contentFormat: edited.contentFormat || resolveBlockFormat(edited),
  };
};

/** Publish payload mirrors the tab being edited (preview uses the same source). */
export const buildBlogPublishPayload = (post, activeLang, extra = {}) => {
  const base = post && typeof post === 'object' ? post : {};
  const edited = base.i18n?.[activeLang] || {};
  const content = (edited.content || base.content || '').trim();
  const contentFormat = edited.contentFormat || base.contentFormat || resolveBlockFormat(edited);

  return {
    ...base,
    ...extra,
    i18n: base.i18n,
    title: edited.title || base.title || '',
    description: edited.description || base.description || '',
    content: edited.content || base.content || '',
    contentFormat,
  };
};

export const clearBlogLocaleCache = (postId) => {
  if (typeof window === 'undefined' || postId == null) return;
  ['en', 'zh'].forEach((lang) => {
    localStorage.removeItem(`blogResolved:v5:${postId}:${lang}`);
    localStorage.removeItem(`blogResolved:v4:${postId}:${lang}`);
  });
};
