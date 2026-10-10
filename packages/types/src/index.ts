// ==========================================
// 1. User & Auth Types
// ==========================================
export type UserStatus = 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY' | 'IN_HUDDLE';
export type SystemRole = 'SUPER_ADMIN' | 'WORKSPACE_ADMIN' | 'USER';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  systemRole: SystemRole;
  status: UserStatus;
  customStatusText: string | null;
  customStatusEmoji: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  user: UserProfile;
}

// ==========================================
// 2. Workspace / Organization & Roles
// ==========================================
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    members: number;
    channels: number;
  };
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  nickname: string | null;
  joinedAt: string;
  user?: UserProfile;
}

// ==========================================
// 3. Channels & Direct Messages
// ==========================================
export type ChannelType = 'PUBLIC' | 'PRIVATE' | 'DIRECT' | 'GROUP_DIRECT';

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  topic: string | null;
  description: string | null;
  type: ChannelType;
  isArchived: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  members?: WorkspaceMember[];
  unreadCount?: number;
  whiteboardData?: any;
}

// ==========================================
// 4. Messages, Threads, Reactions & Files
// ==========================================
export interface Attachment {
  id: string;
  workspaceId: string;
  channelId?: string | null;
  messageId?: string | null;
  uploaderId?: string | null;
  fileName: string;
  fileKey?: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  storageProvider?: string;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt?: string;
  uploader?: UserProfile;
}

export interface StorageCategoryStat {
  category: 'images' | 'videos' | 'audio' | 'documents' | 'archives' | 'code' | 'other';
  label: string;
  bytes: number;
  count: number;
  color: string;
}

export interface StorageStats {
  totalBytes: number;
  formattedTotal: string;
  fileCount: number;
  categories: StorageCategoryStat[];
  recentFiles?: Attachment[];
}

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  user?: UserProfile;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  parentMessageId: string | null; // For threads
  quotedMessageId?: string | null; // For quote replies
  quotedMessage?: Message | null;
  content: string; // Markdown or rich text
  isEdited: boolean;
  isDeleted: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  user?: UserProfile;
  bot?: BotApp;
  attachments?: Attachment[];
  reactions?: Reaction[];
  replyCount?: number;
  latestReplyAt?: string | null;
}

// ==========================================
// 5. Notifications
// ==========================================
export type NotificationType = 'MENTION' | 'DIRECT_MESSAGE' | 'REACTION' | 'THREAD_REPLY' | 'HUDDLE_INVITE' | 'SYSTEM';

export interface AppNotification {
  id: string;
  userId: string;
  workspaceId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  linkUrl: string | null;
  channelId?: string | null;
  messageId?: string | null;
  createdAt: string;
}

// ==========================================
// 6. Huddle (LiveKit Audio/Video/Screen Share)
// ==========================================
export interface HuddleSession {
  id: string;
  channelId: string;
  workspaceId: string;
  roomName: string; // LiveKit room
  hostUserId: string;
  isActive: boolean;
  startedAt: string;
  endedAt?: string | null;
  participants: HuddleParticipant[];
}

export interface HuddleParticipant {
  userId: string;
  joinedAt: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  user?: UserProfile;
}

export interface LiveKitTokenResponse {
  token: string;
  roomName: string;
  serverUrl: string;
}

// ==========================================
// 7. Bot, Webhooks & Developer Platform
// ==========================================
export type BotScope =
  | 'channels:read'
  | 'channels:write'
  | 'chat:write'
  | 'chat:read'
  | 'users:read'
  | 'files:write'
  | 'commands';

export interface BotApp {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  botToken: string; // xoxb-...
  scopes: BotScope[];
  isActive: boolean;
  createdAt: string;
}

export interface WebhookPayload {
  channelId?: string;
  text?: string;
  attachments?: {
    title?: string;
    text?: string;
    color?: string;
    imageUrl?: string;
  }[];
}

export interface SlashCommandPayload {
  command: string;
  text: string;
  channelId: string;
  workspaceId: string;
  userId: string;
  responseUrl: string;
}

// ==========================================
// 8. Real-time Socket Event Names & Payloads
// ==========================================
export const SOCKET_EVENTS = {
  // Connection / Rooms
  JOIN_WORKSPACE: 'workspace:join',
  LEAVE_WORKSPACE: 'workspace:leave',
  JOIN_CHANNEL: 'channel:join',
  LEAVE_CHANNEL: 'channel:leave',

  // Messages & Threads
  MESSAGE_NEW: 'message:new',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_REACTION: 'message:reaction',
  FILE_DELETE: 'file:delete',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',

  // Huddles
  HUDDLE_STARTED: 'huddle:started',
  HUDDLE_ENDED: 'huddle:ended',
  HUDDLE_JOINED: 'huddle:joined',
  HUDDLE_LEFT: 'huddle:left',

  // Channels & Workspaces
  CHANNEL_NEW: 'channel:new',
  CHANNEL_UPDATE: 'channel:updated',

  // Whiteboard / Collaborative Canvas
  WHITEBOARD_UPDATE: 'whiteboard:update',
  WHITEBOARD_CURSOR: 'whiteboard:cursor',
  WHITEBOARD_CLEAR: 'whiteboard:clear',

  // Presence & Notifications
  USER_STATUS_CHANGE: 'user:status_change',
  NOTIFICATION_NEW: 'notification:new',
} as const;
