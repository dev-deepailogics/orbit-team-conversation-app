'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Hash,
  Lock,
  Calendar,
  User,
  Users,
  Info,
  HardDrive,
  PenTool,
  UserPlus,
  Edit2,
  Check,
  MessageSquare,
  Shield,
  Loader2,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { Channel, UserProfile } from '@orbit/types';
import { api } from '../../lib/api';

interface ChannelDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel | null;
  currentUser: UserProfile | null;
  onOpenAddMembers?: () => void;
  onOpenWhiteboard?: () => void;
  onOpenStorage?: () => void;
  onChannelUpdated?: (updated: Channel) => void;
}

export const ChannelDetailsModal: React.FC<ChannelDetailsModalProps> = ({
  isOpen,
  onClose,
  channel,
  currentUser,
  onOpenAddMembers,
  onOpenWhiteboard,
  onOpenStorage,
  onChannelUpdated,
}) => {
  const [details, setDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'about' | 'members'>('about');
  const [memberSearch, setMemberSearch] = useState('');
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [isSavingTopic, setIsSavingTopic] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyChannelId = () => {
    if (!channel) return;
    navigator.clipboard.writeText(channel.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  useEffect(() => {
    if (isOpen && channel) {
      setIsLoading(true);
      setIsEditingTopic(false);
      setNewTopic(channel.topic || '');
      api
        .get(`/api/channels/${channel.id}`)
        .then((res) => {
          setDetails(res.data);
          setNewTopic(res.data.topic || '');
        })
        .catch((err) => {
          console.error('Failed to load channel details', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setDetails(null);
      setActiveTab('about');
      setMemberSearch('');
    }
  }, [isOpen, channel]);

  if (!isOpen || !channel) return null;

  const handleSaveTopic = async () => {
    setIsSavingTopic(true);
    try {
      const res = await api.patch(`/api/channels/${channel.id}`, {
        topic: newTopic,
      });
      setDetails((prev: any) => ({ ...prev, topic: res.data.topic }));
      if (onChannelUpdated) {
        onChannelUpdated(res.data);
      }
      setIsEditingTopic(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update topic');
    } finally {
      setIsSavingTopic(false);
    }
  };

  const channelMembers = details?.members || [];
  const filteredMembers = channelMembers.filter((m: any) => {
    const u = m.user || {};
    const q = memberSearch.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-[#1F2326] border border-[#383F45] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#383F45]/60 bg-[#1A1D21] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#2C3136] flex items-center justify-center shrink-0 text-slack-green border border-gray-700">
              {channel.type === 'DIRECT' ? (
                <span className="font-bold text-base">@</span>
              ) : channel.type === 'PRIVATE' ? (
                <Lock size={18} className="text-gray-300" />
              ) : (
                <Hash size={18} className="text-gray-300" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white truncate flex items-center gap-2">
                <span>{channel.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold bg-[#2C3136] text-gray-300 border border-gray-700">
                  {channel.type}
                </span>
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 truncate">
                <span>{details?.workspace?.name || 'Workspace Channel'}</span>
                <span>•</span>
                <span className="font-mono text-[11px] text-gray-400 truncate select-all">{channel.id}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#383F45]/60 bg-[#1A1D21]/60 px-4 gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('about')}
            className={`py-2.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'about'
                ? 'border-slack-green text-white font-bold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Info size={14} />
            <span>About</span>
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`py-2.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'members'
                ? 'border-slack-green text-white font-bold'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users size={14} />
            <span>Members ({details?.members?.length || 0})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {isLoading ? (
            <div className="py-16 text-center flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="w-7 h-7 text-slack-green animate-spin mb-2" />
              <p className="text-xs">Loading channel details...</p>
            </div>
          ) : activeTab === 'about' ? (
            <>
              {/* Topic & Description Box */}
              <div className="bg-[#272B30]/70 border border-gray-700/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-gray-400">
                    Topic & Description
                  </span>
                  {!isEditingTopic && (
                    <button
                      onClick={() => setIsEditingTopic(true)}
                      className="text-xs text-slack-green hover:underline flex items-center gap-1 font-medium"
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                  )}
                </div>

                {isEditingTopic ? (
                  <div className="space-y-2 mt-2">
                    <textarea
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      rows={3}
                      placeholder="Add a topic or description to explain what this channel is for..."
                      className="w-full bg-[#1A1D21] border border-gray-700 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-slack-green"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setIsEditingTopic(false)}
                        className="px-3 py-1 rounded-md text-xs text-gray-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveTopic}
                        disabled={isSavingTopic}
                        className="px-3 py-1 rounded-md text-xs bg-slack-green hover:bg-[#008a65] text-white font-semibold flex items-center gap-1 disabled:opacity-50"
                      >
                        {isSavingTopic ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {details?.topic || details?.description || (
                      <span className="text-gray-500 italic">No description set. Click Edit to add one.</span>
                    )}
                  </p>
                )}
              </div>

              {/* Channel Metadata Grid */}
              <div className="bg-[#272B30]/70 border border-gray-700/60 rounded-xl divide-y divide-gray-700/40 text-xs">
                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-gray-400">Channel Name</span>
                  <span className="font-semibold text-white">#{channel.name}</span>
                </div>
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <span className="text-gray-400 shrink-0">Channel ID</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-gray-300 select-all bg-[#1A1D21] px-2 py-0.5 rounded border border-gray-700 truncate max-w-[200px] sm:max-w-xs">
                      {channel.id}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyChannelId}
                      title="Copy Channel ID"
                      className="px-2 py-0.5 rounded bg-[#2C3136] hover:bg-[#383F45] text-xs text-gray-200 hover:text-white border border-gray-700 flex items-center gap-1 font-medium transition shrink-0"
                    >
                      {copiedId ? (
                        <>
                          <Check size={11} className="text-slack-green" />
                          <span className="text-slack-green text-[11px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} className="text-gray-400" />
                          <span className="text-[11px]">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-gray-400">Created By</span>
                  <span className="font-medium text-gray-200">
                    {details?.creator?.displayName || details?.creator?.username || 'Team Admin'}
                  </span>
                </div>
                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-gray-400">Created Date</span>
                  <span className="text-gray-300">
                    {new Date(channel.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-gray-400">Messages Count</span>
                  <span className="text-slack-green font-semibold">
                    {details?._count?.messages || 0} messages
                  </span>
                </div>
                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-gray-400">Files & Attachments</span>
                  <span className="text-gray-300">
                    {details?._count?.attachments || 0} files
                  </span>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {channel.type !== 'DIRECT' && onOpenAddMembers && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAddMembers();
                    }}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-[#2C3136] hover:bg-[#383F45] text-gray-200 hover:text-white border border-gray-700 text-xs font-semibold transition"
                  >
                    <UserPlus size={14} className="text-slack-green" />
                    <span>Add People</span>
                  </button>
                )}

                {onOpenStorage && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenStorage();
                    }}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-[#2C3136] hover:bg-[#383F45] text-gray-200 hover:text-white border border-gray-700 text-xs font-semibold transition"
                  >
                    <HardDrive size={14} className="text-slack-green" />
                    <span>Files & Storage</span>
                  </button>
                )}

                {onOpenWhiteboard && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenWhiteboard();
                    }}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-[#2C3136] hover:bg-[#383F45] text-gray-200 hover:text-white border border-gray-700 text-xs font-semibold transition"
                  >
                    <PenTool size={14} className="text-slack-green" />
                    <span>Whiteboard</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Members Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search members in channel..."
                  className="flex-1 bg-[#272B30] border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-slack-green"
                />
                {channel.type !== 'DIRECT' && onOpenAddMembers && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAddMembers();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slack-green hover:bg-[#008a65] text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
                  >
                    <UserPlus size={13} />
                    <span>Add People</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-gray-700/50 border border-gray-700/60 rounded-xl overflow-hidden bg-[#272B30]/50 max-h-80 overflow-y-auto">
                {filteredMembers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400">
                    No members match &quot;{memberSearch}&quot;
                  </div>
                ) : (
                  filteredMembers.map((m: any) => {
                    const u = m.user || {};
                    const isCreator = !channel.isAnonymous && details?.createdById === u.id;
                    const isAnon = !!channel.isAnonymous;
                    return (
                      <div
                        key={m.id || u.id}
                        className="p-3 flex items-center justify-between hover:bg-gray-700/20 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            {isAnon ? (
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-900/70 to-indigo-900/70 border border-purple-500/40 flex items-center justify-center text-base select-none">
                                {m.anonEmoji || '🎭'}
                              </div>
                            ) : (
                              <img
                                src={
                                  u.avatarUrl ||
                                  `https://api.dicebear.com/7.x/bottts/svg?seed=${u.displayName || u.username}`
                                }
                                alt={u.displayName || u.username}
                                className="w-8 h-8 rounded-lg object-cover"
                              />
                            )}
                            {!isAnon && (
                              <div
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1F2326] ${
                                  u.status === 'ONLINE'
                                    ? 'bg-slack-green'
                                    : u.status === 'IN_HUDDLE'
                                    ? 'bg-purple-500'
                                    : 'bg-gray-500'
                                }`}
                              />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-white truncate">
                                {isAnon ? (m.anonName || u.displayName || 'Anonymous Member') : (u.displayName || u.username)}
                              </span>
                              {isAnon && m.isSelf && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-200 border border-purple-500/40 font-semibold">
                                  YOU
                                </span>
                              )}
                              {isCreator && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900/50 text-purple-300 border border-purple-700/60 font-semibold">
                                  CREATOR
                                </span>
                              )}
                              {!isAnon && u.systemRole === 'SUPER_ADMIN' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-900/50 text-red-300 border border-red-700/60 font-semibold">
                                  SUPER ADMIN
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-400 truncate block">
                              {isAnon
                                ? m.isSelf
                                  ? `@${u.username || 'user'} • You (Shielded from other members)`
                                  : 'Anonymous Member • Identity Shielded'
                                : `@${u.username || 'user'} • ${u.email}`}
                            </span>
                          </div>
                        </div>

                        <span className="text-[11px] text-gray-400 capitalize shrink-0">
                          {isAnon ? 'anonymous' : (u.status?.toLowerCase().replace('_', ' ') || 'offline')}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
