import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { assignHeadingIdsInHtml, extractBlogToc } from './blogToc';

export { extractBlogToc };

marked.setOptions({
  gfm: true,
  breaks: false,
});

const SANITIZE_OPTIONS = {
  ADD_TAGS: ['br', 'hr', 'sub', 'sup', 'details', 'summary'],
  ADD_ATTR: ['target', 'rel', 'class', 'id'],
};

export const stripMarkdownInline = (text) =>
  (text || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\\([\\`*_{}\[\]()#+\-.!])/g, '$1')
    .trim();

export const extractMarkdownMetadata = (markdown) => {
  const source = (markdown || '').toString();
  const titleMatch = source.match(/^#{1,2}\s+(.+)$/m);
  const title = titleMatch ? stripMarkdownInline(titleMatch[1]) : '';

  let description = '';
  const blocks = source.split(/\n\s*\n/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (/^#{1,6}\s/.test(trimmed)) continue;
    if (/^>\s?/.test(trimmed)) continue;
    if (/^!\[/.test(trimmed)) continue;
    if (/^[-*+]\s/.test(trimmed)) continue;
    if (/^\d+\.\s/.test(trimmed)) continue;
    description = stripMarkdownInline(trimmed.replace(/\s+/g, ' ')).slice(0, 220);
    if (description) break;
  }

  return { title, description };
};

/** Keep the first markdown H1 in sync with the edited title field. */
export const syncMarkdownTitleHeading = (markdown, title) => {
  const source = (markdown || '').toString();
  const trimmedTitle = (title || '').trim();
  if (!trimmedTitle) return source;

  if (/^#{1,2}\s+/m.test(source)) {
    return source.replace(/^#{1,2}\s+(.+)$/m, `# ${trimmedTitle}`);
  }

  return `# ${trimmedTitle}\n\n${source}`.trim();
};

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;
const MARKDOWN_EXT_RE = /\.(md|markdown)$/i;
const REMOTE_IMAGE_RE = /^https?:\/\//i;

const stripImageExt = (name) => (name || '').replace(IMAGE_EXT_RE, '');

const normalizeImageKey = (key) => {
  if (!key) return '';
  let text = String(key).trim();
  try {
    text = decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    // ignore malformed URI sequences
  }
  return text.normalize('NFC');
};

const isAsciiKey = (key) => /^[\x00-\x7F]*$/.test(key || '');

const lookupKeysFor = (raw) => {
  const keys = [];
  const seen = new Set();
  const add = (value) => {
    const normalized = normalizeImageKey(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    keys.push(normalized);
  };

  add(raw);
  const base = stripImageExt(normalizeImageKey(raw));
  if (base) {
    add(base);
    ['.png', '.jpg', '.jpeg', '.webp', '.gif'].forEach((ext) => add(`${base}${ext}`));
    if (isAsciiKey(base)) add(base.toLowerCase());
  }
  if (isAsciiKey(normalizeImageKey(raw))) add(String(raw).trim().toLowerCase());

  return keys;
};

const mapGetImage = (imageMap, raw) => {
  for (const key of lookupKeysFor(raw)) {
    const hit = imageMap.get(key);
    if (hit) return hit;
  }
  return null;
};

export const isImageUploadFile = (file) => {
  if (!file?.name) return false;
  if (file.type?.startsWith('image/')) return true;
  return IMAGE_EXT_RE.test(file.name);
};

export const isMarkdownUploadFile = (file) => {
  if (!file?.name) return false;
  if (file.type === 'text/markdown' || file.type === 'text/plain') return true;
  return MARKDOWN_EXT_RE.test(file.name);
};

export const buildImageMapFromFiles = async (files) => {
  const map = new Map();
  const ordered = [];
  const list = Array.from(files || []).filter(isImageUploadFile);

  for (const file of list) {
    const dataUrl = await readFileAsDataURL(file);
    const baseName = stripImageExt(normalizeImageKey(file.name));
    ordered.push({ name: file.name, baseName, dataUrl });

    const keySources = [file.name, baseName];
    if (file.webkitRelativePath) {
      const leaf = file.webkitRelativePath.replace(/^.*\//, '');
      keySources.push(file.webkitRelativePath, leaf, stripImageExt(leaf));
    }
    keySources.forEach((source) => {
      lookupKeysFor(source).forEach((key) => map.set(key, dataUrl));
    });
  }

  return { map, ordered };
};

const lookupImageDataUrl = (alt, src, imageMap, orderedImages) => {
  const altText = normalizeImageKey(alt);
  if (altText) {
    const hit = mapGetImage(imageMap, altText);
    if (hit) return hit;
  }

  const srcLeaf = normalizeImageKey(src.split('/').pop() || '');
  if (srcLeaf) {
    const hit = mapGetImage(imageMap, srcLeaf) || mapGetImage(imageMap, stripImageExt(srcLeaf));
    if (hit) return hit;
  }

  const byAlt = orderedImages.find((item) => {
    const itemBase = normalizeImageKey(item.baseName);
    const itemName = normalizeImageKey(item.name);
    return itemBase === altText || itemName === altText || stripImageExt(itemName) === altText;
  });
  return byAlt?.dataUrl || null;
};

export const resolveMarkdownImages = (markdown, imageMap = new Map(), orderedImages = []) => {
  const warnings = [];
  let orderIndex = 0;

  const resolved = (markdown || '').replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, rawSrc) => {
    const src = rawSrc.trim().replace(/^<|>$/g, '');

    if (src.startsWith('data:')) return match;

    // Relative / local path in markdown
    if (!REMOTE_IMAGE_RE.test(src) && !src.startsWith('/')) {
      const candidates = [
        src,
        src.replace(/^\.\//, ''),
        src.split('/').pop(),
        stripImageExt(src.split('/').pop() || ''),
      ];
      for (const key of candidates) {
        const hit = mapGetImage(imageMap, key);
        if (hit) return `![${alt}](${hit})`;
      }
      warnings.push(`未找到配图：${src}（导入时请一并选中同名图片，如 全景数据洞察.jpeg）`);
      return match;
    }

    // Site-local public path — keep as-is
    if (src.startsWith('/') || src.includes('/uploads/')) {
      return match;
    }

    // Remote URL (Feishu etc.) — replace with uploaded images by alt / order
    const mapped = lookupImageDataUrl(alt, src, imageMap, orderedImages);
    if (mapped) return `![${alt}](${mapped})`;

    if (orderIndex < orderedImages.length) {
      const picked = orderedImages[orderIndex];
      orderIndex += 1;
      return `![${alt}](${picked.dataUrl})`;
    }

    if (REMOTE_IMAGE_RE.test(src)) {
      warnings.push(
        `图片无法外链加载：${altTextLabel(alt)}（飞书/内网链接需在上传时选择本地配图，按顺序或文件名匹配）`
      );
    }
    return match;
  });

  return { markdown: resolved, warnings };
};

const altTextLabel = (alt) => {
  const text = (alt || '').trim();
  return text || 'Image';
};

const looksLikeHtmlArticle = (text) =>
  /<(?:p|div|h[1-6]|ul|ol|table|blockquote)\b/i.test(text || '');

const looksLikeMarkdownArticle = (text) => {
  const source = (text || '').trim();
  if (!source) return false;
  return (
    /^#{1,6}\s/m.test(source) ||
    /^>\s/m.test(source) ||
    /^[-*+]\s/m.test(source) ||
    /!\[[^\]]*\]\([^)]+\)/.test(source)
  );
};

export const isMarkdownFormat = (contentFormat, content) => {
  if (contentFormat === 'markdown') return true;
  const text = (content || '').trim();
  if (!text) return false;
  if (contentFormat === 'html') {
    return !looksLikeHtmlArticle(text) && looksLikeMarkdownArticle(text);
  }
  if (looksLikeHtmlArticle(text)) return false;
  return looksLikeMarkdownArticle(text);
};

const FOOTER_EMOJI_RE = /^(?:🔎|🔍|📦|🗂️|📁|💻|🖥️|🗃️|📂|🧰)/;

export const isFooterMarkdownLine = (line) => {
  const trimmed = (line || '').trim().replace(/^[-*+]\s+/, '');
  if (!trimmed) return false;
  if (FOOTER_EMOJI_RE.test(trimmed)) return true;
  return /^\p{Extended_Pictographic}/u.test(trimmed);
};

/** Group consecutive emoji footer rows into a list so spacing and bold stay consistent. */
const normalizeFooterLinkRowLines = (lines) => {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!isFooterMarkdownLine(line)) {
      out.push(line);
      i += 1;
      continue;
    }

    const group = [];
    while (i < lines.length) {
      const current = lines[i];
      if (current.trim() === '') {
        const next = lines[i + 1];
        if (next !== undefined && isFooterMarkdownLine(next)) {
          i += 1;
          continue;
        }
        break;
      }
      if (!isFooterMarkdownLine(current)) break;
      group.push(current.trim().replace(/^[-*+]\s+/, ''));
      i += 1;
    }

    group.forEach((item) => out.push(`- ${item}`));
  }

  return out;
};

/** Fix Feishu-export lists: <br/> breaks and blockquotes must indent under list items. */
export const normalizeFeishuMarkdown = (markdown) => {
  let md = (markdown || '').toString();
  md = md.replace(/<br\s*\/?>/gi, '\n');

  const lines = normalizeFooterLinkRowLines(md.split('\n'));
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^[-*+]\s/.test(line) && !/^\s/.test(line)) {
      out.push(line);
      i += 1;
      const contIndent = '  ';

      while (i < lines.length) {
        const next = lines[i];
        if (/^#{1,6}\s/.test(next)) break;
        if (/^[-*+]\s/.test(next) && !/^\s/.test(next)) break;
        if (next.trim() === '') {
          out.push(next);
          i += 1;
          continue;
        }
        if (/^>\s?/.test(next)) {
          out.push(`${contIndent}${next}`);
          i += 1;
          continue;
        }
        out.push(next.startsWith(contIndent) ? next : `${contIndent}${next}`);
        i += 1;
      }
      continue;
    }

    out.push(line);
    i += 1;
  }

  return out.join('\n');
};

export const renderMarkdownToHtml = (markdown) => {
  const source = (markdown || '').toString();
  if (!source.trim()) return '';
  const normalized = normalizeFeishuMarkdown(source);
  const rawHtml = marked.parse(normalized, { async: false });
  const enriched = enrichMarkdownHtml(rawHtml);
  return DOMPurify.sanitize(enriched, SANITIZE_OPTIONS);
};

const isFooterRow = (el) => isFooterMarkdownLine((el.textContent || '').trim());

/** Map markdown structure → Feishu-style semantic classes for 1:1 article layout. */
const enrichMarkdownHtml = (html) => {
  if (typeof document === 'undefined') return html;

  const doc = new DOMParser().parseFromString(`<div id="md-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('md-root');
  if (!root) return html;

  root.querySelectorAll('u').forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });

  root.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'));

  root.querySelectorAll('h2').forEach((el) => {
    el.classList.add('md-h2-banner');
    const wrap = doc.createElement('div');
    wrap.className = 'md-h2-wrap';
    el.parentNode?.insertBefore(wrap, el);
    wrap.appendChild(el);
  });

  root.querySelectorAll('h5').forEach((el) => {
    if (!el.closest('blockquote')) el.classList.add('md-h5-section');
    else el.classList.add('md-h5-insight-title');
  });

  root.querySelectorAll('h6').forEach((el) => {
    el.classList.add('md-h6-minor');
    const text = (el.textContent || '').trim();
    if (/^观点[一二三四五六七八九十\d]/.test(text)) {
      el.classList.add('md-insight-point');
    } else if (/^\d+\.\s/.test(text)) {
      el.classList.add('md-numbered-heading');
    }
  });

  let insightsAssigned = false;
  root.querySelectorAll('blockquote').forEach((el) => {
    const inList = Boolean(el.closest('li'));
    if (!insightsAssigned && el.querySelector('h5')) {
      el.classList.add('md-insights-card');
      insightsAssigned = true;
      el.querySelectorAll('h6').forEach((h6) => h6.classList.add('md-insight-point'));
    } else {
      el.classList.add('md-callout');
      if (inList) el.classList.add('md-callout-inline');
    }
  });

  root.querySelectorAll('img').forEach((el) => {
    el.classList.add('md-figure');
    const src = el.getAttribute('src') || '';
    if (/feishu\.cn|larkoffice|internal-api-drive-stream/i.test(src)) {
      el.classList.add('md-image-remote');
      el.setAttribute('data-remote-src', src);
    }
  });

  root.querySelectorAll('ul').forEach((ul) => {
    ul.classList.add('md-feishu-list');
    const items = Array.from(ul.children).filter((child) => child.tagName === 'LI');
    if (items.length > 0 && items.every((li) => isFooterRow(li))) {
      ul.classList.add('md-footer-links');
    }
  });

  root.querySelectorAll('p').forEach((p) => {
    if (isFooterRow(p)) p.classList.add('md-footer-row');
  });

  root.querySelectorAll('li').forEach((li) => {
    if (isFooterRow(li)) {
      li.classList.add('md-footer-row');
      return;
    }
    const label =
      li.querySelector(':scope > p:first-child strong:first-child') ||
      li.querySelector(':scope > strong:first-child');
    if (label) label.classList.add('md-list-label');
  });

  root.querySelectorAll('p > strong').forEach((el) => {
    const text = (el.textContent || '').trim();
    if (/^\d+\.\s/.test(text)) el.classList.add('md-lead-strong');
  });

  return root.innerHTML;
};

export const renderBlogContentToHtml = (content, contentFormat, tocItems = null) => {
  const text = (content || '').toString();
  if (!text.trim()) return '';
  const toc = tocItems || extractBlogToc(text, contentFormat);
  let html = '';
  if (isMarkdownFormat(contentFormat, text)) {
    html = renderMarkdownToHtml(text);
  } else {
    html = text;
  }
  if (toc.length) {
    html = assignHeadingIdsInHtml(html, toc);
  }
  return html;
};

const countDataImageRefs = (markdown) =>
  ((markdown || '').match(/!\[[^\]]*\]\(data:image/g) || []).length;

export const embedImagesIntoMarkdown = async (markdown, imageFiles = []) => {
  const { map, ordered } = await buildImageMapFromFiles(imageFiles);
  const before = countDataImageRefs(markdown);
  const { markdown: resolved, warnings } = resolveMarkdownImages(markdown, map, ordered);
  return {
    markdown: resolved,
    warnings,
    embeddedCount: countDataImageRefs(resolved) - before,
    imageFileCount: Array.from(imageFiles || []).filter(isImageUploadFile).length,
  };
};

export const processMarkdownUpload = async (mdFile, imageFiles = []) => {
  const text = await mdFile.text();
  const { map, ordered } = await buildImageMapFromFiles(imageFiles);
  const { markdown, warnings } = resolveMarkdownImages(text, map, ordered);
  const meta = extractMarkdownMetadata(markdown);
  return {
    markdown,
    meta,
    warnings,
    embeddedCount: countDataImageRefs(markdown),
    imageFileCount: Array.from(imageFiles || []).filter(isImageUploadFile).length,
  };
};

/** Pick .md + images from one file dialog; images are embedded automatically. */
export const processMarkdownImportFromFiles = async (files) => {
  const list = Array.from(files || []);
  const mdFile = list.find(isMarkdownUploadFile);
  const imageFiles = list.filter(isImageUploadFile);

  if (!mdFile) {
    return { kind: 'images_only', imageFiles };
  }

  const result = await processMarkdownUpload(mdFile, imageFiles);
  return { kind: 'markdown', ...result };
};
