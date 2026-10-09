'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Workspace, Channel, Message } from '@orbit/types';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useHuddleStore } from '../stores/huddleStore';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

// Components
import { WorkspaceSidebar } from '../components/workspace/WorkspaceSidebar';
import { ChannelSidebar } from '../components/channel/ChannelSidebar';
import { ChatArea } from '../components/chat/ChatArea';
import { ThreadSidebar } from '../components/chat/ThreadSidebar';
import { HuddleModal } from '../components/huddle/HuddleModal';
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
  } = useChatStore();

  const { startHuddle, channelId: activeHuddleChannelId } = useHuddleStore();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [showBotPortal, setShowBotPortal] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);

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

  // 5. Socket.IO Realtime listeners
  useEffect(() => {
    if (!user || !currentWorkspace) return;

    const socket = getSocket(user.id, currentWorkspace.id);
    socket.emit('workspace:join', currentWorkspace.id);

    const onNewMessage = (msg: any) => {
      if (msg.parentMessageId) {
        addThreadReply(msg);
      } else if (msg.channelId === currentChannel?.id) {
        addMessage(msg);
      }
    };

    const onReaction = (data: any) => {
      if (currentChannel) {
        // Update reactions on current messages
        const updated = messages.map((m) =>
          m.id === data.messageId ? { ...m, reactions: data.reactions } : m
        );
        setMessages(updated);
      }
    };

    const onTypingStart = ({ channelId, username }: any) => {
      setTypingUser(channelId, username, true);
    };

    const onTypingStop = ({ channelId, userId }: any) => {
      setTypingUser(channelId, '', false);
    };

    socket.on('message:new', onNewMessage);
    socket.on('message:reaction', onReaction);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:reaction', onReaction);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
    };
  }, [user, currentWorkspace, currentChannel, messages]);

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

  // 7. Handle Starting / Joining Huddle
  const handleStartHuddle = async (channel: Channel) => {
    try {
      const res = await api.post(`/api/huddles/${channel.id}/token`);
      const { token: livekitToken, serverUrl } = res.data;
      await api.post(`/api/huddles/${channel.id}/start`);
      startHuddle(channel.id, channel.name, livekitToken, serverUrl);
    } catch (err) {
      alert('Could not start huddle session');
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

      {/* 5. LiveKit Audio/Video Huddle Overlay */}
      <HuddleModal />

      {/* 6. Bot Developer Portal Dialog */}
      {showBotPortal && currentWorkspace && (
        <BotPortalDialog
          workspace={currentWorkspace}
          onClose={() => setShowBotPortal(false)}
        />
      )}
    </div>
  );
}
