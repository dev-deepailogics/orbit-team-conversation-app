'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Workspace, Channel, Message, Project, SOCKET_EVENTS } from '@orbit/types';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useHuddleStore } from '../stores/huddleStore';
import { useProjectStore } from '../stores/projectStore';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

import { sounds } from '../lib/sound';
import { DesktopNotifier } from '../lib/notifications';
import { registerPush } from '../lib/push';
import { useThemeStore } from '../stores/themeStore';

// Components
import { WorkspaceSidebar } from '../components/workspace/WorkspaceSidebar';
import { ChannelSidebar } from '../components/channel/ChannelSidebar';
import { ChatArea } from '../components/chat/ChatArea';
import { ThreadSidebar } from '../components/chat/ThreadSidebar';
import { HuddleModal } from '../components/huddle/HuddleModal';
import { IncomingCallDialog } from '../components/huddle/IncomingCallDialog';
import { AddMembersDialog } from '../components/channel/AddMembersDialog';
import { BotPortalDialog } from '../components/bot/BotPortalDialog';
import { SearchMessagesDialog } from '../components/chat/SearchMessagesDialog';
import { ProjectBoardView } from '../components/project/ProjectBoardView';
import { CreateProjectModal } from '../components/project/CreateProjectModal';
import { CreateTicketFromMessageDialog } from '../components/project/CreateTicketFromMessageDialog';
import { OrganizationControlView } from '../components/availability/OrganizationControlView';
import {
  Layers,
  ShieldCheck,
  Building2,
  LogOut,
  RefreshCw,
  Copy,
  Check,
  Plus,
} from 'lucide-react';

export default function AppDashboard() {
  const router = useRouter();
  const { user, token, isLoading, fetchMe, logout } = useAuthStore();
  const {
    currentWorkspace,
    channels,
    currentChannel,
    messages,
    activeThread,
    threadReplies,
    typingUsers,
    setCurrentWorkspace,
    setChannels,
    setCurrentChannel,
    setMessages,
    addMessage,
    updateMessage,
    setActiveThread,
    setThreadReplies,
    addThreadReply,
    setTypingUser,
    incrementUnread,
  } = useChatStore();

  const { startHuddle, setIncomingCall, channelId: activeHuddleChannelId } = useHuddleStore();
  const [activeHuddleChannel, setActiveHuddleChannel] = useState<string | null>(null);
  const {

    projects,
    currentProject,
    setProjects,
    setCurrentProject,
    addProject,
    updateProject,
    removeProject,
    addTicket,
  } = useProjectStore();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [showBotPortal, setShowBotPortal] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showOrgControl, setShowOrgControl] = useState(false);
  const [messageForTicket, setMessageForTicket] = useState<Message | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Empty workspace state management
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateWsModal, setShowCreateWsModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsSlug, setNewWsSlug] = useState('');
  const [isCreatingWs, setIsCreatingWs] = useState(false);

  // Message chunking & pagination
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Message search modal state
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Global search shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Keep a ref to the current channel to avoid stale closures in socket events
  const currentChannelRef = useRef<Channel | null>(null);
  useEffect(() => {
    currentChannelRef.current = currentChannel;
  }, [currentChannel]);

  // 1. Check Auth
  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login');
    }
  }, [isLoading, token, router]);

  // 2. Fetch User's Workspaces
  const loadWorkspaces = async () => {
    try {
      const res = await api.get('/api/workspaces');
      setWorkspaces(res.data);
      if (res.data.length > 0) {
        if (!currentWorkspace || !res.data.some((w: Workspace) => w.id === currentWorkspace.id)) {
          handleSelectWorkspace(res.data[0]);
        }
      } else {
        // Clear active workspace and channels when user has 0 workspaces
        setCurrentWorkspace(null);
        setChannels([]);
        setCurrentChannel(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load workspaces', err);
    } finally {
      setIsDataLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user || !token) return;
    loadWorkspaces();
  }, [user, token]);

  // Synchronize workspace theme (cached in localStorage, synced with DB)
  useEffect(() => {
    useThemeStore.getState().initTheme(currentWorkspace?.id);
  }, [currentWorkspace?.id]);

  // 3. Handle Workspace Selection
  const handleSelectWorkspace = async (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    setCurrentProject(null);
    try {
      const res = await api.get(`/api/workspaces/${workspace.id}`);
      setChannels(res.data.channels || []);
      setMembers(res.data.members || []);

      // Load Workspace Projects
      let projectsData: Project[] = [];
      try {
        const projRes = await api.get(`/api/projects/workspaces/${workspace.id}/projects`);
        projectsData = projRes.data || [];
        setProjects(projectsData);
      } catch (pErr) {
        console.error('Failed to load projects', pErr);
        setProjects([]);
      }

      let targetChannel: Channel | null = null;
      let targetProject: Project | null = null;
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlChId = urlParams.get('channelId');
        const urlProjId = urlParams.get('projectId');
        if (urlChId && res.data.channels) {
          targetChannel = res.data.channels.find((c: Channel) => c.id === urlChId) || null;
        }
        if (urlProjId && projectsData.length > 0) {
          targetProject = projectsData.find((p: Project) => p.id === urlProjId) || null;
        }
      }

      if (targetProject) {
        handleSelectProject(targetProject);
      } else if (targetChannel) {
        handleSelectChannel(targetChannel);
      } else if (res.data.channels && res.data.channels.length > 0) {
        handleSelectChannel(res.data.channels[0]);
      }
    } catch (err) {
      console.error('Failed to load workspace details', err);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim() || !newWsSlug.trim()) return;
    setIsCreatingWs(true);
    try {
      const res = await api.post('/api/workspaces', {
        name: newWsName.trim(),
        slug: newWsSlug.trim(),
      });
      const createdWs = res.data;
      setWorkspaces((prev) => [...prev, createdWs]);
      handleSelectWorkspace(createdWs);
      setShowCreateWsModal(false);
      setNewWsName('');
      setNewWsSlug('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create workspace');
    } finally {
      setIsCreatingWs(false);
    }
  };

  // 4. Handle Channel Selection (Chunked Initial Load)
  const handleSelectChannel = async (channel: Channel) => {
    setShowOrgControl(false);
    setCurrentProject(null);
    setCurrentChannel(channel);
    setHasMoreMessages(false);
    setNextCursor(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `?channelId=${channel.id}`);
    }
    try {
      const res = await api.get(`/api/channels/${channel.id}/messages?limit=30`);
      if (Array.isArray(res.data)) {
        setMessages(res.data);
        setHasMoreMessages(res.data.length >= 30);
        setNextCursor(res.data.length > 0 ? res.data[0].id : null);
      } else {
        setMessages(res.data.messages || []);
        setHasMoreMessages(!!res.data.hasMore);
        setNextCursor(res.data.nextCursor || null);
      }
      const socket = getSocket(user?.id, currentWorkspace?.id);
      socket.emit('channel:join', channel.id);
    } catch (err) {
      console.error('Failed to load channel messages', err);
    }
  };

  // 4b. Handle Project Selection
  const handleSelectProject = (project: Project) => {
    setShowOrgControl(false);
    setCurrentProject(project);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `?projectId=${project.id}`);
    }
  };

  // 4a. Load Older Messages (Cursor-based Pagination)
  const handleLoadOlderMessages = async () => {
    if (!currentChannel || !nextCursor || isLoadingOlder) return;
    setIsLoadingOlder(true);
    try {
      const res = await api.get(
        `/api/channels/${currentChannel.id}/messages?cursor=${nextCursor}&limit=30`
      );
      const olderChunk = Array.isArray(res.data) ? res.data : res.data.messages || [];
      const more = Array.isArray(res.data) ? olderChunk.length >= 30 : !!res.data.hasMore;
      const cursor = Array.isArray(res.data)
        ? olderChunk.length > 0
          ? olderChunk[0].id
          : null
        : res.data.nextCursor || null;

      useChatStore.getState().prependMessages(olderChunk);
      setHasMoreMessages(more);
      setNextCursor(cursor);
    } catch (err) {
      console.error('Failed to load older messages', err);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // 4b. Handle DM Selection
  const handleSelectUserDM = async (targetUser: any) => {
    if (!currentWorkspace || !user) return;
    try {
      const res = await api.post(`/api/channels/workspaces/${currentWorkspace.id}/dm`, {
        targetUserId: targetUser.id,
      });
      const dmChannel: Channel = res.data;
      
      const existingIdx = channels.findIndex((c) => c.id === dmChannel.id);
      if (existingIdx >= 0) {
        const updated = [...channels];
        updated[existingIdx] = dmChannel;
        setChannels(updated);
      } else {
        setChannels([...channels, dmChannel]);
      }

      handleSelectChannel(dmChannel);
    } catch (err) {
      console.error('Failed to open direct message', err);
    }
  };

  // 4c. Handle selection of searched message
  const handleSelectSearchedMessage = async (searchedMsg: any) => {
    try {
      // 1. If message belongs to a channel that is not currently selected, switch to that channel
      if (!currentChannel || currentChannel.id !== searchedMsg.channelId) {
        let targetChannel = channels.find((c) => c.id === searchedMsg.channelId);
        if (!targetChannel && currentWorkspace) {
          const res = await api.get(`/api/channels/workspaces/${currentWorkspace.id}`);
          const fetchedChannels: Channel[] = res.data;
          setChannels(fetchedChannels);
          targetChannel = fetchedChannels.find((c) => c.id === searchedMsg.channelId);
        }
        if (targetChannel) {
          await handleSelectChannel(targetChannel);
        }
      }

      // 2. If it's a thread reply, open the thread sidepanel
      if (searchedMsg.parentMessageId) {
        const threadRes = await api.get(`/api/messages/${searchedMsg.parentMessageId}/replies`);
        if (threadRes.data.parent) {
          handleOpenThread(threadRes.data.parent);
        }
      } else {
        // 3. Highlight message in ChatArea
        setTimeout(() => {
          const el = document.getElementById(`msg-${searchedMsg.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('bg-slack-activeChannel/25', 'ring-2', 'ring-slack-activeChannel');
            setTimeout(() => {
              el.classList.remove('bg-slack-activeChannel/25', 'ring-2', 'ring-slack-activeChannel');
            }, 3000);
          }
        }, 350);
      }
    } catch (err) {
      console.error('Failed to jump to searched message', err);
    }
  };

  // 5. Socket.IO Realtime listeners
  useEffect(() => {
    if (!user || !currentWorkspace) return;

    const socket = getSocket(user.id, currentWorkspace.id);
    socket.emit('workspace:join', currentWorkspace.id);
    socket.emit('user:join', user.id);

    // Request desktop notification permission
    DesktopNotifier.requestPermission().then((granted) => {
      if (granted) registerPush();
    });

    const onNewMessage = (msg: any) => {
      const activeChannel = currentChannelRef.current;
      const isFromOther = !msg.userId || msg.userId !== user.id;

      // Play message chime if message is from another user or bot
      if (isFromOther) {
        sounds.playMessageSound();
        DesktopNotifier.send(
          msg.user?.displayName || msg.bot?.name || 'New Message',
          msg.content,
          msg.user?.avatarUrl || msg.bot?.avatarUrl,
          () => {
            window.focus();
            const allChannels = useChatStore.getState().channels;
            const targetChannel = allChannels.find((c) => c.id === msg.channelId);
            if (targetChannel) {
              handleSelectChannel(targetChannel);
            }
          }
        );
      }

      if (msg.parentMessageId) {
        addThreadReply(msg);
      } else if (activeChannel && msg.channelId === activeChannel.id) {
        addMessage(msg);
      } else {
        // Different channel or DM -> increment unread badge!
        incrementUnread(msg.id, msg.channelId);
      }
    };

    const onReaction = (data: any) => {
      const activeChannel = currentChannelRef.current;
      if (activeChannel) {
        setMessages(
          useChatStore.getState().messages.map((m) =>
            m.id === data.messageId ? { ...m, reactions: data.reactions } : m
          )
        );
      }
    };

    const onTypingStart = ({ channelId, username }: any) => {
      setTypingUser(channelId, username, true);
    };

    const onTypingStop = ({ channelId }: any) => {
      setTypingUser(channelId, '', false);
    };

    const onCallStarted = (callData: any) => {
      // If someone else started a call, notify user
      if (callData.hostUserId !== user.id) {
        setIncomingCall(callData);
      }
      if (callData.channelId) {
        setActiveHuddleChannel(callData.channelId);
      }
    };

    const onCallEnded = (payload: { channelId: string }) => {
      if (payload?.channelId) {
        useHuddleStore.getState().clearChannelParticipants(payload.channelId);
        setActiveHuddleChannel(null);
      }
    };

    const onHuddleJoined = (payload: { channelId: string; userId: string; user?: any }) => {
      if (payload?.channelId) {
        setActiveHuddleChannel(payload.channelId);
        useHuddleStore.getState().addChannelParticipant(payload.channelId, {
          identity: payload.userId,
          name: payload.user?.displayName || payload.user?.username || 'Participant',
          user: payload.user,
        });
      }
    };

    const onHuddleLeft = (payload: { channelId: string; userId: string }) => {
      if (payload?.channelId) {
        useHuddleStore.getState().removeChannelParticipant(payload.channelId, payload.userId);
      }
    };

    const onChannelNew = (newChan: Channel) => {
      setChannels(
        useChatStore.getState().channels.some((c) => c.id === newChan.id)
          ? useChatStore.getState().channels.map((c) => (c.id === newChan.id ? newChan : c))
          : [...useChatStore.getState().channels, newChan]
      );
    };

    const onChannelUpdated = (updatedChan: Channel) => {
      setChannels(
        useChatStore.getState().channels.map((c) => (c.id === updatedChan.id ? updatedChan : c))
      );
      if (currentChannelRef.current?.id === updatedChan.id) {
        setCurrentChannel(updatedChan);
      }
    };

    const onMessageUpdated = (updatedMsg: Message) => {
      useChatStore.getState().updateMessage(updatedMsg);
    };

    const onMessagePinned = (payload: { messageId: string; channelId: string; isPinned: boolean; message: Message }) => {
      if (payload?.message) {
        useChatStore.getState().updateMessage(payload.message);
      }
    };

    const onMessageDeleted = (payload: { messageId: string; channelId: string; message?: Message }) => {
      if (payload?.message) {
        useChatStore.getState().updateMessage(payload.message);
      } else if (payload?.messageId) {
        const state = useChatStore.getState();
        const existing =
          state.messages.find((m) => m.id === payload.messageId) ||
          state.threadReplies.find((m) => m.id === payload.messageId) ||
          (state.activeThread?.id === payload.messageId ? state.activeThread : null);
        if (existing) {
          useChatStore.getState().updateMessage({
            ...existing,
            isDeleted: true,
            content: '',
            isPinned: false,
            attachments: [],
          });
        }
      }
    };

    socket.on('message:new', onNewMessage);
    socket.on('message:reaction', onReaction);
    socket.on('message:updated', onMessageUpdated);
    socket.on('message:pinned', onMessagePinned);
    socket.on('message:deleted', onMessageDeleted);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    const onProjectNew = (proj: Project) => {
      addProject(proj);
    };

    const onProjectUpdate = (proj: Project) => {
      updateProject(proj);
    };

    const onProjectDelete = (payload: { projectId: string }) => {
      removeProject(payload.projectId);
    };

    socket.on('huddle:started', onCallStarted);
    socket.on('huddle:ended', onCallEnded);
    socket.on('huddle:joined', onHuddleJoined);
    socket.on('huddle:left', onHuddleLeft);
    socket.on('channel:new', onChannelNew);

    socket.on('channel:updated', onChannelUpdated);
    socket.on(SOCKET_EVENTS.PROJECT_NEW, onProjectNew);
    socket.on(SOCKET_EVENTS.PROJECT_UPDATE, onProjectUpdate);
    socket.on(SOCKET_EVENTS.PROJECT_DELETE, onProjectDelete);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:reaction', onReaction);
      socket.off('message:updated', onMessageUpdated);
      socket.off('message:pinned', onMessagePinned);
      socket.off('message:deleted', onMessageDeleted);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('huddle:started', onCallStarted);
      socket.off('channel:new', onChannelNew);
      socket.off('channel:updated', onChannelUpdated);
      socket.off(SOCKET_EVENTS.PROJECT_NEW, onProjectNew);
      socket.off(SOCKET_EVENTS.PROJECT_UPDATE, onProjectUpdate);
      socket.off(SOCKET_EVENTS.PROJECT_DELETE, onProjectDelete);
    };
  }, [user, currentWorkspace]);

  // 6. Handle Opening Thread
  const handleOpenThread = async (message: Message) => {
    setActiveThread(message);
    try {
      const res = await api.get(`/api/messages/${message.id}/replies`);
      setThreadReplies(res.data.replies || []);
    } catch (err) {
      console.error('Failed to load thread replies', err);
    }
  };

  // 7. Handle Starting / Joining Call
  const handleStartHuddle = async (channel: Channel) => {
    try {
      const res = await api.post(`/api/huddles/${channel.id}/token`);
      const { token: livekitToken, serverUrl } = res.data;
      await api.post(`/api/huddles/${channel.id}/start`);
      startHuddle(channel.id, channel.name, livekitToken, serverUrl, channel.workspaceId);

      const socket = getSocket(user?.id, currentWorkspace?.id);
      if (socket) {
        socket.emit('huddle:joined', {
          channelId: channel.id,
          workspaceId: channel.workspaceId,
          user: user
            ? {
                id: user.id,
                displayName: user.displayName,
                username: user.username,
                avatarUrl: user.avatarUrl,
              }
            : undefined,
        });
      }
    } catch (err) {
      alert('Could not start call session');
    }
  };


  if (isLoading || isDataLoading) {
    return (
      <div
        className="h-screen w-screen flex flex-col items-center justify-center gap-3"
        style={{ backgroundColor: 'var(--theme-bg-app)' }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl animate-pulse"
          style={{ backgroundColor: 'var(--theme-primary)' }}
        >
          <Layers size={28} />
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
          Loading Orbit...
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden relative"
      style={{ backgroundColor: 'var(--theme-bg-app)' }}
    >
      {/* Mobile Navigation Drawer (Backdrop + Slide-over Sidebars) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative flex h-full max-w-[92vw] shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <WorkspaceSidebar
              workspaces={workspaces}
              currentWorkspace={currentWorkspace}
              currentUser={user}
              onSelectWorkspace={(ws) => {
                handleSelectWorkspace(ws);
              }}
              onWorkspaceCreated={(ws) => {
                setWorkspaces([...workspaces, ws]);
                handleSelectWorkspace(ws);
              }}
            />
            {currentWorkspace && (
              <ChannelSidebar
                workspace={currentWorkspace}
                channels={channels}
                currentChannel={currentChannel}
                currentUser={user}
                members={members}
                projects={projects}
                currentProject={currentProject}
                activeHuddleChannelId={activeHuddleChannel || activeHuddleChannelId}
                onSelectChannel={(ch) => {

                  handleSelectChannel(ch);
                  setIsMobileSidebarOpen(false);
                }}
                onSelectUserDM={(u) => {
                  handleSelectUserDM(u);
                  setIsMobileSidebarOpen(false);
                }}
                onChannelCreated={(ch) => {
                  setChannels([...channels, ch]);
                  handleSelectChannel(ch);
                  setIsMobileSidebarOpen(false);
                }}
                onSelectProject={(proj) => {
                  handleSelectProject(proj);
                  setIsMobileSidebarOpen(false);
                }}
                onOpenCreateProject={() => {
                  setIsMobileSidebarOpen(false);
                  setShowCreateProjectModal(true);
                }}
                onOpenBotPortal={() => {
                  setIsMobileSidebarOpen(false);
                  setShowBotPortal(true);
                }}
                onStartHuddle={(ch) => {
                  setIsMobileSidebarOpen(false);
                  handleStartHuddle(ch);
                }}
                onLogout={logout}
                onOpenSearch={() => {
                  setIsMobileSidebarOpen(false);
                  setShowSearchModal(true);
                }}
                onOpenOrganizationControl={() => {
                  setIsMobileSidebarOpen(false);
                  setShowOrgControl(true);
                }}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
                onMemberAdded={async () => {
                  if (currentWorkspace) {
                    const res = await api.get(`/api/workspaces/${currentWorkspace.id}`);
                    setMembers(res.data.members || []);
                  }
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* 1. Workspaces Left-most Sidebar (Desktop) */}
      <div className="hidden md:flex shrink-0 h-full">
        <WorkspaceSidebar
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
          currentUser={user}
          onSelectWorkspace={handleSelectWorkspace}
          onWorkspaceCreated={(ws) => {
            setWorkspaces([...workspaces, ws]);
            handleSelectWorkspace(ws);
          }}
        />
      </div>

      {/* 2. Channels & Members Sidebar (Desktop) */}
      {currentWorkspace && (
        <div className="hidden md:flex shrink-0 h-full">
          <ChannelSidebar
            workspace={currentWorkspace}
            channels={channels}
            currentChannel={currentChannel}
            currentUser={user}
            members={members}
            projects={projects}
            currentProject={currentProject}
            activeHuddleChannelId={activeHuddleChannel || activeHuddleChannelId}
            onSelectChannel={handleSelectChannel}

            onSelectUserDM={handleSelectUserDM}
            onChannelCreated={(ch) => {
              setChannels([...channels, ch]);
              handleSelectChannel(ch);
            }}
            onSelectProject={handleSelectProject}
            onOpenCreateProject={() => setShowCreateProjectModal(true)}
            onOpenBotPortal={() => setShowBotPortal(true)}
            onStartHuddle={handleStartHuddle}
            onLogout={logout}
            onOpenSearch={() => setShowSearchModal(true)}
            onOpenOrganizationControl={() => setShowOrgControl(true)}
            onMemberAdded={async () => {
              if (currentWorkspace) {
                const res = await api.get(`/api/workspaces/${currentWorkspace.id}`);
                setMembers(res.data.members || []);
              }
            }}
          />
        </div>
      )}

      {/* 3. Main Chat View or Empty Workspace State */}
      {workspaces.length === 0 ? (
        <div
          className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-y-auto"
          style={{ backgroundColor: 'var(--theme-bg-app)' }}
        >
          <div className="max-w-md w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            {user?.systemRole === 'SUPER_ADMIN' ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-purple-900/30 border border-purple-500/40 flex items-center justify-center mb-6 shadow-xl text-purple-400">
                  <ShieldCheck size={36} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Orbit Super Admin</h1>
                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                  You are signed in as Developer & Super Administrator. You can monitor the system, assign roles, reset user passwords, or launch workspaces.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center mb-6">
                  <Link
                    href="/admin"
                    className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow-lg flex items-center justify-center gap-2 transition"
                  >
                    <ShieldCheck size={18} />
                    Super Admin Console
                  </Link>
                  <button
                    onClick={() => setShowCreateWsModal(true)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#2C3136] hover:bg-[#3E4348] text-gray-200 hover:text-white text-sm font-semibold rounded-xl border border-gray-700 flex items-center justify-center gap-2 transition"
                  >
                    <Plus size={18} />
                    Create Workspace
                  </button>
                </div>
              </>
            ) : user?.systemRole === 'WORKSPACE_ADMIN' ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-slack-activeChannel/20 border border-slack-activeChannel/40 flex items-center justify-center mb-6 shadow-xl text-slack-activeChannel">
                  <Building2 size={36} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  Welcome, {user?.displayName || 'Admin'}!
                </h1>
                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                  You have been designated as a Company Administrator. Create your organization workspace to start adding channels and inviting your team members.
                </p>
                <div className="w-full mb-6">
                  <button
                    onClick={() => setShowCreateWsModal(true)}
                    className="w-full px-5 py-3 bg-slack-green hover:bg-[#008a65] text-white text-sm font-semibold rounded-xl shadow-lg flex items-center justify-center gap-2 transition"
                  >
                    <Plus size={18} />
                    Create Company Workspace
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-[#222529] border border-gray-700/60 flex items-center justify-center mb-6 shadow-xl text-gray-400">
                  <Building2 size={36} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  Welcome to Orbit, {user?.displayName}!
                </h1>
                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                  You are not a member of any workspace yet. Orbit workspaces are private organizations. Ask your company CEO or workspace admin to add you using your account email:
                </p>
                <div className="w-full bg-[#19171D] border border-gray-800 rounded-xl p-4 mb-6 text-left">
                  <span className="text-xs uppercase tracking-wider font-semibold text-gray-500 block mb-1">
                    Your Account Email
                  </span>
                  <div className="flex items-center justify-between gap-2 bg-[#222529] border border-gray-700/50 rounded-lg px-3 py-2">
                    <span className="text-sm font-mono text-gray-200 truncate">{user?.email}</span>
                    <button
                      onClick={() => {
                        if (user?.email) {
                          navigator.clipboard.writeText(user.email);
                          setCopiedEmail(true);
                          setTimeout(() => setCopiedEmail(false), 2000);
                        }
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-gray-700 hover:bg-gray-600 text-white flex items-center gap-1.5 transition shrink-0"
                    >
                      {copiedEmail ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                      {copiedEmail ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Common bottom action bar */}
            <div className="flex items-center gap-3 w-full justify-center">
              <button
                onClick={() => {
                  setIsRefreshing(true);
                  loadWorkspaces();
                }}
                disabled={isRefreshing}
                className="px-4 py-2 bg-slack-activeChannel hover:bg-[#1164A3] text-white text-xs font-semibold rounded-lg shadow flex items-center gap-2 transition disabled:opacity-50"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                Check for Invites
              </button>
              <button
                onClick={logout}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-semibold rounded-lg transition flex items-center gap-2"
              >
                <LogOut size={14} />
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : showOrgControl && currentWorkspace ? (
        <OrganizationControlView
          workspace={currentWorkspace}
          currentUser={user}
          members={members}
          channels={channels}
          onClose={() => setShowOrgControl(false)}
          onOpenAddMembers={() => setShowAddMembers(true)}
          onOpenBotPortal={() => setShowBotPortal(true)}
          onOpenProjectBoard={(project) => {
            setShowOrgControl(false);
            handleSelectProject(project);
          }}
        />
      ) : currentProject ? (
        <ProjectBoardView
          project={currentProject}
          currentUser={user}
          members={members}
          channels={channels}
          onBackToChat={() => setCurrentProject(null)}
          onDeleteProject={(id) => removeProject(id)}
        />
      ) : currentChannel ? (
        <ChatArea
          channel={currentChannel}
          messages={messages}
          currentUser={user}
          typingUsers={typingUsers[currentChannel.id] || []}
          hasMoreMessages={hasMoreMessages}
          isLoadingOlder={isLoadingOlder}
          onLoadOlderMessages={handleLoadOlderMessages}
          onOpenThread={handleOpenThread}
          onStartHuddle={handleStartHuddle}
          onCreateTicketFromMessage={(msg) => setMessageForTicket(msg)}
          onOpenAddMembers={() => setShowAddMembers(true)}
          onOpenSearch={() => setShowSearchModal(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          members={members}
          onSelectUserDM={handleSelectUserDM}
          onSelectChannel={handleSelectChannel}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-4 text-center">
          <p className="text-base font-semibold text-gray-300">No channel or project selected</p>
          <p className="text-xs text-gray-500 mt-1">Select a channel, direct message, or project board to begin</p>
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="mt-4 md:hidden px-4 py-2 bg-slack-green hover:bg-[#008a65] text-white text-xs font-semibold rounded-lg shadow transition"
          >
            Browse Channels & Projects
          </button>
        </div>
      )}

      {/* Workspace Creation Modal for Admins */}
      {showCreateWsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-[#222529] border border-gray-700/60 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Create a New Workspace</h3>
            <p className="text-xs text-gray-400 mb-5">
              Set up a dedicated workspace for your company or team.
            </p>

            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp"
                  value={newWsName}
                  onChange={(e) => {
                    setNewWsName(e.target.value);
                    if (!newWsSlug || newWsSlug === newWsName.toLowerCase().replace(/[^a-z0-9]/g, '-')) {
                      setNewWsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }
                  }}
                  className="w-full bg-[#1A1D21] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-slack-activeChannel"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Workspace URL Slug
                </label>
                <div className="flex items-center bg-[#1A1D21] border border-gray-700 rounded-lg px-3 py-2">
                  <span className="text-xs text-gray-500 select-none mr-1">orbit.chat/</span>
                  <input
                    type="text"
                    required
                    placeholder="acme-corp"
                    value={newWsSlug}
                    onChange={(e) => setNewWsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'))}
                    className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateWsModal(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingWs}
                  className="px-5 py-2 text-sm font-semibold rounded-lg bg-slack-green hover:bg-[#008a65] text-white transition disabled:opacity-50"
                >
                  {isCreatingWs ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Active Thread Panel (Responsive Drawer on Mobile, Column on Desktop) */}
      {activeThread && (
        <div className="fixed inset-0 z-40 md:static md:z-20 md:flex h-full shrink-0">
          <div
            className="fixed inset-0 bg-black/60 md:hidden transition-opacity"
            onClick={() => setActiveThread(null)}
          />
          <div className="relative ml-auto h-full w-full sm:w-96 md:w-80 lg:w-96 shadow-2xl md:shadow-none animate-in slide-in-from-right duration-200">
            <ThreadSidebar
              parentMessage={activeThread}
              replies={threadReplies}
              currentUser={user}
              onClose={() => setActiveThread(null)}
              onReplyAdded={addThreadReply}
              members={members}
              onSelectUserDM={handleSelectUserDM}
              onSelectChannel={handleSelectChannel}
            />
          </div>
        </div>
      )}

      {/* 5. LiveKit Audio/Video Call Overlay */}
      <HuddleModal />

      {/* 6. Incoming Call Ringing Banner */}
      <IncomingCallDialog
        onAcceptCall={(channelId, channelName) => {
          const matched = channels.find((c) => c.id === channelId) || {
            id: channelId,
            name: channelName,
            workspaceId: currentWorkspace?.id || '',
            type: 'PUBLIC' as any,
            createdById: '',
            isArchived: false,
            createdAt: '',
            updatedAt: '',
            topic: null,
            description: null,
          };
          handleStartHuddle(matched);
        }}
      />

      {/* 7. Add Members to Channel Dialog */}
      {showAddMembers && currentChannel && (
        <AddMembersDialog
          channel={currentChannel}
          workspaceMembers={members}
          onClose={() => setShowAddMembers(false)}
          onMembersAdded={async () => {
            // Refresh members
            if (currentWorkspace) {
              const res = await api.get(`/api/workspaces/${currentWorkspace.id}`);
              setMembers(res.data.members || []);
            }
          }}
        />
      )}

      {/* 8. Bot Developer Portal Dialog */}
      {showBotPortal && currentWorkspace && (
        <BotPortalDialog
          workspace={currentWorkspace}
          onClose={() => setShowBotPortal(false)}
        />
      )}

      {/* 9. Global Message Search Dialog */}
      <SearchMessagesDialog
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        workspace={currentWorkspace}
        currentChannel={currentChannel}
        channels={channels}
        members={members}
        onSelectMessage={handleSelectSearchedMessage}
      />

      {/* 10. Create Project Board Dialog */}
      {showCreateProjectModal && currentWorkspace && (
        <CreateProjectModal
          workspaceId={currentWorkspace.id}
          channels={channels}
          onClose={() => setShowCreateProjectModal(false)}
          onProjectCreated={(newProj) => {
            addProject(newProj);
            setCurrentProject(newProj);
          }}
        />
      )}

      {/* 11. Create Ticket from Message Dialog */}
      {messageForTicket && currentWorkspace && (
        <CreateTicketFromMessageDialog
          isOpen={!!messageForTicket}
          onClose={() => setMessageForTicket(null)}
          message={messageForTicket}
          projects={projects}
          workspaceId={currentWorkspace.id}
          members={members}
          onTicketCreated={(ticket) => {
            addTicket(ticket);
            setMessageForTicket(null);
          }}
          onOpenCreateProject={() => setShowCreateProjectModal(true)}
        />
      )}
    </div>
  );
}
