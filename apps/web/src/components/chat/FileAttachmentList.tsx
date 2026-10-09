'use client';

import React, { useState } from 'react';
import { Attachment, UserProfile } from '@orbit/types';
import {
  FileText,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  Film,
  Music,
  Download,
  Trash2,
  ExternalLink,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  File,
} from 'lucide-react';
import { api } from '../../lib/api';

interface FileAttachmentListProps {
  attachments?: Attachment[];
  currentUser?: UserProfile | null;
  onFileDeleted?: (fileId: string) => void;
  isThreadView?: boolean;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileCategory(
  fileType: string,
  fileName: string
): 'image' | 'video' | 'audio' | 'pdf' | 'doc' | 'sheet' | 'archive' | 'code' | 'other' {
  const mime = (fileType || '').toLowerCase();
  const ext = fileName ? fileName.substring(fileName.lastIndexOf('.')).toLowerCase() : '';

  if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext)) {
    return 'audio';
  }
  if (mime === 'application/pdf' || ext === '.pdf') {
    return 'pdf';
  }
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    ['.xls', '.xlsx', '.csv'].includes(ext)
  ) {
    return 'sheet';
  }
  if (
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('presentation') ||
    ['.doc', '.docx', '.ppt', '.pptx', '.txt', '.rtf'].includes(ext)
  ) {
    return 'doc';
  }
  if (
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('compressed') ||
    ['.zip', '.tar', '.gz', '.tgz', '.rar', '.7z'].includes(ext)
  ) {
    return 'archive';
  }
  if (
    mime.includes('json') ||
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rs',
      '.php', '.rb', '.sh', '.html', '.css', '.json', '.yaml', '.yml', '.sql',
    ].includes(ext)
  ) {
    return 'code';
  }

  return 'other';
}

export const FileAttachmentList: React.FC<FileAttachmentListProps> = ({
  attachments,
  currentUser,
  onFileDeleted,
}) => {
  const [lightboxImage, setLightboxImage] = useState<Attachment | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

  const activeAttachments = attachments.filter((a) => !a.isDeleted);
  if (activeAttachments.length === 0) return null;

  const images = activeAttachments.filter(
    (a) => getFileCategory(a.fileType, a.fileName) === 'image'
  );
  const nonImages = activeAttachments.filter(
    (a) => getFileCategory(a.fileType, a.fileName) !== 'image'
  );

  const handleDeleteFile = async (e: React.MouseEvent, file: Attachment) => {
    e.stopPropagation();
    e.preventDefault();

    if (!confirm(`Are you sure you want to delete "${file.fileName}" from the server?`)) {
      return;
    }

    try {
      setDeletingId(file.id);
      await api.delete(`/api/files/${file.id}`);
      if (onFileDeleted) {
        onFileDeleted(file.id);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  };

  const getFullFileUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    return url;
  };

  const getDownloadUrl = (file: Attachment) => {
    const base = getFullFileUrl(file.fileUrl);
    return `${base}${base.includes('?') ? '&' : '?'}download=1`;
  };

  const renderFileIcon = (category: string) => {
    switch (category) {
      case 'pdf':
        return (
          <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <FileText size={18} />
          </div>
        );
      case 'doc':
        return (
          <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <FileText size={18} />
          </div>
        );
      case 'sheet':
        return (
          <div className="w-9 h-9 rounded-lg bg-green-500/15 border border-green-500/30 flex items-center justify-center text-green-400">
            <FileSpreadsheet size={18} />
          </div>
        );
      case 'archive':
        return (
          <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <FileArchive size={18} />
          </div>
        );
      case 'code':
        return (
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FileCode size={18} />
          </div>
        );
      case 'video':
        return (
          <div className="w-9 h-9 rounded-lg bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
            <Film size={18} />
          </div>
        );
      case 'audio':
        return (
          <div className="w-9 h-9 rounded-lg bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center text-yellow-400">
            <Music size={18} />
          </div>
        );
      default:
        return (
          <div className="w-9 h-9 rounded-lg bg-gray-500/15 border border-gray-500/30 flex items-center justify-center text-gray-400">
            <File size={18} />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-2">
      {/* 1. Image Gallery / Lightbox Thumbnails */}
      {images.length > 0 && (
        <div
          className={`grid gap-2 ${
            images.length === 1
              ? 'grid-cols-1 max-w-md'
              : images.length === 2
              ? 'grid-cols-2 max-w-lg'
              : 'grid-cols-2 sm:grid-cols-3 max-w-xl'
          }`}
        >
          {images.map((img) => (
            <div
              key={img.id}
              className="relative group rounded-xl overflow-hidden border border-gray-700/80 bg-[#1A1D20] shadow-md transition hover:border-slack-green cursor-pointer"
              onClick={() => {
                setLightboxImage(img);
                setZoomLevel(1);
              }}
            >
              {/* Image Preview */}
              <div className="relative aspect-video max-h-64 flex items-center justify-center bg-black/40 overflow-hidden">
                <img
                  src={getFullFileUrl(img.fileUrl)}
                  alt={img.fileName}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              {/* Hover Overlay info & quick actions */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <div className="flex items-center justify-end gap-1">
                  <a
                    href={getDownloadUrl(img)}
                    download={img.fileName}
                    onClick={(e) => e.stopPropagation()}
                    title="Download Image"
                    className="p-1.5 bg-black/60 hover:bg-black/90 text-white rounded-lg backdrop-blur transition"
                  >
                    <Download size={14} />
                  </a>

                  {(currentUser?.id === img.uploaderId || !img.uploaderId) && (
                    <button
                      onClick={(e) => handleDeleteFile(e, img)}
                      disabled={deletingId === img.id}
                      title="Delete Image from Server"
                      className="p-1.5 bg-red-600/70 hover:bg-red-600 text-white rounded-lg backdrop-blur transition disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-200">
                  <span className="truncate max-w-[150px] font-medium" title={img.fileName}>
                    {img.fileName}
                  </span>
                  <span className="text-gray-400 font-mono text-[10px]">
                    {formatFileSize(img.fileSize)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Audio & Video Player Cards */}
      {nonImages
        .filter((a) => ['video', 'audio'].includes(getFileCategory(a.fileType, a.fileName)))
        .map((media) => {
          const category = getFileCategory(media.fileType, media.fileName);
          return (
            <div
              key={media.id}
              className="max-w-md bg-[#1F2326] border border-gray-700/80 rounded-xl overflow-hidden shadow-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 truncate">
                  {renderFileIcon(category)}
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-semibold text-white truncate" title={media.fileName}>
                      {media.fileName}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {formatFileSize(media.fileSize)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <a
                    href={getDownloadUrl(media)}
                    download={media.fileName}
                    title="Download media"
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition"
                  >
                    <Download size={14} />
                  </a>
                  {(currentUser?.id === media.uploaderId || !media.uploaderId) && (
                    <button
                      onClick={(e) => handleDeleteFile(e, media)}
                      title="Delete file"
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {category === 'video' ? (
                <video
                  controls
                  src={getFullFileUrl(media.fileUrl)}
                  className="w-full max-h-60 rounded-lg bg-black"
                />
              ) : (
                <audio
                  controls
                  src={getFullFileUrl(media.fileUrl)}
                  className="w-full h-10 mt-1"
                />
              )}
            </div>
          );
        })}

      {/* 3. Document, Archive, Code & Generic File Cards */}
      {nonImages
        .filter((a) => !['video', 'audio'].includes(getFileCategory(a.fileType, a.fileName)))
        .map((file) => {
          const category = getFileCategory(file.fileType, file.fileName);
          return (
            <div
              key={file.id}
              className="flex items-center justify-between gap-3 max-w-sm sm:max-w-md bg-[#1F2326] hover:bg-[#252A2E] border border-gray-700/70 hover:border-gray-600 px-3.5 py-2.5 rounded-xl transition shadow-sm group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {renderFileIcon(category)}
                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className="text-xs font-semibold text-gray-200 group-hover:text-white truncate"
                    title={file.fileName}
                  >
                    {file.fileName}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono">
                    <span>{formatFileSize(file.fileSize)}</span>
                    <span>•</span>
                    <span className="uppercase text-[9px] px-1 py-0.2 bg-gray-800 rounded font-bold text-gray-300">
                      {category}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <a
                  href={getFullFileUrl(file.fileUrl)}
                  target="_blank"
                  rel="noreferrer"
                  title="Open in new tab"
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition"
                >
                  <ExternalLink size={14} />
                </a>

                <a
                  href={getDownloadUrl(file)}
                  download={file.fileName}
                  title="Download File"
                  className="p-1.5 text-slack-green hover:text-white hover:bg-slack-green/20 rounded-lg transition"
                >
                  <Download size={14} />
                </a>

                {(currentUser?.id === file.uploaderId || !file.uploaderId) && (
                  <button
                    onClick={(e) => handleDeleteFile(e, file)}
                    disabled={deletingId === file.id}
                    title="Delete File from Server"
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

      {/* 4. Interactive Image Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxImage(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightboxImage(null);
          }}
          tabIndex={0}
        >
          {/* Top Bar */}
          <div
            className="w-full flex items-center justify-between text-white z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col">
              <span className="font-bold text-sm truncate max-w-md">{lightboxImage.fileName}</span>
              <span className="text-xs text-gray-400 font-mono">
                {formatFileSize(lightboxImage.fileSize)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                title="Zoom Out"
                className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <ZoomOut size={18} />
              </button>
              <span className="text-xs font-mono text-gray-300">{Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                title="Zoom In"
                className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <ZoomIn size={18} />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                title="Reset Zoom"
                className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <Maximize2 size={18} />
              </button>

              <span className="w-px h-6 bg-gray-700 mx-1" />

              <a
                href={getDownloadUrl(lightboxImage)}
                download={lightboxImage.fileName}
                title="Download"
                className="p-2 bg-slack-green hover:bg-slack-green/90 text-white rounded-xl transition flex items-center gap-1.5 text-xs font-semibold"
              >
                <Download size={16} />
                <span>Download</span>
              </a>

              <button
                onClick={() => setLightboxImage(null)}
                title="Close (Esc)"
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Centered Zoomable Image */}
          <div
            className="flex-1 flex items-center justify-center overflow-auto w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={getFullFileUrl(lightboxImage.fileUrl)}
              alt={lightboxImage.fileName}
              style={{
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.15s ease-out',
              }}
              className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl select-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};
