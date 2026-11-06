'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers, ArrowRight, ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { ThemeToggle } from '../../components/marketing/ThemeToggle';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await api.post('/api/auth/login', { email, password });
      setAuth(res.data.user, res.data.accessToken);
      router.push('/app');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#1A1D21] flex flex-col justify-center items-center p-4">
      <header className="absolute top-0 inset-x-0 flex items-center justify-between p-4 sm:p-6">
        <Link
          href="/"
          aria-label="Back to home"
          title="Back to home"
          className="w-9 h-9 rounded-full flex items-center justify-center border bg-white border-slate-300 hover:border-slate-400 text-slate-700 dark:bg-zinc-900 dark:border-white/15 dark:hover:border-white/30 dark:text-zinc-200 shadow-sm transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <ThemeToggle />
      </header>
      <div className="w-full max-w-md bg-white dark:bg-[#222529] border border-slate-200 dark:border-gray-700/80 rounded-2xl p-8 shadow-xl dark:shadow-2xl">
        <Link href="/" className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 bg-slack-activeChannel rounded-xl flex items-center justify-center text-white shadow-lg">
            <Layers size={24} />
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">ORBIT</span>
        </Link>

        <h1 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">Sign in to your workspace</h1>
        <p className="text-xs text-slate-500 dark:text-gray-400 text-center mb-6">
          Enter your email address and password to continue.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#1A1D21] border border-slate-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-slack-activeChannel"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#1A1D21] border border-slate-300 dark:border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-slack-activeChannel"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-slack-activeChannel hover:bg-[#0d5388] text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 dark:text-gray-400 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-slack-activeChannel hover:underline font-semibold">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
