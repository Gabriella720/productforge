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

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;
const REMOTE_IMAGE_RE = /^https?:\/\//i;

const stripImageExt = (name) => (name || '').replace(IMAGE_EXT_RE, '');

export const buildImageMapFromFiles = async (files) => {
  const map = new Map();
  const ordered = [];
  const list = Array.from(files || []).filter((file) => file?.type?.startsWith('image/'));

  for (const file of list) {
    const dataUrl = await readFileAsDataURL(file);
    const baseName = stripImageExt(file.name);
    ordered.push({ name: file.name, baseName, dataUrl });

    const keys = new Set([
      file.name,
      file.name.toLowerCase(),
      baseName,
      baseName.toLowerCase(),
    ]);
    if (file.webkitRelativePath) {
      keys.add(file.webkitRelativePath);
      keys.add(file.webkitRelativePath.replace(/^.*\//, ''));
      keys.add(stripImageExt(file.webkitRelativePath.replace(/^.*\//, '')));
    }
    keys.forEach((key) => {
      if (key) map.set(key, dataUrl);
    });
  }

  return { map, ordered };
};

const lookupImageDataUrl = (alt, src, imageMap, orderedImages) => {
  const altText = (alt || '').trim();
  const altKeys = altText
    ? [
        altText,
        altText.toLowerCase(),
        `${altText}.png`,
        `${altText}.jpg`,
        `${altText}.jpeg`,
        `${altText}.webp`,
        stripImageExt(altText),
      ]
    : [];

  for (const key of altKeys) {
    const hit = imageMap.get(key) || imageMap.get(key.toLowerCase());
    if (hit) return hit;
  }

  const srcBase = stripImageExt(src.split('/').pop() || '');
  if (srcBase) {
    const hit = imageMap.get(srcBase) || imageMap.get(srcBase.toLowerCase());
    if (hit) return hit;
  }

  const byAlt = orderedImages.find(
    (item) =>
      item.baseName === altText ||
      item.baseName.toLowerCase() === altText.toLowerCase() ||
      item.name === altText
  );
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
        decodeURIComponent(src),
        src.replace(/^\.\//, ''),
        src.split('/').pop(),
        stripImageExt(src.split('/').pop() || ''),
      ];
      for (const key of candidates) {
        if (!key) continue;
        const hit = imageMap.get(key) || imageMap.get(key.toLowerCase());
        if (hit) return `![${alt}](${hit})`;
      }
      warnings.push(`未找到配图：${src}（请在上传 Markdown 时一并选择图片文件）`);
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

export const isMarkdownFormat = (contentFormat, content) => {
  if (contentFormat === 'markdown') return true;
  if (contentFormat === 'html') return false;
  const text = (content || '').trim();
  if (!text || text.includes('<p>') || text.includes('<div')) return false;
  return /^#{1,6}\s/m.test(text) || /^>\s/m.test(text) || /^[-*+]\s/m.test(text) || /!\[[^\]]*\]\([^)]+\)/.test(text);
};

/** Fix Feishu-export lists: <br/> breaks and blockquotes must indent under list items. */
export const normalizeFeishuMarkdown = (markdown) => {
  let md = (markdown || '').toString();
  md = md.replace(/<br\s*\/?>/gi, '\n');

  const lines = md.split('\n');
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

/** Map markdown structure → Feishu-style semantic classes for 1:1 article layout. */
const enrichMarkdownHtml = (html) => {
  if (typeof document === 'undefined') return html;

  const doc = new DOMParser().parseFromString(`<div id="md-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('md-root');
  if (!root) return html;

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

  root.querySelectorAll('ul').forEach((el) => el.classList.add('md-feishu-list'));

  root.querySelectorAll('li').forEach((li) => {
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

export const processMarkdownUpload = async (mdFile, imageFiles = []) => {
  const text = await mdFile.text();
  const { map, ordered } = await buildImageMapFromFiles(imageFiles);
  const { markdown, warnings } = resolveMarkdownImages(text, map, ordered);
  const meta = extractMarkdownMetadata(markdown);
  return { markdown, meta, warnings };
};
