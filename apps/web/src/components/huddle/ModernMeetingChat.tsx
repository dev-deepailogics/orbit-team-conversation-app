'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  useChat,
  useLocalParticipant,
  useRemoteParticipants,
} from '@livekit/components-react';
import {
  MessageSquare,
  Users,
  X,
  Send,
  Smile,
  Paperclip,
  CheckCheck,
  Reply,
  ShieldCheck,
  CornerDownRight,
} from 'lucide-react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';


const QUICK_EMOJIS = ['👍', '❤️', '😂', '👏', '🎉', '🔥'];

export const ModernMeetingChat: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { chatMessages, send, isSending } = useChat();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  const [inputMessage, setInputMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ senderName: string; text: string } | null>(null);
  const [reactionsMap, setReactionsMap] = useState<Record<string, Record<string, string[]>>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  if (!isOpen) return null;

  const totalParticipants = remoteParticipants.length + 1;

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    let finalPayload = inputMessage.trim();
    if (replyingTo) {
      finalPayload = JSON.stringify({
        text: inputMessage.trim(),
        replyTo: replyingTo,
      });
    }

    try {
      await send(finalPayload);
      setInputMessage('');
      setReplyingTo(null);
      setShowEmojiPicker(false);
    } catch (err) {
      console.error('Failed to send in-call chat message:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    const currentReactions = reactionsMap[messageId] || {};
    const users = currentReactions[emoji] || [];
    const myId = localParticipant.identity;

    let updatedUsers = [...users];
    if (users.includes(myId)) {
      updatedUsers = users.filter((u) => u !== myId);
    } else {
      updatedUsers.push(myId);
    }

    setReactionsMap((prev) => ({
      ...prev,
      [messageId]: {
        ...currentReactions,
        [emoji]: updatedUsers,
      },
    }));
  };

  const handleAddMention = (username: string) => {
    setInputMessage((prev) => `${prev}@${username} `);
    textareaRef.current?.focus();
  };

  return (
    <div className="w-80 sm:w-96 h-full bg-[#111418]/95 border-l border-white/[0.08] backdrop-blur-2xl flex flex-col z-30 shadow-2xl animate-fade-in select-none">
      {/* 1. Header with Meeting Chat Title & Total Participants */}
      <div className="h-16 px-5 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <MessageSquare size={17} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              Meeting chat
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                <Users size={12} className="text-emerald-400" />
                {totalParticipants}
              </span>
            </h3>
          </div>
        </div>

        <button
          onClick={onClose}
          title="Close chat"
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition active:scale-95"
        >
          <X size={17} />
        </button>
      </div>

      {/* 2. Meeting Privacy Banner (Feature 6: Meeting-specific privacy) */}
      <div className="px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center gap-2 text-emerald-400 shrink-0">
        <ShieldCheck size={15} className="shrink-0" />
        <span className="text-[11px] font-medium leading-tight">
          Messages are visible to everyone in this call
        </span>
      </div>

      {/* 3. Messages List Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0 text-left select-text">
        <div className="text-center my-2">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider px-3 py-1 bg-white/[0.03] border border-white/5 rounded-full">
            Today in Call
          </span>
        </div>

        {chatMessages.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-500 mb-2">
              <MessageSquare size={22} />
            </div>
            <p className="text-xs font-semibold text-slate-300">No messages yet</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Send questions or comments to everyone in the call.
            </p>
          </div>
        ) : (
          chatMessages.map((msg, index) => {
            const isMe = msg.from?.identity === localParticipant.identity;
            const senderName = msg.from?.name || msg.from?.identity || 'Guest';
            const firstLetter = senderName.charAt(0).toUpperCase();

            // Check if message is a JSON reply payload
            let parsedText = msg.message;
            let replyData: { senderName: string; text: string } | null = null;
            try {
              if (msg.message.startsWith('{') && msg.message.endsWith('}')) {
                const parsed = JSON.parse(msg.message);
                if (parsed.text) {
                  parsedText = parsed.text;
                  replyData = parsed.replyTo || null;
                }
              }
            } catch {
              parsedText = msg.message;
            }

            const messageReactions = reactionsMap[msg.id] || {};

            return (
              <div
                key={msg.id || index}
                className={`flex gap-2.5 group/msg ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* User Avatar */}
                <div
                  onClick={() => handleAddMention(senderName)}
                  title={`Mention @${senderName}`}
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer transition-transform hover:scale-105 ${
                    isMe
                      ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                      : 'bg-slate-800 text-slate-300 border border-white/10'
                  }`}
                >
                  {firstLetter}
                </div>

                {/* Message Body Column */}
                <div className={`flex flex-col max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender Name & Timestamp */}
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span
                      onClick={() => handleAddMention(senderName)}
                      className="text-xs font-bold text-slate-300 hover:text-emerald-400 cursor-pointer transition-colors"
                    >
                      {senderName}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Reply Reference if replying to someone */}
                  {replyData && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 mb-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-400 max-w-full truncate">
                      <CornerDownRight size={11} className="text-emerald-400 shrink-0" />
                      <span className="font-semibold text-slate-300 truncate">
                        {replyData.senderName}:
                      </span>
                      <span className="truncate">{replyData.text}</span>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`relative px-3.5 py-2.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-sm transition-all break-words ${
                      isMe
                        ? 'bg-emerald-600 text-white rounded-tr-sm shadow-[0_4px_16px_rgba(16,185,129,0.25)]'
                        : 'bg-[#1C2026] text-slate-100 rounded-tl-sm border border-white/[0.08]'
                    }`}
                  >
                    {parsedText}

                    {/* Sent status tick for own message */}
                    {isMe && (
                      <span className="inline-block ml-1.5 text-emerald-200">
                        <CheckCheck size={12} className="inline opacity-80" />
                      </span>
                    )}
                  </div>

                  {/* Emoji Reactions List below bubble */}
                  {Object.entries(messageReactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 px-1">
                      {Object.entries(messageReactions).map(([emoji, users]) => {
                        if (users.length === 0) return null;
                        const hasReacted = users.includes(localParticipant.identity);
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleAddReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition active:scale-95 ${
                              hasReacted
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{users.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Hover Quick Action Pill (Reply & Quick Reactions) */}
                  <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 mt-1 px-1 bg-[#1A1E24]/90 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-lg">
                    {QUICK_EMOJIS.slice(0, 4).map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleAddReaction(msg.id, emoji)}
                        className="p-1 hover:bg-white/10 rounded-full text-xs hover:scale-125 transition-transform"
                        title={`React ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setReplyingTo({
                          senderName,
                          text: parsedText.slice(0, 40),
                        })
                      }
                      title="Reply in thread"
                      className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-white/10 rounded-full transition-colors ml-0.5"
                    >
                      <Reply size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Active Reply Banner if user clicked reply */}
      {replyingTo && (
        <div className="px-4 py-2 bg-white/[0.04] border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <Reply size={13} className="text-emerald-400 shrink-0" />
            <span className="truncate">
              Replying to <span className="text-white font-semibold">{replyingTo.senderName}</span>
            </span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 5. Rich Composer Section (Input, Emoji Picker, Attachments, Send) */}
      <div className="p-3.5 border-t border-white/[0.08] bg-[#0E1115] shrink-0 relative">
        {/* Emoji Picker Dropdown */}
        {showEmojiPicker && (
          <div className="absolute bottom-full right-4 mb-2 z-50 shadow-2xl">
            <EmojiPicker
              theme={Theme.DARK}
              lazyLoadEmojis={true}
              onEmojiClick={(emojiData: EmojiClickData) => {
                setInputMessage((prev) => prev + emojiData.emoji);
                setShowEmojiPicker(false);
                textareaRef.current?.focus();
              }}
            />
          </div>
        )}


        <div className="flex flex-col bg-[#161A20] border border-white/10 rounded-2xl p-2.5 focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message everyone in this call..."
            className="w-full bg-transparent text-white text-xs sm:text-[13px] placeholder:text-slate-500 focus:outline-none resize-none leading-relaxed"
          />

          <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-white/5">
            <div className="flex items-center gap-1 text-slate-400">
              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => alert('Attachments can also be uploaded via the channel chat.')}
                title="Add attachment"
                className="p-1.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition"
              >
                <Paperclip size={15} />
              </button>

              {/* Emoji Picker Toggle */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                title="Insert emoji"
                className={`p-1.5 rounded-xl transition ${
                  showEmojiPicker
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Smile size={15} />
              </button>
            </div>

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isSending}
              title="Send message (Enter)"
              className="p-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white shadow-md transition-all active:scale-95 flex items-center justify-center"
            >
              <Send size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 mt-1.5 text-[10px] text-slate-500 font-medium">
          <span>Enter to send · Shift + Enter for new line</span>
        </div>
      </div>
    </div>
  );
};
