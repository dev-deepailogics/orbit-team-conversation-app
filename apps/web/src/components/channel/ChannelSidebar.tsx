'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Workspace, Channel, UserProfile, Project } from '@orbit/types';
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
  FolderKanban,
  Kanban,
  Palette,
  Check,
  Building2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useChatStore } from '../../stores/chatStore';
import { WorkspaceStorageModal } from '../workspace/WorkspaceStorageModal';
import { AddWorkspaceMemberDialog } from '../workspace/AddWorkspaceMemberDialog';
import { ThemeModal } from '../theme/ThemeModal';
import { OrganizationControlModal } from '../availability/OrganizationControlModal';

interface ChannelSidebarProps {
  workspace: Workspace;
  channels: Channel[];
  currentChannel: Channel | null;
  currentUser: UserProfile | null;
  members: any[];
  projects?: Project[];
  currentProject?: Project | null;
  activeHuddleChannelId?: string | null;
  onSelectChannel: (channel: Channel) => void;
  onSelectUserDM: (targetUser: UserProfile) => void;
  onChannelCreated: (channel: Channel) => void;
  onSelectProject?: (project: Project) => void;
  onOpenCreateProject?: () => void;
  onOpenBotPortal: () => void;
  onStartHuddle: (channel: Channel) => void;
  onLogout: () => void;
  onOpenSearch?: () => void;
  onOpenOrganizationControl?: () => void;
  onCloseMobile?: () => void;
  onMemberAdded?: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  workspace,
  channels,
  currentChannel,
  currentUser,
  members,
  projects = [],
  currentProject,
  activeHuddleChannelId,
  onSelectChannel,
  onSelectUserDM,
  onChannelCreated,
  onSelectProject,
  onOpenCreateProject,
  onOpenBotPortal,
  onStartHuddle,
  onLogout,
  onOpenSearch,
  onOpenOrganizationControl,
  onCloseMobile,
  onMemberAdded,
}) => {
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showOrgControlModal, setShowOrgControlModal] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelTopic, setChannelTopic] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const [isProjectsCollapsed, setIsProjectsCollapsed] = useState(false);
  const [isChannelsCollapsed, setIsChannelsCollapsed] = useState(false);
  const [isDmsCollapsed, setIsDmsCollapsed] = useState(false);
  const unreadCounts = useChatStore((s) => s.unreadCounts);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(e.target as Node)) {
        setShowWorkspaceMenu(false);
      }
    };
    if (showWorkspaceMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showWorkspaceMenu]);

  const currentUserMember = members?.find(
    (m: any) => m.userId === currentUser?.id || m.user?.id === currentUser?.id
  );
  const isAdminOrOwner =
    currentUser?.systemRole === 'SUPER_ADMIN' ||
    currentUserMember?.role === 'OWNER' ||
    currentUserMember?.role === 'ADMIN' ||
    workspace.ownerId === currentUser?.id;

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName) return;
    try {
      const res = await api.post(`/api/channels/workspaces/${workspace.id}/channels`, {
        name: channelName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        topic: channelTopic,
        type: isPrivate ? 'PRIVATE' : 'PUBLIC',
        isAnonymous,
      });
      onChannelCreated(res.data);
      setShowCreateChannel(false);
      setChannelName('');
      setChannelTopic('');
      setIsPrivate(false);
      setIsAnonymous(false);
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
    <div
      className="w-64 border-r flex flex-col h-full select-none"
      style={{
        backgroundColor: 'var(--theme-bg-sidebar)',
        borderColor: 'var(--theme-border)',
      }}
    >
      {/* Workspace Header with Dropdown */}
      <div
        ref={workspaceMenuRef}
        className="relative h-14 border-b px-3 sm:px-4 flex items-center justify-between font-bold select-none z-30"
        style={{
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-primary)',
        }}
      >
        <button
          onClick={() => setShowWorkspaceMenu((prev) => !prev)}
          title="Workspace options"
          className="flex items-center gap-1.5 truncate rounded-lg px-2 py-1.5 -ml-1.5 transition hover:bg-black/5 dark:hover:bg-white/10 group text-left min-w-0"
        >
          <span className="truncate font-bold text-sm sm:text-base">{workspace.name}</span>
          <ChevronDown
            size={16}
            className={`shrink-0 transition-transform duration-200 ${
              showWorkspaceMenu ? 'rotate-180' : ''
            }`}
            style={{ color: 'var(--theme-text-muted)' }}
          />
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowAddMemberModal(true)}
            title="Invite & Add Members"
            style={{ color: 'var(--theme-text-muted)' }}
            className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10 hover:opacity-100"
          >
            <UserPlus size={18} />
          </button>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              title="Close Menu"
              style={{ color: 'var(--theme-text-muted)' }}
              className="md:hidden p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10 hover:opacity-100"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Workspace Dropdown Menu */}
        {showWorkspaceMenu && (
          <div
            className="absolute top-full left-3 mt-1.5 w-64 rounded-xl border shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          >
            {/* Header info */}
            <div className="px-3.5 py-2 border-b" style={{ borderColor: 'var(--theme-border)' }}>
              <p className="text-xs font-bold truncate">{workspace.name}</p>
              <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                {isAdminOrOwner ? 'Workspace Administrator' : 'Workspace Member'}
              </p>
            </div>

            <div className="py-1">
              {/* Organization Control (Employee Availability & Shift Management) */}
              <button
                onClick={() => {
                  setShowWorkspaceMenu(false);
                  if (onOpenOrganizationControl) {
                    onOpenOrganizationControl();
                  } else {
                    setShowOrgControlModal(true);
                  }
                }}
                className="w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition hover:bg-black/5 dark:hover:bg-white/10 group"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 size={15} className="text-blue-400" />
                  <span className="font-semibold text-blue-300">Organization Control</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:scale-125 transition" />
              </button>

              {/* Theme & Appearance */}
              <button
                onClick={() => {
                  setShowWorkspaceMenu(false);
                  setShowThemeModal(true);
                }}
                className="w-full px-3.5 py-2 text-left text-xs flex items-center gap-2.5 transition hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Palette size={15} style={{ color: 'var(--theme-primary)' }} />
                <span>Customize Theme & Colors</span>
              </button>

              {/* Chatbot Integrations & Bots */}
              <button
                onClick={() => {
                  setShowWorkspaceMenu(false);
                  onOpenBotPortal();
                }}
                className="w-full px-3.5 py-2 text-left text-xs flex items-center gap-2.5 transition hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Bot size={15} style={{ color: 'var(--theme-primary)' }} />
                <span>Chatbot Integrations & Bots</span>
              </button>

              {/* Workspace Files & Storage */}
              <button
                onClick={() => {
                  setShowWorkspaceMenu(false);
                  setShowStorageModal(true);
                }}
                className="w-full px-3.5 py-2 text-left text-xs flex items-center gap-2.5 transition hover:bg-black/5 dark:hover:bg-white/10"
              >
                <HardDrive size={15} style={{ color: 'var(--theme-primary)' }} />
                <span>Workspace Files & Storage</span>
              </button>

              <div className="h-px my-1" style={{ backgroundColor: 'var(--theme-border)' }} />

              {/* Copy Invite Link */}
              <button
                onClick={() => {
                  copyInviteLink();
                }}
                className="w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="flex items-center gap-2.5">
                  <UserPlus size={15} style={{ color: 'var(--theme-primary)' }} />
                  <span>{copiedInvite ? 'Invite Link Copied!' : 'Copy Workspace Invite Link'}</span>
                </span>
                {copiedInvite && <Check size={13} className="text-green-500" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Channel & DMs List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Quick Search Bar */}
        {onOpenSearch && (
          <div className="px-1 mb-2">
            <button
              onClick={onOpenSearch}
              title="Search messages (Cmd+K / Ctrl+K)"
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition group hover:opacity-85"
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-muted)',
              }}
            >
              <div className="flex items-center gap-2">
                <Search size={14} style={{ color: 'var(--theme-primary)' }} className="transition" />
                <span>Search messages...</span>
              </div>
              <kbd
                className="text-[10px] px-1.5 py-0.5 rounded font-mono border"
                style={{
                  backgroundColor: 'var(--theme-bg-app)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* Projects & Boards Section (Trello-like) */}
        <div>
          <div
            className="flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider mb-1 select-none"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <button
              onClick={() => setIsProjectsCollapsed((prev) => !prev)}
              className="flex items-center gap-1.5 hover:text-white transition cursor-pointer text-left focus:outline-none"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 shrink-0 ${
                  isProjectsCollapsed ? '-rotate-90' : 'rotate-0'
                }`}
              />
              <span className="flex items-center gap-1.5">
                <FolderKanban size={13} style={{ color: 'var(--theme-primary)' }} />
                <span>Projects & Boards</span>
              </span>
            </button>
            {onOpenCreateProject && (
              <button
                onClick={onOpenCreateProject}
                title="Create Project Board"
                className="p-1 hover:opacity-80 rounded transition"
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          {!isProjectsCollapsed && (
            <div className="space-y-0.5">
              {projects
                .filter((p) => (p.status || 'active').toLowerCase() === 'active')
                .map((project) => {
                  const isActive = currentProject?.id === project.id;
                  const ticketCount = project._count?.tickets ?? project.tickets?.length ?? 0;

                  return (
                    <div
                      key={project.id}
                      onClick={() => onSelectProject?.(project)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                        isActive
                          ? 'shadow font-semibold'
                          : 'hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                      style={
                        isActive
                          ? {
                              backgroundColor: 'var(--theme-primary)',
                              color: 'var(--theme-primary-text)',
                            }
                          : {
                              color: 'var(--theme-text-primary)',
                            }
                      }
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-sm shrink-0">{project.icon || '📋'}</span>
                        <span className="truncate">{project.name}</span>
                      </div>

                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded-full transition"
                        style={
                          isActive
                            ? {
                                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                                color: 'inherit',
                              }
                            : {
                                backgroundColor: 'var(--theme-bg-surface-hover)',
                                color: 'var(--theme-text-muted)',
                              }
                        }
                      >
                        {ticketCount}
                      </span>
                    </div>
                  );
                })}

              {projects.length === 0 && onOpenCreateProject && (
                <button
                  onClick={onOpenCreateProject}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center gap-2 cursor-pointer"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <Plus size={12} />
                  <span>Create a project board...</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Channels Section */}
        <div>
          <div
            className="flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider mb-1 select-none"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <button
              onClick={() => setIsChannelsCollapsed((prev) => !prev)}
              className="flex items-center gap-1.5 hover:text-white transition cursor-pointer text-left focus:outline-none"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 shrink-0 ${
                  isChannelsCollapsed ? '-rotate-90' : 'rotate-0'
                }`}
              />
              <span>Channels</span>
            </button>
            <button
              onClick={() => setShowCreateChannel(true)}
              className="p-1 hover:opacity-80 rounded transition"
            >
              <Plus size={14} />
            </button>
          </div>

          {!isChannelsCollapsed && (
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
                        ? 'shadow font-semibold'
                        : unread > 0
                        ? 'font-bold bg-black/5 dark:bg-white/10'
                        : 'hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    style={
                      isActive
                        ? {
                            backgroundColor: 'var(--theme-primary)',
                            color: 'var(--theme-primary-text)',
                          }
                        : {
                            color: 'var(--theme-text-primary)',
                          }
                    }
                  >
                    <div className="flex items-center gap-2 truncate">
                      {channel.isAnonymous ? (
                        <span className="text-sm shrink-0 leading-none" title="Anonymous Channel">🎭</span>
                      ) : channel.type === 'PRIVATE' ? (
                        <Lock size={15} className={`shrink-0 ${unread > 0 ? '' : 'opacity-70'}`} />
                      ) : (
                        <Hash size={16} className={`shrink-0 ${unread > 0 ? '' : 'opacity-70'}`} />
                      )}
                      <span className="truncate">{channel.name}</span>
                      {channel.isAnonymous && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950/80 border border-purple-700/50 text-purple-300 font-semibold shrink-0">
                          anon
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {unread > 0 && (
                        <span className="px-1.5 py-0.5 bg-slack-green text-white text-[10px] font-bold rounded-full min-w-[18px] text-center leading-none">
                          {unread}
                        </span>
                      )}

                      {/* Active Call Indicator & Avatars */}
                      {hasHuddle && (
                        <span className="flex items-center gap-1 bg-slack-green/20 border border-slack-green/40 text-slack-green px-1.5 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-slack-green" />
                          LIVE
                        </span>
                      )}

                      {/* Channel Call Action */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartHuddle(channel);
                        }}
                        title={hasHuddle ? 'Active Call - Click to join' : 'Start Call'}
                        style={hasHuddle ? undefined : { color: 'var(--theme-text-muted)' }}
                        className={`p-1 rounded transition ${
                          hasHuddle
                            ? 'bg-slack-green text-white shadow-sm'
                            : 'opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10'
                        }`}
                      >
                        <PhoneCall size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Direct Messages Section */}
        <div>
          <div
            className="flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider mb-1 select-none"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <button
              onClick={() => setIsDmsCollapsed((prev) => !prev)}
              className="flex items-center gap-1.5 hover:text-white transition cursor-pointer text-left focus:outline-none"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 shrink-0 ${
                  isDmsCollapsed ? '-rotate-90' : 'rotate-0'
                }`}
              />
              <span>Direct Messages</span>
            </button>
          </div>

          {!isDmsCollapsed && (
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
                        ? 'shadow font-semibold'
                        : unread > 0
                        ? 'font-bold bg-black/5 dark:bg-white/10'
                        : 'hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    style={
                      isSelectedDM
                        ? {
                            backgroundColor: 'var(--theme-primary)',
                            color: 'var(--theme-primary-text)',
                          }
                        : {
                            color: 'var(--theme-text-primary)',
                          }
                    }
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                          alt={user.displayName}
                          className="w-5 h-5 rounded-md object-cover"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-black/40 ${
                            isOnline ? 'bg-slack-green' : 'bg-gray-500'
                          }`}
                        />
                      </div>
                      <span className="truncate">{user.displayName}</span>
                      {isSelf && (
                        <span className="text-[10px] shrink-0" style={{ color: 'var(--theme-text-muted)' }}>you</span>
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
          )}
        </div>
      </div>

      {/* User Bottom Bar */}
      {currentUser && (
        <div
          className="h-14 border-t px-3 flex items-center justify-between"
          style={{
            backgroundColor: 'var(--theme-bg-surface)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative">
              <img
                src={currentUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`}
                alt={currentUser.displayName}
                className="w-8 h-8 rounded-lg object-cover"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-slack-green rounded-full ring-2 ring-black/30" />
            </div>
            <div className="truncate">
              <p
                className="text-sm font-semibold truncate leading-tight"
                style={{ color: 'var(--theme-text-primary)' }}
              >
                {currentUser.displayName}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                @{currentUser.username}
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Log out"
            style={{ color: 'var(--theme-text-muted)' }}
            className="p-1.5 hover:text-red-400 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition"
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

              {/* Anonymous Discussion Mode Option */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300">
                  Discussion Mode
                </label>
                <div
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                    isAnonymous
                      ? 'border-purple-500 bg-purple-950/30 text-white shadow'
                      : 'border-gray-700 bg-[#222529] text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <span className="text-2xl shrink-0 select-none">🎭</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">Anonymous Channel</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase transition ${
                          isAnonymous
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-gray-700 text-gray-400'
                        }`}
                      >
                        {isAnonymous ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug mt-1">
                      Ideal for critical discussions and open-ended feedback. Real names, avatars, and IDs are hidden. Each member gets a customizable pseudonym and emoji icon.
                    </p>
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

      {/* Theme Customizer Modal */}
      {showThemeModal && (
        <ThemeModal
          isOpen={showThemeModal}
          onClose={() => setShowThemeModal(false)}
          workspace={workspace}
          isAdminOrOwner={isAdminOrOwner}
        />
      )}

      {/* Organization Control Modal */}
      {showOrgControlModal && (
        <OrganizationControlModal
          isOpen={showOrgControlModal}
          onClose={() => setShowOrgControlModal(false)}
          workspace={workspace}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
