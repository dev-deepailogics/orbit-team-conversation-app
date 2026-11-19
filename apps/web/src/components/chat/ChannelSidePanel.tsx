'use client';

import React, { useEffect, useState } from 'react';
import { Channel, Message, UserProfile } from '@orbit/types';
import { X, Pin, Canvas, FileText, Mail, AtSign, Check, Clock, PhoneCall } from '@/components/ui/icons';
import { api } from '../../lib/api';
import { Presence, PRESENCE_STYLE } from '../availability/useTeamPresence';
import { Avatar, tint } from '../project/projectViewUtils';

export const PRESENCE_COLOR: Record<Presence, string> = {
  working: '#1F9D63',
  break: '#D97706',
  offline: 'var(--theme-text-muted)',
};

/** Avatar with the Figma status badge (white ring + coloured dot) at the bottom-right. */
export const PresenceAvatar: React.FC<{
  name: string;
  src?: string | null;
  size: number;
  presence?: Presence;
  dot?: number;
}> = ({ name, src, size, presence, dot = Math.round(size * 0.36) }) => (
  <span className="relative shrink-0" style={{ width: size, height: size }}>
    <Avatar name={name} src={src} size={size} />
    {presence && (
      <span
        className="absolute rounded-full flex items-center justify-center"
        style={{
          width: dot + 2,
          height: dot + 2,
          left: size - dot + 1,
          top: size - dot + 1,
          backgroundColor: 'var(--theme-bg-app)',
        }}
        title={PRESENCE_STYLE[presence].label}
      >
        <span
          className="rounded-full"
          style={{
            width: dot - 2,
            height: dot - 2,
            backgroundColor: presence === 'offline' ? 'transparent' : PRESENCE_COLOR[presence],
            border: presence === 'offline' ? `1.5px solid ${PRESENCE_COLOR.offline}` : undefined,
          }}
        />
      </span>
    )}
  </span>
);

const SectionHead: React.FC<{ label: string; right?: React.ReactNode }> = ({ label, right }) => (
  <div className="flex items-center justify-between px-4 pt-4 pb-1.5">
    <span className="text-[11px] font-bold tracking-[0.6px]" style={{ color: 'var(--theme-text-muted)' }}>
      {label}
    </span>
    {right}
  </div>
);

const LinkCard: React.FC<{ icon: React.ReactNode; label: string; onClick?: () => void; href?: string }> = ({
  icon,
  label,
  onClick,
  href,
}) => {
  const cls = 'w-full flex items-center gap-2 p-[10px] rounded-[10px] border text-left transition hover:brightness-[0.98]';
  const style: React.CSSProperties = {
    backgroundColor: 'var(--theme-bg-surface)',
    borderColor: 'color-mix(in srgb, var(--theme-primary) 40%, transparent)',
    color: 'var(--theme-primary-hover)',
  };
  const body = (
    <>
      {icon}
      <span className="text-[13px] font-semibold truncate">{label}</span>
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls} style={style}>
      {body}
    </a>
  ) : (
    <button onClick={onClick} className={cls} style={style}>
      {body}
    </button>
  );
};

interface ChannelSidePanelProps {
  channel: Channel;
  messages: Message[];
  currentUser: UserProfile | null;
  members?: any[];
  presence: Record<string, Presence>;
  dmPeer?: UserProfile;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenWhiteboard: () => void;
  onJumpToMessage: (msg: Message) => void;
  onHuddleUser?: (user: UserProfile) => void;
}

export const ChannelSidePanel: React.FC<ChannelSidePanelProps> = ({
  channel,
  messages,
  currentUser,
  members,
  presence,
  dmPeer,
  onClose,
  onOpenSettings,
  onOpenWhiteboard,
  onJumpToMessage,
  onHuddleUser,
}) => {
  const isDM = channel.type === 'DIRECT';
  const [canvases, setCanvases] = useState<{ id: string; title?: string | null }[]>([]);

  useEffect(() => {
    let alive = true;
    api
      .get('/api/canvases', { params: { workspaceId: channel.workspaceId, channelId: channel.id } })
      .then((res) => alive && setCanvases(Array.isArray(res.data) ? res.data : []))
      .catch(() => alive && setCanvases([]));
    return () => {
      alive = false;
    };
  }, [channel.id, channel.workspaceId]);

  const pinned = messages.filter((m) => m.isPinned && !m.isDeleted);
  const sharedFiles = messages.flatMap((m) => (m.isDeleted ? [] : m.attachments || []));

  const people: UserProfile[] = (
    channel.members?.length ? channel.members.map((m) => m.user) : (members || []).map((m: any) => m.user)
  ).filter(Boolean) as UserProfile[];

  const fileHref = (url: string) =>
    url.startsWith('http')
      ? url
      : `${(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000').replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;

  const linkedSection = (title: string) => (
    <>
      <SectionHead label={title} />
      <div className="px-4 flex flex-col gap-1.5">
        {canvases.map((c) => (
          <LinkCard key={c.id} icon={<Canvas size={14} />} label={c.title || 'Untitled canvas'} onClick={onOpenWhiteboard} />
        ))}
        {isDM &&
          sharedFiles.slice(0, 6).map((f) => (
            <LinkCard key={f.id} icon={<FileText size={14} />} label={f.fileName} href={fileHref(f.fileUrl)} />
          ))}
        {canvases.length === 0 && (!isDM || sharedFiles.length === 0) && (
          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            Nothing linked yet.
          </p>
        )}
      </div>
    </>
  );

  return (
    <aside
      className="absolute lg:static right-0 top-0 z-30 flex flex-col w-[300px] max-w-full shrink-0 h-full border-l overflow-y-auto pb-4 shadow-2xl lg:shadow-none"
      style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
    >
      <div
        className="h-[52px] shrink-0 px-4 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--theme-border)' }}
      >
        <span className="text-[15px] font-bold" style={{ color: 'var(--theme-text)' }}>
          {isDM ? 'Profile' : 'Channel details'}
        </span>
        <button
          onClick={onClose}
          title="Close"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <X size={16} />
        </button>
      </div>

      {isDM ? (
        <>
          {(() => {
            const peer = dmPeer ?? currentUser;
            if (!peer) return null;
            const p = presence[peer.id] || 'offline';
            const pc = PRESENCE_COLOR[p];
            return (
              <>
                <div className="p-5 flex flex-col items-center gap-1.5">
                  <PresenceAvatar name={peer.displayName} src={peer.avatarUrl} size={72} presence={p} dot={18} />
                  <span className="text-[17px] font-bold" style={{ color: 'var(--theme-text)' }}>
                    {peer.displayName}
                  </span>
                  <span className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
                    {peer.customStatusText || `@${peer.username}`}
                  </span>
                  <span
                    className="h-[22px] px-[9px] rounded-[11px] flex items-center gap-[5px] text-[11px] font-semibold"
                    style={{ backgroundColor: tint(p === 'offline' ? 'var(--theme-text-muted)' : pc, 14), color: pc }}
                  >
                    {p === 'working' ? <Check size={12} /> : <Clock size={12} />}
                    {PRESENCE_STYLE[p].label}
                  </span>
                </div>
                <SectionHead label="CONTACT" />
                <a
                  href={`mailto:${peer.email}`}
                  className="h-[34px] px-4 flex items-center gap-2.5 text-[13px] hover:underline"
                  style={{ color: 'var(--theme-text)' }}
                >
                  <Mail size={16} style={{ color: 'var(--theme-text-muted)' }} />
                  <span className="truncate">{peer.email}</span>
                </a>
                <div className="h-[34px] px-4 flex items-center gap-2.5 text-[13px]" style={{ color: 'var(--theme-text)' }}>
                  <AtSign size={16} style={{ color: 'var(--theme-text-muted)' }} />
                  <span className="truncate">{peer.username}</span>
                </div>
                {dmPeer && onHuddleUser && (
                  <button
                    onClick={() => onHuddleUser(dmPeer)}
                    className="h-[34px] px-4 flex items-center gap-2.5 text-[13px] text-left hover:underline"
                    style={{ color: 'var(--theme-text)' }}
                  >
                    <PhoneCall size={16} style={{ color: 'var(--theme-text-muted)' }} />
                    Start a call
                  </button>
                )}
                {linkedSection('SHARED IN THIS CHAT')}
              </>
            );
          })()}
        </>
      ) : (
        <>
          <SectionHead
            label="ABOUT"
            right={
              <button onClick={onOpenSettings} className="text-xs font-semibold hover:underline" style={{ color: 'var(--theme-primary-hover)' }}>
                Edit
              </button>
            }
          />
          <div className="px-4 flex flex-col gap-1">
            <p className="text-[13px] leading-[19px]" style={{ color: 'var(--theme-text)' }}>
              {channel.description || channel.topic || 'No description yet.'}
            </p>
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {channel.isAnonymous ? 'Anonymous channel' : channel.type === 'PRIVATE' ? 'Private channel' : 'Public channel'} · Created{' '}
              {new Date(channel.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </p>
          </div>

          {!channel.isAnonymous && (
            <>
              <SectionHead
                label={`MEMBERS · ${people.length}`}
                right={
                  <button onClick={onOpenSettings} className="text-xs font-semibold hover:underline" style={{ color: 'var(--theme-primary-hover)' }}>
                    View all
                  </button>
                }
              />
              {people.slice(0, 6).map((u) => (
                <div key={u.id} className="h-10 px-4 flex items-center gap-2.5">
                  <PresenceAvatar name={u.displayName} src={u.avatarUrl} size={28} presence={presence[u.id] || 'offline'} dot={10} />
                  <span className="flex-1 min-w-0 truncate text-[13px] font-medium" style={{ color: 'var(--theme-text)' }}>
                    {u.displayName}
                    {u.id === currentUser?.id && <span style={{ color: 'var(--theme-text-muted)' }}> (you)</span>}
                  </span>
                  {u.id === channel.createdById && (
                    <span
                      className="h-[22px] px-[9px] rounded-[11px] flex items-center text-[11px] font-semibold"
                      style={{ backgroundColor: 'var(--theme-bg-surface)', color: 'var(--theme-primary-hover)' }}
                    >
                      Owner
                    </span>
                  )}
                </div>
              ))}
            </>
          )}

          <SectionHead
            label="PINNED"
            right={
              <span className="text-xs font-semibold" style={{ color: 'var(--theme-primary-hover)' }}>
                {pinned.length}
              </span>
            }
          />
          <div className="px-4 flex flex-col gap-1.5">
            {pinned.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                No pinned messages.
              </p>
            )}
            {pinned.slice(0, 5).map((m) => (
              <button
                key={m.id}
                onClick={() => onJumpToMessage(m)}
                className="w-full flex items-center gap-2 p-[10px] rounded-[10px] border text-left transition hover:brightness-[0.98]"
                style={{ backgroundColor: 'var(--theme-bg-surface)', borderColor: 'var(--theme-border)' }}
              >
                <Pin size={14} style={{ color: 'var(--theme-text-muted)' }} />
                <span className="text-[13px] font-medium truncate" style={{ color: 'var(--theme-text)' }}>
                  {m.content.replace(/[*_`>#~[\]]/g, '').split('\n')[0] || 'Attachment'}
                </span>
              </button>
            ))}
          </div>

          {linkedSection('LINKED CANVASES & DOCS')}
        </>
      )}
    </aside>
  );
};
