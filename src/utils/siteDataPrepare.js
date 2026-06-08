import { publishBinaryToRepo } from './githubPublish';

const DATA_URL_RE = /data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)/g;
const MAX_SITE_DATA_BYTES = 700000;

const extFromMime = (mime) => {
  const m = (mime || '').toLowerCase();
  if (m === 'jpeg' || m === 'jpg') return 'jpg';
  if (m === 'png') return 'png';
  if (m === 'webp') return 'webp';
  if (m === 'gif') return 'gif';
  return 'img';
};

const hashDataUrl = (dataUrl) => {
  let hash = 0;
  for (let i = 0; i < dataUrl.length; i += 1) {
    hash = ((hash << 5) - hash) + dataUrl.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const collectDataUrls = (text) => {
  const urls = new Set();
  const re = new RegExp(DATA_URL_RE.source, 'g');
  let match = re.exec(text);
  while (match) {
    urls.add(match[0]);
    match = re.exec(text);
  }
  return Array.from(urls);
};

/** Upload embedded base64 images to public/uploads and replace with site paths. */
export const prepareSiteDataForPublish = async (contentString, config) => {
  const base = (contentString || '').toString();
  if (!base) return { ok: false, error: '没有可同步的数据。' };

  const dataUrls = collectDataUrls(base);
  if (!dataUrls.length) {
    const bytes = new TextEncoder().encode(base).length;
    if (bytes > MAX_SITE_DATA_BYTES) {
      return {
        ok: false,
        error: `site-data.json 过大（${Math.round(bytes / 1024)}KB），GitHub API 上限约 1MB。请减少博客正文体积后重试。`,
      };
    }
    return { ok: true, content: base, uploadedImages: 0 };
  }

  const basePath = (import.meta.env.BASE_URL || '/productforge/').replace(/\/?$/, '/');
  let json = base;

  for (const dataUrl of dataUrls) {
    const matched = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!matched) continue;

    const ext = extFromMime(matched[1]);
    const filename = `blog-${hashDataUrl(dataUrl)}.${ext}`;
    const repoPath = `public/uploads/${filename}`;
    const publicUrl = `${basePath}uploads/${filename}`;

    const uploadRes = await publishBinaryToRepo({
      ...config,
      path: repoPath,
      base64Content: matched[2],
      message: `Upload blog image ${filename}`,
    });
    if (!uploadRes.ok) {
      return {
        ok: false,
        error: uploadRes.error || `配图 ${filename} 上传失败。`,
      };
    }

    json = json.split(dataUrl).join(publicUrl);
  }

  const bytes = new TextEncoder().encode(json).length;
  if (bytes > MAX_SITE_DATA_BYTES) {
    return {
      ok: false,
      error: `配图已上传，但 site-data.json 仍过大（${Math.round(bytes / 1024)}KB）。请精简正文后重试。`,
    };
  }

  return { ok: true, content: json, uploadedImages: dataUrls.length };
};
