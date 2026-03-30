import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Clock, Eye, Heart, Share2, 
  MessageSquare, Send, Smile, Image as ImageIcon, X 
} from 'lucide-react';
import { useData, useTranslation } from '../context/DataContext';

const BlogDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useTranslation();
  const { blogPosts, incrementView, incrementLike, incrementShare, addComment } = useData();
  const post = blogPosts.find(p => p.id === parseInt(id));

  const [commentText, setCommentText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [commentImage, setCommentImage] = useState(null);
  const fileInputRef = useRef(null);
  const incrementedRef = useRef(false);

  useEffect(() => {
    if (post && !incrementedRef.current) {
      incrementView(post.id);
      incrementedRef.current = true;
    } else if (!post) {
      navigate('/blog');
    }
  }, [id, post, incrementView, navigate]);

  if (!post) return null;

  const handleLike = (e) => {
    e.preventDefault();
    incrementLike(post.id);
  };

  const handleShare = (e) => {
    e.preventDefault();
    incrementShare(post.id);
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard!');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCommentImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!commentText.trim() && !commentImage) return;

    const newComment = {
      author: "Guest User",
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      content: commentText,
      image: commentImage,
      avatar: `https://ui-avatars.com/api/?name=Guest&background=random`
    };

    addComment(post.id, newComment);
    setCommentText('');
    setCommentImage(null);
  };

  const emojis = ['😊', '😂', '😍', '🙌', '🔥', '👏', '🤔', '👍', '❤️', '✨'];

  return (
    <div className="max-w-4xl mx-auto px-4 pt-16 pb-24">
      {/* Navigation */}
      <Link 
        to="/blog" 
        className="inline-flex items-center text-brand hover:text-brand-hover transition-all mb-12 group font-bold tracking-tight"
      >
        <ArrowLeft className="w-5 h-5 mr-2 transition-transform group-hover:-translate-x-2" />
        {t('blogDetail.back')}
      </Link>

      {/* Header */}
      <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-4xl md:text-6xl font-black text-text-main mb-8 leading-[1.1] tracking-tight">
          {post.title}
        </h1>
        
        <div className="flex flex-wrap items-center gap-6 text-text-muted/80 font-bold text-xs uppercase tracking-widest mb-8">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-brand" />
            {post.date}
          </div>
          <div className="flex items-center">
            <Eye className="w-4 h-4 mr-2 text-brand" />
            {post.views?.toLocaleString() || 0} {t('blog.views') || 'Views'}
          </div>
        </div>
      </div>

      {/* Article Content */}
      <article className="prose prose-slate md:prose-lg max-w-none mb-24 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300
        prose-headings:text-text-main prose-headings:font-black prose-headings:tracking-tight
        prose-p:text-text-main/80 prose-p:leading-relaxed prose-p:font-medium
        prose-img:rounded-[2rem] prose-img:shadow-xl
        prose-blockquote:border-l-4 prose-blockquote:border-brand prose-blockquote:bg-brand/5 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-2xl prose-blockquote:font-bold prose-blockquote:text-brand
        prose-strong:text-text-main prose-strong:font-bold
        prose-a:text-brand prose-a:font-bold prose-a:no-underline hover:prose-a:underline
        rich-text-content
      ">
        <div dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>

      {/* Social Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-24 py-8 border-y border-border-soft animate-in fade-in slide-in-from-bottom-14 duration-1000 delay-400">
        <button 
          onClick={handleLike}
          className={`flex items-center px-8 py-3 rounded-full transition-all duration-300 font-bold text-sm uppercase tracking-widest group shadow-sm hover:shadow-md active:scale-95 ${
            post.isLiked 
              ? 'bg-red-50 text-red-500 border border-red-100' 
              : 'bg-brand/5 text-brand border border-brand/10 hover:bg-brand/10'
          }`}
        >
          <Heart className={`w-5 h-5 mr-3 transition-transform group-hover:scale-110 ${post.isLiked ? 'fill-red-500' : ''}`} />
          {post.likes?.toLocaleString() || 0} {t('blogDetail.likes') || 'Likes'}
        </button>
        <button 
          onClick={handleShare}
          className="flex items-center px-8 py-3 bg-brand/5 text-brand border border-brand/10 rounded-full hover:bg-brand/10 transition-all duration-300 font-bold text-sm uppercase tracking-widest group shadow-sm hover:shadow-md active:scale-95"
        >
          <Share2 className="w-5 h-5 mr-3 transition-transform group-hover:rotate-12" />
          {post.shares?.toLocaleString() || 0} {t('blogDetail.shares') || 'Shares'}
        </button>
      </div>

      {/* Comments Section */}
      <section className="pt-24 border-t border-border-soft animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-500">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-3xl font-black text-text-main tracking-tight flex items-center">
            <MessageSquare className="w-8 h-8 mr-4 text-brand" />
            {t('blogDetail.comments')}
            <span className="ml-4 px-3 py-1 bg-brand text-white text-sm font-bold rounded-full shadow-lg shadow-brand/20">
              {post.comments?.length || 0}
            </span>
          </h2>
        </div>

        {/* Comment Form */}
        <div className="bg-white p-8 rounded-[2rem] border border-border-soft shadow-xl shadow-brand/5 mb-16 relative group">
          <div className="absolute inset-0 bg-brand/5 rounded-[2rem] opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 -z-10" />
          
          <form onSubmit={handleSubmitComment}>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t('blogDetail.commentPlaceholder')}
              className="w-full px-6 py-5 bg-bg-main/50 border border-border-soft rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand focus:bg-white transition-all duration-300 h-32 resize-none text-text-main font-medium placeholder:text-text-muted/50"
            />

            {commentImage && (
              <div className="mt-6 relative inline-block group">
                <img src={commentImage} alt="Comment preview" className="h-32 rounded-2xl shadow-lg ring-4 ring-white" />
                <button 
                  onClick={() => setCommentImage(null)}
                  className="absolute -top-3 -right-3 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-110"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmoji(!showEmoji)}
                    className="p-3 text-text-muted hover:text-brand hover:bg-brand/5 rounded-xl transition-all duration-300"
                  >
                    <Smile className="w-6 h-6" />
                  </button>
                  {showEmoji && (
                    <div className="absolute bottom-full mb-4 left-0 p-4 bg-white border border-border-soft rounded-2xl shadow-2xl flex flex-wrap gap-2 w-56 z-20 animate-in zoom-in-95 duration-200">
                      {emojis.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setCommentText(prev => prev + emoji);
                            setShowEmoji(false);
                          }}
                          className="text-2xl hover:scale-125 transition-transform p-1"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className="p-3 text-text-muted hover:text-brand hover:bg-brand/5 rounded-xl transition-all duration-300"
                >
                  <ImageIcon className="w-6 h-6" />
                </button>
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              <button
                type="submit"
                disabled={!commentText.trim() && !commentImage}
                className="inline-flex items-center px-8 py-3.5 bg-brand text-white rounded-xl font-bold hover:bg-brand-hover transition-all duration-300 shadow-xl shadow-brand/20 hover:shadow-brand/30 hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none"
              >
                {t('blogDetail.submitComment')}
                <Send className="ml-2 w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Comment List */}
        <div className="space-y-8">
          {post.comments?.length > 0 ? (
            post.comments.map((comment, index) => (
              <div key={index} className="flex space-x-6 p-8 bg-white border border-border-soft rounded-[2rem] hover:shadow-lg transition-all duration-500 group">
                <img 
                  src={comment.avatar} 
                  alt={comment.author}
                  className="w-14 h-14 rounded-2xl shadow-md group-hover:rotate-6 transition-transform duration-500"
                />
                <div className="flex-grow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-text-main text-lg tracking-tight">{comment.author}</h4>
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest bg-bg-main px-3 py-1 rounded-full">{comment.date}</span>
                  </div>
                  <p className="text-text-main/80 leading-relaxed font-medium mb-4">{comment.content}</p>
                  {comment.image && (
                    <img src={comment.image} alt="" className="max-w-md rounded-2xl shadow-xl ring-1 ring-border-soft mb-2" />
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-bg-main/30 rounded-[2.5rem] border border-border-soft border-dashed">
              <MessageSquare className="w-12 h-12 text-text-muted/20 mx-auto mb-4" />
              <p className="text-text-muted font-bold uppercase tracking-widest text-xs">{t('blogDetail.noComments') || 'Be the first to comment'}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default BlogDetail;
