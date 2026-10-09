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

    // Request desktop notification permission
    DesktopNotifier.requestPermission();

    const onNewMessage = (msg: any) => {
      const activeChannel = currentChannelRef.current;
      const isFromOther = msg.userId && msg.userId !== user.id;

      // Play message chime if message is from another user
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
      // If someone else in the workspace started a call, notify user
      if (callData.hostUserId !== user.id) {
        setIncomingCall(callData);
      }
    };

    socket.on('message:new', onNewMessage);
    socket.on('message:reaction', onReaction);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('huddle:started', onCallStarted);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:reaction', onReaction);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('huddle:started', onCallStarted);
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#1A1D21]">
      {/* 1. Workspaces Left-most Sidebar */}
      <WorkspaceSidebar
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={handleSelectWorkspace}
        onWorkspaceCreated={(ws) => {
          setWorkspaces([...workspaces, ws]);
          handleSelectWorkspace(ws);
        }}
      />

      {/* 2. Channels & Members Sidebar */}
      {currentWorkspace && (
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
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Select or create a channel to begin
        </div>
      )}

      {/* 4. Active Thread Panel (if open) */}
      {activeThread && (
        <ThreadSidebar
          parentMessage={activeThread}
          replies={threadReplies}
          currentUser={user}
          onClose={() => setActiveThread(null)}
          onReplyAdded={addThreadReply}
        />
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
