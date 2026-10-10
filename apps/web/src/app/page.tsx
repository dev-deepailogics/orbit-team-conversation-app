'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Workspace, Channel, Message } from '@orbit/types';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useHuddleStore } from '../stores/huddleStore';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

import { sounds } from '../lib/sound';
import { DesktopNotifier } from '../lib/notifications';

// Components
import { WorkspaceSidebar } from '../components/workspace/WorkspaceSidebar';
import { ChannelSidebar } from '../components/channel/ChannelSidebar';
import { ChatArea } from '../components/chat/ChatArea';
import { ThreadSidebar } from '../components/chat/ThreadSidebar';
import { HuddleModal } from '../components/huddle/HuddleModal';
import { IncomingCallDialog } from '../components/huddle/IncomingCallDialog';
import { AddMembersDialog } from '../components/channel/AddMembersDialog';
import { BotPortalDialog } from '../components/bot/BotPortalDialog';
import { Layers } from 'lucide-react';

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

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [showBotPortal, setShowBotPortal] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
  useEffect(() => {
    if (!user || !token) return;

    const loadWorkspaces = async () => {
      try {
        const res = await api.get('/api/workspaces');
        setWorkspaces(res.data);
        if (res.data.length > 0 && !currentWorkspace) {
          handleSelectWorkspace(res.data[0]);
        }
      } catch (err) {
        console.error('Failed to load workspaces', err);
      } finally {
        setIsDataLoading(false);
      }
    };

    loadWorkspaces();
  }, [user, token]);

  // 3. Handle Workspace Selection
  const handleSelectWorkspace = async (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    try {
      const res = await api.get(`/api/workspaces/${workspace.id}`);
      setChannels(res.data.channels || []);
      setMembers(res.data.members || []);

      if (res.data.channels && res.data.channels.length > 0) {
        handleSelectChannel(res.data.channels[0]);
      }
    } catch (err) {
      console.error('Failed to load workspace details', err);
    }
  };

  // 4. Handle Channel Selection
  const handleSelectChannel = async (channel: Channel) => {
    setCurrentChannel(channel);
    try {
      const res = await api.get(`/api/channels/${channel.id}/messages`);
      setMessages(res.data);
      const socket = getSocket(user?.id, currentWorkspace?.id);
      socket.emit('channel:join', channel.id);
    } catch (err) {
      console.error('Failed to fetch channel messages', err);
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

  // 5. Socket.IO Realtime listeners
  useEffect(() => {
    if (!user || !currentWorkspace) return;

    const socket = getSocket(user.id, currentWorkspace.id);
    socket.emit('workspace:join', currentWorkspace.id);
    socket.emit('user:join', user.id);

    // Request desktop notification permission
    DesktopNotifier.requestPermission();

    const onNewMessage = (msg: any) => {
      const activeChannel = currentChannelRef.current;
      const isFromOther = !msg.userId || msg.userId !== user.id;

      // Play message chime if message is from another user or bot
      if (isFromOther) {
        sounds.playMessageSound();
        DesktopNotifier.send(
          msg.user?.displayName || msg.bot?.name || 'New Message',
          msg.content,
          msg.user?.avatarUrl || msg.bot?.avatarUrl
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

    socket.on('message:new', onNewMessage);
    socket.on('message:reaction', onReaction);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('huddle:started', onCallStarted);
    socket.on('channel:new', onChannelNew);
    socket.on('channel:updated', onChannelUpdated);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:reaction', onReaction);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('huddle:started', onCallStarted);
      socket.off('channel:new', onChannelNew);
      socket.off('channel:updated', onChannelUpdated);
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
      startHuddle(channel.id, channel.name, livekitToken, serverUrl);
    } catch (err) {
      alert('Could not start call session');
    }
  };

  if (isLoading || isDataLoading) {
    return (
      <div className="h-screen w-screen bg-[#1A1D21] flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 bg-slack-activeChannel rounded-2xl flex items-center justify-center text-white shadow-xl animate-pulse">
          <Layers size={28} />
        </div>
        <span className="text-sm font-semibold text-gray-400">Loading Orbit...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1A1D21] relative">
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
                activeHuddleChannelId={activeHuddleChannelId}
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
                onOpenBotPortal={() => {
                  setIsMobileSidebarOpen(false);
                  setShowBotPortal(true);
                }}
                onStartHuddle={(ch) => {
                  setIsMobileSidebarOpen(false);
                  handleStartHuddle(ch);
                }}
                onLogout={logout}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
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
            activeHuddleChannelId={activeHuddleChannelId}
            onSelectChannel={handleSelectChannel}
            onSelectUserDM={handleSelectUserDM}
            onChannelCreated={(ch) => {
              setChannels([...channels, ch]);
              handleSelectChannel(ch);
            }}
            onOpenBotPortal={() => setShowBotPortal(true)}
            onStartHuddle={handleStartHuddle}
            onLogout={logout}
          />
        </div>
      )}

      {/* 3. Main Chat View */}
      {currentChannel ? (
        <ChatArea
          channel={currentChannel}
          messages={messages}
          currentUser={user}
          typingUsers={typingUsers[currentChannel.id] || []}
          onOpenThread={handleOpenThread}
          onStartHuddle={handleStartHuddle}
          onOpenAddMembers={() => setShowAddMembers(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-4 text-center">
          <p className="text-base font-semibold text-gray-300">No channel selected</p>
          <p className="text-xs text-gray-500 mt-1">Select or create a channel to begin chatting</p>
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="mt-4 md:hidden px-4 py-2 bg-slack-green hover:bg-[#008a65] text-white text-xs font-semibold rounded-lg shadow transition"
          >
            Browse Channels
          </button>
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
    </div>
  );
}
