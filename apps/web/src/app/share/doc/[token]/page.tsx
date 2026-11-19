'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { FileText, Lock, CheckCircle2 } from '@/components/ui/icons';
import { NotionEditor } from '../../../../components/project/NotionEditor';

export default function PublicDocumentSharePage() {
  const params = useParams();
  const token = params?.token as string;

  const [document, setDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchSharedDoc = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';
        const res = await axios.get(`${apiUrl}/api/projects/documents/share/${token}`);
        setDocument(res.data);
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            'This document is either private, does not exist, or public link sharing is disabled.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchSharedDoc();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }}
          />
          <p className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
            Loading shared document…
          </p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
        <div
          className="max-w-md w-full rounded-2xl border p-8 text-center flex flex-col items-center gap-3"
          style={{
            backgroundColor: 'var(--theme-bg-app)',
            borderColor: 'var(--theme-border)',
            boxShadow: '0 8px 12px rgba(20, 26, 46, 0.05), 0 1px 1px rgba(20, 26, 46, 0.05)',
          }}
        >
          <span
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--theme-selected)', color: 'var(--theme-accent)' }}
          >
            <Lock size={22} />
          </span>
          <h2 className="text-lg font-bold" style={{ color: 'var(--theme-text)' }}>
            Document not available
          </h2>
          <p className="text-[13px] leading-5" style={{ color: 'var(--theme-text-muted)' }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--theme-bg-surface)', color: 'var(--theme-text)' }}>
      <header
        className="h-16 shrink-0 border-b px-3 sm:px-5 flex items-center gap-3"
        style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
      >
        <span
          className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--theme-selected)', color: 'var(--theme-accent)' }}
        >
          <FileText size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-bold leading-[22px] truncate">{document.title || 'Untitled Document'}</h1>
          <p className="text-[13px] leading-[18px] truncate" style={{ color: 'var(--theme-text-muted)' }}>
            {document.project ? `${document.project.name} board · ` : ''}Shared from Orbit
          </p>
        </div>
        <span
          className="inline-flex items-center gap-[5px] h-6 px-[9px] rounded-xl text-xs font-semibold shrink-0"
          style={{
            backgroundColor: 'color-mix(in srgb, #1F9D63 14%, transparent)',
            color: 'color-mix(in srgb, #1F9D63 70%, var(--theme-text))',
          }}
        >
          <CheckCircle2 size={12} />
          Public link
        </span>
      </header>

      <NotionEditor
        variant="page"
        readOnly
        value={document.content || ''}
        onChange={() => {}}
        pageHeader={
          <div className="flex flex-col gap-3.5">
            {document.coverImage && <div className="h-28 rounded-[10px]" style={{ background: document.coverImage }} />}
            {document.icon && document.icon !== '📄' && <span className="text-[34px] leading-none">{document.icon}</span>}
            <h1 className="text-[30px] leading-[38px] font-bold">{document.title || 'Untitled Document'}</h1>
            <p className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
              By {document.creator?.displayName || 'Orbit user'} · Last updated{' '}
              {new Date(document.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <div className="h-1.5" />
          </div>
        }
      />

      <footer
        className="py-5 text-center text-xs border-t"
        style={{ color: 'var(--theme-text-muted)', borderColor: 'var(--theme-border)' }}
      >
        Powered by Orbit
      </footer>
    </div>
  );
}
