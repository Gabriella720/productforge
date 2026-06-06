import React, { useEffect, useState } from 'react';
import { List } from 'lucide-react';

const BlogTableOfContents = ({ items = [], title = 'Contents' }) => {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (!items.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: [0, 1] }
    );

    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  if (!items.length) return null;

  const handleClick = (event, id) => {
    event.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: 'smooth' });
    setActiveId(id);
  };

  return (
    <nav className="blog-toc" aria-label={title}>
      <div className="flex items-center gap-2 mb-4 text-text-main font-bold text-sm">
        <List className="w-4 h-4 text-brand" />
        <span>{title}</span>
      </div>
      <ul className="space-y-1 border-l border-border-soft">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(event) => handleClick(event, item.id)}
              className={[
                'block py-1.5 text-sm leading-relaxed border-l-2 -ml-px transition-colors break-words',
                item.level >= 5 ? 'pl-5' : item.level === 4 ? 'pl-4' : item.level === 3 ? 'pl-3' : 'pl-2.5',
                activeId === item.id
                  ? 'border-brand text-brand font-semibold'
                  : 'border-transparent text-text-muted hover:text-brand hover:border-brand/40',
              ].join(' ')}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default BlogTableOfContents;
