'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Channel, Message, UserProfile } from '@orbit/types';
import {
  Hash,
  Lock,
  PhoneCall,
  UserPlus,
  Paperclip,
  Smile,
  Send,
  MessageSquare,
  Sparkles,
  Bot as BotIcon,
  X,
  FileText,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import EmojiPicker from 'emoji-picker-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useChatStore } from '../../stores/chatStore';

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
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && attachments.length === 0) || !currentUser) return;

    const trimmed = content.trim();

    // Check for Slash Command
    if (trimmed.startsWith('/')) {
      const commandParts = trimmed.split(' ');
      const cmd = commandParts[0].toLowerCase();

      if (cmd === '/call' || cmd === '/meet' || cmd === '/huddle') {
        setContent('');
        onStartHuddle(channel);
        return;
      }

      try {
        const res = await api.post('/api/bot/commands/execute', {
          channelId: channel.id,
          workspaceId: channel.workspaceId,
          commandText: trimmed,
        });
        if (res.data.message) {
          useChatStore.getState().addMessage(res.data.message);
        }
        setContent('');
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
      });

      // Optimistically append sent message immediately to avoid channel reload delay
      useChatStore.getState().addMessage(res.data);

      setContent('');
      setAttachments([]);
      setShowEmoji(false);
      const socket = getSocket();
      socket.emit('typing:stop', { channelId: channel.id });
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const res = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAttachments((prev) => [...prev, res.data]);
    } catch (err) {
      alert('File upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
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
          {channel.topic && channel.type !== 'DIRECT' && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-xs text-gray-400 truncate max-w-md">{channel.topic}</span>
            </>
          )}
        </div>

        {/* Actions in Header */}
        <div className="flex items-center gap-2">
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
              <div key={msg.id} className="group flex gap-3 hover:bg-[#222529]/60 -mx-6 px-6 py-2 rounded-lg transition relative">
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

                  {/* Message Content */}
                  <div className="text-sm text-gray-200 mt-1 prose prose-invert max-w-none break-words">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 bg-[#2C3136] hover:bg-[#3E4348] border border-gray-700 px-3 py-2 rounded-lg text-xs text-blue-400 transition"
                        >
                          <FileText size={16} />
                          <span className="truncate max-w-xs">{att.fileName}</span>
                          <span className="text-gray-500 text-[10px]">({Math.round(att.fileSize / 1024)} KB)</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Reactions Bar */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {msg.reactions?.map((reaction) => (
                      <button
                        key={reaction.id}
                        onClick={() => handleReaction(msg.id, reaction.emoji)}
                        className="flex items-center gap-1 bg-[#2C3136]/80 hover:bg-[#3E4348] border border-gray-700/60 px-2 py-0.5 rounded-full text-xs text-gray-300 transition"
                      >
                        <span>{reaction.emoji}</span>
                        <span className="text-[11px] font-semibold">1</span>
                      </button>
                    ))}

                    {/* Quick Reactions */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                      {['👍', '❤️', '🔥', '🚀'].map((em) => (
                        <button
                          key={em}
                          onClick={() => handleReaction(msg.id, em)}
                          className="hover:scale-125 transition text-xs p-1"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>

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
                    onClick={() => handleReaction(msg.id, '👍')}
                    title="React"
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded"
                  >
                    <Smile size={15} />
                  </button>
                  <button
                    onClick={() => onOpenThread(msg)}
                    title="Reply in thread"
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded"
                  >
                    <MessageSquare size={15} />
                  </button>
                </div>
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
          className="bg-[#222529] border border-gray-700 rounded-xl focus-within:border-gray-500 shadow-lg relative overflow-hidden"
        >
          {/* File Attachments Preview */}
          {attachments.length > 0 && (
            <div className="px-3 pt-2 flex flex-wrap gap-2 border-b border-gray-800 pb-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-[#2C3136] px-2.5 py-1 rounded text-xs text-white">
                  <FileText size={14} className="text-blue-400" />
                  <span className="truncate max-w-[150px]">{att.fileName}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                    className="hover:text-red-400"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            rows={2}
            value={content}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder={`Message #${channel.name}`}
            className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none resize-none"
          />

          {/* Action Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#1C1F23]/60 border-t border-gray-800/40">
            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition"
              >
                <Paperclip size={16} />
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
              disabled={!content.trim() && attachments.length === 0}
              className="p-1.5 bg-slack-green hover:bg-[#008a65] text-white rounded-lg transition disabled:opacity-30"
            >
              <Send size={15} />
            </button>
          </div>

          {/* Emoji Picker Popover */}
          {showEmoji && (
            <div className="absolute bottom-14 left-4 z-50">
              <EmojiPicker
                theme={"dark" as any}
                onEmojiClick={(emojiData) => {
                  setContent((prev) => prev + emojiData.emoji);
                  setShowEmoji(false);
                }}
              />
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
