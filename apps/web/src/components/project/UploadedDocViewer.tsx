'use client';

import React from 'react';
import { ProjectDocumentFile } from '@orbit/types';
import { Download, ExternalLink } from '@/components/ui/icons';

const SERVER_URL = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000').replace(/\/$/, '');

const fileHref = (url: string) => (url.startsWith('http') ? url : `${SERVER_URL}${url.startsWith('/') ? '' : '/'}${url}`);
const downloadHref = (url: string) => `${fileHref(url)}${url.includes('?') ? '&' : '?'}download=1`;

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const linkButtonClass =
  'h-8 px-3 rounded-lg flex items-center gap-1.5 text-[13px] font-semibold transition hover:bg-[var(--theme-fill-hover)]';

/**
 * Shows a doc that was uploaded as a file: PDFs are previewed in the browser's built-in viewer,
 * Word files (which browsers can't render) get a card with a download button.
 */
export const UploadedDocViewer: React.FC<{ file: ProjectDocumentFile; header?: React.ReactNode }> = ({ file, header }) => {
  const isPdf = file.fileType === 'application/pdf';

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 pt-6 pb-4 flex flex-col gap-4 flex-1 min-h-0">
        {header}

        <div
          className="flex flex-wrap items-center gap-3 p-3 rounded-xl"
          style={{ border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-bg-app)' }}
        >
          <span className="text-2xl leading-none">{isPdf ? '📕' : '📘'}</span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text)' }} title={file.fileName}>
              {file.fileName}
            </span>
            <span className="text-[12px]" style={{ color: 'var(--theme-text-muted)' }}>
              {isPdf ? 'PDF' : 'Word document'} · {formatSize(file.fileSize)}
            </span>
          </span>
          <a
            href={fileHref(file.fileUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className={linkButtonClass}
            style={{ color: 'var(--theme-text)' }}
          >
            <ExternalLink size={14} />
            <span className="hidden sm:inline">Open</span>
          </a>
          <a href={downloadHref(file.fileUrl)} className={linkButtonClass} style={{ color: 'var(--theme-text)' }}>
            <Download size={14} />
            <span className="hidden sm:inline">Download</span>
          </a>
        </div>

        {isPdf ? (
          <iframe
            src={fileHref(file.fileUrl)}
            title={file.fileName}
            className="w-full flex-1 min-h-[60vh] rounded-xl"
            style={{ border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-bg-app)' }}
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-3 py-14 px-6 rounded-xl text-center"
            style={{ border: '1px dashed var(--theme-border)', backgroundColor: 'var(--theme-bg-app)' }}
          >
            <span className="text-5xl leading-none">📘</span>
            <p className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
              Word files can't be previewed in Orbit
            </p>
            <p className="text-[13px] max-w-sm" style={{ color: 'var(--theme-text-muted)' }}>
              Download it to open it in Microsoft Word, Google Docs or LibreOffice.
            </p>
            <a
              href={downloadHref(file.fileUrl)}
              className="mt-1 h-9 px-4 rounded-lg flex items-center gap-2 text-[13px] font-semibold"
              style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
            >
              <Download size={14} />
              Download {file.fileName}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
