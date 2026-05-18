import { detectContentLanguage } from './blogLocale';

const tagsFrom = (block, fallback = []) => {
  if (Array.isArray(block?.tags) && block.tags.length) {
    return block.tags.map((t) => String(t).trim()).filter(Boolean);
  }
  return Array.isArray(fallback) ? fallback.map((t) => String(t).trim()).filter(Boolean) : [];
};

/** True when this locale was authored in site-data (use verbatim, no machine translate). */
export const hasManualProjectLocale = (project, lang) => {
  const block = project?.i18n?.[lang];
  if (!block || typeof block !== 'object') return false;
  const title = (block.title || '').trim();
  const description = (block.description || '').trim();
  const hasTags = Array.isArray(block.tags) && block.tags.some((t) => String(t).trim());
  return Boolean(title || description || hasTags);
};

const blockFromI18n = (block, top, lang) => ({
  title: (block?.title || (lang === 'en' ? top?.title : '') || '').trim(),
  description: (block?.description || (lang === 'en' ? top?.description : '') || '').trim(),
  tags: tagsFrom(block, lang === 'en' ? top?.tags : []),
});

export const getProjectLocaleBlock = (project, lang) => {
  const i18n = project?.i18n && typeof project.i18n === 'object' ? project.i18n : {};
  const top = project && typeof project === 'object' ? project : {};
  const enBlock = i18n.en || {};
  const zhBlock = i18n.zh || {};

  if (lang === 'zh' && hasManualProjectLocale(project, 'zh')) {
    return blockFromI18n(zhBlock, top, 'zh');
  }

  if (lang === 'en' && hasManualProjectLocale(project, 'en')) {
    return blockFromI18n(enBlock, top, 'en');
  }

  if (lang === 'zh') {
    const zh = blockFromI18n(zhBlock, top, 'zh');
    const en = blockFromI18n(enBlock, top, 'en');
    if (zh.title || zh.description || zh.tags.length) return zh;
    if (en.title || en.description || en.tags.length) return en;
    return zh;
  }

  const en = blockFromI18n(enBlock, top, 'en');
  if (en.title || en.description || en.tags.length) return en;
  return blockFromI18n(enBlock, top, 'en');
};

export const getPrimaryProjectSource = (project) => {
  const zh = getProjectLocaleBlock(project, 'zh');
  const en = getProjectLocaleBlock(project, 'en');

  const pick = (block) => {
    const lang = detectContentLanguage(`${block.title} ${block.description} ${block.tags.join(' ')}`) || 'en';
    return { lang, ...block };
  };

  if (hasManualProjectLocale(project, 'zh')) return { lang: 'zh', ...zh };
  if (hasManualProjectLocale(project, 'en')) return { lang: 'en', ...en };
  if (zh.title || zh.description || zh.tags.length) return pick(zh);
  if (en.title || en.description || en.tags.length) return pick(en);
  return { lang: 'en', title: '', description: '', tags: [] };
};

export const needsProjectAutoTranslation = (project, targetLang) => {
  if (hasManualProjectLocale(project, targetLang)) return false;

  const source = getPrimaryProjectSource(project);
  if (!source.title && !source.description && !source.tags.length) return false;

  const target = getProjectLocaleBlock(project, targetLang);
  if (!target.title && !target.description && !target.tags.length) return true;

  const targetDetected = detectContentLanguage(
    `${target.title} ${target.description} ${target.tags.join(' ')}`
  );
  if (!targetDetected) return false;
  return targetDetected !== targetLang;
};

export const isProjectLocaleValid = (fields, targetLang, source = null) => {
  if (!fields?.title && !fields?.description && !(fields?.tags?.length)) return false;
  const lang = detectContentLanguage(
    `${fields.title} ${fields.description} ${(fields.tags || []).join(' ')}`
  );
  if (!lang) return Boolean(fields.title || fields.description || fields.tags?.length);
  return lang === targetLang;
};

export const getDisplayProjectBlock = (project, targetLang) => {
  return getProjectLocaleBlock(project, targetLang);
};
