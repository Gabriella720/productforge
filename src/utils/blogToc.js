import { isMarkdownFormat, stripMarkdownInline } from './markdown';

export const slugifyHeading = (text) => {
  const base = stripMarkdownInline((text || '').toString())
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'section';
};

const uniqueHeadingId = (text, used) => {
  const base = slugifyHeading(text);
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
};

export const buildHeadingIds = (items) => {
  const used = new Set();
  return items.map((item) => ({
    ...item,
    id: uniqueHeadingId(item.text, used),
  }));
};

const parseMarkdownHeadings = (markdown) => {
  const items = [];
  const lines = (markdown || '').toString().split('\n');
  for (const line of lines) {
    const quoted = line.match(/^>\s*(#{1,6})\s+(.+)$/);
    if (quoted) {
      const level = quoted[1].length;
      if (level >= 2) items.push({ level, text: stripMarkdownInline(quoted[2]) });
      continue;
    }
    const plain = line.match(/^(#{1,6})\s+(.+)$/);
    if (plain) {
      const level = plain[1].length;
      if (level >= 2) items.push({ level, text: stripMarkdownInline(plain[2]) });
    }
  }
  return buildHeadingIds(items);
};

const parseHtmlHeadings = (html) => {
  if (typeof document === 'undefined') return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const nodes = doc.querySelectorAll('h2, h3, h4, h5, h6');
  const items = Array.from(nodes).map((node) => ({
    level: Number(node.tagName.slice(1)),
    text: (node.textContent || '').trim(),
  }));
  return buildHeadingIds(items.filter((item) => item.text));
};

export const extractBlogToc = (content, contentFormat) => {
  const text = (content || '').toString();
  if (!text.trim()) return [];
  if (isMarkdownFormat(contentFormat, text)) {
    return parseMarkdownHeadings(text);
  }
  return parseHtmlHeadings(text);
};

export const assignHeadingIdsInHtml = (html, tocItems) => {
  if (typeof document === 'undefined' || !html) return html;
  const doc = new DOMParser().parseFromString(`<div id="toc-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('toc-root');
  if (!root) return html;

  const headings = root.querySelectorAll('h2, h3, h4, h5, h6');
  headings.forEach((el, index) => {
    const item = tocItems[index];
    if (item?.id) el.id = item.id;
  });

  return root.innerHTML;
};
