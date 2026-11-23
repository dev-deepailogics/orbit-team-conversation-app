// Unit tests for how a poll is shown to each viewer. No database: toPollView is a pure function.
//   npx tsx --test src/services/pollService.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isRawPoll, pollFallbackContent, pollInputSchema, toPollView } from './pollService.js';

const voter = (id: string) => ({ userId: id, user: { id, displayName: `Name of ${id}`, avatarUrl: null } });
const raw = {
  id: 'poll-1',
  messageId: 'msg-1',
  question: 'Lunch?',
  allowMultiple: true,
  createdAt: new Date(),
  options: [
    { id: 'o1', pollId: 'poll-1', text: 'Pizza', position: 0, votes: [voter('alice'), voter('bob')] },
    { id: 'o2', pollId: 'poll-1', text: 'Sushi', position: 1, votes: [voter('alice')] },
  ],
};

describe('toPollView', () => {
  it('anonymous channels: counts only, nothing that identifies a voter', () => {
    const view = toPollView(raw, 'bob', true);
    assert.deepEqual(view.options.map((o) => o.voteCount), [2, 1]);
    assert.equal(view.voterCount, 2);
    assert.ok(view.options.every((o) => !('voters' in o)));
    const json = JSON.stringify(view);
    for (const leak of ['alice', 'Name of']) assert.ok(!json.includes(leak), `leaked "${leak}"`);
    assert.deepEqual(view.myVotes, ['o1'], 'the viewer still sees their own choice');
  });

  it('normal channels list who voted for each option', () => {
    const view = toPollView(raw, 'carol', false);
    assert.deepEqual(view.options[0].voters?.map((v) => v.id), ['alice', 'bob']);
    assert.deepEqual(view.myVotes, [], 'carol has not voted');
  });

  it('a broadcast carries no "my votes" (it goes to everyone)', () => {
    assert.ok(!('myVotes' in toPollView(raw, null, true)));
    assert.ok(!('myVotes' in toPollView(raw, 'public', false)));
  });

  it('a view is never mistaken for a raw poll (so it is not converted twice)', () => {
    assert.ok(isRawPoll(raw));
    assert.ok(!isRawPoll(toPollView(raw, 'bob', false)));
    assert.ok(!isRawPoll(null));
  });
});

describe('poll input', () => {
  it('trims, and rejects duplicate, empty or too few options', () => {
    assert.deepEqual(pollInputSchema.parse({ question: ' Q ', options: [' a ', 'b'] }), {
      question: 'Q',
      options: ['a', 'b'],
      allowMultiple: false,
    });
    assert.ok(!pollInputSchema.safeParse({ question: 'Q', options: ['a', 'A'] }).success);
    assert.ok(!pollInputSchema.safeParse({ question: 'Q', options: ['a', '  '] }).success);
    assert.ok(!pollInputSchema.safeParse({ question: 'Q', options: ['a'] }).success);
    assert.ok(!pollInputSchema.safeParse({ question: '', options: ['a', 'b'] }).success);
  });

  it('fallback content is plain readable text (it also shows in pushes and previews)', () => {
    assert.equal(pollFallbackContent({ question: 'Q', options: ['a', 'b'], allowMultiple: false }), '📊 Poll: Q\n• a\n• b');
  });
});
