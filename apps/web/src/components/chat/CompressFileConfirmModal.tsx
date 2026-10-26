'use client';

import React, { useState, useEffect } from 'react';
import {
  FileArchive,
  Image as ImageIcon,
  FileText,
  FileCode,
  Sparkles,
  ArrowRight,
  X,
  Check,
  AlertCircle,
  Loader2,
  TrendingDown,
  Video as VideoIcon
} from 'lucide-react';
import { formatBytes, isImageFile, isVideoFile, getCompressedSize } from '../../lib/compression';

interface CompressFileConfirmModalProps {
  isOpen: boolean;
  files: File[];
  onConfirmCompress: () => void;
  onSkip: () => void;
  onCancel: () => void;
  isCompressing?: boolean;
}

interface FileSizeInfo {
  original: number;
  compressed: number | null;
}

export const CompressFileConfirmModal: React.FC<CompressFileConfirmModalProps> = ({
  isOpen,
  files,
  onConfirmCompress,
  onSkip,
  onCancel,
  isCompressing = false,
}) => {
  const [estimatedSizes, setEstimatedSizes] = useState<Record<string, number>>({});
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    if (!isOpen || files.length === 0) {
      setEstimatedSizes({});
      return;
    }

    let isMounted = true;
    setIsCalculating(true);

    const calcAll = async () => {
      const results: Record<string, number> = {};
      for (const file of files) {
        try {
          const compSize = await getCompressedSize(file);
          results[file.name + file.size] = compSize;
        } catch (e) {
          results[file.name + file.size] = file.size;
        }
      }
      if (isMounted) {
        setEstimatedSizes(results);
        setIsCalculating(false);
      }
    };

    calcAll();

    return () => {
      isMounted = false;
    };
  }, [isOpen, files]);

  if (!isOpen || files.length === 0) return null;

  const totalOriginalSize = files.reduce((acc, f) => acc + f.size, 0);
  const totalCompressedSize = files.reduce((acc, f) => {
    const key = f.name + f.size;
    const est = estimatedSizes[key];
    return acc + (est !== undefined ? est : f.size);
  }, 0);

  const totalSavedBytes = Math.max(0, totalOriginalSize - totalCompressedSize);
  const percentSaved =
    totalOriginalSize > 0 && totalSavedBytes > 0
      ? Math.round((totalSavedBytes / totalOriginalSize) * 100)
      : 0;

  const isSingle = files.length === 1;

  const getFileIcon = (file: File) => {
    if (isImageFile(file)) return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    if (isVideoFile(file)) return <VideoIcon className="w-5 h-5 text-violet-400" />;
    if (file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text')) {
      return <FileText className="w-5 h-5 text-blue-400" />;
    }
    return <FileArchive className="w-5 h-5 text-amber-400" />;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl p-6 text-slate-100 flex flex-col gap-5 animate-in zoom-in-95 duration-200"
        style={{ backgroundColor: '#1E222B' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white tracking-tight">
                Compress Media & Files
              </h3>
              <p className="text-xs text-slate-400">
                Speed up uploads and save bandwidth
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isCompressing}
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
            title="Cancel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Question prompt */}
        <div className="flex items-start gap-3 bg-white/[0.03] p-3.5 rounded-xl border border-white/5">
          <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-white">
              Do you want to compress {isSingle ? 'this file' : `these ${files.length} files`}?
            </span>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Compressing optimizes high-resolution images and packages documents into lightweight archives before uploading.
            </p>
          </div>
        </div>

        {/* File previews list with Current vs After Compress Size */}
        <div className="max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {files.map((file, idx) => {
            const key = file.name + file.size;
            const compSize = estimatedSizes[key];
            const hasSaved = compSize !== undefined && compSize < file.size;
            const singlePercent =
              hasSaved && file.size > 0
                ? Math.round(((file.size - compSize!) / file.size) * 100)
                : 0;

            return (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between p-3 rounded-xl bg-[#171A21] border border-white/5 text-xs hover:border-white/10 transition gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="p-2 rounded-lg bg-white/5 shrink-0">
                    {getFileIcon(file)}
                  </div>
                  <div className="truncate">
                    <p className="truncate text-slate-200 font-medium text-xs">{file.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isImageFile(file)
                        ? 'Image optimization (WebP/JPEG)'
                        : isVideoFile(file)
                        ? 'Video optimization (720p H.264/WebM)'
                        : 'ZIP Deflate Archive'}
                    </p>
                  </div>
                </div>

                {/* Current & After Compress size column */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Current Size */}
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Current</div>
                    <span className="font-mono text-[12px] text-slate-300 bg-white/5 px-2 py-0.5 rounded inline-block mt-0.5">
                      {formatBytes(file.size)}
                    </span>
                  </div>

                  <ArrowRight size={13} className="text-slate-500 shrink-0 mt-3" />

                  {/* After Compress Size */}
                  <div className="text-right">
                    <div className="text-[10px] text-emerald-400/90 uppercase tracking-wider font-semibold">After</div>
                    {compSize === undefined ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 bg-white/5 px-2 py-0.5 rounded mt-0.5">
                        <Loader2 size={10} className="animate-spin" />
                      </span>
                    ) : (
                      <span
                        className={`font-mono text-[12px] font-semibold px-2 py-0.5 rounded inline-block mt-0.5 ${
                          hasSaved
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        {formatBytes(compSize)}
                        {singlePercent > 0 && (
                          <span className="ml-1 text-[10px] font-normal text-emerald-300">
                            (-{singlePercent}%)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total Summary Comparison */}
        <div className="p-3 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300 font-medium">Estimated Total:</span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-slate-400 line-through font-mono">
              {formatBytes(totalOriginalSize)}
            </span>
            <ArrowRight size={12} className="text-slate-500" />
            {isCalculating ? (
              <span className="inline-flex items-center gap-1 text-slate-400 font-mono">
                <Loader2 size={12} className="animate-spin" />
                <span>Calculating...</span>
              </span>
            ) : (
              <span className="text-emerald-400 font-mono font-bold text-sm">
                {formatBytes(totalCompressedSize)}
                {percentSaved > 0 && (
                  <span className="ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Save {percentSaved}%
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
          {/* Skip option */}
          <button
            type="button"
            disabled={isCompressing}
            onClick={onSkip}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#262B36] hover:bg-[#313745] border border-white/10 active:scale-95 transition disabled:opacity-50"
          >
            Skip
          </button>

          {/* Compress option */}
          <button
            type="button"
            disabled={isCompressing}
            onClick={onConfirmCompress}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#007A5A] hover:bg-[#00916B] border border-[#00B074]/60 shadow-[0_0_15px_rgba(0,176,116,0.3)] active:scale-95 transition flex items-center gap-2 disabled:opacity-50 font-bold"
          >
            {isCompressing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Compressing...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Compress</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
