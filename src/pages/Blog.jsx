import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ArrowRight, Eye, Heart, Share2, Search, X } from 'lucide-react';
import { useData, useTranslation } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { useBlogLocale } from '../hooks/useBlogLocale';
import { getDisplayLocaleBlock, needsAutoTranslation } from '../utils/blogLocale';

const useIsTruncated = (ref, text) => {
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const check = () => {
      setIsTruncated(el.scrollHeight > el.clientHeight + 1);
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, text]);

  return isTruncated;
};

const BlogPostCard = ({ post, language, t }) => {
  const base = getDisplayLocaleBlock(post, language);
  const shouldTranslate = needsAutoTranslation(post, language);
  const { title, description, loading } = useBlogLocale(post, { includeContent: false });
  const displayTitle = shouldTranslate
    ? (loading && !title ? t('blog.translating') : (title || base.title))
    : base.title;
  const displayDescription = shouldTranslate ? (description || base.description) : base.description;
  const descriptionRef = useRef(null);
  const isDescriptionTruncated = useIsTruncated(descriptionRef, displayDescription);

  return (
    <Link
      to={`/blog/${post.id}`}
      className="relative flex flex-col border border-border-soft rounded-2xl bg-white hover:shadow-[0_20px_40px_rgba(59,130,246,0.1)] transition-all duration-500 group hover:-translate-y-1 hover:z-20"
    >
      <div className="relative overflow-hidden rounded-t-2xl aspect-[16/10] shrink-0">
        <div className="absolute inset-0 bg-bg-main" />
        <img
          src={post.image}
          alt={displayTitle}
          className="relative w-full h-full object-contain transition-transform duration-700 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-brand/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-center space-x-4 text-[10px] font-bold text-text-muted/70 uppercase tracking-widest mb-2">
          <span className="flex items-center">
            <Calendar className="w-3 h-3 mr-1" />
            {post.date}
          </span>
        </div>

        <h3 className="text-lg font-bold text-text-main mb-2 group-hover:text-brand transition-colors duration-300 leading-snug line-clamp-2">
          {displayTitle}
        </h3>

        <div className="relative mb-4">
          <p
            ref={descriptionRef}
            className="text-sm text-text-muted leading-relaxed font-medium line-clamp-2 group-hover:text-text-main/80 transition-colors duration-300"
          >
            {displayDescription}
          </p>
          {isDescriptionTruncated && displayDescription && (
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 right-0 bottom-full z-30 mb-2 max-h-36 overflow-y-auto rounded-xl border border-border-soft bg-white px-3 py-2.5 text-sm leading-relaxed text-text-muted shadow-lg opacity-0 invisible translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0"
            >
              {displayDescription}
            </div>
          )}
        </div>

        <div className="mt-auto pt-4 border-t border-border-soft flex items-center justify-between">
          <span className="text-xs font-bold text-brand group-hover:text-brand-hover transition-colors duration-300 flex items-center">
            {t('blog.readMore') || 'Read More'}
            <ArrowRight className="ml-1.5 w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-2" />
          </span>
          <div className="flex items-center space-x-3 text-text-muted/40 group-hover:text-brand/50 transition-colors duration-300">
            <div className="flex items-center">
              <Eye className="w-3.5 h-3.5 mr-1" />
              <span className="text-[10px] font-bold">{post.views?.toLocaleString() || 0}</span>
            </div>
            <div className="flex items-center">
              <Heart className="w-3.5 h-3.5 mr-0.5" />
              <span className="text-[10px] font-bold">{post.likes || 0}</span>
            </div>
            <div className="flex items-center">
              <Share2 className="w-3.5 h-3.5 mr-0.5" />
              <span className="text-[10px] font-bold">{post.shares || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

const Blog = () => {
  const { blogPosts, language } = useData();
  const t = useTranslation();
  const [sortBy, setSortBy] = useState('latest'); // 'latest' or 'popular'
  const [searchQuery, setSearchQuery] = useState('');

  const getPostText = (post) => getDisplayLocaleBlock(post, language);

  // 1. Filter posts based on search query (fuzzy search in title and content)
  const filteredPosts = blogPosts.filter(post => {
    const text = getPostText(post);
    const query = searchQuery.toLowerCase();
    const titleMatch = text.title.toLowerCase().includes(query);
    const contentMatch = (text.content || '').toLowerCase().includes(query);
    const descriptionMatch = text.description.toLowerCase().includes(query);
    return titleMatch || contentMatch || descriptionMatch;
  });

  // 2. Sort filtered posts
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortBy === 'latest') {
      return new Date(b.date) - new Date(a.date);
    } else {
      return (b.views || 0) - (a.views || 0);
    }
  });

  return (
    <div className="max-w-6xl mx-auto px-4 pt-8 pb-24">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-text-main mb-3 tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
          {t('blog.title')}
        </h1>
        
        <p className="text-base text-text-muted max-w-2xl mb-6 leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          {t('blog.subtitle')}
        </p>

        {/* Search and Sort Controls */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
          <div className="relative w-full md:max-w-md group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-text-muted group-focus-within:text-brand transition-all duration-300" />
            </div>
            <input
              type="text"
              placeholder={t('blog.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-12 pr-12 py-4 bg-white border border-border-soft rounded-[1.5rem] text-sm font-medium placeholder:text-text-muted/60 focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand transition-all duration-300 shadow-sm hover:shadow-md"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-5 flex items-center text-text-muted hover:text-brand transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="flex items-center bg-white p-1.5 rounded-2xl border border-border-soft self-start md:self-auto shadow-sm">
            <button 
              onClick={() => setSortBy('latest')}
              className={`flex items-center px-8 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                sortBy === 'latest' 
                  ? 'bg-brand text-white shadow-lg shadow-brand/20' 
                  : 'text-text-muted hover:text-brand hover:bg-brand/5'
              }`}
            >
              <Calendar className="w-4 h-4 mr-2" />
              {t('blog.latest')}
            </button>
            <button 
              onClick={() => setSortBy('popular')}
              className={`flex items-center px-8 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                sortBy === 'popular' 
                  ? 'bg-brand text-white shadow-lg shadow-brand/20' 
                  : 'text-text-muted hover:text-brand hover:bg-brand/5'
              }`}
            >
              <Eye className="w-4 h-4 mr-2" />
              {t('blog.popular')}
            </button>
          </div>
        </div>
      </div>

      {sortedPosts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-400">
          {sortedPosts.map((post) => (
            <BlogPostCard key={post.id} post={post} language={language} t={t} />
          ))}
        </div>
      ) : (
        <div className="text-center py-32 bg-white rounded-[2.5rem] border border-border-soft border-dashed animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-bg-main rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-text-muted/30" />
          </div>
          <h3 className="text-2xl font-bold text-text-main mb-2">{t('blog.noResultsTitle') || 'No posts found'}</h3>
          <p className="text-text-muted font-medium">{t('blog.noResultsDesc') || 'Try adjusting your search or filter'}</p>
        </div>
      )}
    </div>
  );
};

export default Blog;
