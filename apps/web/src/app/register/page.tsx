'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { AuthShell, AuthError, MicrosoftSignIn, authInputClass, authLabelClass, authButtonClass } from '../../components/auth/AuthShell';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
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
      const res = await api.post('/api/auth/register', {
        email,
        username,
        displayName,
        password,
      });
      setAuth(res.data.user, res.data.accessToken);
      router.push('/app');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Set up your profile to join your team's workspace.">
      <AuthError message={error} />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="displayName" className={authLabelClass}>Display Name</label>
          <input
            id="displayName"
            type="text"
            required
            autoComplete="name"
            placeholder="Alex Smith"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={authInputClass}
          />
        </div>
        <div>
          <label htmlFor="username" className={authLabelClass}>Username</label>
          <input
            id="username"
            type="text"
            required
            autoComplete="username"
            placeholder="alex"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, ''))}
            className={authInputClass}
          />
        </div>
        <div>
          <label htmlFor="email" className={authLabelClass}>Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="alex@company.com"
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
            autoComplete="new-password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
          />
        </div>

        <button type="submit" disabled={isLoading} className={`${authButtonClass} !mt-8`}>
          <span>{isLoading ? 'Creating Account...' : 'Create Account'}</span>
          <ArrowRight size={20} />
        </button>
      </form>

      <MicrosoftSignIn label="Sign up with Microsoft" />

      <p className="text-center text-sm text-slate-400 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-sky-400 hover:text-sky-300 hover:underline font-medium">
          Sign In
        </Link>
      </p>
    </AuthShell>
  );
}
