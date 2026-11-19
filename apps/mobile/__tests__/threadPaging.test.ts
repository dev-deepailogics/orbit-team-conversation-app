import type { Message } from '@orbit/types';
import { getThread } from '../src/features/chat/services/chatApi';
import { useChatStore } from '../src/features/chat/store';

jest.mock('../src/features/chat/services/chatApi');
const mockedGetThread = getThread as jest.MockedFunction<typeof getThread>;

const reply = (n: number, parentId = 'p1') =>
  ({ id: `r${n}`, channelId: 'c1', parentMessageId: parentId, content: `reply ${n}`, createdAt: '', updatedAt: '' }) as Message;
const parent = (id = 'p1') => ({ id, channelId: 'c1', content: 'parent', replyCount: 9 }) as Message;
const ids = () => useChatStore.getState().thread.replies.map(r => r.id);

beforeEach(() => {
  mockedGetThread.mockReset();
  useChatStore.getState().reset();
});

test('opening a thread loads only the newest page and remembers where to continue', async () => {
  mockedGetThread.mockResolvedValueOnce({ parent: parent(), replies: [reply(7), reply(8), reply(9)], hasMore: true, nextCursor: 'r7' });
  await useChatStore.getState().openThread('p1');
  expect(mockedGetThread).toHaveBeenCalledWith('p1'); // no cursor: the newest page
  expect(ids()).toEqual(['r7', 'r8', 'r9']);
  expect(useChatStore.getState().thread).toMatchObject({ hasMore: true, nextCursor: 'r7', isLoading: false });
});

test('loadOlderReplies puts the earlier page in front and moves the cursor back', async () => {
  mockedGetThread.mockResolvedValueOnce({ parent: parent(), replies: [reply(7), reply(8), reply(9)], hasMore: true, nextCursor: 'r7' });
  await useChatStore.getState().openThread('p1');

  mockedGetThread.mockResolvedValueOnce({ parent: parent(), replies: [reply(4), reply(5), reply(6)], hasMore: true, nextCursor: 'r4' });
  await useChatStore.getState().loadOlderReplies();
  expect(mockedGetThread).toHaveBeenLastCalledWith('p1', 'r7');
  expect(ids()).toEqual(['r4', 'r5', 'r6', 'r7', 'r8', 'r9']);

  mockedGetThread.mockResolvedValueOnce({ parent: parent(), replies: [reply(1), reply(2), reply(3)], hasMore: false, nextCursor: null });
  await useChatStore.getState().loadOlderReplies();
  expect(ids()).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9']);
  expect(useChatStore.getState().thread.hasMore).toBe(false);

  await useChatStore.getState().loadOlderReplies(); // nothing earlier: no request
  expect(mockedGetThread).toHaveBeenCalledTimes(3);
});

test('a reply that arrives live is kept, and not duplicated when the page that contains it loads', async () => {
  mockedGetThread.mockResolvedValueOnce({ parent: parent(), replies: [reply(8), reply(9)], hasMore: true, nextCursor: 'r8' });
  await useChatStore.getState().openThread('p1');
  useChatStore.getState().receiveMessage(reply(10));
  expect(ids()).toEqual(['r8', 'r9', 'r10']);

  mockedGetThread.mockResolvedValueOnce({ parent: parent(), replies: [reply(6), reply(7)], hasMore: false, nextCursor: null });
  await useChatStore.getState().loadOlderReplies();
  expect(ids()).toEqual(['r6', 'r7', 'r8', 'r9', 'r10']);
});

test('does not start a second request while one is in flight', async () => {
  mockedGetThread.mockResolvedValueOnce({ parent: parent(), replies: [reply(9)], hasMore: true, nextCursor: 'r9' });
  await useChatStore.getState().openThread('p1');

  let release!: (page: Awaited<ReturnType<typeof getThread>>) => void;
  mockedGetThread.mockReturnValueOnce(new Promise(r => (release = r)));
  const first = useChatStore.getState().loadOlderReplies();
  await useChatStore.getState().loadOlderReplies(); // e.g. scroll fires again
  expect(mockedGetThread).toHaveBeenCalledTimes(2); // the open + one older page, not two
  release({ parent: parent(), replies: [reply(8)], hasMore: false, nextCursor: null });
  await first;
  expect(ids()).toEqual(['r8', 'r9']);
});

test('earlier replies fetched for a thread that was closed meanwhile are dropped', async () => {
  mockedGetThread.mockResolvedValueOnce({ parent: parent(), replies: [reply(9)], hasMore: true, nextCursor: 'r9' });
  await useChatStore.getState().openThread('p1');

  let release!: (page: Awaited<ReturnType<typeof getThread>>) => void;
  mockedGetThread.mockReturnValueOnce(new Promise(r => (release = r)));
  const pending = useChatStore.getState().loadOlderReplies();
  useChatStore.getState().closeThread('p1');
  mockedGetThread.mockResolvedValueOnce({ parent: parent('p2'), replies: [reply(1, 'p2')], hasMore: false, nextCursor: null });
  await useChatStore.getState().openThread('p2');

  release({ parent: parent(), replies: [reply(8)], hasMore: false, nextCursor: null });
  await pending;
  expect(ids()).toEqual(['r1']); // only p2's reply: p1's late page didn't leak in
});

test('a failed earlier-page load leaves the replies as they were and can be retried', async () => {
  mockedGetThread.mockResolvedValueOnce({ parent: parent(), replies: [reply(9)], hasMore: true, nextCursor: 'r9' });
  await useChatStore.getState().openThread('p1');

  mockedGetThread.mockRejectedValueOnce(new Error('offline'));
  await useChatStore.getState().loadOlderReplies();
  expect(ids()).toEqual(['r9']);
  expect(useChatStore.getState().thread).toMatchObject({ hasMore: true, isLoadingOlder: false });

  mockedGetThread.mockResolvedValueOnce({ parent: parent(), replies: [reply(8)], hasMore: false, nextCursor: null });
  await useChatStore.getState().loadOlderReplies();
  expect(ids()).toEqual(['r8', 'r9']);
});
