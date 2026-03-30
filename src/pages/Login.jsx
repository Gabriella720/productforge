import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useTranslation } from '../context/DataContext';
import { Lock, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useData();
  const navigate = useNavigate();
  const t = useTranslation();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (login(password)) {
      navigate('/admin');
    } else {
      setError(t('login.error') || 'Invalid password');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 pt-20">
      <div className="max-w-md w-full bg-white p-12 border border-border-soft rounded-[2.5rem] shadow-2xl shadow-brand/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 blur-3xl -z-10 group-hover:bg-brand/10 transition-colors duration-500"></div>
        
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 bg-brand/10 text-brand rounded-2xl flex items-center justify-center mb-6 shadow-inner ring-1 ring-brand/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-text-main tracking-tight mb-3">
            {t('login.title') || 'Admin Access'}
          </h1>
          <p className="text-text-muted font-medium text-sm">
            {t('login.subtitle') || 'Enter your secure password to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-sm font-bold text-text-main mb-3 uppercase tracking-widest opacity-70">
              {t('login.password') || 'Password'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 bg-bg-main/50 border border-border-soft rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand focus:bg-white transition-all duration-300 text-text-main font-medium placeholder:text-text-muted/30"
              placeholder="••••••••"
              required
            />
          </div>
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold uppercase tracking-wider text-center animate-in shake duration-300">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-brand text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-brand-hover transition-all duration-300 shadow-xl shadow-brand/20 hover:shadow-brand/30 hover:-translate-y-1 active:scale-95"
          >
            {t('login.button') || 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
