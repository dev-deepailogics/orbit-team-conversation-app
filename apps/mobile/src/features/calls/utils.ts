import type { CallChatLine, IncomingCall } from './types';

// The server hands out NEXT_PUBLIC_LIVEKIT_URL (ws://localhost:7880 in dev), which a phone can't reach:
// point a loopback host at the API server's host instead, where docker-compose publishes LiveKit.
export function resolveLiveKitUrl(url: string, serverUrl: string): string {
  const host = /^https?:\/\/([^:/]+)/.exec(serverUrl)?.[1];
  if (!host) return url;
  return url.replace(/^(wss?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/, `$1${host}`);
}

export function incomingCallTitle(call: IncomingCall): string {
  return call.channelType === 'DIRECT'
    ? `Incoming call from ${call.callerName}`
    : `${call.callerName} started a call in #${call.channelName}`;
}

// Web's in-call chat sends replies as JSON {text, replyTo} (ModernMeetingChat.tsx); everything else is plain text.
export function parseCallChat(message: string): CallChatLine {
  if (message.startsWith('{') && message.endsWith('}')) {
    try {
      const parsed = JSON.parse(message);
      if (typeof parsed?.text === 'string') return { text: parsed.text, replyTo: parsed.replyTo ?? null };
    } catch {}
  }
  return { text: message, replyTo: null };
}
