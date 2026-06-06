import React, { useEffect, useMemo, useRef } from 'react';
import { extractBlogToc, isMarkdownFormat, renderBlogContentToHtml } from '../utils/markdown';

const BlogContent = ({ content, contentFormat, className = '', onTocChange }) => {
  const containerRef = useRef(null);
  const isFeishuArticle = isMarkdownFormat(contentFormat, content);
  const tocItems = useMemo(
    () => extractBlogToc(content, contentFormat),
    [content, contentFormat]
  );
  const html = useMemo(
    () => renderBlogContentToHtml(content, contentFormat, tocItems),
    [content, contentFormat, tocItems]
  );

  useEffect(() => {
    onTocChange?.(tocItems);
  }, [tocItems, onTocChange]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    const onError = (event) => {
      const img = event.currentTarget;
      img.classList.add('md-image-error');
      if (!img.getAttribute('alt')?.trim()) {
        img.setAttribute('alt', '图片加载失败');
      }
    };

    const images = root.querySelectorAll('img');
    images.forEach((img) => {
      img.addEventListener('error', onError);
      if (img.complete && img.naturalWidth === 0 && img.src) {
        onError({ currentTarget: img });
      }
    });

    return () => {
      images.forEach((img) => img.removeEventListener('error', onError));
    };
  }, [html]);

  if (!html) return null;

  return (
    <div
      ref={containerRef}
      className={[
        'rich-text-content',
        isFeishuArticle ? 'markdown-body article-feishu' : 'markdown-body',
        className,
      ].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default BlogContent;
