'use client';

import React, { useState } from 'react';
import { POLL_LIMITS, type Message } from '@orbit/types';
import { BarChart3, Plus, X } from '@/components/ui/icons';
import { api } from '@/lib/api';
import {
  CheckboxBox,
  ErrorNote,
  Field,
  inputClass,
  ModalShell,
  PrimaryButton,
  SecondaryButton,
} from '../channel/modalKit';

/** Same rules the server enforces, so the form says what's wrong before sending. */
function validate(question: string, options: string[]): string | null {
  if (!question) return 'Add a question.';
  if (options.length < POLL_LIMITS.minOptions) return `Add at least ${POLL_LIMITS.minOptions} options.`;
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return 'Each option must be different.';
  return null;
}

export const CreatePollModal: React.FC<{
  channelId: string;
  isAnonymous?: boolean;
  onClose: () => void;
  onCreated: (message: Message) => void;
}> = ({ channelId, isAnonymous = false, onClose, onCreated }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOption = (index: number, value: string) => setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  const removeOption = (index: number) => setOptions((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const trimmedQuestion = question.trim();
    const filled = options.map((o) => o.trim()).filter(Boolean);
    const problem = validate(trimmedQuestion, filled);
    if (problem) return setError(problem);

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<Message>(`/api/channels/${channelId}/messages`, {
        poll: { question: trimmedQuestion, options: filled, allowMultiple },
      });
      onCreated(res.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not create the poll. Try again.');
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      width={520}
      title="Create poll"
      subtitle={
        isAnonymous
          ? 'This channel is anonymous: everyone sees the results, but never who voted.'
          : 'Everyone in the channel can vote and see the results.'
      }
      icon={<BarChart3 size={20} className="mt-0.5" style={{ color: 'var(--theme-primary)' }} />}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={submitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton disabled={submitting}>{submitting ? 'Posting…' : 'Post poll'}</PrimaryButton>
        </>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}

      <Field label="Question">
        <input
          autoFocus
          value={question}
          maxLength={POLL_LIMITS.questionLength}
          placeholder="What do you want to ask?"
          onChange={(e) => setQuestion(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Options">
        <div className="flex flex-col gap-2">
          {options.map((option, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={option}
                maxLength={POLL_LIMITS.optionLength}
                placeholder={`Option ${i + 1}`}
                aria-label={`Option ${i + 1}`}
                onChange={(e) => setOption(i, e.target.value)}
                className={inputClass}
              />
              {options.length > POLL_LIMITS.minOptions && (
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  aria-label={`Remove option ${i + 1}`}
                  className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          {options.length < POLL_LIMITS.maxOptions && (
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, ''])}
              className="self-start h-8 px-2 -ml-2 rounded-lg flex items-center gap-1.5 text-sm font-semibold transition hover:bg-[var(--theme-fill-hover)]"
              style={{ color: 'var(--theme-primary)' }}
            >
              <Plus size={15} />
              Add option
            </button>
          )}
        </div>
      </Field>

      <button
        type="button"
        role="checkbox"
        aria-checked={allowMultiple}
        onClick={() => setAllowMultiple((v) => !v)}
        className="flex items-center gap-2.5 text-left"
      >
        <CheckboxBox checked={allowMultiple} />
        <span className="flex flex-col">
          <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
            Allow multiple answers
          </span>
          <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            {allowMultiple ? 'People can pick as many options as they like.' : 'People pick one option.'}
          </span>
        </span>
      </button>
    </ModalShell>
  );
};
