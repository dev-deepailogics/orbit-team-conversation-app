import { incomingCallTitle, parseCallChat, resolveLiveKitUrl } from '../src/features/calls/utils';

describe('resolveLiveKitUrl', () => {
  const server = 'http://192.168.1.20:4000';
  it('points loopback hosts at the API server host', () => {
    expect(resolveLiveKitUrl('ws://localhost:7880', server)).toBe('ws://192.168.1.20:7880');
    expect(resolveLiveKitUrl('ws://127.0.0.1:7880/rtc', server)).toBe('ws://192.168.1.20:7880/rtc');
  });
  it('leaves real hosts alone', () => {
    expect(resolveLiveKitUrl('wss://livekit.example.com', server)).toBe('wss://livekit.example.com');
    expect(resolveLiveKitUrl('ws://localhostess.com', server)).toBe('ws://localhostess.com');
  });
  it('keeps the url when the server url is unparseable', () => {
    expect(resolveLiveKitUrl('ws://localhost:7880', '')).toBe('ws://localhost:7880');
  });
});

describe('incomingCallTitle', () => {
  const base = { channelId: 'c', channelName: 'general', callerName: 'Ada', hostUserId: 'u', workspaceId: 'w' };
  it('names the caller for DMs and the channel otherwise', () => {
    expect(incomingCallTitle({ ...base, channelType: 'DIRECT' })).toBe('Incoming call from Ada');
    expect(incomingCallTitle({ ...base, channelType: 'PUBLIC' })).toBe('Ada started a call in #general');
  });
});

describe('parseCallChat', () => {
  it('unwraps web reply payloads', () => {
    const msg = JSON.stringify({ text: 'yes', replyTo: { senderName: 'Ada', text: 'ready?' } });
    expect(parseCallChat(msg)).toEqual({ text: 'yes', replyTo: { senderName: 'Ada', text: 'ready?' } });
  });
  it('treats anything else as plain text', () => {
    expect(parseCallChat('hello')).toEqual({ text: 'hello', replyTo: null });
    expect(parseCallChat('{not json}')).toEqual({ text: '{not json}', replyTo: null });
    expect(parseCallChat('{"a":1}')).toEqual({ text: '{"a":1}', replyTo: null });
  });
});
