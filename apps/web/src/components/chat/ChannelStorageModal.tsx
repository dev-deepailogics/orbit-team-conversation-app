'use client';

import React, { useState, useEffect } from 'react';
import { Channel, Attachment, UserProfile, StorageStats } from '@orbit/types';
import {
  X,
  HardDrive,
  Download,
  Trash2,
  Search,
  ExternalLink,
  FileText,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  Film,
  Music,
  File,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatFileSize, getFileCategory } from './FileAttachmentList';

interface ChannelStorageModalProps {
  channel: Channel;
  currentUser: UserProfile | null;
  onClose: () => void;
  onFileDeleted?: (fileId: string) => void;
}

export const ChannelStorageModal: React.FC<ChannelStorageModalProps> = ({
  channel,
  currentUser,
  onClose,
  onFileDeleted,
}) => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStorage = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/api/files/channels/${channel.id}/storage`);
      setStats({
        totalBytes: res.data.totalBytes,
        formattedTotal: res.data.formattedTotal,
        fileCount: res.data.fileCount,
        categories: res.data.categories,
      });
      setFiles(res.data.files || []);
    } catch (err) {
      console.error('Failed to fetch storage stats', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStorage();
  }, [channel.id]);

  const handleDeleteFile = async (file: Attachment) => {
    if (!confirm(`Are you sure you want to permanently delete "${file.fileName}" from the server?`)) {
      return;
    }

    try {
      setDeletingId(file.id);
      await api.delete(`/api/files/${file.id}`);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (stats) {
        setStats((prev) =>
          prev
            ? {
                ...prev,
                totalBytes: Math.max(0, prev.totalBytes - Number(file.fileSize)),
                formattedTotal: formatFileSize(Math.max(0, prev.totalBytes - Number(file.fileSize))),
                fileCount: Math.max(0, prev.fileCount - 1),
              }
            : null
        );
      }
      if (onFileDeleted) {
        onFileDeleted(file.id);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTab === 'all') return true;
    const cat = getFileCategory(f.fileType, f.fileName);
    if (activeTab === 'images') return cat === 'image';
    if (activeTab === 'documents') return ['pdf', 'doc', 'sheet'].includes(cat);
    if (activeTab === 'media') return ['video', 'audio'].includes(cat);
    if (activeTab === 'archives') return cat === 'archive';
    if (activeTab === 'code') return cat === 'code';
    return true;
  });

  const renderFileIcon = (category: string) => {
    switch (category) {
      case 'pdf':
        return <FileText size={16} className="text-red-400" />;
      case 'doc':
        return <FileText size={16} className="text-blue-400" />;
      case 'sheet':
        return <FileSpreadsheet size={16} className="text-green-400" />;
      case 'archive':
        return <FileArchive size={16} className="text-purple-400" />;
      case 'code':
        return <FileCode size={16} className="text-amber-400" />;
      case 'video':
        return <Film size={16} className="text-pink-400" />;
      case 'audio':
        return <Music size={16} className="text-yellow-400" />;
      default:
        return <File size={16} className="text-gray-400" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#1F2326] border border-gray-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-700/80 flex items-center justify-between bg-[#1A1D20]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slack-green/15 border border-slack-green/30 flex items-center justify-center text-slack-green">
              <HardDrive size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>#{channel.name}</span>
                <span className="text-xs font-normal text-gray-400">Files & Storage</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Accumulated storage and shared files in this channel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStorage}
              title="Refresh Storage Stats"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Storage Summary Banner */}
        <div className="p-5 bg-gradient-to-b from-[#22262A] to-[#1F2326] border-b border-gray-700/80">
          <div className="flex items-end justify-between mb-2">
            <div>
              <span className="text-2xl font-extrabold text-white">
                {stats?.formattedTotal || '0 B'}
              </span>
              <span className="text-xs text-gray-400 ml-2">
                used across {stats?.fileCount || 0} files
              </span>
            </div>
          </div>

          {/* Color-Coded Multi-Segment Storage Bar */}
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex border border-gray-700/60 shadow-inner">
            {stats && stats.totalBytes > 0 ? (
              stats.categories
                .filter((c) => c.bytes > 0)
                .map((cat) => {
                  const pct = Math.max(1, Math.round((cat.bytes / stats.totalBytes) * 100));
                  return (
                    <div
                      key={cat.category}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: cat.color,
                      }}
                      title={`${cat.label}: ${formatFileSize(cat.bytes)} (${cat.count} files)`}
                      className="h-full transition-all duration-300 hover:opacity-80"
                    />
                  );
                })
            ) : (
              <div className="w-full h-full bg-gray-700/40" />
            )}
          </div>

          {/* Category Badges */}
          {stats && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {stats.categories
                .filter((c) => c.bytes > 0)
                .map((cat) => (
                  <div key={cat.category} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-gray-300 font-medium">{cat.label}:</span>
                    <span className="text-gray-400 font-mono text-[11px]">
                      {formatFileSize(cat.bytes)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Filter Bar & Search */}
        <div className="px-5 py-3 border-b border-gray-700/70 flex items-center justify-between gap-3 bg-[#1A1D20]">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'images', label: 'Images' },
              { id: 'documents', label: 'Docs' },
              { id: 'media', label: 'Media' },
              { id: 'archives', label: 'Archives' },
              { id: 'code', label: 'Code' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-slack-green text-white shadow'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-48 sm:w-56">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full bg-[#252A2E] border border-gray-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-slack-green"
            />
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-gray-800">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-xs gap-2">
              <RefreshCw size={16} className="animate-spin" />
              <span>Loading channel storage...</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm font-semibold text-gray-300">No files found</p>
              <p className="text-xs mt-1">
                {searchQuery
                  ? `No files match "${searchQuery}"`
                  : 'No files have been shared in this channel yet.'}
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => {
              const category = getFileCategory(file.fileType, file.fileName);
              const isImage = category === 'image';

              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 pt-2 pb-2 px-2 hover:bg-gray-800/40 rounded-xl transition group"
                >
                  {/* File Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isImage ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/40 border border-gray-700 flex-shrink-0">
                        <img
                          src={file.fileUrl}
                          alt={file.fileName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700/80 flex items-center justify-center flex-shrink-0">
                        {renderFileIcon(category)}
                      </div>
                    )}

                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        className="text-xs font-semibold text-gray-200 group-hover:text-white truncate"
                        title={file.fileName}
                      >
                        {file.fileName}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono mt-0.5">
                        <span>{formatFileSize(file.fileSize)}</span>
                        <span>•</span>
                        <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                        {file.uploader && (
                          <>
                            <span>•</span>
                            <span className="text-gray-300">{file.uploader.displayName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <a
                      href={file.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open / View"
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition"
                    >
                      <ExternalLink size={15} />
                    </a>

                    <a
                      href={`${file.fileUrl}${file.fileUrl.includes('?') ? '&' : '?'}download=1`}
                      download={file.fileName}
                      title="Download file"
                      className="p-1.5 text-slack-green hover:text-white hover:bg-slack-green/20 rounded-lg transition"
                    >
                      <Download size={15} />
                    </a>

                    {(currentUser?.id === file.uploaderId || !file.uploaderId) && (
                      <button
                        onClick={() => handleDeleteFile(file)}
                        disabled={deletingId === file.id}
                        title="Delete file permanently"
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-700/80 bg-[#1A1D20] flex items-center justify-between text-xs text-gray-400">
          <span>Storage Provider: <strong className="text-gray-300">VPS / Local Volume Storage</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-700/60 hover:bg-gray-700 text-white rounded-xl transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
