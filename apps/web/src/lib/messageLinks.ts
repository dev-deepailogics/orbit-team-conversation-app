// In-app link to one message: message://<channelId>/<messageId>[/<parentMessageId>] (written by the server's
// mentionService). Any message view can open one by dispatching OPEN_MESSAGE_EVENT; the app page handles it, so the
// renderers don't need handlers threaded through every component that shows messages.

export interface MessageTarget {
  channelId: string;
  messageId: string;
  /** Set when the message is a thread reply. */
  parentMessageId?: string;
}

export const OPEN_MESSAGE_EVENT = 'orbit:open-message';

const MESSAGE_LINK = /message:\/\/([\w-]+)\/([\w-]+)(?:\/([\w-]+))?/;

/** The first message link in `text` (an href or a whole message's markdown), or null. */
export function parseMessageLink(text: string | null | undefined): MessageTarget | null {
  const m = text?.match(MESSAGE_LINK);
  return m ? { channelId: m[1], messageId: m[2], parentMessageId: m[3] || undefined } : null;
}

export function openMessage(target: MessageTarget) {
  window.dispatchEvent(new CustomEvent<MessageTarget>(OPEN_MESSAGE_EVENT, { detail: target }));
}
