'use client';

import React, { useMemo, useState } from 'react';
import { UserProfile } from '@orbit/types';
import { Search, Check } from '@/components/ui/icons';
import { Presence } from '../availability/useTeamPresence';
import {
  ModalShell,
  Field,
  GroupLabel,
  SecondaryButton,
  PrimaryButton,
  PersonChip,
  PresenceAvatar,
  presenceLabel,
  inputShellClass,
  bareInputClass,
} from './modalKit';

interface NewDirectMessageModalProps {
  members: any[];
  presence?: Record<string, Presence>;
  currentUserId?: string;
  onClose: () => void;
  /** Opens (or creates) the 1:1 conversation; the DM API takes a single target user. */
  onSelectUser: (user: UserProfile) => void;
}

export const NewDirectMessageModal: React.FC<NewDirectMessageModalProps> = ({
  members,
  presence = {},
  currentUserId,
  onClose,
  onSelectUser,
}) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<UserProfile | null>(null);

  const people: UserProfile[] = useMemo(() => {
    const seen = new Map<string, UserProfile>();
    members.forEach((m) => m?.user && seen.set(m.user.id, m.user));
    return Array.from(seen.values()).sort((a, b) => {
      if (a.id === currentUserId) return 1;
      if (b.id === currentUserId) return -1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [members, currentUserId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((u) => `${u.displayName} ${u.username} ${u.email || ''}`.toLowerCase().includes(q));
  }, [people, query]);

  const start = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selected) return;
    onSelectUser(selected);
    onClose();
  };

  return (
    <ModalShell
      width={520}
      title="New message"
      subtitle="Search for a member to start a conversation."
      onClose={onClose}
      onSubmit={start}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={!selected}>Start conversation</PrimaryButton>
        </>
      }
    >
      <Field label="To" help="Pick one person to start a conversation.">
        <div className="flex flex-col gap-2">
          <div className={inputShellClass}>
            <Search size={16} style={{ color: 'var(--theme-text-muted)' }} />
            <input
              type="text"
              autoFocus
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={bareInputClass}
            />
          </div>
          {selected && (
            <div className="flex items-center">
              <PersonChip name={selected.displayName} avatarUrl={selected.avatarUrl} onRemove={() => setSelected(null)} />
            </div>
          )}
        </div>
      </Field>

      <div className="flex flex-col gap-2">
        <GroupLabel>Members</GroupLabel>
        <div
          className="rounded-xl border overflow-hidden max-h-[264px] overflow-y-auto"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-app)' }}
        >
          {visible.length === 0 && (
            <p className="h-[52px] px-3 flex items-center text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
              No members match “{query.trim()}”.
            </p>
          )}
          {visible.map((u, i) => {
            const isSelected = selected?.id === u.id;
            const p = presence[u.id];
            return (
              <React.Fragment key={u.id}>
                {i > 0 && <div className="h-px" style={{ backgroundColor: 'var(--theme-border)' }} />}
                <button
                  type="button"
                  onClick={() => setSelected(isSelected ? null : u)}
                  onDoubleClick={() => {
                    onSelectUser(u);
                    onClose();
                  }}
                  aria-pressed={isSelected}
                  className="w-full h-[52px] px-3 flex items-center gap-3 text-left transition hover:bg-[var(--theme-fill-hover)]"
                  style={isSelected ? { backgroundColor: 'var(--theme-bg-surface)' } : undefined}
                >
                  <PresenceAvatar name={u.displayName} src={u.avatarUrl} size={32} presence={p} />
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold leading-5 truncate" style={{ color: 'var(--theme-text)' }}>
                      {u.displayName}
                      {u.id === currentUserId && (
                        <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--theme-text-muted)' }}>
                          you
                        </span>
                      )}
                    </span>
                    <span className="text-xs leading-4" style={{ color: 'var(--theme-text-muted)' }}>
                      {presenceLabel(p)}
                    </span>
                  </span>
                  <span className="flex-1" />
                  {isSelected && (
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center bg-[var(--theme-primary)]"
                      style={{ color: 'var(--theme-primary-text)' }}
                    >
                      <Check size={12} />
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
};
