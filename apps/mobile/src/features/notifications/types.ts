// Mirrors the FCM `data` payload built in apps/server/src/services/pushService.ts (values are always strings).
export interface PushTarget {
  channelId: string;
  parentMessageId?: string;
}

export interface InAppBanner extends PushTarget {
  title: string;
  body: string;
}
