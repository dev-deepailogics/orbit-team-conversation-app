'use client';

import React, { useMemo, useState } from 'react';
import { Channel } from '@orbit/types';
import { Search, Hash, Lock, Mask, Link2, Canvas, FileText } from '@/components/ui/icons';
import { Presence } from '../availability/useTeamPresence';
import {
  ModalShell,
  GroupLabel,
  SecondaryButton,
  PrimaryButton,
  Radio,
  PresenceAvatar,
  inputShellClass,
  bareInputClass,
  DANGER,
} from './modalKit';

export interface LinkableItem {
  title: string;
  kind: 'canvas' | 'document';
}

interface LinkConversationModalProps {
  item: LinkableItem;
  channels: Channel[];
  currentUserId?: string;
  presence?: Record<string, Presence>;
  /** Channel (or DM channel) the item is linked to now, if any. */
  linkedChannelId?: string | null;
  onLink: (channelId: string | null) => void;
  onClose: () => void;
}

const isDirect = (c: Channel) => c.type === 'DIRECT' || c.type === 'GROUP_DIRECT';

export const LinkConversationModal: React.FC<LinkConversationModalProps> = ({
  item,
  channels,
  currentUserId,
  presence = {},
  linkedChannelId = null,
  onLink,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(linkedChannelId);

  const dmPeers = (c: Channel) =>
    (c.members || []).map((m: any) => m.user).filter((u: any) => u && u.id !== currentUserId);

  const dmName = (c: Channel) => {
    const peers = dmPeers(c);
    if (peers.length === 0) return 'Notes to self';
    return peers.map((u: any) => u.displayName).join(', ');
  };

  const { conversations, dms } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const open = channels.filter((c) => !c.isArchived);
    const match = (label: string) => !q || label.toLowerCase().includes(q);
    return {
      conversations: open.filter((c) => !isDirect(c) && match(c.name)),
      dms: open.filter((c) => isDirect(c) && match(dmName(c))),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, query, currentUserId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    onLink(selectedId);
    onClose();
  };

  const KindIcon = item.kind === 'canvas' ? Canvas : FileText;

  return (
    <ModalShell
      width={520}
      title="Link to a conversation"
      subtitle="Linked items show up in the conversation for everyone in it."
      onClose={onClose}
      onSubmit={submit}
      footerAlign={linkedChannelId ? 'between' : 'end'}
      footer={
        <>
          {linkedChannelId && (
            <button
              type="button"
              onClick={() => {
                onLink(null);
                onClose();
              }}
              className="h-9 px-3 rounded-[10px] text-sm font-semibold transition hover:bg-[var(--theme-fill-hover)]"
              style={{ color: DANGER }}
            >
              Remove link
            </button>
          )}
          <span className="flex-1" />
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={!selectedId || selectedId === linkedChannelId}>
            <Link2 size={16} />
            Link
          </PrimaryButton>
        </>
      }
    >
      {/* Item being linked */}
      <div className="rounded-xl p-2.5 flex items-center gap-2.5" style={{ backgroundColor: 'var(--theme-bg-surface-hover)' }}>
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--theme-bg-app)', color: 'var(--theme-text-muted)' }}
        >
          <KindIcon size={16} />
        </span>
        <span className="flex flex-col min-w-0">
          <span className="text-sm font-semibold leading-5 truncate" style={{ color: 'var(--theme-text)' }}>
            {item.title || 'Untitled'}
          </span>
          <span className="text-xs leading-4" style={{ color: 'var(--theme-text-muted)' }}>
            {item.kind === 'canvas' ? 'Canvas' : 'Document'}
          </span>
        </span>
      </div>

      <div className={inputShellClass}>
        <Search size={16} style={{ color: 'var(--theme-text-muted)' }} />
        <input
          type="text"
          autoFocus
          placeholder="Search channels and people"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={bareInputClass}
        />
      </div>

      {conversations.length > 0 && (
        <Group label="Channels">
          {conversations.map((c) => (
            <Row
              key={c.id}
              selected={selectedId === c.id}
              onSelect={() => setSelectedId(c.id)}
              leading={
                c.isAnonymous ? <Mask size={18} /> : c.type === 'PRIVATE' ? <Lock size={18} /> : <Hash size={18} />
              }
              label={c.name}
            />
          ))}
        </Group>
      )}

      {dms.length > 0 && (
        <Group label="Direct messages">
          {dms.map((c) => {
            const peer = dmPeers(c)[0];
            return (
              <Row
                key={c.id}
                selected={selectedId === c.id}
                onSelect={() => setSelectedId(c.id)}
                avatar={
                  <PresenceAvatar
                    name={peer?.displayName || dmName(c)}
                    src={peer?.avatarUrl}
                    size={24}
                    presence={peer ? presence[peer.id] : undefined}
                  />
                }
                label={dmName(c)}
              />
            );
          })}
        </Group>
      )}

      {conversations.length === 0 && dms.length === 0 && (
        <p className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
          No channels or people match “{query.trim()}”.
        </p>
      )}
    </ModalShell>
  );
};

const Group: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-2">
    <GroupLabel>{label}</GroupLabel>
    <div
      className="rounded-xl border overflow-hidden max-h-[178px] overflow-y-auto"
      style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-app)' }}
    >
      {React.Children.map(children, (child, i) => (
        <>
          {i > 0 && <div className="h-px" style={{ backgroundColor: 'var(--theme-border)' }} />}
          {child}
        </>
      ))}
    </div>
  </div>
);

const Row: React.FC<{
  selected: boolean;
  onSelect: () => void;
  leading?: React.ReactNode;
  avatar?: React.ReactNode;
  label: string;
}> = ({ selected, onSelect, leading, avatar, label }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className="w-full h-11 px-3 flex items-center gap-2.5 text-left transition hover:bg-[var(--theme-fill-hover)]"
    style={selected ? { backgroundColor: 'var(--theme-bg-surface)' } : undefined}
  >
    {avatar ?? (
      <span
        className="w-[18px] h-[18px] flex items-center justify-center shrink-0"
        style={{ color: selected ? 'var(--theme-primary-hover)' : 'var(--theme-text-muted)' }}
      >
        {leading}
      </span>
    )}
    <span
      className={`text-sm truncate ${selected ? 'font-semibold' : 'font-medium'}`}
      style={{ color: selected ? 'var(--theme-primary-hover)' : 'var(--theme-text)' }}
    >
      {label}
    </span>
    <span className="flex-1" />
    <Radio checked={selected} />
  </button>
);
