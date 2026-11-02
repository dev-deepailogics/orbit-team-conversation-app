import { isViewing, parseTarget } from '../src/features/notifications/utils';

jest.mock('@/navigation/ref', () => ({ navigationRef: { isReady: () => false } }));

test('parseTarget needs a channelId and treats empty parent as none', () => {
  expect(parseTarget(undefined)).toBeNull();
  expect(parseTarget({ channelId: 'c1', parentMessageId: '' })).toEqual({ channelId: 'c1', parentMessageId: undefined });
  expect(parseTarget({ channelId: 'c1', parentMessageId: 'm1' })?.parentMessageId).toBe('m1');
});

test('isViewing: channel messages hide when channel open; thread replies only when that thread is open', () => {
  const open = { channelId: 'c1', threadParentId: 'm1' };
  expect(isViewing({ channelId: 'c1' }, open)).toBe(true);
  expect(isViewing({ channelId: 'c2' }, open)).toBe(false);
  expect(isViewing({ channelId: 'c1', parentMessageId: 'm1' }, open)).toBe(true);
  expect(isViewing({ channelId: 'c1', parentMessageId: 'm2' }, open)).toBe(false);
});
