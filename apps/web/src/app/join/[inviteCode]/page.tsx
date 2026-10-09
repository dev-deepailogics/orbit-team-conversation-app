'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Layers, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';

export default function JoinWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const inviteCode = params.inviteCode as string;
  const { user, token, isLoading, fetchMe } = useAuthStore();
  const [status, setStatus] = useState<'idle' | 'joining' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const handleJoin = async () => {
    if (!token) {
      router.push(`/login?redirect=/join/${inviteCode}`);
      return;
    }

    setStatus('joining');
    try {
      const res = await api.post('/api/workspaces/join', { inviteCode });
      setStatus('success');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.response?.data?.error || 'Invalid or expired invite link');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1A1D21] flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1D21] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-[#222529] border border-gray-700/80 rounded-2xl p-8 shadow-2xl text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-12 h-12 bg-slack-activeChannel rounded-xl flex items-center justify-center text-white shadow-lg">
            <Layers size={28} />
          </div>
        </div>

        <h1 className="text-xl font-bold text-white mb-2">You&apos;ve been invited to join a Workspace</h1>
        <p className="text-xs text-gray-400 mb-6">
          Collaborate with your team in real-time, join voice &amp; video huddles, and communicate across channels.
        </p>

        {status === 'error' && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg mb-4 flex items-center justify-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {status === 'success' ? (
          <div className="bg-slack-green/10 border border-slack-green/30 text-slack-green text-sm p-4 rounded-lg flex items-center justify-center gap-2 font-semibold">
            <CheckCircle2 size={18} />
            <span>Joined successfully! Redirecting...</span>
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={status === 'joining'}
            className="w-full py-3 bg-slack-green hover:bg-[#008a65] text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            <span>{status === 'joining' ? 'Joining Workspace...' : 'Accept Invitation & Join'}</span>
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
