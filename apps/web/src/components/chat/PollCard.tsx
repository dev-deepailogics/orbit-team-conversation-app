'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { MessagePoll, PollVoter } from '@orbit/types';
import { BarChart3 } from '@/components/ui/icons';
import { api } from '@/lib/api';
import { useChatStore } from '@/stores/chatStore';
import { Avatar } from '@/components/project/projectViewUtils';
import { CheckboxBox, DANGER, ModalShell, Radio, SecondaryButton } from '../channel/modalKit';

const MAX_FACES = 3;

const Voters: React.FC<{ voters: PollVoter[] }> = ({ voters }) => (
  <span className="flex -space-x-1.5 shrink-0" title={voters.map((v) => v.displayName).join(', ')}>
    {voters.slice(0, MAX_FACES).map((v) => (
      <Avatar key={v.id} name={v.displayName} src={v.avatarUrl} size={18} ring="var(--theme-bg-surface)" />
    ))}
    {voters.length > MAX_FACES && (
      <span className="pl-2.5 text-[11px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
        +{voters.length - MAX_FACES}
      </span>
    )}
  </span>
);

const votesLabel = (n: number) => (n === 1 ? '1 vote' : `${n} votes`);

/** Who picked each option (normal channels only; anonymous polls never carry voters). Portalled so no message's
 * stacking context can paint over it. */
const PollVotesModal: React.FC<{ poll: MessagePoll; onClose: () => void }> = ({ poll, onClose }) =>
  createPortal(
    <ModalShell
      width={440}
      title="Poll votes"
      subtitle={poll.question}
      onClose={onClose}
      footer={<SecondaryButton onClick={onClose}>Close</SecondaryButton>}
    >
      {poll.options.map((option) => (
        <section key={option.id} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold break-words min-w-0" style={{ color: 'var(--theme-text)' }}>
              {option.text}
            </span>
            <span className="text-xs shrink-0" style={{ color: 'var(--theme-text-muted)' }}>
              {votesLabel(option.voteCount)}
            </span>
          </div>
          {option.voters?.length ? (
            <ul className="flex flex-col gap-1.5">
              {option.voters.map((v) => (
                <li key={v.id} className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={v.displayName} src={v.avatarUrl} size={28} />
                  <span className="text-sm truncate" style={{ color: 'var(--theme-text)' }}>
                    {v.displayName}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              No votes
            </p>
          )}
        </section>
      ))}
    </ModalShell>,
    document.body,
  );

/**
 * A poll inside a message. Results show live; in anonymous channels the server sends counts only, so there are no
 * voters here to show.
 */
export const PollCard: React.FC<{
  messageId: string;
  poll: MessagePoll;
  isAnonymous?: boolean;
}> = ({ messageId, poll, isAnonymous = false }) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVotes, setShowVotes] = useState(false);
  const mine = poll.myVotes ?? [];

  const vote = async (optionId: string) => {
    if (pending) return;
    // One answer: picking another switches to it, picking yours again takes it back. Multiple: each option toggles.
    const next = mine.includes(optionId)
      ? mine.filter((id) => id !== optionId)
      : poll.allowMultiple
        ? [...mine, optionId]
        : [optionId];
    setPending(true);
    setError(null);
    try {
      const res = await api.post<MessagePoll>(`/api/messages/${messageId}/poll/votes`, { optionIds: next });
      useChatStore.getState().applyPollUpdate(messageId, res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not save your vote. Try again.');
    } finally {
      setPending(false);
    }
  };

  const voted = poll.voterCount;
  return (
    <div
      className="mt-1 max-w-[480px] rounded-xl border p-3.5 flex flex-col gap-2.5"
      style={{
        backgroundColor: 'var(--theme-bg-surface)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div className="flex items-start gap-2">
        <BarChart3 size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--theme-primary)' }} />
        <p className="text-sm font-semibold leading-5 break-words" style={{ color: 'var(--theme-text)' }}>
          {poll.question}
        </p>
      </div>

      <div
        role={poll.allowMultiple ? 'group' : 'radiogroup'}
        aria-label={poll.question}
        className="flex flex-col gap-1.5"
      >
        {poll.options.map((option) => {
          const selected = mine.includes(option.id);
          // Bar length = share of the people who voted (with multiple answers the bars can add up to more than full)
          const percent = voted ? Math.round((option.voteCount / voted) * 100) : 0;
          return (
            <button
              key={option.id}
              type="button"
              role={poll.allowMultiple ? 'checkbox' : 'radio'}
              aria-checked={selected}
              disabled={pending}
              onClick={() => vote(option.id)}
              className="relative overflow-hidden rounded-lg border px-3 py-2 text-left transition hover:bg-[var(--theme-fill-hover)] disabled:cursor-wait"
              style={{
                borderColor: selected ? 'var(--theme-primary)' : 'var(--theme-border)',
              }}
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 transition-[width] duration-300"
                style={{
                  width: `${percent}%`,
                  backgroundColor: 'color-mix(in srgb, var(--theme-primary) 14%, transparent)',
                }}
              />
              <span className="relative flex items-center gap-2.5">
                {poll.allowMultiple ? <CheckboxBox checked={selected} /> : <Radio checked={selected} />}
                <span className="flex-1 min-w-0 text-sm break-words" style={{ color: 'var(--theme-text)' }}>
                  {option.text}
                </span>
                {!!option.voters?.length && <Voters voters={option.voters} />}
                <span className="text-xs tabular-nums shrink-0" style={{ color: 'var(--theme-text-muted)' }}>
                  {option.voteCount}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          {voted === 0 ? 'No votes yet' : voted === 1 ? '1 person voted' : `${voted} people voted`}
          {' · '}
          {poll.allowMultiple ? 'Multiple answers allowed' : 'One answer'}
          {isAnonymous && ' · Votes are anonymous'}
        </p>
        {!isAnonymous && voted > 0 && (
          <button
            type="button"
            onClick={() => setShowVotes(true)}
            className="shrink-0 h-7 px-2 -mr-2 rounded-lg text-xs font-semibold transition hover:bg-[var(--theme-fill-hover)]"
            style={{ color: 'var(--theme-primary)' }}
          >
            View votes
          </button>
        )}
      </div>
      {showVotes && !isAnonymous && <PollVotesModal poll={poll} onClose={() => setShowVotes(false)} />}
      {error && (
        <p role="alert" className="text-xs" style={{ color: DANGER }}>
          {error}
        </p>
      )}
    </div>
  );
};
