import { hasCjk } from './blogLocale';

const CACHE_PREFIX = 'blogTrCache:v2:';
const MYMEMORY_CHUNK = 420;
const GTX_CHUNK = 1200;
const FETCH_TIMEOUT_MS = 15000;
const CHUNK_DELAY_MS = 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const hashKey = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return String(h >>> 0);
};

const readCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCache = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota
  }
};

const langPair = (from, to) => {
  const src = from === 'zh' ? 'zh-CN' : 'en';
  const tgt = to === 'zh' ? 'zh-CN' : 'en';
  return `${src}|${tgt}`;
};

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

const translatePlainMyMemory = async (text, from, to) => {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair(from, to)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`mymemory_http_${res.status}`);
  const json = await res.json();
  if (json.responseStatus !== 200) throw new Error('mymemory_status');
  const out = json.responseData?.translatedText?.trim();
  if (!out) throw new Error('mymemory_empty');
  return out;
};

const translatePlainGtx = async (text, from, to) => {
  const sl = from === 'zh' ? 'zh-CN' : 'en';
  const tl = to === 'zh' ? 'zh-CN' : 'en';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`gtx_http_${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.[0])) throw new Error('gtx_parse');
  return data[0].map((part) => part?.[0] || '').join('');
};

const translatePlainLibre = async (text, from, to) => {
  const base = (import.meta.env.VITE_LIBRETRANSLATE_URL || 'https://libretranslate.com').replace(/\/$/, '');
  const apiKey = import.meta.env.VITE_LIBRETRANSLATE_API_KEY || '';
  const res = await fetchWithTimeout(`${base}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: from === 'zh' ? 'zh' : 'en',
      target: to === 'zh' ? 'zh' : 'en',
      format: 'text',
      api_key: apiKey,
    }),
  });
  if (!res.ok) throw new Error(`libre_http_${res.status}`);
  const json = await res.json();
  return json.translatedText || text;
};

const translateChunked = async (text, from, to, chunkSize, translateFn) => {
  const input = (text || '').trim();
  if (!input) return text || '';
  const chunks = [];
  for (let i = 0; i < input.length; i += chunkSize) {
    chunks.push(input.slice(i, i + chunkSize));
  }
  const parts = [];
  for (let i = 0; i < chunks.length; i++) {
    parts.push(await translateFn(chunks[i], from, to));
    if (i < chunks.length - 1) await sleep(CHUNK_DELAY_MS);
  }
  return parts.join('');
};

const runProviders = async (text, from, to) => {
  const errors = [];

  try {
    return await translateChunked(text, from, to, MYMEMORY_CHUNK, translatePlainMyMemory);
  } catch (e) {
    errors.push(e);
  }

  if (import.meta.env.VITE_LIBRETRANSLATE_API_KEY) {
    try {
      return await translateChunked(text, from, to, GTX_CHUNK, translatePlainLibre);
    } catch (e) {
      errors.push(e);
    }
  }

  try {
    return await translateChunked(text, from, to, GTX_CHUNK, translatePlainGtx);
  } catch (e) {
    errors.push(e);
    throw errors[0] || e;
  }
};

export const translatePlainText = async (text, from, to) => {
  const input = (text || '').trim();
  if (!input || from === to) return text || '';

  const cacheKey = `${CACHE_PREFIX}${from}:${to}:${hashKey(input)}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const out = await runProviders(input, from, to);
  writeCache(cacheKey, out);
  return out;
};

const shouldTranslateNode = (raw, from, to) => {
  const text = (raw || '').trim();
  if (!text) return false;
  if (from === to) return false;
  if (to === 'en' && !hasCjk(text)) return false;
  if (to === 'zh' && hasCjk(text)) return false;
  return true;
};

export const translateHtml = async (html, from, to) => {
  const input = (html || '').trim();
  if (!input || from === to) return html || '';

  const cacheKey = `${CACHE_PREFIX}html:${from}:${to}:${hashKey(input)}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const doc = new DOMParser().parseFromString(input, 'text/html');
  const nodes = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent?.trim()) nodes.push(node);
  }

  for (const node of nodes) {
    const raw = node.textContent;
    if (!shouldTranslateNode(raw, from, to)) continue;
    const translated = await translatePlainText(raw, from, to);
    node.textContent = translated;
    await sleep(100);
  }

  const out = doc.body?.innerHTML || '';
  if (!out.trim() && input.trim()) {
    throw new Error('html_translate_empty');
  }
  writeCache(cacheKey, out);
  return out;
};

export const translateBlogFields = async (fields, from, to) => {
  const title = await translatePlainText(fields.title, from, to);
  const description = await translatePlainText(fields.description, from, to);
  const content = fields.content?.includes('<')
    ? await translateHtml(fields.content, from, to)
    : await translatePlainText(fields.content, from, to);
  return { title, description, content };
};

export const translateProjectFields = async (fields, from, to) => {
  const title = await translatePlainText(fields.title, from, to);
  const description = await translatePlainText(fields.description, from, to);
  const tags = await Promise.all(
    (fields.tags || []).map((tag) => translatePlainText(tag, from, to))
  );
  return { title, description, tags };
};
