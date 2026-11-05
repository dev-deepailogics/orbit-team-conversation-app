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
  AlertCircle,
  Calendar,
  Clock,
  Plus,
  Share2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Channel } from '@orbit/types';

interface GoogleMeetSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentChannel: Channel | null;
  channels: Channel[];
  currentUser?: any;
  onSelectChannel?: (channel: Channel) => void;
}

export const GoogleMeetSidebar: React.FC<GoogleMeetSidebarProps> = ({
  isOpen,
  onClose,
  currentChannel,
  channels,
  currentUser,
  onSelectChannel,
}) => {
  const [meetingUrl, setMeetingUrl] = useState('https://meet.google.com/new');
  const [isCopied, setIsCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [customSummary, setCustomSummary] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string>(currentChannel?.id || '');

  useEffect(() => {
    if (currentChannel) {
      setSelectedChannelId(currentChannel.id);
    }
  }, [currentChannel]);

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

  const handleLaunchMeeting = (mode: 'instant' | 'later' | 'calendar') => {
    if (mode === 'instant') {
      window.open('https://meet.google.com/new', '_blank', 'noopener,noreferrer,width=1000,height=700');
    } else if (mode === 'later') {
      window.open('https://meet.google.com/', '_blank', 'noopener,noreferrer');
    } else if (mode === 'calendar') {
      window.open('https://calendar.google.com/calendar/u/0/r/eventedit', '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSyncNoteToChat = async () => {
    const targetChId = selectedChannelId || currentChannel?.id;
    if (!targetChId) {
      setStatusMessage('Please select a conversation to post the notes into.');
      return;
    }

    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const selectedDoc = recentDocs.find((d) => d.id === selectedDocId);
      const matchedChannel = channels.find((c) => c.id === targetChId) || currentChannel;
      const meetingTitle = selectedDoc?.name || `Google Meet - ${matchedChannel?.name || 'Discussion'}`;

      const res = await api.post('/api/google/sync-meet-note', {
        channelId: targetChId,
        fileId: selectedDocId || undefined,
        customSummary: customSummary.trim() || undefined,
        meetingTitle,
        meetUrl: selectedDoc?.webViewLink || meetingUrl,
      });

      if (res.data?.success) {
        setStatusMessage('Meeting notes successfully sent into the chat!');
        setTimeout(() => {
          setStatusMessage(null);
        }, 3500);
      }
    } catch (err: any) {
      setStatusMessage(err.response?.data?.error || 'Failed to sync meeting note.');
    } finally {
      setIsSyncing(false);
    }
  };

  const getChannelDisplayName = (ch: Channel) => {
    if (ch.type === 'DIRECT') {
      if (ch.members && ch.members.length > 0) {
        const otherMember = ch.members.find((m: any) => m.userId !== currentUser?.id);
        if (otherMember && otherMember.user?.displayName) {
          return `@ ${otherMember.user.displayName}`;
        }
      }
      return `@ ${ch.name}`;
    }
    return `# ${ch.name}`;
  };

  const activeChannel = channels.find((c) => c.id === selectedChannelId) || currentChannel;
  const activeChannelName = activeChannel ? getChannelDisplayName(activeChannel) : 'Selected Chat';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-[#1A1D21] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 border-b border-white/10 px-4 flex items-center justify-between bg-black/20 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
            <Video size={16} />
          </div>
          <div className="truncate">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Google Meet
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                App
              </span>
            </h2>
            <p className="text-[11px] text-gray-400 truncate">Create meetings & sync Gemini notes</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quick Actions / Instant Create */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
            Start or Schedule
          </label>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => handleLaunchMeeting('instant')}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs flex items-center justify-between shadow-lg shadow-emerald-500/20 transition group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                  <Plus size={14} />
                </div>
                <div className="text-left">
                  <p className="leading-tight">Start Instant Meeting</p>
                  <p className="text-[10px] text-emerald-100/70 font-normal">Opens new Google Meet now</p>
                </div>
              </div>
              <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleLaunchMeeting('later')}
                className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-medium flex items-center gap-2 transition"
              >
                <Clock size={13} className="text-emerald-400" />
                <span className="truncate">Create for later</span>
              </button>

              <button
                onClick={() => handleLaunchMeeting('calendar')}
                className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-medium flex items-center gap-2 transition"
              >
                <Calendar size={13} className="text-emerald-400" />
                <span className="truncate">Schedule in Cal</span>
              </button>
            </div>
          </div>
        </div>

        {/* Existing Meeting Code / Join Link */}
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-white">Join / Share Meeting Link</label>
            <button
              onClick={handleCopyLink}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition"
            >
              {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/..."
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => window.open(meetingUrl, '_blank', 'noopener,noreferrer')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg flex items-center gap-1 transition shrink-0"
            >
              <ExternalLink size={13} />
              <span>Join</span>
            </button>
          </div>
        </div>

        {/* Google Account Connection Status */}
        {googleConnected === false ? (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 text-amber-400 mt-0.5" />
              <span>Connect your upgraded Google account to sync Gemini meeting notes automatically into chat.</span>
            </div>
            <a
              href="/api/google/auth"
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition shadow"
            >
              <ExternalLink size={13} />
              <span>Connect Google Account</span>
            </a>
          </div>
        ) : null}

        {/* Sync Gemini Meeting Notes Section */}
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Sparkles size={14} className="text-emerald-400" />
              <span>Sync Gemini Notes to Chat</span>
            </div>
            {googleConnected && (
              <button
                onClick={fetchRecentDocs}
                disabled={isLoadingDocs}
                className="text-[11px] text-gray-400 hover:text-emerald-400 flex items-center gap-1 transition"
              >
                <RefreshCw size={12} className={isLoadingDocs ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            )}
          </div>

          {/* Target Channel / DM Selector */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-400">Target Chat (Send notes to):</label>
            <select
              value={selectedChannelId}
              onChange={(e) => {
                setSelectedChannelId(e.target.value);
                const matched = channels.find((c) => c.id === e.target.value);
                if (matched && onSelectChannel) onSelectChannel(matched);
              }}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id} className="bg-gray-900 text-white">
                  {getChannelDisplayName(c)}
                </option>
              ))}
            </select>
          </div>

          {/* Google Docs Notes Selector */}
          {googleConnected && (
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400">Select Google Meet Note Document:</label>
              {recentDocs.length > 0 ? (
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {recentDocs.map((doc) => (
                    <option key={doc.id} value={doc.id} className="bg-gray-900 text-white">
                      {doc.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-gray-500 italic">
                  {isLoadingDocs ? 'Scanning Google Drive for notes...' : 'No notes found. You can add notes below.'}
                </p>
              )}
            </div>
          )}

          {/* Optional Additional Action Items */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-400">Meeting Key Points & Follow-ups:</label>
            <textarea
              value={customSummary}
              onChange={(e) => setCustomSummary(e.target.value)}
              placeholder="Action items or custom notes discussed with team..."
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {statusMessage && (
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle size={14} className="shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <button
            onClick={handleSyncNoteToChat}
            disabled={isSyncing}
            className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition"
          >
            {isSyncing ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
            <span>Send Notes to {activeChannelName}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
