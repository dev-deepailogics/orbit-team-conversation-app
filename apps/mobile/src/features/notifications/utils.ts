import { navigationRef } from '@/navigation/ref';
import type { PushTarget } from './types';

export function parseTarget(data: Record<string, unknown> | undefined): PushTarget | null {
  const channelId = typeof data?.channelId === 'string' ? data.channelId : '';
  if (!channelId) return null;
  const parent = data?.parentMessageId;
  return { channelId, parentMessageId: typeof parent === 'string' && parent ? parent : undefined };
}

// Banner is pointless when the user is already looking at that conversation.
export function isViewing(
  t: PushTarget,
  open: { channelId: string | null; threadParentId: string | null },
): boolean {
  if (t.channelId !== open.channelId) return false;
  return t.parentMessageId ? t.parentMessageId === open.threadParentId : true;
}

// The navigator may not be mounted yet on a cold start from a tap; retry briefly.
// ponytail: assumes the channel is in the current workspace; add a workspace switch when the payload carries workspaceId.
export function openTarget(t: PushTarget, attempts = 10) {
  if (!navigationRef.isReady()) {
    if (attempts > 0) setTimeout(() => openTarget(t, attempts - 1), 300);
    return;
  }
  navigationRef.navigate('Channel', { channelId: t.channelId });
  if (t.parentMessageId) {
    navigationRef.navigate('Thread', { channelId: t.channelId, messageId: t.parentMessageId });
  }
}
