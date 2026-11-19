'use client';

import React, { useState, useEffect } from 'react';
import { Users, Globe, Lock, Mask, Link2, Check, Copy, Loader2, Trash2, HardDrive, Canvas, Pencil } from '@/components/ui/icons';
import { Channel, UserProfile } from '@orbit/types';
import { api } from '../../lib/api';
import { Presence } from '../availability/useTeamPresence';
import {
  ModalShell,
  PresenceAvatar,
  PrimaryButton,
  SecondaryButton,
  ErrorNote,
  DANGER,
  inputClass,
} from './modalKit';

interface ChannelDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel | null;
  currentUser: UserProfile | null;
  presence?: Record<string, Presence>;
  onOpenAddMembers?: () => void;
  onOpenWhiteboard?: () => void;
  onOpenStorage?: () => void;
  onChannelUpdated?: (updated: Channel) => void;
}

type Tab = 'members' | 'about';

export const ChannelDetailsModal: React.FC<ChannelDetailsModalProps> = ({
  isOpen,
  onClose,
  channel,
  currentUser,
  presence = {},
  onOpenAddMembers,
  onOpenWhiteboard,
  onOpenStorage,
  onChannelUpdated,
}) => {
  const [details, setDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('members');
  const [topic, setTopic] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [copied, setCopied] = useState<'link' | 'id' | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!isOpen || !channel) {
      setDetails(null);
      setTab('members');
      setDeleteConfirmText('');
      setDeleteError('');
      setSaveError('');
      return;
    }
    setIsLoading(true);
    setTopic(channel.topic || '');
    api
      .get(`/api/channels/${channel.id}`)
      .then((res) => {
        setDetails(res.data);
        setTopic(res.data.topic || '');
      })
      .catch((err) => console.error('Failed to load channel details', err))
      .finally(() => setIsLoading(false));
  }, [isOpen, channel]);

  if (!isOpen || !channel) return null;

  const isDirect = channel.type === 'DIRECT';
  const isAnon = !!channel.isAnonymous;
  const isPrivate = channel.type === 'PRIVATE';
  const members: any[] = details?.members || [];
  const topicChanged = (details?.topic || '') !== topic;
  // Server rejects deleting these defaults; permission (creator / workspace admin) is also enforced there.
  const canDelete = (channel.type === 'PUBLIC' || channel.type === 'PRIVATE') && !['general', 'activity'].includes(channel.name);

  const copy = (what: 'link' | 'id') => {
    navigator.clipboard.writeText(
      what === 'link' ? `${window.location.origin}/app?channelId=${channel.id}` : channel.id,
    );
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const save = async () => {
    if (!topicChanged) return onClose();
    setIsSaving(true);
    setSaveError('');
    try {
      const res = await api.patch(`/api/channels/${channel.id}`, { topic });
      setDetails((prev: any) => ({ ...prev, topic: res.data.topic }));
      onChannelUpdated?.(res.data);
      onClose();
    } catch (err: any) {
      setSaveError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // The page's channel:deleted socket listener removes the channel and switches away from it.
  const deleteChannel = async () => {
    if (isDeleting || deleteConfirmText !== channel.name) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/api/channels/${channel.id}`);
      onClose();
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || 'Failed to delete channel');
    } finally {
      setIsDeleting(false);
    }
  };

  const title = isDirect ? 'Conversation details' : `Channel settings · # ${channel.name}`;

  return (
    <ModalShell
      width={560}
      title={title}
      subtitle={isDirect ? 'People and details for this conversation.' : 'Manage details, privacy and who is in this channel.'}
      onClose={onClose}
      footerAlign="between"
      footer={
        <>
          <SecondaryButton onClick={() => copy('link')}>
            {copied === 'link' ? <Check size={16} /> : <Link2 size={16} />}
            {copied === 'link' ? 'Link copied' : 'Copy link'}
          </SecondaryButton>
          <span className="flex-1" />
          <PrimaryButton type="button" onClick={save} disabled={isSaving}>
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            {topicChanged ? 'Save changes' : 'Done'}
          </PrimaryButton>
        </>
      }
    >
      {/* Tabs */}
      <div className="flex gap-5 h-10 border-b shrink-0" style={{ borderColor: 'var(--theme-border)' }}>
        {(['members', 'about'] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex flex-col h-10 items-center"
            >
              <span
                className={`h-[38px] px-0.5 flex items-center text-sm ${active ? 'font-semibold' : 'font-medium'}`}
                style={{ color: active ? 'var(--theme-primary-hover)' : 'var(--theme-text-muted)' }}
              >
                {t === 'members' ? 'Members' : 'About'}
              </span>
              <span className="h-0.5 w-full" style={{ backgroundColor: active ? 'var(--theme-primary)' : 'transparent' }} />
            </button>
          );
        })}
      </div>

      {saveError && <ErrorNote>{saveError}</ErrorNote>}

      {isLoading ? (
        <div className="py-14 flex flex-col items-center gap-2 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          <Loader2 size={24} className="animate-spin" />
          Loading channel details…
        </div>
      ) : tab === 'members' ? (
        <>
          {!isDirect && onOpenAddMembers && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAddMembers();
              }}
              className="h-10 w-full px-3 rounded-[10px] border flex items-center gap-2 text-left transition hover:bg-[var(--theme-fill-hover)]"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <Users size={16} style={{ color: 'var(--theme-text-muted)' }} />
              <span className="flex-1 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                Add people by name or email
              </span>
              <span
                className="h-[30px] px-4 rounded-[15px] flex items-center text-[13px] font-semibold"
                style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
              >
                Add
              </span>
            </button>
          )}

          {!isDirect && (
            <div
              className="rounded-[10px] border p-3 flex items-center gap-2.5"
              style={{ backgroundColor: 'var(--theme-bg-surface)', borderColor: 'var(--theme-border)' }}
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--theme-bg-app)', color: 'var(--theme-text-muted)' }}
              >
                {isAnon ? <Mask size={16} /> : isPrivate ? <Lock size={16} /> : <Globe size={16} />}
              </span>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
                  {isAnon ? 'Anonymous channel' : isPrivate ? 'Private channel' : 'Public channel'}
                </span>
                <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  {isAnon
                    ? 'Members post under a character name'
                    : isPrivate
                      ? 'Only invited members can see and join'
                      : 'Anyone in the workspace can find and join'}
                </span>
              </span>
            </div>
          )}

          <p className="text-[11px] font-bold tracking-[0.6px]" style={{ color: 'var(--theme-text-muted)' }}>
            {members.length} {members.length === 1 ? 'MEMBER' : 'MEMBERS'}
          </p>

          <div className="flex flex-col -mt-2">
            {members.map((m) => {
              const u = m.user || {};
              const isSelf = isAnon ? !!m.isSelf : u.id === currentUser?.id;
              const name = isAnon ? m.anonName || 'Anonymous member' : u.displayName || u.username || 'Member';
              const isOwner = !isAnon && details?.createdById === u.id;
              const sub = isAnon
                ? isSelf
                  ? 'Your identity is hidden from others'
                  : 'Identity hidden'
                : isOwner
                  ? 'Channel owner'
                  : u.email || `@${u.username || 'user'}`;
              return (
                <div key={m.id || u.id} className="h-12 px-1.5 flex items-center gap-2.5">
                  {isAnon ? (
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base"
                      style={{ backgroundColor: `color-mix(in srgb, #D97706 14%, transparent)` }}
                    >
                      {m.anonEmoji || <Mask size={16} style={{ color: '#D97706' }} />}
                    </span>
                  ) : (
                    <PresenceAvatar name={name} src={u.avatarUrl} size={32} presence={presence[u.id]} />
                  )}
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text)' }}>
                      {name}
                      {isSelf && ' (you)'}
                    </span>
                    <span className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                      {sub}
                    </span>
                  </span>
                  {!isAnon && (
                    <span
                      className="h-[30px] px-2.5 rounded-lg border flex items-center text-xs font-semibold shrink-0"
                      style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
                    >
                      {u.systemRole === 'SUPER_ADMIN' ? 'Admin' : isOwner ? 'Owner' : 'Member'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--theme-text)' }}>
              <Pencil size={13} style={{ color: 'var(--theme-text-muted)' }} />
              Topic
            </span>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              maxLength={250}
              placeholder="Add a topic so people know what this channel is for"
              className={`${inputClass} h-auto py-2.5 resize-none`}
            />
          </div>

          <div
            className="rounded-[10px] border divide-y text-[13px]"
            style={{ borderColor: 'var(--theme-border)', ['--tw-divide-opacity' as string]: 1 }}
          >
            {[
              ['Created by', details?.creator?.displayName || details?.creator?.username || '—'],
              [
                'Created',
                new Date(channel.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
              ],
              ['Messages', String(details?._count?.messages ?? 0)],
              ['Files', String(details?._count?.attachments ?? 0)],
            ].map(([k, v]) => (
              <div key={k} className="h-10 px-3 flex items-center justify-between" style={{ borderColor: 'var(--theme-border)' }}>
                <span style={{ color: 'var(--theme-text-muted)' }}>{k}</span>
                <span className="font-medium" style={{ color: 'var(--theme-text)' }}>
                  {v}
                </span>
              </div>
            ))}
            <div className="h-10 px-3 flex items-center justify-between gap-3" style={{ borderColor: 'var(--theme-border)' }}>
              <span style={{ color: 'var(--theme-text-muted)' }}>Channel ID</span>
              <button
                type="button"
                onClick={() => copy('id')}
                className="flex items-center gap-1.5 min-w-0 font-mono text-xs hover:opacity-80"
                style={{ color: 'var(--theme-text)' }}
              >
                <span className="truncate max-w-[220px]">{channel.id}</span>
                {copied === 'id' ? (
                  <Check size={12} style={{ color: 'var(--theme-primary)' }} />
                ) : (
                  <Copy size={12} style={{ color: 'var(--theme-text-muted)' }} />
                )}
              </button>
            </div>
          </div>

          {(onOpenStorage || onOpenWhiteboard) && (
            <div className="flex gap-2">
              {onOpenStorage && (
                <SecondaryButton
                  className="flex-1"
                  onClick={() => {
                    onClose();
                    onOpenStorage();
                  }}
                >
                  <HardDrive size={16} />
                  Files & storage
                </SecondaryButton>
              )}
              {onOpenWhiteboard && (
                <SecondaryButton
                  className="flex-1"
                  onClick={() => {
                    onClose();
                    onOpenWhiteboard();
                  }}
                >
                  <Canvas size={16} />
                  Whiteboard
                </SecondaryButton>
              )}
            </div>
          )}

          {canDelete && (
            <div
              className="rounded-[10px] border p-3 flex flex-col gap-2"
              style={{
                borderColor: `color-mix(in srgb, ${DANGER} 35%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${DANGER} 6%, transparent)`,
              }}
            >
              <span className="text-[13px] font-semibold" style={{ color: DANGER }}>
                Delete channel
              </span>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text)' }}>
                This permanently deletes <b>#{channel.name}</b> with all its messages and files. Type{' '}
                <span className="font-mono font-semibold">{channel.name}</span> to confirm.
              </p>
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && deleteChannel()}
                placeholder={channel.name}
                autoComplete="off"
                className={inputClass}
              />
              {deleteError && <ErrorNote>{deleteError}</ErrorNote>}
              <button
                type="button"
                onClick={deleteChannel}
                disabled={isDeleting || deleteConfirmText !== channel.name}
                className="h-9 rounded-[10px] flex items-center justify-center gap-1.5 text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: DANGER }}
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete this channel
              </button>
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
};
