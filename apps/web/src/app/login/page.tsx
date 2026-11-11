'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { AuthShell, AuthError, MicrosoftSignIn, authInputClass, authLabelClass, authButtonClass } from '../../components/auth/AuthShell';

// Error codes sent back by the server's Microsoft callback (/api/auth/microsoft/callback).
const MICROSOFT_ERRORS: Record<string, string> = {
  microsoft_cancelled: 'Microsoft sign-in was cancelled.',
  microsoft_invalid_state: 'Your sign-in session expired. Please try again.',
  microsoft_account_exists:
    'An account with this email already exists. Sign in with your email and password below to link your Microsoft account — after that, "Sign in with Microsoft" will work.',
  microsoft_no_email: 'Your Microsoft account has no usable email address.',
  microsoft_not_configured: 'Sign in with Microsoft is not available.',
  account_deactivated: 'Account is deactivated',
  microsoft_failed: 'Sign in with Microsoft failed. Please try again.',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  // Finish a Microsoft sign-in: the server redirects here with #token=… or ?error=…
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    const errorCode = new URLSearchParams(window.location.search).get('error');
    if (!token && !errorCode) return;
    window.history.replaceState(null, '', window.location.pathname); // drop the token from the URL/history

    if (errorCode) {
      setError(MICROSOFT_ERRORS[errorCode] || MICROSOFT_ERRORS.microsoft_failed);
      return;
    }
    localStorage.setItem('orbit_token', token!);
    setIsLoading(true);
    fetchMe().then(() => {
      if (useAuthStore.getState().user) router.push('/app');
      else {
        setError(MICROSOFT_ERRORS.microsoft_failed);
        setIsLoading(false);
      }
    });
  }, [fetchMe, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // withCredentials sends the HttpOnly pending-Microsoft-link cookie, if any, so this login links it.
      const res = await api.post('/api/auth/login', { email, password }, { withCredentials: true });
      setAuth(res.data.user, res.data.accessToken);
      router.push('/app');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell title="Sign in to your workspace" subtitle="Access your team, projects and workspace in one place.">
      <AuthError message={error} />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className={authLabelClass}>Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className={authLabelClass}>Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
          />
        </div>

        <button type="submit" disabled={isLoading} className={`${authButtonClass} !mt-8`}>
          <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
          <ArrowRight size={20} />
        </button>
      </form>

      <MicrosoftSignIn />

      <p className="text-center text-sm text-slate-400 mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-sky-400 hover:text-sky-300 hover:underline font-medium">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
