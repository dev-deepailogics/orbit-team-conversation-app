import React, { useState, useEffect } from 'react';
import {
  Video,
  ExternalLink,
  RefreshCw,
  FileText,
  CheckCircle,
  Copy,
  Check,
  Send,
  X,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { api } from '../../lib/api';

interface GoogleMeetModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  targetUser?: {
    id: string;
    displayName: string;
  } | null;
}

export const GoogleMeetModal: React.FC<GoogleMeetModalProps> = ({
  isOpen,
  onClose,
  channelId,
  channelName,
  targetUser,
}) => {
  const [meetingUrl, setMeetingUrl] = useState('https://meet.google.com/new');
  const [isCopied, setIsCopied] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [customSummary, setCustomSummary] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkDriveStatus();
    }
  }, [isOpen]);

  const checkDriveStatus = async () => {
    try {
      const res = await api.get('/api/google/status');
      setGoogleConnected(Boolean(res.data?.connected));
      if (res.data?.connected) {
        fetchRecentDocs();
      }
    } catch {
      setGoogleConnected(false);
    }
  };

  const fetchRecentDocs = async () => {
    setIsLoadingDocs(true);
    try {
      const res = await api.get('/api/google/meet-notes');
      if (res.data?.files) {
        setRecentDocs(res.data.files);
        if (res.data.files.length > 0) {
          setSelectedDocId(res.data.files[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch recent docs:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  if (!isOpen) return null;

  const handleLaunchMeeting = () => {
    window.open(meetingUrl, '_blank', 'noopener,noreferrer,width=1000,height=700');
    setHasStarted(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSyncNoteToChat = async () => {
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const selectedDoc = recentDocs.find((d) => d.id === selectedDocId);
      const meetingTitle = selectedDoc?.name || `Meeting with ${targetUser?.displayName || channelName}`;

      const res = await api.post('/api/google/sync-meet-note', {
        channelId,
        fileId: selectedDocId || undefined,
        customSummary: customSummary.trim() || undefined,
        meetingTitle,
        meetUrl: selectedDoc?.webViewLink || meetingUrl,
      });

      if (res.data?.success) {
        setStatusMessage('Meeting notes successfully posted to the chat!');
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setStatusMessage(err.response?.data?.error || 'Failed to sync meeting note.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--theme-bg-surface, #1e2228)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Video size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Google Meet
                {targetUser ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    with {targetUser.displayName}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    #{channelName}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400">
                Launch your upgraded Google Meet with AI Notes and sync notes into chat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Step 1: Launch Google Meet */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-400 text-xs flex items-center justify-center">1</span>
                <span>Meeting Link</span>
              </div>
              <button
                onClick={handleCopyLink}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition"
              >
                {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{isCopied ? 'Copied' : 'Copy link'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleLaunchMeeting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-lg flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition shrink-0"
              >
                <ExternalLink size={15} />
                <span>Join / Launch</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              💡 Tip: Click <strong>"Take notes for me" (Gemini)</strong> inside your Google Meet to automatically generate meeting notes.
            </p>
          </div>

          {/* Step 2: Auto-Import Notes to Chat */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-400 text-xs flex items-center justify-center">2</span>
                <span>Send Notes to {targetUser ? targetUser.displayName : `#${channelName}`}</span>
              </div>
              {googleConnected && (
                <button
                  onClick={fetchRecentDocs}
                  disabled={isLoadingDocs}
                  className="text-xs text-gray-400 hover:text-emerald-400 flex items-center gap-1 transition"
                  title="Refresh Drive files"
                >
                  <RefreshCw size={13} className={isLoadingDocs ? 'animate-spin' : ''} />
                  <span>Refresh Docs</span>
                </button>
              )}
            </div>

            {googleConnected === false ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="shrink-0 text-amber-400" />
                  <span>Connect your upgraded Google account to auto-sync Gemini meeting notes into this chat.</span>
                </div>
                <a
                  href="/api/google/auth"
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition shrink-0 shadow"
                >
                  <ExternalLink size={13} />
                  <span>Connect Google</span>
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex items-center justify-between">
                  <span>Select Google Meet Notes Doc:</span>
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <Sparkles size={11} /> Auto-detected Docs
                  </span>
                </label>
                {recentDocs.length > 0 ? (
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {recentDocs.map((doc) => (
                      <option key={doc.id} value={doc.id} className="bg-gray-900 text-white">
                        {doc.name} (Updated {new Date(doc.modifiedTime).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-gray-500 italic py-1">
                    {isLoadingDocs ? 'Loading Google Docs...' : 'No Google Docs found yet. You can paste notes summary below.'}
                  </p>
                )}
              </div>
            )}

            {/* Optional Custom Summary fallback */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Additional Summary / Action Items (Optional):</label>
              <textarea
                value={customSummary}
                onChange={(e) => setCustomSummary(e.target.value)}
                placeholder="Key takeaways, decisions, or follow-ups discussed..."
                rows={2}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {statusMessage && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle size={15} />
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-black/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSyncNoteToChat}
            disabled={isSyncing}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition"
          >
            {isSyncing ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            <span>Send Notes into Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
