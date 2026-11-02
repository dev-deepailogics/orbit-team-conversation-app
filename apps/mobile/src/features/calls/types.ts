// Payload of huddle:started (apps/server/src/routes/huddles.ts → /start).
export interface IncomingCall {
  channelId: string;
  channelName: string;
  channelType?: string;
  callerName: string;
  hostUserId: string;
  workspaceId: string;
}

export interface ActiveCall {
  channelId: string;
  channelName: string;
  workspaceId: string;
}

export interface CallChatLine {
  text: string;
  replyTo: { senderName: string; text: string } | null;
}
