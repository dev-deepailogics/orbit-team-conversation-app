'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import {
  FileText,
  Lock,
  Calendar,
  User,
  Share2,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center bg-[#1A1D21] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Loading shared document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1D21] text-white p-6">
        <div className="max-w-md w-full bg-[#222529] border border-[#383F45] rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center mx-auto">
            <Lock size={24} />
          </div>
          <h2 className="text-lg font-bold">Document Not Available</h2>
          <p className="text-xs text-gray-400 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1D21] text-white flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-[#383F45] bg-[#222529] px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">{document.icon || '📄'}</span>
          <div>
            <h1 className="text-sm font-bold truncate max-w-sm">
              {document.title || 'Untitled Document'}
            </h1>
            {document.project && (
              <p className="text-[11px] text-gray-400">
                Project: {document.project.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 size={12} />
            Public Link
          </span>
        </div>
      </header>

      {/* Cover Banner if exists */}
      {document.coverImage && (
        <div
          className="w-full h-44 shadow-inner"
          style={{ background: document.coverImage }}
        />
      )}

      {/* Document Content Canvas */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-12 space-y-6">
        {/* Document Header */}
        <div className="space-y-3 pb-6 border-b border-[#383F45]">
          <span className="text-5xl">{document.icon || '📄'}</span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            {document.title || 'Untitled Document'}
          </h1>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>By {document.creator?.displayName || 'Orbit User'}</span>
            <span>•</span>
            <span>Last updated {new Date(document.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="max-w-none">
          <NotionEditor
            value={document.content || ''}
            onChange={() => {}}
            readOnly={true}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-gray-500 border-t border-[#383F45]">
        Powered by Orbit Workspace & Docs
      </footer>
    </div>
  );
}
