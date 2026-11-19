'use client';

import React, { useMemo, useState } from 'react';
import { ProjectDocument, WorkspaceMember, UserProfile } from '@orbit/types';
import { api } from '../../lib/api';
import { Users, Globe, Link as LinkIcon, Check, Lock } from '@/components/ui/icons';
import { Avatar } from './projectViewUtils';
import {
  MenuItem,
  ModalFrame,
  PermissionButton,
  Popover,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
} from './docsCanvasUi';

interface ShareDocumentModalProps {
  document: ProjectDocument;
  currentUser: UserProfile | null;
  members: WorkspaceMember[];
  isOpen: boolean;
  onClose: () => void;
  onDocumentUpdated: (doc: ProjectDocument) => void;
}

const PERMISSION_LABEL = { EDIT: 'Can edit', VIEW: 'Can view' } as const;

export const ShareDocumentModal: React.FC<ShareDocumentModalProps> = ({
  document: doc,
  currentUser,
  members,
  isOpen,
  onClose,
  onDocumentUpdated,
}) => {
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<'VIEW' | 'EDIT'>('EDIT');
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCreator = currentUser?.id === doc.createdById;
  const sharedUserIds = new Set((doc.shares || []).map((s) => s.userId));

  const availableMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(
      (m) =>
        m.user &&
        m.userId !== doc.createdById &&
        !sharedUserIds.has(m.userId) &&
        (!q ||
          m.user.displayName.toLowerCase().includes(q) ||
          m.user.username.toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, doc.createdById, doc.shares, query]);

  if (!isOpen) return null;

  const run = async (fn: () => Promise<{ data: ProjectDocument }>, failMsg: string) => {
    setIsBusy(true);
    setError(null);
    try {
      const res = await fn();
      onDocumentUpdated(res.data);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || failMsg);
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const setShare = (userId: string, permission: 'VIEW' | 'EDIT') =>
    run(() => api.post(`/api/documents/${doc.id}/shares`, { userId, permission }), 'Failed to share document with member');

  const handleInvite = async () => {
    if (!selectedUserId) return;
    if (await setShare(selectedUserId, selectedPermission)) {
      setSelectedUserId('');
      setQuery('');
    }
  };

  const removeShare = (userId: string) =>
    run(() => api.delete(`/api/documents/${doc.id}/shares/${userId}`), 'Failed to remove member share');

  const patchDoc = (body: Partial<ProjectDocument>) =>
    run(() => api.patch(`/api/documents/${doc.id}`, body), 'Failed to update sharing settings');

  const handleCopyLink = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = doc.isPublicLinkEnabled
      ? `${origin}/share/doc/${doc.shareToken || doc.id}`
      : `${origin}/app?view=docs&docId=${doc.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedUser = members.find((m) => m.userId === selectedUserId)?.user;
  const ownerName = doc.creator?.displayName || doc.creator?.username || 'Owner';

  return (
    <ModalFrame
      width={560}
      title={`Share "${doc.title || 'Untitled Document'}"`}
      subtitle="Choose who can open this document."
      onClose={onClose}
      footerJustify="between"
      footer={
        <>
          <SecondaryButton onClick={handleCopyLink} icon={copied ? <Check size={16} /> : <LinkIcon size={16} />}>
            {copied ? 'Copied' : 'Copy link'}
          </SecondaryButton>
          <span className="flex-1" />
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        </>
      }
    >
      {isCreator && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <label
              className="h-10 px-3 rounded-[10px] flex items-center gap-2 transition"
              style={{
                border: showPicker ? '1.5px solid var(--theme-primary)' : '1px solid var(--theme-border)',
                backgroundColor: 'var(--theme-bg-app)',
                color: 'var(--theme-text-muted)',
              }}
            >
              <Users size={16} />
              <input
                value={selectedUser && !showPicker ? selectedUser.displayName : query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedUserId('');
                  setShowPicker(true);
                }}
                onFocus={() => setShowPicker(true)}
                onBlur={() => setTimeout(() => setShowPicker(false), 120)}
                placeholder="Add people by name"
                className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-[var(--theme-text-muted)]"
                style={{ color: 'var(--theme-text)' }}
              />
            </label>
            {showPicker && (
              <div
                className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-56 overflow-y-auto rounded-xl border p-1.5 shadow-xl"
                style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
              >
                {availableMembers.length === 0 ? (
                  <p className="px-2.5 py-2 text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
                    No matching members
                  </p>
                ) : (
                  availableMembers.map((m) => (
                    <button
                      key={m.userId}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedUserId(m.userId);
                        setQuery('');
                        setShowPicker(false);
                      }}
                      className="w-full h-10 px-2.5 rounded-lg flex items-center gap-2.5 text-left transition hover:bg-[var(--theme-fill-hover)]"
                    >
                      <Avatar name={m.user!.displayName} src={m.user!.avatarUrl} size={24} />
                      <span className="flex-1 truncate text-[13px] font-medium" style={{ color: 'var(--theme-text)' }}>
                        {m.user!.displayName}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                        @{m.user!.username}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <Popover
            width={140}
            trigger={(_, toggle) => <PermissionButton label={PERMISSION_LABEL[selectedPermission]} onClick={toggle} />}
          >
            {(close) =>
              (['EDIT', 'VIEW'] as const).map((p) => (
                <MenuItem
                  key={p}
                  selected={p === selectedPermission}
                  onClick={() => {
                    setSelectedPermission(p);
                    close();
                  }}
                >
                  {PERMISSION_LABEL[p]}
                </MenuItem>
              ))
            }
          </Popover>
          <PrimaryButton onClick={handleInvite} disabled={!selectedUserId || isBusy}>
            Invite
          </PrimaryButton>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <SectionLabel>People with access</SectionLabel>
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--theme-border)' }}>
          <PersonRow
            name={`${ownerName}${isCreator ? ' (you)' : ''}`}
            avatarName={ownerName}
            avatarUrl={doc.creator?.avatarUrl}
            subtitle="Document owner"
            right={
              <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
                Owner
              </span>
            }
          />
          {(doc.shares || []).map((share) => {
            const name = share.user?.displayName || share.user?.username || 'Member';
            return (
              <PersonRow
                key={share.id}
                divider
                name={`${name}${share.userId === currentUser?.id ? ' (you)' : ''}`}
                avatarName={name}
                avatarUrl={share.user?.avatarUrl}
                subtitle={PERMISSION_LABEL[share.permission]}
                right={
                  isCreator ? (
                    <Popover
                      width={160}
                      trigger={(_, toggle) => (
                        <PermissionButton label={PERMISSION_LABEL[share.permission]} onClick={toggle} />
                      )}
                    >
                      {(close) => (
                        <>
                          {(['EDIT', 'VIEW'] as const).map((p) => (
                            <MenuItem
                              key={p}
                              selected={p === share.permission}
                              onClick={() => {
                                close();
                                if (p !== share.permission) setShare(share.userId, p);
                              }}
                            >
                              {PERMISSION_LABEL[p]}
                            </MenuItem>
                          ))}
                          <MenuItem
                            danger
                            onClick={() => {
                              close();
                              removeShare(share.userId);
                            }}
                          >
                            Remove access
                          </MenuItem>
                        </>
                      )}
                    </Popover>
                  ) : (
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
                      {PERMISSION_LABEL[share.permission]}
                    </span>
                  )
                }
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>General access</SectionLabel>
        <AccessRow
          icon={doc.isPublicInProject ? <Globe size={16} /> : <Lock size={16} />}
          title={doc.isPublicInProject ? 'Anyone in Orbit' : 'Restricted'}
          subtitle={
            doc.isPublicInProject ? 'Everyone in the workspace can open it' : 'Only people with access can open it'
          }
          value={doc.isPublicInProject ? 'Can edit' : 'No access'}
          editable={isCreator}
          options={[
            { label: 'Can edit', active: doc.isPublicInProject, onSelect: () => patchDoc({ isPublicInProject: true }) },
            { label: 'No access', active: !doc.isPublicInProject, onSelect: () => patchDoc({ isPublicInProject: false }) },
          ]}
        />
        <AccessRow
          icon={<LinkIcon size={16} />}
          title="Anyone with the link"
          subtitle={doc.isPublicLinkEnabled ? 'People outside Orbit can read it' : 'Public link is off'}
          value={doc.isPublicLinkEnabled ? 'Can view' : 'Off'}
          editable={isCreator}
          options={[
            { label: 'Can view', active: doc.isPublicLinkEnabled, onSelect: () => patchDoc({ isPublicLinkEnabled: true }) },
            { label: 'Off', active: !doc.isPublicLinkEnabled, onSelect: () => patchDoc({ isPublicLinkEnabled: false }) },
          ]}
        />
      </div>

      {error && (
        <p className="text-[13px]" style={{ color: '#DC2626' }}>
          {error}
        </p>
      )}
    </ModalFrame>
  );
};

const PersonRow: React.FC<{
  name: string;
  avatarName: string;
  avatarUrl?: string | null;
  subtitle: string;
  right: React.ReactNode;
  divider?: boolean;
}> = ({ name, avatarName, avatarUrl, subtitle, right, divider }) => (
  <div
    className={`h-[52px] px-3 flex items-center gap-3 ${divider ? 'border-t' : ''}`}
    style={{ borderColor: 'var(--theme-border)' }}
  >
    <Avatar name={avatarName} src={avatarUrl} size={32} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold leading-5 truncate" style={{ color: 'var(--theme-text)' }}>
        {name}
      </p>
      <p className="text-xs leading-4 truncate" style={{ color: 'var(--theme-text-muted)' }}>
        {subtitle}
      </p>
    </div>
    {right}
  </div>
);

const AccessRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: string;
  editable: boolean;
  options: { label: string; active: boolean; onSelect: () => void }[];
}> = ({ icon, title, subtitle, value, editable, options }) => (
  <div className="p-3 rounded-xl border flex items-center gap-3" style={{ borderColor: 'var(--theme-border)' }}>
    <span
      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: 'var(--theme-bg-surface-hover)', color: 'var(--theme-text-muted)' }}
    >
      {icon}
    </span>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold leading-5 truncate" style={{ color: 'var(--theme-text)' }}>
        {title}
      </p>
      <p className="text-xs leading-4 truncate" style={{ color: 'var(--theme-text-muted)' }}>
        {subtitle}
      </p>
    </div>
    {editable ? (
      <Popover width={140} trigger={(_, toggle) => <PermissionButton label={value} onClick={toggle} />}>
        {(close) =>
          options.map((o) => (
            <MenuItem
              key={o.label}
              selected={o.active}
              onClick={() => {
                close();
                if (!o.active) o.onSelect();
              }}
            >
              {o.label}
            </MenuItem>
          ))
        }
      </Popover>
    ) : (
      <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
        {value}
      </span>
    )}
  </div>
);
