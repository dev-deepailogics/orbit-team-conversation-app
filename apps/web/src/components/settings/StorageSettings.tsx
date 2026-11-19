'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Attachment, StorageStats, UserProfile, Workspace } from '@orbit/types';
import {
  Clock,
  Download,
  ExternalLink,
  File,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  Film,
  Hash,
  Music,
  Paperclip,
  RefreshCw,
  Search,
  Trash2,
  X,
} from '@/components/ui/icons';
import { api } from '../../lib/api';
import { formatFileSize, getFileCategory } from '../chat/FileAttachmentList';
import { Card, CardTitle, OutlineButton, PageHeader, SettingRow, DANGER } from './ui';

const LARGE_BYTES = 25 * 1024 * 1024;
const YEAR_MS = 365 * 86_400_000;

type Filter = 'all' | 'images' | 'documents' | 'media' | 'archives' | 'code';
type Review = 'large' | 'old' | null;

export const StorageSettings: React.FC<{
  workspace: Workspace;
  currentUser: UserProfile | null;
  onFileDeleted?: (fileId: string) => void;
}> = ({ workspace, currentUser, onFileDeleted }) => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [review, setReview] = useState<Review>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStorage = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/files/workspaces/${workspace.id}/storage`);
      setStats({
        totalBytes: res.data.totalBytes,
        formattedTotal: res.data.formattedTotal,
        fileCount: res.data.fileCount,
        categories: res.data.categories,
      });
      setFiles(res.data.recentFiles || []);
    } catch (err) {
      console.error('Failed to fetch workspace storage stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  const handleDelete = async (file: Attachment) => {
    if (!confirm(`Are you sure you want to delete "${file.fileName}" across the workspace?`)) return;
    try {
      setDeletingId(file.id);
      await api.delete(`/api/files/${file.id}`);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      setStats((prev) =>
        prev
          ? {
              ...prev,
              totalBytes: Math.max(0, prev.totalBytes - Number(file.fileSize)),
              formattedTotal: formatFileSize(Math.max(0, prev.totalBytes - Number(file.fileSize))),
              fileCount: Math.max(0, prev.fileCount - 1),
            }
          : null,
      );
      onFileDeleted?.(file.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  };

  const now = Date.now();
  const large = useMemo(() => files.filter((f) => Number(f.fileSize) > LARGE_BYTES), [files]);
  const old = useMemo(() => files.filter((f) => now - new Date(f.createdAt).getTime() > YEAR_MS), [files, now]);
  const sumBytes = (list: any[]) => list.reduce((a, f) => a + Number(f.fileSize || 0), 0);

  const used = (stats?.categories || []).filter((c) => c.bytes > 0).sort((a, b) => b.bytes - a.bytes);
  const total = stats?.totalBytes || 0;

  const visible = (review === 'large' ? large : review === 'old' ? old : files).filter((f) => {
    if (!f.fileName.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'all') return true;
    const cat = getFileCategory(f.fileType, f.fileName);
    if (filter === 'images') return cat === 'image';
    if (filter === 'documents') return ['pdf', 'doc', 'sheet'].includes(cat);
    if (filter === 'media') return ['video', 'audio'].includes(cat);
    if (filter === 'archives') return cat === 'archive';
    return cat === 'code';
  });

  const fileIcon = (category: string) => {
    const Icon =
      category === 'pdf' || category === 'doc'
        ? FileText
        : category === 'sheet'
          ? FileSpreadsheet
          : category === 'archive'
            ? FileArchive
            : category === 'code'
              ? FileCode
              : category === 'video'
                ? Film
                : category === 'audio'
                  ? Music
                  : File;
    return <Icon size={16} />;
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        title="Workspace storage"
        subtitle="See what is using space and clean up what you no longer need."
        actions={
          <OutlineButton onClick={fetchStorage} icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}>
            Refresh
          </OutlineButton>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 flex flex-col gap-4" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
        <Card>
          <CardTitle
            title="Storage used"
            subtitle={
              stats ? `${stats.formattedTotal} across ${stats.fileCount} ${stats.fileCount === 1 ? 'file' : 'files'}` : 'Loading…'
            }
          />
          <div className="w-full h-3.5 rounded-[7px] overflow-hidden flex" style={{ backgroundColor: 'var(--theme-bg-surface-hover)' }}>
            {total > 0 &&
              used.map((c) => (
                <div
                  key={c.category}
                  title={`${c.label}: ${formatFileSize(c.bytes)}`}
                  style={{ width: `${Math.max(1, (c.bytes / total) * 100)}%`, backgroundColor: c.color }}
                />
              ))}
          </div>
          {used.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {used.map((c) => (
                <div key={c.category} className="rounded-xl p-3.5 flex flex-col gap-1 min-w-0" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--theme-text)' }}>
                      {c.label}
                    </span>
                  </span>
                  <span className="text-xl font-bold" style={{ color: 'var(--theme-text)' }}>
                    {formatFileSize(c.bytes)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    {Math.round((c.bytes / total) * 100)}% of used
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle title="Clean-up options" subtitle="Free up space without losing anything important" />
          <SettingRow
            icon={<Paperclip size={18} />}
            title="Large files over 25 MB"
            subtitle={`${large.length} ${large.length === 1 ? 'file' : 'files'} · ${formatFileSize(sumBytes(large))}`}
            action={
              <OutlineButton disabled={!large.length} onClick={() => setReview(review === 'large' ? null : 'large')}>
                {review === 'large' ? 'Show all' : 'Review'}
              </OutlineButton>
            }
          />
          <SettingRow
            icon={<Clock size={18} />}
            title="Attachments older than 1 year"
            subtitle={`${old.length} ${old.length === 1 ? 'file' : 'files'} · ${formatFileSize(sumBytes(old))}`}
            action={
              <OutlineButton disabled={!old.length} onClick={() => setReview(review === 'old' ? null : 'old')}>
                {review === 'old' ? 'Show all' : 'Review'}
              </OutlineButton>
            }
          />
        </Card>

        <Card>
          <CardTitle
            title={review === 'large' ? 'Large files' : review === 'old' ? 'Older attachments' : 'Recent files'}
            subtitle={`${visible.length} shown${review ? ' · from recent uploads' : ''}`}
            right={
              review ? (
                <OutlineButton icon={<X size={15} />} onClick={() => setReview(null)}>
                  Clear review
                </OutlineButton>
              ) : undefined
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1 overflow-x-auto">
              {(
                [
                  ['all', 'All'],
                  ['images', 'Images'],
                  ['documents', 'Docs'],
                  ['media', 'Media'],
                  ['archives', 'Archives'],
                  ['code', 'Code'],
                ] as [Filter, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className="h-8 px-3 rounded-2xl text-[13px] font-medium shrink-0 transition hover:bg-[var(--theme-fill-hover)]"
                  style={
                    filter === id
                      ? { backgroundColor: 'var(--theme-selected)', color: 'var(--theme-primary-hover)', fontWeight: 600 }
                      : { color: 'var(--theme-text-muted)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <label
              className="h-8 w-56 px-3 rounded-2xl border flex items-center gap-2"
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-app)' }}
            >
              <Search size={14} style={{ color: 'var(--theme-text-muted)' }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files"
                className="flex-1 min-w-0 bg-transparent outline-none text-[13px]"
                style={{ color: 'var(--theme-text)' }}
              />
            </label>
          </div>

          <div className="flex flex-col">
            {loading ? (
              <p className="py-8 text-center text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
                Loading workspace storage…
              </p>
            ) : visible.length === 0 ? (
              <p className="py-8 text-center text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
                {query ? `No files match "${query}"` : 'No files here.'}
              </p>
            ) : (
              visible.map((file, i) => {
                const category = getFileCategory(file.fileType, file.fileName);
                const canDelete = currentUser?.id === file.uploaderId || !file.uploaderId;
                return (
                  <div
                    key={file.id}
                    className={`group flex items-center gap-3 py-2.5 ${i ? 'border-t' : ''}`}
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    {category === 'image' ? (
                      <img
                        src={file.fileUrl}
                        alt={file.fileName}
                        className="w-9 h-9 rounded-[10px] object-cover border shrink-0"
                        style={{ borderColor: 'var(--theme-border)' }}
                      />
                    ) : (
                      <span
                        className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--theme-bg-surface)', color: 'var(--theme-text-muted)' }}
                      >
                        {fileIcon(category)}
                      </span>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text)' }} title={file.fileName}>
                        {file.fileName}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                        <span>{formatFileSize(file.fileSize)}</span>
                        {file.channel && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-0.5">
                              <Hash size={11} />
                              {file.channel.name}
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                        {file.uploader && (
                          <>
                            <span>·</span>
                            <span>{file.uploader.displayName}</span>
                          </>
                        )}
                      </span>
                    </div>
                    <a
                      href={file.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open"
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      <ExternalLink size={15} />
                    </a>
                    <a
                      href={`${file.fileUrl}${file.fileUrl.includes('?') ? '&' : '?'}download=1`}
                      download={file.fileName}
                      title="Download"
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      <Download size={15} />
                    </a>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(file)}
                        disabled={deletingId === file.id}
                        title="Delete file permanently"
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)] disabled:opacity-50"
                        style={{ color: DANGER }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
