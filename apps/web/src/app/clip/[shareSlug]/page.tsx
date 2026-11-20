'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Recording } from '@orbit/types';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { RecordingPlayer } from '../../../components/recording/RecordingPlayer';

export default function ClipSharePage() {
  const params = useParams<{ shareSlug: string }>();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.shareSlug) return;
    api
      .get<Recording>(`/api/recordings/share/${params.shareSlug}`)
      .then((res) => setRecording(res.data))
      .catch((err) => setError(err.response?.data?.error || 'This recording could not be found.'));
  }, [params?.shareSlug]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--theme-bg-app)] p-4">
      {error && (
        <div className="flex flex-col items-center gap-2 text-[var(--theme-text-muted)]">
          <AlertTriangle size={28} />
          <p className="text-sm">{error}</p>
        </div>
      )}
      {!error && !recording && <Loader2 size={28} className="animate-spin text-slack-green" />}
      {recording && (
        <div className="w-full max-w-2xl">
          <RecordingPlayer recording={recording} autoPlay />
        </div>
      )}
    </div>
  );
}
