import React, { useState, useRef, useEffect, useMemo } from "react";
import { Channel, Message, UserProfile } from "@orbit/types";
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
  X,
  FileText,
  CornerUpLeft,
  Copy,
  Check,
  HardDrive,
  Loader2,
  Menu,
  Search,
  Info,
  Pin,
  CheckSquare,
  Pencil,
  Trash2,
  ChevronDown,
  Mask,
  Eye,
  Canvas,
  More,
  Users,
  User as UserIcon,
  AtSign,
  Plus,
  Bell,
  BellOff,
  Forward,
} from "@/components/ui/icons";
import { EyeOff } from "lucide-react";
import { useAnonStore } from "../../stores/anonStore";
import { Avatar, tint, relativeTime } from "../project/projectViewUtils";
import { AnonAvatar } from "./AnonAvatar";
import { BotAvatar } from "../bot/BotAvatar";
import {
  ChannelSidePanel,
  PresenceAvatar,
  PRESENCE_COLOR,
} from "./ChannelSidePanel";

import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { loadDraft, saveDraft, clearDraft } from "../../lib/drafts";
import { useChatStore } from "../../stores/chatStore";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import { getTopEmojis, recordEmojiUsage } from "../../lib/emojiStore";
import { CanvasView } from "../whiteboard/CanvasView";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { RichTextEditor, RichTextEditorRef } from "./RichTextEditor";
import {
  FileAttachmentList,
  formatFileSize,
  getFileCategory,
} from "./FileAttachmentList";
import { ChannelStorageModal } from "./ChannelStorageModal";
import { ChannelDetailsModal } from "../channel/ChannelDetailsModal";
import { CompressFileConfirmModal } from "./CompressFileConfirmModal";
import { compressFile } from "../../lib/compression";
import { PinnedMessagesModal } from "./PinnedMessagesModal";
import { AnonymousPersonaModal } from "../channel/AnonymousPersonaModal";
import { UserHoverCard } from "./UserHoverCard";
import { Presence, PRESENCE_STYLE } from "../availability/useTeamPresence";
import { useTimeFormat, formatMessageTime } from "../../lib/timeFormat";
import { ForwardMessageDialog } from "./ForwardMessageDialog";
import { MessageChangeNote } from "./MessageChangeNote";
// Anonymous-feed warm accent (Figma amber/600); text uses a darker mix so it stays readable on any theme.
const ANON_WARM = "#D97706";
const ANON_WARM_TEXT = "color-mix(in srgb, #D97706 70%, var(--theme-text))";

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== today.getFullYear() && { year: "numeric" }),
  });
};

const HeaderIconButton: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}> = ({ title, onClick, children, className = "", active }) => (
  <button
    onClick={onClick}
    title={title}
    className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition hover:bg-[var(--theme-fill-hover)] ${className}`}
    style={{
      color: active ? "var(--theme-text)" : "var(--theme-text-muted)",
      backgroundColor: active ? "var(--theme-fill)" : undefined,
    }}
  >
    {children}
  </button>
);

const HeaderTab: React.FC<{
  label: string;
  active?: boolean;
  count?: number;
  onClick: () => void;
}> = ({ label, active, count, onClick }) => (
  <button
    onClick={onClick}
    className="h-12 flex flex-col items-center shrink-0"
  >
    <span
      className={`h-[46px] px-1 flex items-center gap-2 text-sm ${active ? "font-semibold" : "font-medium"}`}
      style={{
        color: active
          ? "var(--theme-primary-hover)"
          : "var(--theme-text-muted)",
      }}
    >
      {label}
      {typeof count === "number" && count > 0 && (
        <span
          className="h-5 min-w-5 px-[7px] rounded-[10px] flex items-center justify-center text-xs font-semibold"
          style={{
            backgroundColor: "var(--theme-bg-surface-hover)",
            color: "var(--theme-text-muted)",
          }}
        >
          {count}
        </span>
      )}
    </span>
    <span
      className="h-0.5 w-full"
      style={{
        backgroundColor: active ? "var(--theme-primary)" : "transparent",
      }}
    />
  </button>
);

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  muted?: boolean;
  selected?: boolean;
  disabled?: boolean;
}> = ({ icon, label, onClick, muted, selected, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full px-3.5 py-2 text-left text-[13px] flex items-center gap-2.5 transition hover:bg-[var(--theme-fill-hover)] disabled:opacity-50"
    style={{ color: muted ? "var(--theme-text-muted)" : "var(--theme-text)" }}
  >
    <span
      style={{
        color: selected ? "var(--theme-primary)" : "var(--theme-text-muted)",
      }}
    >
      {icon}
    </span>
    <span className={`flex-1 ${selected ? "font-semibold" : ""}`}>{label}</span>
    {selected && <Check size={13} style={{ color: "var(--theme-primary)" }} />}
  </button>
);

interface ChatAreaProps {
  channel: Channel;
  messages: Message[];
  currentUser: UserProfile | null;
  typingUsers: string[];
  hasMoreMessages?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlderMessages?: () => void;
  onOpenThread: (message: Message) => void;
  onStartHuddle: (channel: Channel) => void;
  onCreateTicketFromMessage?: (message: Message) => void;
  onOpenAddMembers?: () => void;
  onOpenSearch?: () => void;
  onToggleMobileSidebar?: () => void;
  members?: any[];
  onSelectUserDM?: (user: UserProfile) => void;
  onSelectChannel?: (channel: Channel) => void;
  activeView: "messages" | "whiteboard";
  onChangeView: (view: "messages" | "whiteboard") => void;
  presence?: Record<string, Presence>;
  onHuddleUser?: (user: UserProfile) => void;
  onOpenQuickCanvas?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  channel,
  messages,
  currentUser,
  typingUsers,
  hasMoreMessages = false,
  isLoadingOlder = false,
  onLoadOlderMessages,
  onOpenThread,
  onStartHuddle,
  onCreateTicketFromMessage,
  onOpenAddMembers,
  onOpenSearch,
  onToggleMobileSidebar,
  members,
  onSelectUserDM,
  onSelectChannel,
  activeView,
  onChangeView: setActiveView,
  presence = {},
  onHuddleUser,
  onOpenQuickCanvas,
}) => {
  const timeFormat = useTimeFormat();
  // Unsent text for this channel, restored from this device when the composer mounts (see lib/drafts.ts).
  const initialDraft = useMemo(
    () => (currentUser ? loadDraft(currentUser.id, channel.id) : undefined),
    [currentUser?.id, channel.id],
  );
  const [content, setContent] = useState(initialDraft ?? "");
  useEffect(() => {
    setContent(initialDraft ?? "");
  }, [initialDraft, channel.id]);
  const sendingRef = useRef(false);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(
    null,
  );
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeEmojiMessageId, setActiveEmojiMessageId] = useState<
    string | null
  >(null);
  const [topEmojis, setTopEmojis] = useState<string[]>([
    "👍",
    "❤️",
    "🔥",
    "🎉",
    "🚀",
  ]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPinsModal, setShowPinsModal] = useState(false);
  const [showAnonPersonaModal, setShowAnonPersonaModal] = useState(false);
  const revealAnon = useAnonStore((s) => s.reveal);
  const toggleRevealAnon = useAnonStore((s) => s.toggleReveal);
  const [anonProfile, setAnonProfile] = useState<{
    anonName: string;
    anonEmoji: string;
  } | null>(channel.myAnonProfile || null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteConfirmMessage, setDeleteConfirmMessage] =
    useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Compression Confirmation State
  const [pendingCompressFiles, setPendingCompressFiles] = useState<File[]>([]);
  const [showCompressModal, setShowCompressModal] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const currentWorkspace = useChatStore((state) => state.currentWorkspace);
  const notificationPreference =
    channel.members?.find((m) => m.userId === currentUser?.id)
      ?.notificationPreference || "ALL";
  const isMuted = notificationPreference === "MUTED";
  const [isSavingNotifPref, setIsSavingNotifPref] = useState(false);
  // Only private channels take explicit invites; public ones are open for anyone in the workspace to join
  const canAddMembers = channel.type === "PRIVATE" && !!onOpenAddMembers;

  const handleSetNotificationPreference = async (
    preference: "ALL" | "MENTIONS" | "MUTED",
  ) => {
    if (preference === notificationPreference) return;
    setIsSavingNotifPref(true);
    try {
      await api.post(`/api/channels/${channel.id}/notifications`, {
        preference,
      });
      useChatStore.getState().updateChannel({
        ...channel,
        members: (channel.members || []).map((m) =>
          m.userId === currentUser?.id
            ? { ...m, notificationPreference: preference }
            : m,
        ),
      });
    } catch (err) {
      console.error("Failed to update notification preference", err);
    } finally {
      setIsSavingNotifPref(false);
    }
  };
  const isWsAdmin =
    currentWorkspace?.ownerId === currentUser?.id ||
    members?.some(
      (m) =>
        m.userId === currentUser?.id &&
        (m.role === "ADMIN" || m.role === "OWNER"),
    );
  const isSuperAdmin = currentUser?.systemRole === "SUPER_ADMIN";

  useEffect(() => {
    if (channel.isAnonymous) {
      if (channel.myAnonProfile) {
        setAnonProfile(channel.myAnonProfile);
      } else {
        api
          .get(`/api/channels/${channel.id}`)
          .then((res) => {
            if (res.data?.myAnonProfile) {
              setAnonProfile(res.data.myAnonProfile);
            }
          })
          .catch(() => {});
      }
    } else {
      setAnonProfile(null);
    }
  }, [channel.id, channel.isAnonymous, channel.myAnonProfile]);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [copiedChannelId, setCopiedChannelId] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<
    string | null
  >(null);
  const previousScrollHeightRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);
  const previousMessagesCountRef = useRef(0);
  const editorRef = useRef<RichTextEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const mentionUsers = React.useMemo(() => {
    if (channel.isAnonymous) return [];
    if (!members) return [];
    return members
      .map((m) => m.user)
      .filter(Boolean)
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        status: u.status,
      }));
  }, [members, channel.isAnonymous]);

  const handleMentionClick = (username: string) => {
    if (channel.isAnonymous) return;
    const targetMember = members?.find(
      (m) => m.user?.username?.toLowerCase() === username.toLowerCase(),
    );
    if (targetMember?.user && onSelectUserDM) {
      onSelectUserDM(targetMember.user);
    }
  };

  const handleChannelClick = (channelId: string) => {
    const ch = useChatStore.getState().channels.find((c) => c.id === channelId);
    if (ch && onSelectChannel) {
      onSelectChannel(ch);
    }
  };

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMoreMenu]);

  // Reset scroll and load state when channel changes & auto-focus message input
  useEffect(() => {
    isInitialLoadRef.current = true;
    isNearBottomRef.current = true;
    setFirstUnreadMessageId(null);
    previousMessagesCountRef.current = 0;
    previousScrollHeightRef.current = 0;

    const timer = setTimeout(() => {
      editorRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [channel.id]);

  // Auto-focus message input when switching to messages view
  useEffect(() => {
    if (activeView === "messages") {
      const timer = setTimeout(() => {
        editorRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeView]);

  // Auto-focus message input when quoting a message
  useEffect(() => {
    if (replyingToMessage) {
      const timer = setTimeout(() => {
        editorRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [replyingToMessage]);

  useEffect(() => {
    // 1. Initial load of channel messages: jump straight to bottom
    if (isInitialLoadRef.current) {
      if (messages.length > 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        isInitialLoadRef.current = false;
      }
      previousMessagesCountRef.current = messages.length;
      return;
    }

    // 2. Older messages prepended at top: maintain exact scroll position
    if (previousScrollHeightRef.current > 0 && scrollContainerRef.current) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight;
      const heightDifference =
        newScrollHeight - previousScrollHeightRef.current;
      scrollContainerRef.current.scrollTop += heightDifference;
      previousScrollHeightRef.current = 0;
      previousMessagesCountRef.current = messages.length;
      return;
    }

    // 3. New message added at the bottom:
    // Only auto-scroll if user is already near bottom OR if the new message was sent by the current user
    if (messages.length > previousMessagesCountRef.current) {
      const lastMessage = messages[messages.length - 1];
      const isSentByMe = Boolean(
        lastMessage &&
        (lastMessage.isSelf ||
          (currentUser && lastMessage.userId === currentUser.id)),
      );

      if (isNearBottomRef.current || isSentByMe) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        // User is at bottom, so they have seen the message
        setFirstUnreadMessageId(null);
      } else {
        // User was scrolled up reading history; mark the first unread incoming message
        if (!isSentByMe) {
          setFirstUnreadMessageId((prev) => prev || lastMessage?.id || null);
        }
      }
    }
    previousMessagesCountRef.current = messages.length;
  }, [messages, currentUser]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // Track if user is near bottom (within 150px)
    const distanceFromBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;
    const isNearBottom = distanceFromBottom < 150;
    isNearBottomRef.current = isNearBottom;

    // Once user scrolls down and sees the latest messages, clear the new messages indicator
    if (isNearBottom) {
      setFirstUnreadMessageId(null);
    }

    // When user scrolls close to top (within 40px), trigger loading older messages
    if (
      target.scrollTop <= 40 &&
      hasMoreMessages &&
      !isLoadingOlder &&
      onLoadOlderMessages
    ) {
      previousScrollHeightRef.current = target.scrollHeight;
      onLoadOlderMessages();
    }
  };

  useEffect(() => {
    setTopEmojis(getTopEmojis(5));
  }, []);

  const handleTyping = (text: string) => {
    setContent(text);
    if (currentUser)
      saveDraft(
        currentUser.id,
        channel.id,
        editorRef.current?.getMarkdown() ?? text,
      );
    const socket = getSocket();

    if (currentUser) {
      const typingName = channel.isAnonymous
        ? anonProfile
          ? `${anonProfile.anonEmoji} ${anonProfile.anonName}`
          : "Someone"
        : currentUser.displayName;
      socket.emit("typing:start", {
        channelId: channel.id,
        username: typingName,
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing:stop", { channelId: channel.id });
      }, 2000);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawMarkdown = editorRef.current?.getMarkdown() || content.trim();
    if ((!rawMarkdown.trim() && attachments.length === 0) || !currentUser)
      return;

    const trimmed = rawMarkdown.trim();
    const plainText = editorRef.current?.getText() || content.trim();

    // Check for Slash Command
    if (plainText.startsWith("/")) {
      const commandParts = plainText.split(" ");
      const cmd = commandParts[0].toLowerCase();

      if (cmd === "/call" || cmd === "/meet" || cmd === "/huddle") {
        editorRef.current?.clear();
        setContent("");
        clearDraft(currentUser.id, channel.id);
        onStartHuddle(channel);
        return;
      }

      try {
        const res = await api.post("/api/bot/commands/execute", {
          channelId: channel.id,
          workspaceId: channel.workspaceId,
          commandText: plainText,
        });
        if (res.data.message) {
          useChatStore.getState().addMessage(res.data.message);
        }
        editorRef.current?.clear();
        setContent("");
        clearDraft(currentUser.id, channel.id);
        setReplyingToMessage(null);
        return;
      } catch (err: any) {
        alert(err.response?.data?.error || "Failed to execute command");
        return;
      }
    }

    if (sendingRef.current) return;
    sendingRef.current = true;
    const sentAttachments = attachments;
    const sentReplyTo = replyingToMessage;
    // Clear input immediately so a second Enter can't resend
    editorRef.current?.clear();
    setContent("");
    clearDraft(currentUser.id, channel.id); // cleared now, not after the request, so text typed while it sends isn't wiped
    // Stop the typing indicator for everyone now, not after the request finishes
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    getSocket().emit("typing:stop", { channelId: channel.id });
    setAttachments([]);
    setReplyingToMessage(null);

    try {
      const res = await api.post(`/api/channels/${channel.id}/messages`, {
        content: trimmed,
        attachments: sentAttachments,
        quotedMessageId: sentReplyTo?.id,
      });

      // Optimistically append sent message immediately to avoid channel reload delay
      useChatStore.getState().addMessage(res.data);

      setShowEmoji(false);
      const socket = getSocket();
      socket.emit("typing:stop", { channelId: channel.id });
    } catch (err) {
      console.error("Failed to send message", err);
      setAttachments(sentAttachments);
      setReplyingToMessage(sentReplyTo);
      // Put the unsent text back (unless the user already started a new one) so a failed send isn't lost
      if (!editorRef.current?.getText()) {
        editorRef.current?.setMarkdown(trimmed);
        setContent(trimmed);
        saveDraft(currentUser.id, channel.id, trimmed);
      }
    } finally {
      sendingRef.current = false;
    }
  };

  // Core file uploading logic with optional compression
  const processUploadFiles = async (
    filesToUpload: File[],
    shouldCompress: boolean,
  ) => {
    setIsUploading(true);
    if (shouldCompress) {
      setIsCompressing(true);
    }

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        let file = filesToUpload[i];

        if (shouldCompress) {
          try {
            file = await compressFile(file);
          } catch (compErr) {
            console.error("Compression failed for file", file.name, compErr);
          }
        }

        const formData = new FormData();
        formData.append("workspaceId", channel.workspaceId);
        formData.append("channelId", channel.id);
        formData.append("file", file);

        const url = `/api/files/upload?workspaceId=${encodeURIComponent(channel.workspaceId)}&channelId=${encodeURIComponent(channel.id)}`;
        const res = await api.post(url, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setAttachments((prev) => [...prev, res.data]);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "File upload failed");
    } finally {
      setIsUploading(false);
      setIsCompressing(false);
      setShowCompressModal(false);
      setPendingCompressFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setTimeout(() => {
        editorRef.current?.focus();
      }, 50);
    }
  };

  // Multiple File Upload Handler (triggers confirmation prompt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setPendingCompressFiles(files);
    setShowCompressModal(true);
  };

  // Pasted images/files (Ctrl+V) go through the same confirmation and upload as the file picker
  const handlePasteFiles = (files: File[]) => {
    setPendingCompressFiles((prev) =>
      showCompressModal ? [...prev, ...files] : files,
    );
    setShowCompressModal(true);
  };

  // Drag & Drop File Upload Handler (triggers confirmation prompt)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const fileList = e.dataTransfer.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setPendingCompressFiles(files);
    setShowCompressModal(true);
  };

  // Socket listener for real-time file deletions
  useEffect(() => {
    const socket = getSocket();
    const onFileDelete = (payload: { fileId: string; channelId?: string }) => {
      if (payload.fileId) {
        useChatStore.getState().removeAttachment(payload.fileId);
      }
    };

    socket.on("file:delete", onFileDelete);
    return () => {
      socket.off("file:delete", onFileDelete);
    };
  }, []);

  const handleReaction = async (messageId: string, emoji: string) => {
    recordEmojiUsage(emoji);
    setTopEmojis(getTopEmojis(5));
    try {
      await api.post(`/api/messages/${messageId}/reactions`, { emoji });
    } catch (err) {
      console.error("Failed to react", err);
    }
  };

  const handleTogglePin = async (msg: Message) => {
    try {
      const res = await api.post(`/api/messages/${msg.id}/pin`, {
        isPinned: !msg.isPinned,
      });
      useChatStore.getState().updateMessage(res.data.message);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to toggle pin");
    }
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) return;
    setIsSavingEdit(true);
    try {
      const res = await api.patch(`/api/messages/${messageId}`, {
        content: editContent.trim(),
      });
      useChatStore.getState().updateMessage(res.data);
      setEditingMessageId(null);
      setEditContent("");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to edit message");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const handleDeleteMessage = async () => {
    if (!deleteConfirmMessage) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/api/messages/${deleteConfirmMessage.id}`);
      if (res.data?.message) {
        useChatStore.getState().updateMessage(res.data.message);
      }
      setDeleteConfirmMessage(null);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete message");
    } finally {
      setIsDeleting(false);
    }
  };

  const getDirectChannelTitle = () => {
    if (channel.type !== "DIRECT") return channel.name;
    if (channel.members && channel.members.length > 0) {
      const otherMember = channel.members.find(
        (m) => m.userId !== currentUser?.id,
      );
      if (otherMember && otherMember.user) {
        return otherMember.user.displayName;
      }
      return `${currentUser?.displayName || "You"} (you)`;
    }
    return channel.name;
  };

  // Slack-style intro shown at the top of a DM instead of the channel intro
  const dmPeer = channel.members?.find(
    (m) => m.userId !== currentUser?.id,
  )?.user;
  const dmName = getDirectChannelTitle();
  const dmIntro = channel.type === "DIRECT" && (
    <div
      className="pb-5 mb-1 border-b flex flex-col gap-2"
      style={{ borderColor: "var(--theme-border)" }}
    >
      <Avatar
        name={dmName}
        src={(dmPeer ?? currentUser)?.avatarUrl}
        size={64}
      />
      <h3
        className="text-[17px] font-bold"
        style={{ color: "var(--theme-text)" }}
      >
        {dmName}
      </h3>
      <p
        className="text-sm leading-[21px] max-w-md"
        style={{ color: "var(--theme-text-muted)" }}
      >
        {dmPeer ? (
          <>
            This conversation is just between{" "}
            <span
              className="font-semibold"
              style={{ color: "var(--theme-primary-hover)" }}
            >
              @{dmPeer.displayName}
            </span>{" "}
            and you.
          </>
        ) : (
          "This is your space. Draft messages, list your to-dos, or keep links and files handy."
        )}
      </p>
    </div>
  );

  const isDirect = channel.type === "DIRECT";
  const channelPeople: UserProfile[] = (
    channel.members?.length
      ? channel.members.map((m) => m.user)
      : (members || []).map((m: any) => m.user)
  ).filter(Boolean) as UserProfile[];
  const pinnedCount = messages.filter((m) => m.isPinned && !m.isDeleted).length;
  const fileCount = messages.reduce(
    (n, m) => n + (m.isDeleted ? 0 : m.attachments?.length || 0),
    0,
  );

  const jumpToMessage = (msg: Message) => {
    const el = document.getElementById(`msg-${msg.id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-[var(--theme-primary)]");
      setTimeout(
        () => el.classList.remove("ring-2", "ring-[var(--theme-primary)]"),
        2500,
      );
    }
  };

  const handleCopyChannelId = () => {
    navigator.clipboard.writeText(channel.id);
    setCopiedChannelId(true);
    setTimeout(() => setCopiedChannelId(false), 2000);
  };

  return (
    <div
      className="flex-1 flex flex-col h-full relative min-w-0"
      style={{
        backgroundColor: "var(--theme-bg-app)",
        color: "var(--theme-text)",
      }}
    >
      {/* Channel Header (Redesign v3) */}
      <div
        className="shrink-0 border-b z-10"
        style={{
          backgroundColor: "var(--theme-bg-app)",
          borderColor: "var(--theme-border)",
        }}
      >
        <div className="h-[72px] px-3 sm:px-7 flex items-center gap-3 sm:gap-5">
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              title="Open Navigation"
              className="md:hidden p-1.5 -ml-1 rounded-lg transition shrink-0 hover:bg-[var(--theme-fill-hover)]"
              style={{ color: "var(--theme-text)" }}
            >
              <Menu size={20} />
            </button>
          )}

          {/* Page info */}
          <div className="flex-1 min-w-0 flex items-center gap-3.5">
            {isDirect ? (
              <button
                onClick={() => setShowSidePanel((v) => !v)}
                title="View profile"
                className="shrink-0"
              >
                <PresenceAvatar
                  name={dmName}
                  src={(dmPeer ?? currentUser)?.avatarUrl}
                  size={44}
                  presence={
                    presence[(dmPeer ?? currentUser)?.id || ""] || "offline"
                  }
                  dot={14}
                />
              </button>
            ) : (
              <span
                className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: channel.isAnonymous
                    ? tint(ANON_WARM, 12)
                    : "var(--theme-selected)",
                  color: channel.isAnonymous
                    ? ANON_WARM
                    : "var(--theme-accent)",
                }}
              >
                {channel.isAnonymous ? (
                  <Mask size={22} />
                ) : channel.type === "PRIVATE" ? (
                  <Lock size={22} />
                ) : (
                  <Hash size={22} />
                )}
              </span>
            )}
            <div className="min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() =>
                    isDirect
                      ? setShowSidePanel((v) => !v)
                      : setShowDetailsModal(true)
                  }
                  title={isDirect ? "View profile" : "Channel settings"}
                  className="text-[20px] leading-[26px] font-bold tracking-[-0.4px] truncate hover:underline text-left"
                  style={{ color: "var(--theme-text)" }}
                >
                  {getDirectChannelTitle()}
                </button>
                {channel.isAnonymous && (
                  <span
                    className="h-[22px] px-[9px] rounded-[11px] flex items-center gap-[5px] text-[11px] font-semibold shrink-0"
                    style={{
                      backgroundColor: tint(ANON_WARM, 12),
                      color: ANON_WARM_TEXT,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: ANON_WARM }}
                    />
                    Anonymous
                  </span>
                )}
                {!channel.isAnonymous && channel.type === "PRIVATE" && (
                  <span
                    className="h-6 px-[9px] rounded-xl flex items-center gap-[5px] text-[11px] font-semibold shrink-0"
                    style={{
                      backgroundColor: tint(ANON_WARM, 14),
                      color: ANON_WARM_TEXT,
                    }}
                  >
                    <Lock size={12} />
                    Private
                  </span>
                )}
                {isMuted && (
                  <span
                    title="Notifications muted"
                    className="shrink-0 inline-flex"
                    style={{ color: "var(--theme-text-muted)" }}
                  >
                    <BellOff size={15} />
                  </span>
                )}
              </div>
              <p
                className="text-[13px] leading-[18px] truncate flex items-center gap-1.5"
                style={{ color: "var(--theme-text-muted)" }}
              >
                {isDirect
                  ? (() => {
                      const p =
                        presence[(dmPeer ?? currentUser)?.id || ""] ||
                        "offline";
                      return (
                        <>
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                p === "offline"
                                  ? "transparent"
                                  : PRESENCE_COLOR[p],
                              border:
                                p === "offline"
                                  ? `1.5px solid ${PRESENCE_COLOR.offline}`
                                  : undefined,
                            }}
                          />
                          {PRESENCE_STYLE[p].label}
                          {dmPeer?.customStatusText
                            ? ` · ${dmPeer.customStatusText}`
                            : ""}
                        </>
                      );
                    })()
                  : channel.isAnonymous
                    ? channel.description ||
                      channel.topic ||
                      "Post without revealing your identity"
                    : messages.length === 0 && !hasMoreMessages
                      ? `New channel · ${channelPeople.length} ${channelPeople.length === 1 ? "member" : "members"}`
                      : channel.description ||
                        channel.topic ||
                        (channel.type === "PRIVATE"
                          ? "Private channel"
                          : "Public channel")}
              </p>
            </div>

            {/* Member stack */}
            {!isDirect && !channel.isAnonymous && channelPeople.length > 0 && (
              <button
                onClick={() => setShowSidePanel((v) => !v)}
                title="Channel members"
                className="hidden md:flex items-center px-1.5 py-1 shrink-0 rounded-[18px] transition hover:bg-[var(--theme-fill-hover)]"
              >
                {channelPeople.slice(0, 3).map((u, i) => (
                  <Avatar
                    key={u.id}
                    name={u.displayName}
                    src={u.avatarUrl}
                    size={28}
                    ring="var(--theme-bg-app)"
                    className={i ? "-ml-[5px]" : ""}
                  />
                ))}
                {channelPeople.length > 3 && (
                  <span
                    className="-ml-[5px] w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                    style={{
                      backgroundColor: "var(--theme-bg-surface-hover)",
                      color: "var(--theme-text)",
                      boxShadow: "0 0 0 2px var(--theme-bg-app)",
                    }}
                  >
                    +{channelPeople.length - 3}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {channel.isAnonymous && anonProfile && revealAnon && (
              <button
                onClick={() => setShowAnonPersonaModal(true)}
                title="Change your character name"
                className="h-9 pl-1.5 pr-3 rounded-[18px] flex items-center gap-2 transition hover:brightness-95"
                style={{ backgroundColor: tint(ANON_WARM, 12) }}
              >
                <AnonAvatar
                  name={anonProfile.anonName}
                  emoji={anonProfile.anonEmoji}
                  size={24}
                  rounded="full"
                />
                <span
                  className="hidden sm:inline text-[13px] font-semibold whitespace-nowrap"
                  style={{ color: ANON_WARM_TEXT }}
                >
                  You are {anonProfile.anonName}
                </span>
                <Pencil size={14} style={{ color: ANON_WARM_TEXT }} />
              </button>
            )}

            {isDirect && (
              <button
                onClick={() => setShowSidePanel((v) => !v)}
                className="hidden sm:flex h-9 px-3.5 rounded-[18px] border items-center gap-1.5 text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
                style={{
                  borderColor: "var(--theme-border)",
                  color: "var(--theme-text)",
                }}
              >
                <UserIcon size={15} />
                View profile
              </button>
            )}

            {onOpenSearch && (
              <button
                onClick={onOpenSearch}
                title="Search messages (Cmd+K / Ctrl+K)"
                className="hidden xl:flex w-[340px] h-11 pl-4 pr-2.5 rounded-[22px] border items-center gap-2.5 transition hover:brightness-[0.98]"
                style={{
                  backgroundColor: "var(--theme-bg-surface-hover)",
                  borderColor: "var(--theme-border)",
                }}
              >
                <Search
                  size={16}
                  style={{ color: "var(--theme-text-muted)" }}
                />
                <span
                  className="flex-1 text-left text-sm"
                  style={{ color: "var(--theme-text-muted)" }}
                >
                  Search Orbit
                </span>
                <kbd
                  className="font-sans text-[11px] font-medium px-1.5 py-0.5 rounded-md border"
                  style={{
                    backgroundColor: "var(--theme-bg-app)",
                    borderColor:
                      "color-mix(in srgb, var(--theme-text) 20%, transparent)",
                    color: "var(--theme-text-muted)",
                  }}
                >
                  Ctrl K
                </kbd>
              </button>
            )}
            {onOpenSearch && (
              <HeaderIconButton
                title="Search messages"
                onClick={onOpenSearch}
                className="xl:hidden"
              >
                <Search size={18} />
              </HeaderIconButton>
            )}

            {isDirect && (
              <HeaderIconButton
                title="Open canvas"
                onClick={() => setActiveView("whiteboard")}
              >
                <Canvas size={18} />
              </HeaderIconButton>
            )}
            <HeaderIconButton
              title="Pinned messages"
              onClick={() => setShowPinsModal(true)}
            >
              <Pin size={18} />
            </HeaderIconButton>
            <HeaderIconButton
              title="Start audio/video call"
              onClick={() => onStartHuddle(channel)}
            >
              <PhoneCall size={18} />
            </HeaderIconButton>

            {/* More menu */}
            <div className="relative" ref={moreMenuRef}>
              <HeaderIconButton
                title="More options"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                active={showMoreMenu}
              >
                <More size={18} />
              </HeaderIconButton>
              {showMoreMenu && (
                <div
                  className="absolute right-0 mt-1.5 w-56 rounded-xl border shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    backgroundColor: "var(--theme-bg-app)",
                    borderColor: "var(--theme-border)",
                  }}
                >
                  {isDirect ? (
                    // A 1:1 DM has no wider audience to filter, so it's a plain mute toggle
                    <MenuItem
                      icon={
                        isMuted ? <Bell size={14} /> : <BellOff size={14} />
                      }
                      label={
                        isMuted ? "Unmute notifications" : "Mute notifications"
                      }
                      disabled={isSavingNotifPref}
                      onClick={() => {
                        setShowMoreMenu(false);
                        handleSetNotificationPreference(
                          isMuted ? "ALL" : "MUTED",
                        );
                      }}
                    />
                  ) : (
                    <>
                      <p
                        className="px-3.5 pt-1.5 pb-1 text-[11px] font-bold tracking-[0.6px]"
                        style={{ color: "var(--theme-text-muted)" }}
                      >
                        NOTIFICATIONS
                      </p>
                      {(
                        [
                          { value: "ALL", label: "All new posts", Icon: Bell },
                          {
                            value: "MENTIONS",
                            label: "Mentions only",
                            Icon: AtSign,
                          },
                          { value: "MUTED", label: "Mute", Icon: BellOff },
                        ] as const
                      ).map(({ value, label, Icon }) => (
                        <MenuItem
                          key={value}
                          icon={<Icon size={14} />}
                          label={label}
                          selected={notificationPreference === value}
                          disabled={isSavingNotifPref}
                          onClick={() => {
                            setShowMoreMenu(false);
                            handleSetNotificationPreference(value);
                          }}
                        />
                      ))}
                    </>
                  )}
                  <div
                    className="h-px my-1"
                    style={{ backgroundColor: "var(--theme-border)" }}
                  />
                  {canAddMembers && (
                    <MenuItem
                      icon={<UserPlus size={14} />}
                      label="Add people"
                      onClick={() => {
                        setShowMoreMenu(false);
                        onOpenAddMembers?.();
                      }}
                    />
                  )}
                  <MenuItem
                    icon={<Info size={14} />}
                    label={
                      isDirect ? "Conversation details" : "Channel settings"
                    }
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowDetailsModal(true);
                    }}
                  />
                  <MenuItem
                    icon={<HardDrive size={14} />}
                    label="Files & storage"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowStorageModal(true);
                    }}
                  />
                  <div
                    className="h-px my-1"
                    style={{ backgroundColor: "var(--theme-border)" }}
                  />
                  <MenuItem
                    icon={
                      copiedChannelId ? <Check size={14} /> : <Copy size={14} />
                    }
                    label={
                      copiedChannelId ? "Channel ID copied" : "Copy channel ID"
                    }
                    muted
                    onClick={() => {
                      setShowMoreMenu(false);
                      handleCopyChannelId();
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs row */}
        <div className="h-12 px-3 sm:px-7 flex items-center justify-between gap-3">
          <div className="flex items-start gap-5 h-12 overflow-x-auto">
            <HeaderTab
              label="Messages"
              active={activeView === "messages"}
              onClick={() => setActiveView("messages")}
            />
            <HeaderTab
              label="Canvas"
              active={activeView === "whiteboard"}
              onClick={() => setActiveView("whiteboard")}
            />
            <HeaderTab
              label="Pinned"
              count={pinnedCount}
              onClick={() => setShowPinsModal(true)}
            />
            <HeaderTab
              label="Files"
              count={fileCount}
              onClick={() => setShowStorageModal(true)}
            />
          </div>
          {!isDirect && (
            <button
              onClick={() => setShowSidePanel((v) => !v)}
              className="hidden lg:flex h-9 px-3.5 rounded-[18px] border items-center gap-1.5 text-[13px] font-medium shrink-0 transition hover:bg-[var(--theme-fill-hover)]"
              style={{
                borderColor: "var(--theme-border)",
                color: "var(--theme-text)",
                backgroundColor: showSidePanel
                  ? "var(--theme-selected)"
                  : "var(--theme-bg-app)",
              }}
            >
              <Users size={15} />
              Details
            </button>
          )}
        </div>
      </div>

      {/* Anonymity banner */}
      {channel.isAnonymous && (
        <div
          className="shrink-0 px-3 sm:px-6 py-3 flex items-center gap-2.5 text-[13px]"
          style={{ backgroundColor: tint(ANON_WARM, 8) }}
        >
          <Info size={18} style={{ color: ANON_WARM }} />
          <span
            className="flex-1 min-w-0"
            style={{ color: "var(--theme-text)" }}
          >
            Everything here is posted under a character name, not your profile.
            Keep it kind and follow the community rules.
          </span>
          {anonProfile && (
            <button
              onClick={toggleRevealAnon}
              title={revealAnon ? "Hide your persona" : "Show your persona"}
              aria-label={
                revealAnon ? "Hide your persona" : "Show your persona"
              }
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition hover:brightness-95"
              style={{
                backgroundColor: tint(ANON_WARM, 14),
                color: ANON_WARM_TEXT,
              }}
            >
              {revealAnon ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
          {anonProfile && (
            <button
              onClick={() => setShowAnonPersonaModal(true)}
              className="font-semibold whitespace-nowrap hover:underline shrink-0"
              style={{ color: ANON_WARM_TEXT }}
            >
              Change name
            </button>
          )}
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative">
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Main Content: Whiteboard View or Messages View */}
          {activeView === "whiteboard" ? (
            <div className="flex-1 w-full h-full relative flex min-h-0">
              <CanvasView
                workspaceId={channel.workspaceId}
                currentUser={currentUser}
                scope={{
                  channelId: channel.id,
                  label:
                    channel.type === "DIRECT" ? dmName : `#${channel.name}`,
                }}
                onClose={() => setActiveView("messages")}
              />
            </div>
          ) : (
            <>
              {/* Message List */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 space-y-2.5"
              >
                {messages.length === 0 ? (
                  dmIntro || (
                    <div className="min-h-full flex flex-col">
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                        <span
                          className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
                          style={{
                            backgroundColor: channel.isAnonymous
                              ? tint(ANON_WARM, 12)
                              : "var(--theme-bg-surface)",
                            color: channel.isAnonymous
                              ? ANON_WARM
                              : "var(--theme-accent)",
                          }}
                        >
                          {channel.isAnonymous ? (
                            <Mask size={32} />
                          ) : channel.type === "PRIVATE" ? (
                            <Lock size={32} />
                          ) : (
                            <Hash size={32} />
                          )}
                        </span>
                        <h3
                          className="text-[17px] font-bold"
                          style={{ color: "var(--theme-text)" }}
                        >
                          Welcome to #{channel.name}
                        </h3>
                        <p
                          className="text-sm leading-[21px] max-w-[360px]"
                          style={{ color: "var(--theme-text-muted)" }}
                        >
                          {channel.isAnonymous
                            ? "Nothing posted yet. Everything here is shared under a character name, so start the conversation."
                            : "This is the very beginning of the channel. Add teammates or post the first message to get things moving."}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          {canAddMembers && !channel.isAnonymous && (
                            <button
                              onClick={onOpenAddMembers}
                              className="h-9 px-4 rounded-[18px] flex items-center gap-1.5 text-[13px] font-semibold transition hover:brightness-95"
                              style={{
                                backgroundColor: "var(--theme-primary)",
                                color: "var(--theme-primary-text)",
                              }}
                            >
                              <Plus size={15} />
                              Add people
                            </button>
                          )}
                          <button
                            onClick={() => editorRef.current?.focus()}
                            className="h-9 px-3.5 rounded-[18px] border flex items-center gap-1.5 text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
                            style={{
                              borderColor: "var(--theme-border)",
                              color: "var(--theme-text)",
                              backgroundColor: "var(--theme-bg-app)",
                            }}
                          >
                            <MessageSquare size={15} />
                            Post a message
                          </button>
                        </div>
                      </div>
                      {!channel.isAnonymous && (
                        <div className="flex flex-wrap items-stretch justify-center gap-3 pb-0">
                          {[
                            {
                              Icon: Users,
                              title: "Invite your team",
                              body: "Add members by name or email",
                              onClick: canAddMembers
                                ? onOpenAddMembers
                                : undefined,
                            },
                            {
                              Icon: Canvas,
                              title: "Start a canvas",
                              body: "Plan together on a whiteboard",
                              onClick: () => setActiveView("whiteboard"),
                            },
                            {
                              Icon: FileText,
                              title: "Share a doc",
                              body: "Link a doc everyone can read",
                              onClick: () => fileInputRef.current?.click(),
                            },
                          ].map(({ Icon, title, body, onClick }) => (
                            <button
                              key={title}
                              onClick={onClick}
                              disabled={!onClick}
                              className="w-[230px] p-3.5 rounded-xl border flex flex-col items-start gap-1 text-left transition hover:bg-[var(--theme-fill-hover)] disabled:cursor-default"
                              style={{
                                borderColor: "var(--theme-border)",
                                backgroundColor: "var(--theme-bg-app)",
                              }}
                            >
                              <span
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{
                                  backgroundColor: "var(--theme-bg-surface)",
                                  color: "var(--theme-accent)",
                                }}
                              >
                                <Icon size={16} />
                              </span>
                              <span
                                className="text-[13px] font-bold"
                                style={{ color: "var(--theme-text)" }}
                              >
                                {title}
                              </span>
                              <span
                                className="text-xs"
                                style={{ color: "var(--theme-text-muted)" }}
                              >
                                {body}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <>
                    {/* Load older messages button / indicator */}
                    {hasMoreMessages && (
                      <div className="flex justify-center py-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (scrollContainerRef.current) {
                              previousScrollHeightRef.current =
                                scrollContainerRef.current.scrollHeight;
                            }
                            onLoadOlderMessages?.();
                          }}
                          disabled={isLoadingOlder}
                          style={{
                            backgroundColor: "var(--theme-bg-surface)",
                            borderColor: "var(--theme-border)",
                            color: "var(--theme-text-primary)",
                          }}
                          className="px-4 py-1.5 text-xs font-medium rounded-full transition flex items-center gap-2 border shadow-xs disabled:opacity-50 cursor-pointer hover:opacity-85"
                        >
                          {isLoadingOlder ? (
                            <>
                              <Loader2
                                size={13}
                                className="animate-spin"
                                style={{ color: "var(--theme-primary)" }}
                              />
                              <span>Loading older messages...</span>
                            </>
                          ) : (
                            <span>Load older messages</span>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Start of channel header (only shown when user has scrolled all the way to the beginning) */}
                    {!hasMoreMessages &&
                      (dmIntro || (
                        <div
                          className="pb-5 mb-1 border-b flex flex-col gap-2"
                          style={{ borderColor: "var(--theme-border)" }}
                        >
                          <span
                            className="w-14 h-14 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: channel.isAnonymous
                                ? tint(ANON_WARM, 12)
                                : "var(--theme-bg-surface)",
                              color: channel.isAnonymous
                                ? ANON_WARM
                                : "var(--theme-accent)",
                            }}
                          >
                            {channel.isAnonymous ? (
                              <Mask size={26} />
                            ) : channel.type === "PRIVATE" ? (
                              <Lock size={26} />
                            ) : (
                              <Hash size={26} />
                            )}
                          </span>
                          <h3
                            className="text-[17px] font-bold"
                            style={{ color: "var(--theme-text)" }}
                          >
                            Welcome to #{channel.name}
                          </h3>
                          <p
                            className="text-sm leading-[21px] max-w-md"
                            style={{ color: "var(--theme-text-muted)" }}
                          >
                            {channel.description ||
                              channel.topic ||
                              "This is the very beginning of the channel history."}
                          </p>
                        </div>
                      ))}

                    {messages.map((msg, idx) => {
                      const isBot = !!msg.bot;
                      const isAnon = channel.isAnonymous || msg.isAnonymous;
                      const isSelf =
                        msg.isSelf ||
                        (!isAnon && msg.userId === currentUser.id);
                      const isForward =
                        !!msg.quotedMessage &&
                        msg.quotedMessage.channelId !== msg.channelId;
                      // Only the author edits (admins can delete, not edit); forwards are read-only copies.
                      const canEdit = !msg.isDeleted && isSelf && !isForward;
                      const canDelete =
                        !msg.isDeleted && (isSelf || isWsAdmin || isSuperAdmin);
                      // Your own persona stays hidden until you reveal it with the eye toggle.
                      const hideSelfAnon = isAnon && isSelf && !revealAnon;
                      const authorName = isAnon
                        ? hideSelfAnon
                          ? "Anonymous"
                          : msg.anonName || "Anonymous"
                        : isBot
                          ? msg.bot?.name
                          : msg.user?.displayName || "Unknown";
                      const anonEmoji = msg.anonEmoji || "🎭";
                      const avatarUrl = isBot
                        ? msg.bot?.avatarUrl
                        : msg.user?.avatarUrl;
                      // Profile hover card: real people only (not bots / anonymous posts)
                      const author = !isAnon && !isBot ? msg.user : undefined;
                      const withCard = (
                        node: React.ReactNode,
                        className?: string,
                      ) =>
                        author ? (
                          <UserHoverCard
                            user={author}
                            presence={presence[author.id] || "offline"}
                            isSelf={author.id === currentUser.id}
                            onMessage={() =>
                              onSelectUserDM?.(author as UserProfile)
                            }
                            onHuddle={() =>
                              onHuddleUser?.(author as UserProfile)
                            }
                            className={className}
                          >
                            {node}
                          </UserHoverCard>
                        ) : (
                          node
                        );

                      return (
                        <React.Fragment key={msg.id}>
                          {(idx === 0 ||
                            dayKey(messages[idx - 1].createdAt) !==
                              dayKey(msg.createdAt)) && (
                            <div
                              className="flex items-center gap-2.5 py-1 select-none"
                              role="separator"
                            >
                              <span
                                className="flex-1 h-px"
                                style={{
                                  backgroundColor: "var(--theme-border)",
                                }}
                              />
                              <span
                                className="h-6 px-3 rounded-xl border flex items-center text-xs font-semibold"
                                style={{
                                  borderColor: "var(--theme-border)",
                                  color: "var(--theme-text-muted)",
                                  backgroundColor: "var(--theme-bg-app)",
                                }}
                              >
                                {dayLabel(msg.createdAt)}
                              </span>
                              <span
                                className="flex-1 h-px"
                                style={{
                                  backgroundColor: "var(--theme-border)",
                                }}
                              />
                            </div>
                          )}
                          {firstUnreadMessageId === msg.id && (
                            <div
                              className="flex items-center gap-2.5 select-none animate-in fade-in duration-200"
                              role="separator"
                            >
                              <span
                                className="flex-1 h-px"
                                style={{
                                  backgroundColor:
                                    "color-mix(in srgb, var(--theme-primary) 55%, transparent)",
                                }}
                              />
                              <span
                                className="text-xs font-bold"
                                style={{ color: "var(--theme-primary)" }}
                              >
                                New messages
                              </span>
                            </div>
                          )}
                          <div
                            id={`msg-${msg.id}`}
                            className="group flex gap-3 hover:bg-[var(--theme-fill-hover)] -mx-3 sm:-mx-6 px-3 sm:px-6 py-1 transition-colors duration-200 relative"
                            style={
                              msg.isPinned
                                ? {
                                    backgroundColor: tint(ANON_WARM, 6),
                                    boxShadow: `inset 2px 0 0 ${ANON_WARM}`,
                                  }
                                : undefined
                            }
                          >
                            {isAnon ? (
                              <AnonAvatar
                                name={authorName}
                                emoji={anonEmoji}
                                size={36}
                              />
                            ) : isBot ? (
                              <BotAvatar
                                name={authorName}
                                src={avatarUrl}
                                size={36}
                                className="self-start"
                              />
                            ) : (
                              withCard(
                                <Avatar
                                  name={authorName}
                                  src={avatarUrl}
                                  size={36}
                                  className="cursor-pointer"
                                />,
                                "shrink-0 self-start",
                              )
                            )}

                            <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                              {msg.isPinned && (
                                <div
                                  className="flex items-center gap-1 text-[11px] font-semibold"
                                  style={{ color: ANON_WARM_TEXT }}
                                >
                                  <Pin size={11} />
                                  <span>Pinned to channel</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 leading-none">
                                {withCard(
                                  <span
                                    className={`font-bold text-sm flex items-center gap-1.5 ${author ? "hover:underline cursor-pointer" : ""}`}
                                    style={{ color: "var(--theme-text)" }}
                                  >
                                    {!isAnon &&
                                    author &&
                                    author.id === currentUser.id
                                      ? "You"
                                      : authorName}
                                    {isBot && (
                                      <span
                                        className="h-4 px-1.5 rounded flex items-center text-[10px] font-semibold leading-3"
                                        style={{
                                          backgroundColor:
                                            "var(--theme-bg-surface-hover)",
                                          color: "var(--theme-text-muted)",
                                        }}
                                      >
                                        APP
                                      </span>
                                    )}
                                  </span>,
                                )}
                                <span
                                  className="text-xs"
                                  style={{ color: "var(--theme-text-muted)" }}
                                >
                                  {isAnon && isSelf && revealAnon
                                    ? "You · "
                                    : ""}
                                  {formatMessageTime(msg.createdAt, timeFormat)}
                                </span>
                                <MessageChangeNote
                                  message={msg}
                                  timeFormat={timeFormat}
                                  className="text-[10px] opacity-80"
                                />
                              </div>

                              {msg.isDeleted ? (
                                <div
                                  className="flex items-center gap-2 py-1.5 text-xs italic select-none"
                                  style={{ color: "var(--theme-text-muted)" }}
                                >
                                  <Trash2
                                    size={13}
                                    className="opacity-60 shrink-0"
                                  />
                                  <span>
                                    {(msg as any).deletedByName
                                      ? `This message was deleted by ${(msg as any).deletedByName}`
                                      : "This message was deleted"}
                                  </span>
                                </div>
                              ) : editingMessageId === msg.id ? (
                                <div className="mt-2 space-y-2">
                                  <textarea
                                    value={editContent}
                                    onChange={(e) =>
                                      setEditContent(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSaveEdit(msg.id);
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        handleCancelEdit();
                                      }
                                    }}
                                    rows={3}
                                    autoFocus
                                    className="w-full text-sm p-2.5 rounded-lg border focus:outline-none focus:ring-1 resize-y"
                                    style={{
                                      backgroundColor:
                                        "var(--theme-bg-surface)",
                                      borderColor: "var(--theme-border)",
                                      color: "var(--theme-text-primary)",
                                    }}
                                    placeholder="Edit message..."
                                  />
                                  <div className="flex items-center justify-between text-xs">
                                    <span
                                      style={{
                                        color: "var(--theme-text-muted)",
                                      }}
                                      className="text-[11px]"
                                    >
                                      escape to{" "}
                                      <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="underline hover:opacity-80"
                                      >
                                        cancel
                                      </button>{" "}
                                      • enter to{" "}
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEdit(msg.id)}
                                        className="underline hover:opacity-80"
                                      >
                                        save
                                      </button>
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        disabled={isSavingEdit}
                                        className="px-3 py-1 rounded text-xs font-medium border hover:bg-black/5 dark:hover:bg-[var(--theme-bg-surface-hover)] transition"
                                        style={{
                                          borderColor: "var(--theme-border)",
                                          color: "var(--theme-text-primary)",
                                        }}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEdit(msg.id)}
                                        disabled={
                                          isSavingEdit || !editContent.trim()
                                        }
                                        className="px-3 py-1 rounded text-xs font-semibold text-[var(--theme-primary-text)] transition flex items-center gap-1.5 shadow-sm"
                                        style={{
                                          backgroundColor:
                                            "var(--theme-primary)",
                                        }}
                                      >
                                        {isSavingEdit ? (
                                          <>
                                            <Loader2
                                              size={12}
                                              className="animate-spin"
                                            />
                                            <span>Saving...</span>
                                          </>
                                        ) : (
                                          "Save Changes"
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {/* Quoted Message Preview Box */}
                                  {isForward && msg.quotedMessage ? (
                                    <div
                                      style={{
                                        backgroundColor:
                                          "var(--theme-bg-surface)",
                                        borderColor: "var(--theme-border)",
                                      }}
                                      className="mt-1 mb-1.5 border-l-4 rounded-r-lg px-3 py-2 text-xs max-w-lg shadow-sm"
                                    >
                                      <span
                                        className="flex items-center gap-1 text-[11px] mb-1"
                                        style={{
                                          color: "var(--theme-text-muted)",
                                        }}
                                      >
                                        <Forward size={11} /> Forwarded
                                        {msg.quotedMessage.channel &&
                                          msg.quotedMessage.channel.type !==
                                            "DIRECT" &&
                                          msg.quotedMessage.channel.type !==
                                            "GROUP_DIRECT" && (
                                            <>
                                              {" "}
                                              from #
                                              {msg.quotedMessage.channel.name}
                                            </>
                                          )}
                                      </span>
                                      <span
                                        className="font-bold text-[11px] block"
                                        style={{
                                          color: "var(--theme-text-primary)",
                                        }}
                                      >
                                        {msg.quotedMessage.isAnonymous
                                          ? msg.quotedMessage.anonName
                                            ? `${msg.quotedMessage.anonEmoji || "🎭"} ${msg.quotedMessage.anonName}`
                                            : "Anonymous"
                                          : msg.quotedMessage.user
                                              ?.displayName || "Teammate"}
                                      </span>
                                      {/* The forward's own copy, so it survives the original being deleted */}
                                      <div
                                        className="text-sm break-words"
                                        style={{
                                          color: "var(--theme-text-primary)",
                                        }}
                                      >
                                        <MarkdownRenderer
                                          content={msg.content}
                                          currentUsername={
                                            currentUser?.username
                                          }
                                        />
                                      </div>
                                      {!!msg.attachments?.length && (
                                        <FileAttachmentList
                                          attachments={msg.attachments}
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    msg.quotedMessage && (
                                      <div
                                        onClick={() => {
                                          const el = document.getElementById(
                                            `msg-${msg.quotedMessage?.id}`,
                                          );
                                          if (el) {
                                            el.scrollIntoView({
                                              behavior: "smooth",
                                              block: "center",
                                            });
                                            el.classList.add(
                                              "ring-2",
                                              "ring-[var(--theme-primary)]",
                                            );
                                            setTimeout(() => {
                                              el.classList.remove(
                                                "ring-2",
                                                "ring-[var(--theme-primary)]",
                                              );
                                            }, 2000);
                                          }
                                        }}
                                        style={{
                                          backgroundColor:
                                            "var(--theme-bg-surface)",
                                          borderColor: "var(--theme-border)",
                                        }}
                                        className="mt-1 mb-1.5 flex items-center gap-2 border-l-4 border-l-[var(--theme-primary)] rounded-r-lg px-3 py-1.5 cursor-pointer text-xs transition max-w-lg"
                                      >
                                        <div className="min-w-0">
                                          <span
                                            className="font-bold text-[11px] block"
                                            style={{
                                              color:
                                                "var(--theme-primary-hover)",
                                            }}
                                          >
                                            {channel.isAnonymous ||
                                            msg.quotedMessage.isAnonymous
                                              ? msg.quotedMessage.anonName
                                                ? `${msg.quotedMessage.anonEmoji || "🎭"} ${msg.quotedMessage.anonName}`
                                                : "Anonymous"
                                              : msg.quotedMessage.user
                                                  ?.displayName || "Teammate"}
                                          </span>
                                          <span
                                            className="text-[11px] truncate block max-w-md"
                                            style={{
                                              color: "var(--theme-text-muted)",
                                            }}
                                          >
                                            {msg.quotedMessage.content}
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  )}

                                  {/* Message Content */}
                                  {!isForward && (
                                    <>
                                      <div
                                        className="text-sm leading-[21px] max-w-none break-words"
                                        style={{ color: "var(--theme-text)" }}
                                      >
                                        <MarkdownRenderer
                                          content={msg.content}
                                          currentUsername={
                                            currentUser?.username
                                          }
                                          onMentionClick={handleMentionClick}
                                          onChannelClick={handleChannelClick}
                                        />
                                      </div>

                                      {/* Attachments */}
                                      {msg.attachments &&
                                        msg.attachments.length > 0 && (
                                          <FileAttachmentList
                                            attachments={msg.attachments}
                                            currentUser={currentUser}
                                            onFileDeleted={(deletedFileId) => {
                                              useChatStore
                                                .getState()
                                                .removeAttachment(
                                                  deletedFileId,
                                                );
                                            }}
                                          />
                                        )}
                                    </>
                                  )}

                                  {/* Reactions Bar - ONLY displayed when reactions exist */}
                                  {(() => {
                                    const reactionCounts = (
                                      msg.reactions || []
                                    ).reduce(
                                      (
                                        acc: {
                                          [emoji: string]: {
                                            count: number;
                                            users: string[];
                                            hasReacted: boolean;
                                          };
                                        },
                                        r,
                                      ) => {
                                        if (!acc[r.emoji]) {
                                          acc[r.emoji] = {
                                            count: 0,
                                            users: [],
                                            hasReacted: false,
                                          };
                                        }
                                        acc[r.emoji].count += 1;
                                        if (r.user?.displayName) {
                                          acc[r.emoji].users.push(
                                            channel.isAnonymous
                                              ? "Anonymous"
                                              : r.user.displayName,
                                          );
                                        }
                                        if (r.userId === currentUser?.id)
                                          acc[r.emoji].hasReacted = true;
                                        return acc;
                                      },
                                      {},
                                    );

                                    const entries =
                                      Object.entries(reactionCounts);
                                    if (entries.length === 0) return null;

                                    return (
                                      <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                                        {entries.map(([emoji, data]) => (
                                          <button
                                            key={emoji}
                                            onClick={() =>
                                              handleReaction(msg.id, emoji)
                                            }
                                            title={data.users.join(", ")}
                                            className="h-6 px-2 rounded-xl border flex items-center gap-1 text-xs font-semibold transition hover:brightness-95"
                                            style={
                                              data.hasReacted
                                                ? {
                                                    backgroundColor:
                                                      "var(--theme-selected)",
                                                    borderColor:
                                                      "color-mix(in srgb, var(--theme-primary) 40%, transparent)",
                                                    color:
                                                      "var(--theme-primary-hover)",
                                                  }
                                                : {
                                                    backgroundColor:
                                                      "var(--theme-bg-app)",
                                                    borderColor:
                                                      "var(--theme-border)",
                                                    color:
                                                      "var(--theme-text-muted)",
                                                  }
                                            }
                                          >
                                            <span className="text-xs leading-none">
                                              {emoji}
                                            </span>
                                            <span>{data.count}</span>
                                          </button>
                                        ))}

                                        <button
                                          onClick={() =>
                                            setActiveEmojiMessageId(
                                              activeEmojiMessageId === msg.id
                                                ? null
                                                : msg.id,
                                            )
                                          }
                                          title="Add reaction"
                                          className="h-6 w-7 rounded-xl border flex items-center justify-center transition opacity-0 group-hover:opacity-100 hover:bg-[var(--theme-fill-hover)]"
                                          style={{
                                            borderColor: "var(--theme-border)",
                                            color: "var(--theme-text-muted)",
                                          }}
                                        >
                                          <SmilePlus size={12} />
                                        </button>
                                      </div>
                                    );
                                  })()}
                                </>
                              )}

                              {/* Thread Replies Button */}
                              {(msg.replyCount || 0) > 0 && (
                                <button
                                  onClick={() => onOpenThread(msg)}
                                  className="self-start flex items-center gap-2 pt-1 group/thread"
                                >
                                  <span
                                    className="w-5 h-5 rounded-full flex items-center justify-center"
                                    style={{
                                      backgroundColor: "var(--theme-selected)",
                                      color: "var(--theme-accent)",
                                    }}
                                  >
                                    <MessageSquare size={11} />
                                  </span>
                                  <span
                                    className="text-[13px] font-semibold group-hover/thread:underline"
                                    style={{
                                      color: "var(--theme-primary-hover)",
                                    }}
                                  >
                                    {msg.replyCount}{" "}
                                    {msg.replyCount === 1 ? "reply" : "replies"}
                                  </span>
                                  {msg.latestReplyAt && (
                                    <span
                                      className="text-xs"
                                      style={{
                                        color: "var(--theme-text-muted)",
                                      }}
                                    >
                                      Last reply{" "}
                                      {(() => {
                                        const r = relativeTime(
                                          msg.latestReplyAt,
                                        );
                                        return r === "Just now" ||
                                          r === "Yesterday"
                                          ? r.toLowerCase()
                                          : r;
                                      })()}
                                    </span>
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Floating Hover Bubble Layer */}
                            {!msg.isDeleted && (
                              <div className="absolute right-2 sm:right-4 -top-3.5 hidden group-hover:flex items-center bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-xl shadow-2xl px-1.5 py-1 gap-1 z-20">
                                {/* Top 4 Quick Reaction Emojis */}
                                <div className="flex items-center gap-0.5 pr-1 border-r border-[var(--theme-border)] mr-0.5">
                                  {topEmojis.slice(0, 4).map((em) => (
                                    <button
                                      key={em}
                                      onClick={() => handleReaction(msg.id, em)}
                                      className="hover:scale-125 transition text-xs p-1 rounded hover:bg-[var(--theme-bg-surface-hover)]"
                                      title={`React with ${em}`}
                                    >
                                      {em}
                                    </button>
                                  ))}
                                </div>

                                <button
                                  onClick={() =>
                                    setActiveEmojiMessageId(
                                      activeEmojiMessageId === msg.id
                                        ? null
                                        : msg.id,
                                    )
                                  }
                                  title="More emojis..."
                                  className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
                                >
                                  <SmilePlus size={14} />
                                </button>
                                <button
                                  onClick={() => setReplyingToMessage(msg)}
                                  title="Quote Reply"
                                  className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
                                >
                                  <CornerUpLeft size={14} />
                                </button>
                                <button
                                  onClick={() => onOpenThread(msg)}
                                  title="Reply in thread"
                                  className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
                                >
                                  <MessageSquare size={14} />
                                </button>
                                {!channel.isAnonymous && (
                                  <button
                                    onClick={() => setForwardingMessage(msg)}
                                    title="Forward message"
                                    className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
                                  >
                                    <Forward size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleTogglePin(msg)}
                                  title={
                                    msg.isPinned
                                      ? "Unpin message"
                                      : "Pin message to channel"
                                  }
                                  className={`p-1 rounded transition ${
                                    msg.isPinned
                                      ? "text-[#D97706]"
                                      : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)]"
                                  }`}
                                >
                                  <Pin size={14} />
                                </button>
                                {onCreateTicketFromMessage && (
                                  <button
                                    onClick={() =>
                                      onCreateTicketFromMessage(msg)
                                    }
                                    title="Create Ticket from message"
                                    className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
                                  >
                                    <CheckSquare size={14} />
                                  </button>
                                )}
                                {canEdit && (
                                  <button
                                    onClick={() => {
                                      setEditingMessageId(msg.id);
                                      setEditContent(msg.content);
                                    }}
                                    title="Edit message"
                                    className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded transition"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => setDeleteConfirmMessage(msg)}
                                    title="Delete message"
                                    className="p-1 text-[#DC2626] hover:bg-[color-mix(in_srgb,#DC2626_12%,transparent)] rounded transition"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Anchored Mini Emoji Popover */}
                            {!msg.isDeleted &&
                              activeEmojiMessageId === msg.id && (
                                <EmojiPickerPopover
                                  isOpen={true}
                                  onClose={() => setActiveEmojiMessageId(null)}
                                  onSelectEmoji={(emoji) =>
                                    handleReaction(msg.id, emoji)
                                  }
                                  title="Add Reaction"
                                  positionClass={
                                    idx >= Math.max(0, messages.length - 4)
                                      ? "bottom-10 right-2 sm:right-4"
                                      : "top-8 right-2 sm:right-4"
                                  }
                                />
                              )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                <div
                  className="px-3 sm:px-6 py-1 text-xs italic flex items-center gap-1.5"
                  style={{ color: "var(--theme-text-muted)" }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: "var(--theme-text-muted)" }}
                  />
                  <span>
                    {typingUsers.join(", ")}{" "}
                    {typingUsers.length === 1 ? "is" : "are"} typing...
                  </span>
                </div>
              )}

              {/* Chat Input Container */}
              <div className="px-3 sm:px-6 pb-5 pt-1 relative">
                {/* Floating "New Messages ↓" pill positioned above the input box */}
                {firstUnreadMessageId && !isNearBottomRef.current && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-auto">
                    <button
                      type="button"
                      onClick={() => {
                        messagesEndRef.current?.scrollIntoView({
                          behavior: "smooth",
                        });
                        setFirstUnreadMessageId(null);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xl transition hover:brightness-95 cursor-pointer bg-[var(--theme-primary)] text-[var(--theme-primary-text)]"
                    >
                      <span>New messages</span>
                      <ChevronDown size={14} />
                    </button>
                  </div>
                )}

                {/* Quote Reply Banner */}
                {replyingToMessage && (
                  <div
                    className="mb-2 rounded-r-xl px-3.5 py-2 flex items-center justify-between border-l-4"
                    style={{
                      backgroundColor: "var(--theme-bg-surface)",
                      borderLeftColor: "var(--theme-primary)",
                    }}
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <span
                        className="text-[11px] font-bold flex items-center gap-1.5"
                        style={{ color: "var(--theme-primary-hover)" }}
                      >
                        <CornerUpLeft size={12} />
                        Replying to{" "}
                        {channel.isAnonymous || replyingToMessage.isAnonymous
                          ? replyingToMessage.anonName
                            ? `${replyingToMessage.anonEmoji || "🎭"} ${replyingToMessage.anonName}`
                            : "Anonymous"
                          : replyingToMessage.user?.displayName || "Teammate"}
                      </span>
                      <p className="text-xs text-[var(--theme-text)] truncate mt-0.5 max-w-2xl">
                        {replyingToMessage.content}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingToMessage(null)}
                      className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] rounded-lg transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {/* Slash Command Suggestions */}
                {content.startsWith("/") && !content.includes(" ") && (
                  <div className="mb-2 bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-xl p-2 shadow-2xl space-y-1">
                    <div className="text-[10px] font-bold uppercase text-[var(--theme-text-muted)] px-2 py-1 tracking-wider">
                      Available Slash Commands
                    </div>
                    {[
                      {
                        cmd: '/poll "Question" "Opt 1" "Opt 2"',
                        desc: "Create an interactive vote with reactions",
                      },
                      {
                        cmd: "/topic <new topic>",
                        desc: "Set or change channel topic",
                      },
                      {
                        cmd: "/huddle",
                        desc: "Start an instant voice/video huddle",
                      },
                      {
                        cmd: "/shrug <message>",
                        desc: "Append ¯\\_(ツ)_/¯ to message",
                      },
                    ]
                      .filter((c) =>
                        c.cmd.toLowerCase().startsWith(content.toLowerCase()),
                      )
                      .map((c, i) => (
                        <div
                          key={i}
                          onClick={() => setContent(c.cmd.split(" ")[0] + " ")}
                          className="flex items-center justify-between px-3 py-1.5 hover:bg-[var(--theme-bg-surface-hover)] rounded-lg cursor-pointer text-xs transition"
                        >
                          <span
                            className="font-mono font-semibold"
                            style={{ color: "var(--theme-primary-hover)" }}
                          >
                            {c.cmd}
                          </span>
                          <span className="text-[var(--theme-text-muted)]">
                            {c.desc}
                          </span>
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
                  style={{
                    backgroundColor: "var(--theme-bg-app)",
                    borderColor: "var(--theme-border)",
                    boxShadow: "0 1px 1px rgba(20, 26, 46, 0.06)",
                  }}
                  className={`border rounded-xl relative transition focus-within:border-[color-mix(in_srgb,var(--theme-text)_20%,transparent)] ${
                    isDragOver ? "ring-2 ring-[var(--theme-primary)]" : ""
                  }`}
                >
                  {/* File Attachments Preview & Upload Indicator */}
                  {(attachments.length > 0 || isUploading) && (
                    <div className="px-3 pt-2.5 flex flex-wrap gap-2 border-b border-[var(--theme-border)] pb-2.5 rounded-t-xl">
                      {attachments.map((att, idx) => {
                        const isImage =
                          getFileCategory(att.fileType, att.fileName) ===
                          "image";
                        return (
                          <div
                            key={att.id || idx}
                            className="flex items-center gap-2 bg-[var(--theme-bg-surface-hover)] border border-[var(--theme-border)] px-2.5 py-1 rounded-lg text-xs text-[var(--theme-text)] shadow-sm animate-in fade-in zoom-in-95 duration-100"
                          >
                            {isImage ? (
                              <div className="w-4 h-4 rounded overflow-hidden bg-[var(--theme-bg-app)]">
                                <img
                                  src={
                                    att.fileUrl?.startsWith("http")
                                      ? att.fileUrl
                                      : `${(process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000").replace(/\/$/, "")}${att.fileUrl?.startsWith("/") ? "" : "/"}${att.fileUrl}`
                                  }
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <FileText
                                size={14}
                                style={{ color: "var(--theme-text-muted)" }}
                              />
                            )}
                            <span
                              className="truncate max-w-[140px] font-medium"
                              title={att.fileName}
                            >
                              {att.fileName}
                            </span>
                            <span className="text-[10px] text-[var(--theme-text-muted)] font-mono">
                              ({formatFileSize(att.fileSize)})
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setAttachments(
                                  attachments.filter((_, i) => i !== idx),
                                )
                              }
                              title="Remove attachment"
                              className="text-[var(--theme-text-muted)] hover:text-red-400 p-0.5 rounded transition"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}

                      {isUploading && (
                        <div className="flex items-center gap-1.5 bg-[var(--theme-bg-surface-hover)] px-2.5 py-1 rounded-lg text-xs text-[var(--theme-primary)] border border-[var(--theme-border)] animate-pulse">
                          <Loader2 size={13} className="animate-spin" />
                          <span>Uploading file...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live WYSIWYG In-Place Rich Text Editor */}
                  <RichTextEditor
                    key={channel.id}
                    ref={editorRef}
                    initialValue={initialDraft}
                    autoFocus={true}
                    placeholder={
                      isDragOver
                        ? "Drop file here to upload to channel..."
                        : channel.isAnonymous
                          ? `Post as ${anonProfile?.anonName || "Anonymous"}`
                          : channel.type === "DIRECT"
                            ? `Message ${dmName}`
                            : `Message #${channel.name}`
                    }
                    showToolbar={showFormatting}
                    mentionUsers={mentionUsers}
                    onTyping={(text) => handleTyping(text)}
                    onPasteFiles={handlePasteFiles}
                    onSubmit={() => handleSendMessage()}
                  />

                  {/* Action Bar */}
                  <div className="flex items-center gap-0.5 px-2.5 pb-2.5 rounded-b-xl">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      multiple
                      className="hidden"
                    />
                    {[
                      {
                        title: showFormatting
                          ? "Hide formatting"
                          : "Show formatting",
                        Icon: Pencil,
                        onClick: () => setShowFormatting(!showFormatting),
                        active: showFormatting,
                      },
                      {
                        title: "Add emoji",
                        Icon: Smile,
                        onClick: () => setShowEmoji(!showEmoji),
                        active: showEmoji,
                      },
                      ...(channel.isAnonymous
                        ? []
                        : [
                            {
                              title: "Mention someone",
                              Icon: AtSign,
                              onClick: () =>
                                editorRef.current?.insertEmoji("@"),
                              active: false,
                            },
                          ]),
                      {
                        title: "Attach files (images, docs, code, zip...)",
                        Icon: Paperclip,
                        onClick: () => fileInputRef.current?.click(),
                        active: false,
                      },
                    ].map(({ title, Icon, onClick, active }) => (
                      <button
                        key={title}
                        type="button"
                        onClick={onClick}
                        title={title}
                        className="w-[30px] h-[30px] rounded-lg flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
                        style={{
                          color: active
                            ? "var(--theme-text)"
                            : "var(--theme-text-muted)",
                          backgroundColor: active
                            ? "var(--theme-fill)"
                            : undefined,
                        }}
                      >
                        <Icon size={17} />
                      </button>
                    ))}
                    <span className="flex-1" />

                    <button
                      type="submit"
                      disabled={
                        (!content.trim() && attachments.length === 0) ||
                        isUploading
                      }
                      title="Send"
                      className="w-8 h-8 rounded-[10px] transition disabled:opacity-40 flex items-center justify-center hover:brightness-95"
                      style={{
                        backgroundColor: channel.isAnonymous
                          ? ANON_WARM
                          : "var(--theme-primary)",
                        color: channel.isAnonymous
                          ? "#FFFFFF"
                          : "var(--theme-primary-text)",
                      }}
                    >
                      {isUploading ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Send size={15} />
                      )}
                    </button>
                  </div>

                  {/* Emoji Picker Popover - sits completely above composer input without clipping */}
                  <EmojiPickerPopover
                    isOpen={showEmoji}
                    onClose={() => setShowEmoji(false)}
                    onSelectEmoji={(emoji) => {
                      editorRef.current?.insertEmoji(emoji);
                    }}
                    title="Add Emoji"
                    positionClass="bottom-full mb-2 left-2 sm:left-4 z-50"
                  />
                </form>
              </div>
            </>
          )}
        </div>
        {showSidePanel && (
          <ChannelSidePanel
            channel={channel}
            messages={messages}
            currentUser={currentUser}
            members={members}
            presence={presence}
            dmPeer={dmPeer}
            onClose={() => setShowSidePanel(false)}
            onOpenSettings={() => setShowDetailsModal(true)}
            onOpenWhiteboard={() => setActiveView("whiteboard")}
            onJumpToMessage={jumpToMessage}
            onHuddleUser={onHuddleUser}
          />
        )}
      </div>

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

      {/* Channel Details & Info Modal */}
      {showDetailsModal && (
        <ChannelDetailsModal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          channel={channel}
          currentUser={currentUser}
          presence={presence}
          onOpenAddMembers={onOpenAddMembers}
          onOpenWhiteboard={() => setActiveView("whiteboard")}
          onOpenStorage={() => setShowStorageModal(true)}
          onChannelUpdated={(updated) => {
            // Update channel in store if needed
            useChatStore.getState().updateChannel(updated);
          }}
        />
      )}

      {forwardingMessage && (
        <ForwardMessageDialog
          message={forwardingMessage}
          currentUser={currentUser}
          onClose={() => setForwardingMessage(null)}
        />
      )}

      {/* Pinned Messages Modal */}
      {showPinsModal && (
        <PinnedMessagesModal
          isOpen={showPinsModal}
          onClose={() => setShowPinsModal(false)}
          channel={channel}
          currentUser={currentUser}
          onJumpToMessage={(msg) => {
            const el = document.getElementById(`msg-${msg.id}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("ring-2", "ring-[var(--theme-primary)]");
              setTimeout(() => {
                el.classList.remove("ring-2", "ring-[var(--theme-primary)]");
              }, 3000);
            }
          }}
        />
      )}

      {/* Anonymous Persona Modal */}
      {showAnonPersonaModal && (
        <AnonymousPersonaModal
          isOpen={showAnonPersonaModal}
          onClose={() => setShowAnonPersonaModal(false)}
          channelId={channel.id}
          channelName={channel.name}
          currentName={anonProfile?.anonName}
          currentEmoji={anonProfile?.anonEmoji}
          onPersonaUpdated={(newProfile) => {
            setAnonProfile(newProfile);
            const currentCh = useChatStore
              .getState()
              .channels.find((c) => c.id === channel.id);
            if (currentCh) {
              useChatStore.getState().updateChannel({
                ...currentCh,
                myAnonProfile: newProfile,
              });
            }
          }}
        />
      )}

      {/* Delete Message Confirmation Modal */}
      {deleteConfirmMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4"
            style={{
              backgroundColor: "var(--theme-bg-surface)",
              borderColor: "var(--theme-border)",
              color: "var(--theme-text-primary)",
            }}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 shrink-0 mt-0.5">
                <Trash2 size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold">Delete message</h3>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--theme-text-muted)" }}
                >
                  Are you sure you want to delete this message? This message
                  will be marked as deleted.
                </p>
              </div>
            </div>

            {deleteConfirmMessage.content && (
              <div
                className="p-3 rounded-lg border text-xs max-h-24 overflow-y-auto italic line-clamp-3"
                style={{
                  backgroundColor: "var(--theme-bg-surface-hover)",
                  borderColor: "var(--theme-border)",
                  color: "var(--theme-text-muted)",
                }}
              >
                &ldquo;{deleteConfirmMessage.content}&rdquo;
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmMessage(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-medium border hover:bg-black/5 dark:hover:bg-[var(--theme-bg-surface-hover)] transition"
                style={{
                  borderColor: "var(--theme-border)",
                  color: "var(--theme-text-primary)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMessage}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-1.5 shadow-sm"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compression Confirmation Modal */}
      <CompressFileConfirmModal
        isOpen={showCompressModal}
        files={pendingCompressFiles}
        isCompressing={isCompressing}
        onConfirmCompress={() => processUploadFiles(pendingCompressFiles, true)}
        onSkip={() => processUploadFiles(pendingCompressFiles, false)}
        onCancel={() => {
          setShowCompressModal(false);
          setPendingCompressFiles([]);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }}
      />
    </div>
  );
};
