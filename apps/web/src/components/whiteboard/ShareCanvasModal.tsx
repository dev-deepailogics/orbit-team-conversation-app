'use client';

import React, { useState } from 'react';
import { Canvas, Channel, Project } from '@orbit/types';
import { Globe, Lock, Hash, Board, Link as LinkIcon, Check } from '@/components/ui/icons';
import { Avatar } from '../project/projectViewUtils';
import { ModalFrame, PrimaryButton, SecondaryButton, SectionLabel } from '../project/docsCanvasUi';

interface ShareCanvasModalProps {
  canvas: Canvas;
  owner: { name: string; avatarUrl?: string | null; isMe: boolean };
  channel: Channel | null;
  project: Project | null;
  channelLabel: (c: Channel) => string;
  // Absent until the app can deep-link to a canvas; the Copy link button is hidden without it
  getCanvasLink?: (canvasId: string) => string;
  onClose: () => void;
}

// Canvas access follows its link: canvases in a private channel or DM are visible to that
// conversation's members; every other canvas is open to the whole workspace.
// ponytail: per-person canvas invites need a canvas share table on the server (docs have one).
export const ShareCanvasModal: React.FC<ShareCanvasModalProps> = ({
  canvas,
  owner,
  channel,
  project,
  channelLabel,
  getCanvasLink,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const restricted = !!channel && channel.type !== 'PUBLIC';

  const access = restricted
    ? {
        icon: <Lock size={16} />,
        title: `Members of ${channelLabel(channel!)}`,
        subtitle: 'Only people in this conversation can open it',
      }
    : {
        icon: <Globe size={16} />,
        title: 'Anyone in Orbit',
        subtitle: 'Everyone in the workspace can open it',
      };

  const copy = async () => {
    if (!getCanvasLink) return;
    await navigator.clipboard.writeText(getCanvasLink(canvas.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalFrame
      width={560}
      title={`Share "${canvas.title}"`}
      subtitle="Choose who can view or edit this canvas."
      onClose={onClose}
      footerJustify="between"
      footer={
        <>
          {getCanvasLink && (
            <SecondaryButton onClick={copy} icon={copied ? <Check size={16} /> : <LinkIcon size={16} />}>
              {copied ? 'Copied' : 'Copy link'}
            </SecondaryButton>
          )}
          <span className="flex-1" />
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <SectionLabel>People with access</SectionLabel>
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="h-[52px] px-3 flex items-center gap-3">
            <Avatar name={owner.name} src={owner.avatarUrl} size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-5 truncate" style={{ color: 'var(--theme-text)' }}>
                {owner.name}
                {owner.isMe ? ' (you)' : ''}
              </p>
              <p className="text-xs leading-4" style={{ color: 'var(--theme-text-muted)' }}>
                Canvas owner
              </p>
            </div>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
              Owner
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>General access</SectionLabel>
        <div className="p-3 rounded-xl border flex items-center gap-3" style={{ borderColor: 'var(--theme-border)' }}>
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--theme-bg-surface-hover)', color: 'var(--theme-text-muted)' }}
          >
            {access.icon}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-5 truncate" style={{ color: 'var(--theme-text)' }}>
              {access.title}
            </p>
            <p className="text-xs leading-4 truncate" style={{ color: 'var(--theme-text-muted)' }}>
              {access.subtitle}
            </p>
          </div>
          <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
            Can edit
          </span>
        </div>
        {(channel || project) && (
          <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            {channel ? <Hash size={12} /> : <Board size={12} />}
            Linked to {channel ? channelLabel(channel) : `${project!.name} board`}. Change the link to change who can open it.
          </p>
        )}
      </div>
    </ModalFrame>
  );
};
