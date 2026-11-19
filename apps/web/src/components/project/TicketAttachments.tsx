'use client';

import React, { useState } from 'react';
import { Paperclip, Trash2, X, Download, Loader2 } from '@/components/ui/icons';
import { api } from '../../lib/api';

export interface TicketAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  // Present only for a freshly uploaded file (not yet linked to an Attachment DB
  // row); lets the server create one so the correct MIME type is preserved.
  fileKey?: string;
  storageProvider?: string;
}

/**
 * Shared upload logic for all three ticket screens (create, detail/edit,
 * create-from-message). Uploads run one at a time — uploading two files in
 * parallel let a previous bug through where one upload's stream got cut off
 * and silently produced a 0-byte file. A single queue here rules that out
 * regardless of whether the file came from the file picker or a paste.
 */
export function useTicketAttachmentUpload(
  workspaceId: string,
  initial: TicketAttachment[] = [],
  onChange?: (next: TicketAttachment[]) => void | Promise<void>
) {
  const [attachments, setAttachments] = useState<TicketAttachment[]>(initial);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (next: TicketAttachment[]) => {
    setAttachments(next);
    await onChange?.(next);
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    setIsUploading(true);
    try {
      let current = attachments;
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post(
          `/api/files/upload?workspaceId=${encodeURIComponent(workspaceId)}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        current = [
          ...current,
          {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            fileUrl: res.data.fileUrl,
            fileName: res.data.fileName,
            fileType: res.data.fileType,
            fileSize: res.data.fileSize,
            fileKey: res.data.fileKey,
            storageProvider: res.data.storageProvider,
          },
        ];
        await update(current);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    uploadFiles(files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length === 0) return;
    e.preventDefault();
    uploadFiles(files);
  };

  const removeAttachment = (id: string) => {
    update(attachments.filter((a) => a.id !== id)).catch(() => {});
  };

  return {
    attachments,
    setAttachments,
    isUploading,
    error,
    handleFileInputChange,
    handlePaste,
    removeAttachment,
  };
}

export const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
};

const isImage = (fileType: string) => !!fileType?.startsWith('image/');

// Forces the browser to download rather than navigate, regardless of file type.
const downloadUrl = (fileUrl: string) =>
  `${fileUrl}${fileUrl.includes('?') ? '&' : '?'}download=1`;

interface TicketAttachmentListProps {
  attachments: TicketAttachment[];
  onRemove: (id: string) => void;
  emptyLabel?: string;
}

export const TicketAttachmentList: React.FC<TicketAttachmentListProps> = ({
  attachments,
  onRemove,
  emptyLabel = 'No attachments yet.',
}) => {
  const [previewing, setPreviewing] = useState<TicketAttachment | null>(null);

  if (attachments.length === 0) {
    return <p className="text-[var(--theme-text-muted)] text-xs py-1">{emptyLabel}</p>;
  }

  const images = attachments.filter((a) => isImage(a.fileType));
  const files = attachments.filter((a) => !isImage(a.fileType));

  return (
    <div className="space-y-2 pt-1">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.id} className="relative group w-20 h-20 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewing(img)}
                className="block w-20 h-20 cursor-pointer"
              >
                <img
                  src={img.fileUrl}
                  alt={img.fileName}
                  className="w-20 h-20 object-cover rounded-lg border border-[var(--theme-border)]"
                />
              </button>
              <button
                type="button"
                onClick={() => onRemove(img.id)}
                className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-2 rounded-lg bg-[var(--theme-bg-app)] border border-[var(--theme-border)] text-xs group"
            >
              <button
                type="button"
                onClick={() => setPreviewing(file)}
                className="flex items-center gap-2 min-w-0 hover:underline cursor-pointer"
              >
                <Paperclip size={12} className="text-[var(--theme-text-muted)] shrink-0" />
                <span className="truncate text-[var(--theme-text)]">{file.fileName}</span>
                <span className="text-[var(--theme-text-muted)] shrink-0">{formatFileSize(file.fileSize)}</span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(file.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-[var(--theme-text-muted)] hover:text-rose-400 transition shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {previewing && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          onClick={() => setPreviewing(null)}
        >
          <div
            className="max-w-2xl w-full rounded-2xl border bg-[var(--theme-bg-surface)] border-[var(--theme-border)] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border)]">
              <span className="text-xs font-semibold text-[var(--theme-text)] truncate pr-2">
                {previewing.fileName}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={downloadUrl(previewing.fileUrl)}
                  download={previewing.fileName}
                  className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition"
                  title="Download"
                >
                  <Download size={15} />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewing(null)}
                  className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="p-4 flex items-center justify-center max-h-[70vh] overflow-auto">
              {isImage(previewing.fileType) ? (
                <img
                  src={previewing.fileUrl}
                  alt={previewing.fileName}
                  className="max-w-full max-h-[65vh] object-contain rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <Paperclip size={32} className="text-[var(--theme-text-muted)]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--theme-text)]">{previewing.fileName}</p>
                    <p className="text-xs text-[var(--theme-text-muted)]">
                      {formatFileSize(previewing.fileSize)}
                    </p>
                  </div>
                  <a
                    href={downloadUrl(previewing.fileUrl)}
                    download={previewing.fileName}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
                  >
                    <Download size={13} />
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Figma-styled attachments field for the ticket screens: upload button, paste target and file list. */
export const TicketAttachmentsField: React.FC<{
  upload: ReturnType<typeof useTicketAttachmentUpload>;
  showEmpty?: boolean;
}> = ({ upload, showEmpty }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div
      tabIndex={0}
      onPaste={upload.handlePaste}
      className="flex flex-col gap-2.5 rounded-[10px] outline-none focus-visible:shadow-[0_0_0_2px_var(--theme-primary)]"
    >
      <input ref={inputRef} type="file" multiple className="hidden" onChange={upload.handleFileInputChange} />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isUploading}
          className="h-9 px-3.5 rounded-[10px] border flex items-center gap-1.5 text-[13px] font-semibold transition hover:bg-[var(--theme-fill-hover)] disabled:opacity-50"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-app)', color: 'var(--theme-text)' }}
        >
          {upload.isUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
          {upload.isUploading ? 'Uploading…' : 'Add attachment'}
        </button>
        <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          or click here and paste (Ctrl+V)
        </span>
      </div>
      {upload.error && (
        <p className="text-xs" style={{ color: '#DC2626' }}>
          {upload.error}
        </p>
      )}
      {(showEmpty || upload.attachments.length > 0) && (
        <TicketAttachmentList attachments={upload.attachments} onRemove={upload.removeAttachment} />
      )}
    </div>
  );
};
