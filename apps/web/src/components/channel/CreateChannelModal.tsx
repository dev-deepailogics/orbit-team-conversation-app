'use client';

import React, { useMemo, useState } from 'react';
import { Channel } from '@orbit/types';
import { Hash, Lock, Mask, Search } from '@/components/ui/icons';
import { api } from '../../lib/api';
import { useChatStore } from '../../stores/chatStore';
import { Avatar } from '../project/projectViewUtils';
import {
  ModalShell,
  Field,
  SecondaryButton,
  PrimaryButton,
  ErrorNote,
  Radio,
  CheckboxBox,
  PersonChip,
  inputShellClass,
  bareInputClass,
} from './modalKit';

interface CreateChannelModalProps {
  workspaceId: string;
  members: any[];
  currentUserId?: string;
  onClose: () => void;
  onCreated: (channel: Channel) => void;
}

const toChannelName = (raw: string) => raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  workspaceId,
  members,
  currentUserId,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const people = useMemo(
    () => members.map((m) => m?.user).filter((u) => u && u.id !== currentUserId),
    [members, currentUserId],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people
      .filter((u) => !picked.some((p) => p.id === u.id))
      .filter((u) => `${u.displayName} ${u.username} ${u.email || ''}`.toLowerCase().includes(q))
      .slice(0, 5);
  }, [people, picked, query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = toChannelName(name).replace(/^-+|-+$/g, '');
    if (finalName.length < 2) {
      setError('Channel names need at least 2 characters.');
      return;
    }
    const isDuplicate = useChatStore.getState().channels.some(
      (c) => c.workspaceId === workspaceId && c.type !== 'DIRECT' && c.name.toLowerCase() === finalName.toLowerCase()
    );
    if (isDuplicate) {
      setError(`A channel named "#${finalName}" already exists in this workspace`);
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/api/channels/workspaces/${workspaceId}/channels`, {
        name: finalName,
        topic,
        type: isPrivate ? 'PRIVATE' : 'PUBLIC',
        isAnonymous,
      });
      if (picked.length) {
        try {
          await api.post(`/api/channels/${res.data.id}/members`, { userIds: picked.map((p) => p.id) });
        } catch (err) {
          console.error('Channel created, but adding members failed', err);
        }
      }
      onCreated(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create channel');
      setIsSubmitting(false);
    }
  };

  const visibility = [
    {
      key: 'public',
      selected: !isPrivate,
      Icon: Hash,
      title: 'Public',
      body: 'Anyone in the workspace can find and join this channel.',
      onSelect: () => setIsPrivate(false),
    },
    {
      key: 'private',
      selected: isPrivate,
      Icon: Lock,
      title: 'Private',
      body: 'Only people you invite can see and join.',
      onSelect: () => setIsPrivate(true),
    },
  ];

  return (
    <ModalShell
      width={520}
      title="Create channel"
      subtitle="Channels are where your team talks about a topic."
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={isSubmitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton disabled={isSubmitting || toChannelName(name).length < 2}>
            {isSubmitting ? 'Creating…' : 'Create channel'}
          </PrimaryButton>
        </>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}

      <Field label="Channel name" help="Channel names are lowercase and have no spaces.">
        <div className={inputShellClass}>
          <Hash size={16} style={{ color: 'var(--theme-text-muted)' }} />
          <input
            type="text"
            required
            autoFocus
            maxLength={50}
            placeholder="e.g. design-reviews"
            value={name}
            onChange={(e) => setName(toChannelName(e.target.value))}
            className={bareInputClass}
          />
        </div>
      </Field>

      <Field label="Description" optional>
        <input
          type="text"
          placeholder="What is this channel about?"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full h-10 px-3 rounded-[10px] border text-sm bg-[var(--theme-bg-app)] border-[var(--theme-border)] text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] outline-none transition-[border-color,box-shadow] focus:border-[var(--theme-primary)] focus:shadow-[0_0_0_0.5px_var(--theme-primary)]"
        />
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text)' }}>
          Visibility
        </span>
        {visibility.map((v) => (
          <OptionCard
            key={v.key}
            selected={v.selected}
            onSelect={v.onSelect}
            icon={<v.Icon size={16} />}
            title={v.title}
            body={v.body}
            control={<Radio checked={v.selected} />}
          />
        ))}
        <OptionCard
          selected={isAnonymous}
          onSelect={() => setIsAnonymous((a) => !a)}
          icon={<Mask size={16} />}
          title="Anonymous posting"
          body="Members post under a character name. Real names stay hidden."
          control={<CheckboxBox checked={isAnonymous} />}
        />
      </div>

      <Field label="Add members" optional>
        <div className="flex flex-col gap-2">
          <div className="relative">
            <div className={inputShellClass}>
              <Search size={16} style={{ color: 'var(--theme-text-muted)' }} />
              <input
                type="text"
                placeholder="Search for people"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (matches[0]) {
                      setPicked((p) => [...p, matches[0]]);
                      setQuery('');
                    }
                  }
                }}
                className={bareInputClass}
              />
            </div>
            {matches.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-1 z-[60] rounded-xl border p-1 shadow-xl"
                style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
              >
                {matches.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setPicked((p) => [...p, u]);
                      setQuery('');
                    }}
                    className="w-full h-10 px-2.5 rounded-lg flex items-center gap-2.5 text-left transition hover:bg-[var(--theme-fill-hover)]"
                  >
                    <Avatar name={u.displayName} src={u.avatarUrl} size={24} />
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>
                      {u.displayName}
                    </span>
                    <span className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                      @{u.username}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {picked.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {picked.map((u) => (
                <PersonChip
                  key={u.id}
                  name={u.displayName}
                  avatarUrl={u.avatarUrl}
                  onRemove={() => setPicked((p) => p.filter((x) => x.id !== u.id))}
                />
              ))}
            </div>
          )}
        </div>
      </Field>
    </ModalShell>
  );
};

const OptionCard: React.FC<{
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
  control: React.ReactNode;
}> = ({ selected, onSelect, icon, title, body, control }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className="w-full p-3 rounded-xl flex items-center gap-3 text-left transition"
    style={{
      backgroundColor: selected ? 'var(--theme-bg-surface)' : 'var(--theme-bg-app)',
      boxShadow: selected ? 'inset 0 0 0 1.5px var(--theme-primary)' : 'inset 0 0 0 1px var(--theme-border)',
    }}
  >
    <span
      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
      style={{
        backgroundColor: selected ? 'var(--theme-selected)' : 'var(--theme-bg-surface-hover)',
        color: selected ? 'var(--theme-accent)' : 'var(--theme-text-muted)',
      }}
    >
      {icon}
    </span>
    <span className="flex flex-col gap-0.5 min-w-0">
      <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
        {title}
      </span>
      <span className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
        {body}
      </span>
    </span>
    <span className="flex-1" />
    {control}
  </button>
);
