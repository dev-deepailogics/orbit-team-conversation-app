'use client';

import React, { useState } from 'react';
import { Workspace, Channel, UserProfile } from '@orbit/types';
import {
  Hash,
  Lock,
  Plus,
  ChevronDown,
  PhoneCall,
  Bot,
  UserPlus,
  LogOut,
  Smile,
  Volume2,
  HardDrive,
  X,
  Search,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useChatStore } from '../../stores/chatStore';
import { WorkspaceStorageModal } from '../workspace/WorkspaceStorageModal';
import { AddWorkspaceMemberDialog } from '../workspace/AddWorkspaceMemberDialog';

interface ChannelSidebarProps {
  workspace: Workspace;
  channels: Channel[];
  currentChannel: Channel | null;
  currentUser: UserProfile | null;
  members: any[];
  activeHuddleChannelId?: string | null;
  onSelectChannel: (channel: Channel) => void;
  onSelectUserDM: (targetUser: UserProfile) => void;
  onChannelCreated: (channel: Channel) => void;
  onOpenBotPortal: () => void;
  onStartHuddle: (channel: Channel) => void;
  onLogout: () => void;
  onOpenSearch?: () => void;
  onCloseMobile?: () => void;
  onMemberAdded?: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  workspace,
  channels,
  currentChannel,
  currentUser,
  members,
  activeHuddleChannelId,
  onSelectChannel,
  onSelectUserDM,
  onChannelCreated,
  onOpenBotPortal,
  onStartHuddle,
  onLogout,
  onOpenSearch,
  onCloseMobile,
  onMemberAdded,
}) => {
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelTopic, setChannelTopic] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const unreadCounts = useChatStore((s) => s.unreadCounts);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName) return;
    try {
      const res = await api.post(`/api/channels/workspaces/${workspace.id}/channels`, {
        name: channelName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        topic: channelTopic,
        type: isPrivate ? 'PRIVATE' : 'PUBLIC',
      });
      onChannelCreated(res.data);
      setShowCreateChannel(false);
      setChannelName('');
      setChannelTopic('');
      setIsPrivate(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create channel');
    }
  };

  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}/join/${(workspace as any).inviteCode || workspace.id}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  return (
    <div className="w-64 bg-[#1F2326] border-r border-[#383F45]/40 flex flex-col h-full select-none">
      {/* Workspace Header */}
      <div className="h-14 border-b border-[#383F45]/40 px-4 flex items-center justify-between text-white font-bold hover:bg-white/5 transition cursor-pointer group">
        <div className="flex items-center gap-2 truncate">
          <span className="truncate">{workspace.name}</span>
          <ChevronDown size={16} className="text-gray-400 group-hover:text-white" />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowStorageModal(true);
            }}
            title="Workspace Storage & Files"
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition"
          >
            <HardDrive size={18} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenBotPortal();
            }}
            title="Integrations & Bot Developer Portal"
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition"
          >
            <Bot size={18} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAddMemberModal(true);
            }}
            title="Invite & Add Members"
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition"
          >
            <UserPlus size={18} />
          </button>
          {onCloseMobile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseMobile();
              }}
              title="Close Menu"
              className="md:hidden p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Channel & DMs List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Quick Search Bar */}
        {onOpenSearch && (
          <div className="px-1 mb-2">
            <button
              onClick={onOpenSearch}
              title="Search messages (Cmd+K / Ctrl+K)"
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#272B30] hover:bg-[#2F343A] text-gray-400 hover:text-gray-200 border border-gray-700/60 text-xs transition group"
            >
              <div className="flex items-center gap-2">
                <Search size={14} className="text-gray-400 group-hover:text-slack-green transition" />
                <span>Search messages...</span>
              </div>
              <kbd className="text-[10px] bg-[#1A1D21] px-1.5 py-0.5 rounded text-gray-400 font-mono border border-gray-700">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* Channels Section */}
        <div>
          <div className="flex items-center justify-between px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            <span>Channels</span>
            <button
              onClick={() => setShowCreateChannel(true)}
              className="p-1 hover:text-white hover:bg-gray-700/50 rounded transition"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-0.5">
            {channels.filter((c) => c.type !== 'DIRECT').map((channel) => {
              const isActive = currentChannel?.id === channel.id;
              const hasHuddle = activeHuddleChannelId === channel.id;
              const unread = unreadCounts[channel.id] || 0;

              return (
                <div
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-slack-activeChannel text-white shadow font-semibold'
                      : unread > 0
                      ? 'text-white font-bold bg-[#282C30]'
                      : 'text-gray-300 hover:bg-[#2C3136] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {channel.type === 'PRIVATE' ? (
                      <Lock size={15} className={unread > 0 ? 'text-white' : 'text-gray-400'} />
                    ) : (
                      <Hash size={16} className={unread > 0 ? 'text-white' : 'text-gray-400'} />
                    )}
                    <span className="truncate">{channel.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {unread > 0 && (
                      <span className="px-1.5 py-0.5 bg-slack-green text-white text-[10px] font-bold rounded-full min-w-[18px] text-center leading-none">
                        {unread}
                      </span>
                    )}

                    {/* Channel Call Action */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartHuddle(channel);
                      }}
                      title={hasHuddle ? 'Active Call - Click to join' : 'Start Call'}
                      className={`p-1 rounded transition ${
                        hasHuddle
                          ? 'bg-slack-green text-white animate-pulse'
                          : 'opacity-0 group-hover:opacity-100 hover:bg-black/20 text-gray-400 hover:text-white'
                      }`}
                    >
                      <PhoneCall size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Direct Messages Section */}
        <div>
          <div className="flex items-center justify-between px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            <span>Direct Messages</span>
          </div>

          <div className="space-y-0.5">
            {members.map((member) => {
              const user = member.user;
              if (!user) return null;
              const isOnline = user.status === 'ONLINE';
              const isSelf = user.id === currentUser?.id;
              
              // Find matching DM channel to check selection and unread counts
              const dmChannel = channels.find(
                (c) =>
                  c.type === 'DIRECT' &&
                  c.members &&
                  (isSelf
                    ? c.members.length === 1 || c.members.every((m) => m.userId === currentUser?.id)
                    : c.members.some((m) => m.userId === user.id) && c.members.some((m) => m.userId === currentUser?.id))
              );

              const isSelectedDM = currentChannel?.type === 'DIRECT' && (
                isSelf
                  ? (!currentChannel.members || currentChannel.members.length <= 1 || currentChannel.members.every((m) => m.userId === currentUser?.id))
                  : (currentChannel.members?.some((m) => m.userId === user.id) && currentChannel.members?.some((m) => m.userId === currentUser?.id))
              );

              const unread = dmChannel ? (unreadCounts[dmChannel.id] || 0) : 0;

              return (
                <div
                  key={member.id}
                  onClick={() => onSelectUserDM(user)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                    isSelectedDM
                      ? 'bg-slack-activeChannel text-white shadow font-semibold'
                      : unread > 0
                      ? 'text-white font-bold bg-[#282C30]'
                      : 'text-gray-300 hover:bg-[#2C3136] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                        alt={user.displayName}
                        className="w-5 h-5 rounded-md object-cover"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-[#1F2326] ${
                          isOnline ? 'bg-slack-green' : 'bg-gray-500'
                        }`}
                      />
                    </div>
                    <span className="truncate">{user.displayName}</span>
                    {isSelf && (
                      <span className="text-[10px] text-gray-500 shrink-0">you</span>
                    )}
                  </div>

                  {unread > 0 && (
                    <span className="px-1.5 py-0.5 bg-slack-green text-white text-[10px] font-bold rounded-full min-w-[18px] text-center leading-none shrink-0 ml-1">
                      {unread}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* User Bottom Bar */}
      {currentUser && (
        <div className="h-14 bg-[#181B1E] border-t border-[#383F45]/40 px-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative">
              <img
                src={currentUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`}
                alt={currentUser.displayName}
                className="w-8 h-8 rounded-lg object-cover"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-slack-green rounded-full ring-2 ring-[#181B1E]" />
            </div>
            <div className="truncate">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {currentUser.displayName}
              </p>
              <p className="text-xs text-gray-400 truncate">@{currentUser.username}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Log out"
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1D21] border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Hash className="text-slack-activeChannel" size={22} />
              Create a channel
            </h2>
            <p className="text-sm text-gray-400 mb-5">
              Channels are where conversations happen around a topic.
            </p>

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1">
                  Name
                </label>
                <div className="flex items-center bg-[#222529] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-400">
                  <span>#</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. project-updates"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    className="flex-1 bg-transparent text-white focus:outline-none ml-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1">
                  Topic (optional)
                </label>
                <input
                  type="text"
                  placeholder="What is this channel about?"
                  value={channelTopic}
                  onChange={(e) => setChannelTopic(e.target.value)}
                  className="w-full bg-[#222529] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-slack-activeChannel text-sm"
                />
              </div>

              {/* Channel Type / Privacy Cards */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300">
                  Channel Privacy
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setIsPrivate(false)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      !isPrivate
                        ? 'border-slack-green bg-slack-green/10 text-white shadow'
                        : 'border-gray-700 bg-[#222529] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Hash size={16} className={!isPrivate ? 'text-slack-green' : 'text-gray-400'} />
                      <span className="font-bold text-xs text-white">Public</span>
                    </div>
                    <span className="text-[11px] text-gray-400 leading-snug">
                      Anyone in workspace can view &amp; join
                    </span>
                  </div>

                  <div
                    onClick={() => setIsPrivate(true)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      isPrivate
                        ? 'border-slack-green bg-slack-green/10 text-white shadow'
                        : 'border-gray-700 bg-[#222529] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Lock size={16} className={isPrivate ? 'text-slack-green' : 'text-gray-400'} />
                      <span className="font-bold text-xs text-white">Private</span>
                    </div>
                    <span className="text-[11px] text-gray-400 leading-snug">
                      Only invited people can view &amp; join
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateChannel(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-slack-green hover:bg-[#008a65] text-white transition"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workspace Storage & File Management Modal */}
      {showStorageModal && (
        <WorkspaceStorageModal
          workspace={workspace}
          currentUser={currentUser}
          onClose={() => setShowStorageModal(false)}
          onFileDeleted={(id) => useChatStore.getState().removeAttachment(id)}
        />
      )}

      {/* Add Workspace Member Modal */}
      {showAddMemberModal && (
        <AddWorkspaceMemberDialog
          workspace={workspace}
          currentUser={currentUser}
          onClose={() => setShowAddMemberModal(false)}
          onMemberAdded={onMemberAdded}
        />
      )}
    </div>
  );
};
