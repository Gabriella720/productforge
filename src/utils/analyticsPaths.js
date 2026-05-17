export const slugify = (text, id) => {
  const raw = (text || '').trim();
  if (!raw) return `item-${id}`;

  const latin = raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  if (latin.length >= 2) return latin;

  const cjk = raw
    .replace(/[「」『』"'']/g, '')
    .replace(/[：:，,。.!？?；;（）()[\]{}]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/gi, '')
    .slice(0, 48);

  return cjk || `item-${id}`;
};

const getBlogTitle = (post, language) => {
  if (!post) return '';
  const i18n = post.i18n?.[language] || post.i18n?.en || post.i18n?.zh || {};
  return (i18n.title || post.title || '').trim();
};

export const getProjectSlug = (project) => slugify(project?.title, project?.id);

export const getBlogSlug = (post, language) => slugify(getBlogTitle(post, language), post?.id);

export const resolveAnalyticsPath = (pathname, { projects = [], blogPosts = [], language = 'en' } = {}) => {
  const path = (pathname || '/').replace(/\/$/, '') || '/';

  const blogMatch = path.match(/^\/blog\/(\d+)$/);
  if (blogMatch) {
    const post = blogPosts.find((p) => String(p.id) === blogMatch[1]);
    if (post) return `/blog/${getBlogSlug(post, language)}`;
  }

  return path;
};

export const buildProjectPath = (project, action) => {
  const slug = getProjectSlug(project);
  if (action === 'github' || action === 'demo') return `/projects/${slug}/${action}`;
  return `/projects/${slug}`;
};

export const buildBlogPath = (post, language) => `/blog/${getBlogSlug(post, language)}`;
