export const hasCjk = (text) => /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(text || '');

/** Strip embedded assets/noise so Chinese posts with data-URL images are not misread as English. */
export const sampleForLanguageDetection = (text) =>
  (text || '')
    .replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/gi, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[A-Za-z0-9+/=]{120,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const detectContentLanguage = (text) => {
  const plain = sampleForLanguageDetection(text);
  if (!plain) return null;
  const cjk = (plain.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = (plain.match(/[a-zA-Z]/g) || []).length;
  if (cjk === 0 && latin === 0) return null;
  if (cjk >= latin) return 'zh';
  return 'en';
};

const resolveContentFormat = (block, top) => {
  if (block?.contentFormat === 'markdown') return 'markdown';
  if (block?.contentFormat === 'html') return 'html';
  if (top?.contentFormat === 'markdown') return 'markdown';
  return 'html';
};

const blockFrom = (block, top) => ({
  title: (block?.title || top?.title || '').trim(),
  description: (block?.description || top?.description || '').trim(),
  content: (block?.content || top?.content || '').trim(),
  contentFormat: resolveContentFormat(block, top),
});

/** Read a locale block; fixes posts where Chinese lives in EN tab or ZH has old English templates. */
export const getLocaleBlock = (post, lang) => {
  const i18n = post?.i18n && typeof post.i18n === 'object' ? post.i18n : {};
  const top = post && typeof post === 'object' ? post : {};
  const target = blockFrom(i18n[lang], top);
  const en = blockFrom(i18n.en, top);
  const zh = blockFrom(i18n.zh, top);

  if (lang === 'zh') {
    const targetLang = detectContentLanguage(`${target.title} ${target.description} ${target.content}`);
    const enLang = detectContentLanguage(`${en.title} ${en.description} ${en.content}`);
    const zhLang = detectContentLanguage(`${zh.title} ${zh.description} ${zh.content}`);

    if (zhLang === 'zh' && (target.content || target.title)) return target;
    if (enLang === 'zh' && (en.content || en.title)) return en;
    if (zhLang === 'zh') return zh;
    if (target.content || target.title) return target;
    return en.content || en.title ? en : target;
  }

  if (lang === 'en') {
    const targetLang = detectContentLanguage(`${target.title} ${target.description} ${target.content}`);
    const enLang = detectContentLanguage(`${en.title} ${en.description} ${en.content}`);
    if (enLang === 'en' && (en.content || en.title)) return en;
    if (targetLang === 'en' && (target.content || target.title)) return target;
    if (en.content || en.title) return en;
    return target;
  }

  return target;
};

export const getPrimarySourceLocale = (post) => {
  const zh = getLocaleBlock(post, 'zh');
  const en = getLocaleBlock(post, 'en');

  if (zh.content) {
    const lang = detectContentLanguage(`${zh.title} ${zh.content}`) || 'zh';
    return { lang, ...zh };
  }
  if (en.content) {
    const lang = detectContentLanguage(`${en.title} ${en.content}`) || 'en';
    return { lang, ...en };
  }
  if (zh.title || zh.description) {
    const lang = detectContentLanguage(`${zh.title} ${zh.description}`) || 'zh';
    return { lang, ...zh };
  }
  if (en.title || en.description) {
    const lang = detectContentLanguage(`${en.title} ${en.description}`) || 'en';
    return { lang, ...en };
  }
  return { lang: 'zh', title: '', description: '', content: '', contentFormat: 'html' };
};

export const needsAutoTranslation = (post, targetLang) => {
  const source = getPrimarySourceLocale(post);
  if (!source.content && !source.title) return false;

  // Article already authored in the UI language (e.g. Chinese post in Chinese UI).
  if (source.lang === targetLang) return false;

  const target = getLocaleBlock(post, targetLang);
  if (!target.content && !target.title && !target.description) {
    return false;
  }

  const targetLangDetected = detectContentLanguage(
    `${target.title} ${target.description} ${target.content}`
  );
  if (!targetLangDetected) return false;
  if (targetLangDetected === targetLang) return false;

  // Same body, wrong tab label — show source, do not call translate API
  if (
    source.content &&
    target.content &&
    source.content === target.content &&
    source.lang === targetLang
  ) {
    return false;
  }

  return true;
};

export const isResolvedLocaleValid = (fields, targetLang, source = null) => {
  if (!fields?.title && !fields?.content) return false;

  const sourceContent = (source?.content || '').trim();
  const resolvedContent = (fields.content || '').trim();
  if (sourceContent && !resolvedContent) return false;

  const lang = detectContentLanguage(`${fields.title} ${fields.description} ${fields.content}`);
  if (!lang) return Boolean(resolvedContent || fields.title);
  return lang === targetLang;
};

export const getDisplayLocaleBlock = (post, targetLang) => {
  if (!needsAutoTranslation(post, targetLang)) {
    return getLocaleBlock(post, targetLang);
  }
  return getPrimarySourceLocale(post);
};
