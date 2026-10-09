import React, { useState, useRef, useEffect } from 'react';
import { Channel, Message, UserProfile } from '@orbit/types';
import {
  Hash,
  Lock,
  PhoneCall,
  UserPlus,
  Paperclip,
  Smile,
  SmilePlus,
  Send,
  MessageSquare,
  Sparkles,
  Bot as BotIcon,
  X,
  FileText,
  CornerUpLeft,
  Copy,
  Check,
  PenTool,
  Presentation,
  Type,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useChatStore } from '../../stores/chatStore';
import { EmojiPickerPopover } from './EmojiPickerPopover';
import { getTopEmojis, recordEmojiUsage } from '../../lib/emojiStore';
import { WhiteboardView } from '../whiteboard/WhiteboardView';
import { MarkdownRenderer } from './MarkdownRenderer';
import { RichTextEditor, RichTextEditorRef } from './RichTextEditor';
import { FileAttachmentList, formatFileSize, getFileCategory } from './FileAttachmentList';
import { ChannelStorageModal } from './ChannelStorageModal';

interface ChatAreaProps {
  channel: Channel;
  messages: Message[];
  currentUser: UserProfile | null;
  typingUsers: string[];
  onOpenThread: (message: Message) => void;
  onStartHuddle: (channel: Channel) => void;
  onOpenAddMembers?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  channel,
  messages,
  currentUser,
  typingUsers,
  onOpenThread,
  onStartHuddle,
  onOpenAddMembers,
}) => {
  const [content, setContent] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeEmojiMessageId, setActiveEmojiMessageId] = useState<string | null>(null);
  const [topEmojis, setTopEmojis] = useState<string[]>(['👍', '❤️', '🔥', '🎉', '🚀']);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showFormatting, setShowFormatting] = useState(true);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [activeView, setActiveView] = useState<'messages' | 'whiteboard'>('messages');
  const [copiedChannelId, setCopiedChannelId] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RichTextEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setTopEmojis(getTopEmojis(5));
  }, []);

  const handleTyping = (text: string) => {
    setContent(text);
    const socket = getSocket();

    if (currentUser) {
      socket.emit('typing:start', { channelId: channel.id, username: currentUser.displayName });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { channelId: channel.id });
      }, 2000);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawMarkdown = editorRef.current?.getMarkdown() || content.trim();
    if ((!rawMarkdown.trim() && attachments.length === 0) || !currentUser) return;

    const trimmed = rawMarkdown.trim();
    const plainText = editorRef.current?.getText() || content.trim();

    // Check for Slash Command
    if (plainText.startsWith('/')) {
      const commandParts = plainText.split(' ');
      const cmd = commandParts[0].toLowerCase();

      if (cmd === '/call' || cmd === '/meet' || cmd === '/huddle') {
        editorRef.current?.clear();
        setContent('');
        onStartHuddle(channel);
        return;
      }

      try {
        const res = await api.post('/api/bot/commands/execute', {
          channelId: channel.id,
          workspaceId: channel.workspaceId,
          commandText: plainText,
        });
        if (res.data.message) {
          useChatStore.getState().addMessage(res.data.message);
        }
        editorRef.current?.clear();
        setContent('');
        setReplyingToMessage(null);
        return;
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to execute command');
        return;
      }
    }

    try {
      const res = await api.post(`/api/channels/${channel.id}/messages`, {
        content: trimmed,
        attachments,
        quotedMessageId: replyingToMessage?.id,
      });

      // Optimistically append sent message immediately to avoid channel reload delay
      useChatStore.getState().addMessage(res.data);

      editorRef.current?.clear();
      setContent('');
      setAttachments([]);
      setReplyingToMessage(null);
      setShowEmoji(false);
      const socket = getSocket();
      socket.emit('typing:stop', { channelId: channel.id });
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  // Multiple File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('workspaceId', channel.workspaceId);
        formData.append('channelId', channel.id);
        formData.append('file', file);

        const url = `/api/files/upload?workspaceId=${encodeURIComponent(channel.workspaceId)}&channelId=${encodeURIComponent(channel.id)}`;
        const res = await api.post(url, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setAttachments((prev) => [...prev, res.data]);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'File upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Drag & Drop File Upload Handler
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('workspaceId', channel.workspaceId);
        formData.append('channelId', channel.id);
        formData.append('file', file);

        const url = `/api/files/upload?workspaceId=${encodeURIComponent(channel.workspaceId)}&channelId=${encodeURIComponent(channel.id)}`;
        const res = await api.post(url, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setAttachments((prev) => [...prev, res.data]);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'File upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Socket listener for real-time file deletions
  useEffect(() => {
    const socket = getSocket();
    const onFileDelete = (payload: { fileId: string; channelId?: string }) => {
      if (payload.fileId) {
        useChatStore.getState().removeAttachment(payload.fileId);
      }
    };

    socket.on('file:delete', onFileDelete);
    return () => {
      socket.off('file:delete', onFileDelete);
    };
  }, []);

  const handleReaction = async (messageId: string, emoji: string) => {
    recordEmojiUsage(emoji);
    setTopEmojis(getTopEmojis(5));
    try {
      await api.post(`/api/messages/${messageId}/reactions`, { emoji });
    } catch (err) {
      console.error('Failed to react', err);
    }
  };

  const getDirectChannelTitle = () => {
    if (channel.type !== 'DIRECT') return channel.name;
    if (channel.members && channel.members.length > 0) {
      const otherMember = channel.members.find((m) => m.userId !== currentUser?.id);
      if (otherMember && otherMember.user) {
        return otherMember.user.displayName;
      }
      return `${currentUser?.displayName || 'You'} (you)`;
    }
    return channel.name;
  };

  // Switch back to messages when channel changes
  useEffect(() => {
    setActiveView('messages');
  }, [channel.id]);

  const handleCopyChannelId = () => {
    navigator.clipboard.writeText(channel.id);
    setCopiedChannelId(true);
    setTimeout(() => setCopiedChannelId(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1A1D21] relative min-w-0">
      {/* Channel Header */}
      <div className="h-14 border-b border-[#383F45]/40 px-6 flex items-center justify-between bg-[#1A1D21]/90 backdrop-blur z-10">
        <div className="flex items-center gap-2 min-w-0">
          {channel.type === 'DIRECT' ? (
            <span className="font-bold text-slack-green text-base">@</span>
          ) : channel.type === 'PRIVATE' ? (
            <Lock size={18} className="text-gray-400 shrink-0" />
          ) : (
            <Hash size={20} className="text-gray-400 shrink-0" />
          )}
          <span className="font-bold text-white text-base truncate">
            {getDirectChannelTitle()}
          </span>

          {/* Copy Channel ID button for developer & bot testing */}
          <button
            onClick={handleCopyChannelId}
            title={copiedChannelId ? 'Channel ID Copied!' : `Click to copy Channel ID: ${channel.id}`}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#2C3136]/60 hover:bg-[#3E4348] text-gray-400 hover:text-white border border-gray-700/60 text-[10px] font-mono transition"
          >
            {copiedChannelId ? (
              <>
                <Check size={11} className="text-slack-green" />
                <span className="text-slack-green font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span className="truncate max-w-[80px]">{channel.id.slice(0, 8)}...</span>
              </>
            )}
          </button>

          {channel.topic && channel.type !== 'DIRECT' && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-xs text-gray-400 truncate max-w-xs">{channel.topic}</span>
            </>
          )}

          {/* Chat vs Canvas / Whiteboard Mode Selector */}
          <div className="flex items-center bg-[#222529] border border-gray-700 rounded-lg p-0.5 ml-2">
            <button
              onClick={() => setActiveView('messages')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                activeView === 'messages'
                  ? 'bg-[#383F45] text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <MessageSquare size={13} />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setActiveView('whiteboard')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                activeView === 'whiteboard'
                  ? 'bg-slack-green text-white shadow font-semibold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <PenTool size={13} />
              <span>Canvas</span>
            </button>
          </div>
        </div>

        {/* Actions in Header */}
        <div className="flex items-center gap-2">
          {/* Direct Whiteboard / Canvas button */}
          <button
            onClick={() => setActiveView(activeView === 'whiteboard' ? 'messages' : 'whiteboard')}
            title="Open Brainstorming Whiteboard"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
              activeView === 'whiteboard'
                ? 'bg-slack-green text-white border-slack-green shadow'
                : 'bg-[#2C3136] hover:bg-[#3E4348] text-gray-300 hover:text-white border-gray-700'
            }`}
          >
            <PenTool size={14} className={activeView === 'whiteboard' ? 'text-white' : 'text-slack-green'} />
            <span>{activeView === 'whiteboard' ? 'Back to Chat' : 'Whiteboard'}</span>
          </button>

          {channel.type !== 'DIRECT' && onOpenAddMembers && (
            <button
              onClick={onOpenAddMembers}
              title="Add members to channel"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2C3136] hover:bg-[#3E4348] text-gray-300 hover:text-white border border-gray-700 text-xs font-medium transition"
            >
              <UserPlus size={14} />
              <span>Add People</span>
            </button>
          )}

          {/* Channel Files & Storage Button */}
          <button
            onClick={() => setShowStorageModal(true)}
            title="Channel Files & Storage"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2C3136] hover:bg-[#3E4348] text-gray-300 hover:text-white border border-gray-700 text-xs font-medium transition"
          >
            <HardDrive size={14} className="text-slack-green" />
            <span>Files</span>
          </button>

          {/* Call / Meet Button */}
          <button
            onClick={() => onStartHuddle(channel)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slack-green/15 hover:bg-slack-green/25 text-slack-green border border-slack-green/40 text-xs font-semibold transition"
          >
            <PhoneCall size={14} />
            <span>Call</span>
          </button>
        </div>
      </div>

      {/* Main Content: Whiteboard View or Messages View */}
      {activeView === 'whiteboard' ? (
        <div className="flex-1 w-full h-full relative">
          <WhiteboardView
            channel={channel}
            currentUser={currentUser}
            onClose={() => setActiveView('messages')}
          />
        </div>
      ) : (
        <>
          {/* Message List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
            <div className="w-12 h-12 rounded-full bg-[#2C3136] flex items-center justify-center mb-3 text-gray-400">
              <Hash size={24} />
            </div>
            <h3 className="font-bold text-lg text-white">This is the start of #{channel.name}</h3>
            <p className="text-sm max-w-xs mt-1">This channel was created for your team. Send a message to get started!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isBot = !!msg.bot;
            const authorName = isBot ? msg.bot?.name : (msg.user?.displayName || 'Unknown');
            const avatarUrl = isBot
              ? (msg.bot?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.bot?.name}`)
              : (msg.user?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${authorName}`);

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className="group flex gap-3 hover:bg-[#222529]/60 -mx-6 px-6 py-2 rounded-lg transition-all duration-300 relative"
              >
                <img src={avatarUrl} alt={authorName} className="w-9 h-9 rounded-lg object-cover shrink-0 mt-0.5" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white hover:underline cursor-pointer flex items-center gap-1.5">
                      {authorName}
                      {isBot && (
                        <span className="text-[10px] font-semibold bg-[#2C3136] text-gray-300 px-1.5 py-0.2 rounded uppercase">
                          APP
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Quoted Message Preview Box */}
                  {msg.quotedMessage && (
                    <div
                      onClick={() => {
                        const el = document.getElementById(`msg-${msg.quotedMessage?.id}`);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el.classList.add('bg-slack-activeChannel/25', 'ring-2', 'ring-slack-activeChannel');
                          setTimeout(() => {
                            el.classList.remove('bg-slack-activeChannel/25', 'ring-2', 'ring-slack-activeChannel');
                          }, 2000);
                        }
                      }}
                      className="mt-1 mb-1.5 flex items-center gap-2 bg-[#25292D] hover:bg-[#2F3439] border-l-4 border-slack-green rounded-r-lg px-3 py-1.5 cursor-pointer text-xs transition max-w-lg shadow-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slack-green text-[11px] block">
                          {msg.quotedMessage.user?.displayName || 'Teammate'}
                        </span>
                        <span className="text-gray-300 text-[11px] truncate block max-w-md">
                          {msg.quotedMessage.content}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="text-sm text-gray-200 mt-1 max-w-none break-words">
                    <MarkdownRenderer content={msg.content} />
                  </div>

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <FileAttachmentList
                      attachments={msg.attachments}
                      currentUser={currentUser}
                      onFileDeleted={(deletedFileId) => {
                        useChatStore.getState().removeAttachment(deletedFileId);
                      }}
                    />
                  )}

                  {/* Reactions Bar */}
                  {(() => {
                    const reactionCounts = (msg.reactions || []).reduce(
                      (acc: { [emoji: string]: { count: number; users: string[]; hasReacted: boolean } }, r) => {
                        if (!acc[r.emoji]) {
                          acc[r.emoji] = { count: 0, users: [], hasReacted: false };
                        }
                        acc[r.emoji].count += 1;
                        if (r.user?.displayName) acc[r.emoji].users.push(r.user.displayName);
                        if (r.userId === currentUser?.id) acc[r.emoji].hasReacted = true;
                        return acc;
                      },
                      {}
                    );

                    return (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {Object.entries(reactionCounts).map(([emoji, data]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            title={data.users.join(', ')}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition border ${
                              data.hasReacted
                                ? 'bg-slack-activeChannel/20 border-slack-activeChannel text-slack-activeChannel font-bold'
                                : 'bg-[#2C3136]/80 hover:bg-[#3E4348] border-gray-700/60 text-gray-300'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[11px]">{data.count}</span>
                          </button>
                        ))}

                        {/* Add reaction plus button if message already has reactions */}
                        {Object.keys(reactionCounts).length > 0 && (
                          <button
                            onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === msg.id ? null : msg.id)}
                            title="Add reaction"
                            className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2C3136]/60 hover:bg-[#3E4348] border border-gray-700/50 text-gray-400 hover:text-white transition"
                          >
                            <SmilePlus size={12} />
                          </button>
                        )}

                        {/* Quick Top 5 Most Used Reactions on Hover */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition ml-1">
                          {topEmojis.map((em) => (
                            <button
                              key={em}
                              onClick={() => handleReaction(msg.id, em)}
                              className="hover:scale-125 transition text-xs p-1"
                              title={`React with ${em}`}
                            >
                              {em}
                            </button>
                          ))}
                          <button
                            onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === msg.id ? null : msg.id)}
                            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition text-xs"
                            title="More emojis..."
                          >
                            <SmilePlus size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Thread Replies Button */}
                  {(msg.replyCount || 0) > 0 && (
                    <button
                      onClick={() => onOpenThread(msg)}
                      className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                    >
                      <MessageSquare size={13} />
                      <span>{msg.replyCount} {msg.replyCount === 1 ? 'reply' : 'replies'}</span>
                    </button>
                  )}
                </div>

                {/* Hover Message Action Bar */}
                <div className="absolute right-4 -top-3 hidden group-hover:flex items-center bg-[#222529] border border-gray-700 rounded-lg shadow-lg px-1 py-0.5 gap-1 z-10">
                  <button
                    onClick={() => setReplyingToMessage(msg)}
                    title="Quote Reply"
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded"
                  >
                    <CornerUpLeft size={15} />
                  </button>
                  <button
                    onClick={() => setActiveEmojiMessageId(activeEmojiMessageId === msg.id ? null : msg.id)}
                    title="React with emoji"
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded"
                  >
                    <SmilePlus size={15} />
                  </button>
                  <button
                    onClick={() => onOpenThread(msg)}
                    title="Reply in thread"
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded"
                  >
                    <MessageSquare size={15} />
                  </button>
                </div>

                {/* Anchored Mini Emoji Popover */}
                {activeEmojiMessageId === msg.id && (
                  <EmojiPickerPopover
                    isOpen={true}
                    onClose={() => setActiveEmojiMessageId(null)}
                    onSelectEmoji={(emoji) => handleReaction(msg.id, emoji)}
                    title="Add Reaction"
                    positionClass="top-8 right-4"
                  />
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-6 py-1 text-xs text-gray-400 italic flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
          <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
        </div>
      )}

      {/* Chat Input */}
      <div className="px-6 pb-6 pt-1">
        {/* Quote Reply Banner */}
        {replyingToMessage && (
          <div className="mb-2 bg-[#222529] border-l-4 border-slack-green rounded-r-xl px-3.5 py-2 flex items-center justify-between shadow-lg">
            <div className="min-w-0 flex-1 mr-2">
              <span className="text-[11px] font-bold text-slack-green flex items-center gap-1.5">
                <CornerUpLeft size={12} />
                Replying to {replyingToMessage.user?.displayName || 'Teammate'}
              </span>
              <p className="text-xs text-gray-300 truncate mt-0.5 max-w-2xl">
                {replyingToMessage.content}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingToMessage(null)}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {/* Slash Command Suggestions */}
        {content.startsWith('/') && !content.includes(' ') && (
          <div className="mb-2 bg-[#1F2326] border border-gray-700 rounded-xl p-2 shadow-2xl space-y-1">
            <div className="text-[10px] font-bold uppercase text-gray-400 px-2 py-1 tracking-wider">
              Available Slash Commands
            </div>
            {[
              { cmd: '/poll "Question" "Opt 1" "Opt 2"', desc: 'Create an interactive vote with reactions' },
              { cmd: '/topic <new topic>', desc: 'Set or change channel topic' },
              { cmd: '/huddle', desc: 'Start an instant voice/video huddle' },
              { cmd: '/shrug <message>', desc: 'Append ¯\\_(ツ)_/¯ to message' },
            ]
              .filter((c) => c.cmd.toLowerCase().startsWith(content.toLowerCase()))
              .map((c, i) => (
                <div
                  key={i}
                  onClick={() => setContent(c.cmd.split(' ')[0] + ' ')}
                  className="flex items-center justify-between px-3 py-1.5 hover:bg-[#2C3136] rounded-lg cursor-pointer text-xs transition"
                >
                  <span className="font-mono text-slack-green font-semibold">{c.cmd}</span>
                  <span className="text-gray-400">{c.desc}</span>
                </div>
              ))}
          </div>
        )}

        <form
          onSubmit={handleSendMessage}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`bg-[#222529] border rounded-xl focus-within:border-gray-500 shadow-lg relative overflow-hidden transition ${
            isDragOver
              ? 'border-slack-green ring-2 ring-slack-green/50 bg-[#252C28]'
              : 'border-gray-700'
          }`}
        >
          {/* File Attachments Preview & Upload Indicator */}
          {(attachments.length > 0 || isUploading) && (
            <div className="px-3 pt-2.5 flex flex-wrap gap-2 border-b border-gray-800/80 pb-2.5 bg-[#1B1E22]/60">
              {attachments.map((att, idx) => {
                const isImage = getFileCategory(att.fileType, att.fileName) === 'image';
                return (
                  <div
                    key={att.id || idx}
                    className="flex items-center gap-2 bg-[#2C3136] border border-gray-700/80 px-2.5 py-1 rounded-lg text-xs text-white shadow-sm animate-in fade-in zoom-in-95 duration-100"
                  >
                    {isImage ? (
                      <div className="w-4 h-4 rounded overflow-hidden bg-black/40">
                        <img
                          src={att.fileUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <FileText size={14} className="text-blue-400" />
                    )}
                    <span className="truncate max-w-[140px] font-medium" title={att.fileName}>
                      {att.fileName}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      ({formatFileSize(att.fileSize)})
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                      title="Remove attachment"
                      className="text-gray-400 hover:text-red-400 p-0.5 rounded transition"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}

              {isUploading && (
                <div className="flex items-center gap-1.5 bg-[#2C3136] px-2.5 py-1 rounded-lg text-xs text-slack-green border border-slack-green/40 animate-pulse">
                  <Loader2 size={13} className="animate-spin" />
                  <span>Uploading file...</span>
                </div>
              )}
            </div>
          )}

          {/* Live WYSIWYG In-Place Rich Text Editor */}
          <RichTextEditor
            ref={editorRef}
            placeholder={
              isDragOver
                ? 'Drop file here to upload to channel...'
                : `Message #${channel.name}`
            }
            showToolbar={showFormatting}
            onTyping={(text) => handleTyping(text)}
            onSubmit={() => handleSendMessage()}
          />

          {/* Action Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#1C1F23]/60 border-t border-gray-800/40">
            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach files (images, docs, code, zip...)"
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition"
              >
                <Paperclip size={16} />
              </button>

              <button
                type="button"
                onClick={() => setShowFormatting(!showFormatting)}
                title={showFormatting ? 'Hide formatting toolbar' : 'Show formatting toolbar'}
                className={`p-1.5 rounded-lg transition ${
                  showFormatting ? 'bg-[#383F45] text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Type size={16} />
              </button>

              <button
                type="button"
                onClick={() => setShowEmoji(!showEmoji)}
                title="Add emoji"
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition relative"
              >
                <Smile size={16} />
              </button>
            </div>

            <button
              type="submit"
              disabled={(!content.trim() && attachments.length === 0) || isUploading}
              className="p-1.5 bg-slack-green hover:bg-[#008a65] text-white rounded-lg transition disabled:opacity-30 flex items-center justify-center"
            >
              {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>

          {/* Emoji Picker Popover */}
          <EmojiPickerPopover
            isOpen={showEmoji}
            onClose={() => setShowEmoji(false)}
            onSelectEmoji={(emoji) => {
              editorRef.current?.insertEmoji(emoji);
            }}
            title="Add Emoji"
            positionClass="bottom-14 left-4"
          />
        </form>
      </div>
      </>
      )}

      {/* Channel Storage & Files Modal */}
      {showStorageModal && (
        <ChannelStorageModal
          channel={channel}
          currentUser={currentUser}
          onClose={() => setShowStorageModal(false)}
          onFileDeleted={(deletedFileId) => {
            useChatStore.getState().removeAttachment(deletedFileId);
          }}
        />
      )}
    </div>
  );
};
