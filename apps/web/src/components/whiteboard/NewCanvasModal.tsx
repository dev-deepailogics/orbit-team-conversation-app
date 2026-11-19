'use client';

import React, { useState } from 'react';
import { Canvas, Channel, Project, UserProfile } from '@orbit/types';
import { Canvas as CanvasIcon, Plus, Link2, Board, Hash, Lock, ChevronRight } from '@/components/ui/icons';
import { api } from '../../lib/api';
import {
  FieldLabel,
  MenuItem,
  ModalFrame,
  Popover,
  PrimaryButton,
  SecondaryButton,
  SelectTrigger,
  inputClass,
  inputStyle,
} from '../project/docsCanvasUi';
import type { CanvasElement } from './WhiteboardView';

type Template = 'blank' | 'brainstorm' | 'flowchart';
export type CanvasLink = { channelId: string | null; projectId: string | null };

interface NewCanvasModalProps {
  workspaceId: string;
  currentUser: UserProfile | null;
  channels: Channel[];
  projects: Project[];
  defaultLink?: CanvasLink;
  onClose: () => void;
  onCreated: (canvas: Canvas) => void;
}

const isDirect = (c: Channel) => c.type === 'DIRECT' || c.type === 'GROUP_DIRECT';

// Starter content. '#FFFFFF' is the whiteboard's "ink" color (drawn in the theme text color).
const sticky = (id: string, x: number, bg: string, text: string): CanvasElement => ({
  id,
  type: 'sticky',
  x,
  y: 110,
  width: 180,
  height: 180,
  color: text,
  fillColor: bg,
  strokeWidth: 2,
  fontSize: 20,
  text: '',
});

const label = (id: string, x: number, y: number, text: string, fontSize = 18): CanvasElement => ({
  id,
  type: 'text',
  x,
  y,
  width: 240,
  height: 48,
  color: '#FFFFFF',
  strokeWidth: 1,
  fontSize,
  text,
});

const TEMPLATE_ELEMENTS: Record<Exclude<Template, 'blank'>, () => CanvasElement[]> = {
  brainstorm: () => {
    const t = Date.now();
    return [
      label(`text-${t}`, 80, 40, 'Brainstorm', 32),
      sticky(`sticky-${t}-1`, 80, '#FEF08A', '#713F12'),
      sticky(`sticky-${t}-2`, 290, '#BBF7D0', '#14532D'),
      sticky(`sticky-${t}-3`, 500, '#DDD6FE', '#4C1D95'),
    ];
  },
  flowchart: () => {
    const t = Date.now();
    const box = (i: number, x: number): CanvasElement => ({
      id: `rect-${t}-${i}`,
      type: 'rect',
      x,
      y: 120,
      width: 160,
      height: 72,
      color: '#007A5A',
      strokeWidth: 3,
    });
    const arrow = (i: number, x1: number, x2: number): CanvasElement => ({
      id: `arrow-${t}-${i}`,
      type: 'arrow',
      x: x1,
      y: 156,
      points: [
        { x: x1, y: 156 },
        { x: x2, y: 156 },
      ],
      color: '#007A5A',
      strokeWidth: 3,
    });
    return [
      box(1, 80),
      box(2, 340),
      box(3, 600),
      arrow(1, 248, 332),
      arrow(2, 508, 592),
      label(`text-${t}-1`, 104, 142, 'Start'),
      label(`text-${t}-2`, 364, 142, 'Step'),
      label(`text-${t}-3`, 624, 142, 'Finish'),
    ];
  },
};

export const NewCanvasModal: React.FC<NewCanvasModalProps> = ({
  workspaceId,
  currentUser,
  channels,
  projects,
  defaultLink,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<Template>('blank');
  const [link, setLink] = useState<CanvasLink>(defaultLink || { channelId: null, projectId: null });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelLabel = (c: Channel) => {
    if (!isDirect(c)) return `# ${c.name}`;
    const others = (c.members || []).filter((m) => m.userId !== currentUser?.id).map((m) => m.user?.displayName);
    return others.filter(Boolean).join(', ') || c.name;
  };

  const linkedChannel = link.channelId ? channels.find((c) => c.id === link.channelId) : null;
  const linkedProject = link.projectId ? projects.find((p) => p.id === link.projectId) : null;
  const linkText = linkedChannel
    ? channelLabel(linkedChannel)
    : linkedProject
      ? `${linkedProject.name} board`
      : 'No link, independent canvas';

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      const res = await api.post('/api/canvases', {
        workspaceId,
        title: name.trim() || 'Untitled canvas',
        channelId: link.channelId || undefined,
        projectId: link.projectId || undefined,
      });
      if (template !== 'blank') {
        await api.put(`/api/canvases/${res.data.id}/data`, { data: { elements: TEMPLATE_ELEMENTS[template]() } });
      }
      onCreated(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create canvas');
      setIsCreating(false);
    }
  };

  const linkableChannels = channels.filter((c) => !c.isArchived && !isDirect(c));
  const linkableChats = channels.filter((c) => !c.isArchived && isDirect(c));

  return (
    <ModalFrame
      width={560}
      icon={<CanvasIcon size={20} />}
      title="New canvas"
      subtitle="A shared whiteboard for shapes, notes and connectors."
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => handleCreate()} disabled={isCreating} icon={<Plus size={16} />}>
            {isCreating ? 'Creating…' : 'Create canvas'}
          </PrimaryButton>
        </>
      }
    >
      <form onSubmit={handleCreate} className="flex flex-col gap-1.5">
        <FieldLabel>Canvas name</FieldLabel>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled canvas"
          maxLength={120}
          className={inputClass}
          style={inputStyle}
        />
      </form>

      <div className="flex flex-col gap-1.5">
        <FieldLabel>Template</FieldLabel>
        <div className="grid grid-cols-3 gap-3">
          <TemplateCard selected={template === 'blank'} onSelect={() => setTemplate('blank')} label="Blank">
            <span className="h-[72px] rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--theme-bg-app)', color: 'var(--theme-accent)' }}>
              <Plus size={20} />
            </span>
          </TemplateCard>
          <TemplateCard selected={template === 'brainstorm'} onSelect={() => setTemplate('brainstorm')} label="Brainstorm">
            <span className="h-[72px] rounded-lg flex items-center justify-center gap-1.5" style={{ backgroundColor: 'var(--theme-bg-surface-hover)' }}>
              {['#FEF08A', '#BBF7D0', '#DDD6FE'].map((c) => (
                <span key={c} className="w-[18px] h-[18px] rounded-[3px]" style={{ backgroundColor: c }} />
              ))}
            </span>
          </TemplateCard>
          <TemplateCard selected={template === 'flowchart'} onSelect={() => setTemplate('flowchart')} label="Flowchart">
            <span
              className="h-[72px] rounded-lg flex items-center justify-center gap-1.5"
              style={{ backgroundColor: 'var(--theme-bg-surface-hover)', color: 'var(--theme-text-muted)' }}
            >
              <span className="w-[22px] h-[14px] rounded-[3px] border" style={{ borderColor: 'var(--theme-text-muted)', backgroundColor: 'var(--theme-bg-app)' }} />
              <ChevronRight size={12} />
              <span className="w-[22px] h-[14px] rounded-[3px] border" style={{ borderColor: 'var(--theme-text-muted)', backgroundColor: 'var(--theme-bg-app)' }} />
            </span>
          </TemplateCard>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel optional>Link to</FieldLabel>
        <Popover
          align="left"
          width={512}
          trigger={(_, toggle) => <SelectTrigger onClick={toggle} icon={<Link2 size={16} />} label={linkText} />}
        >
          {(close) => {
            const pick = (l: CanvasLink) => {
              setLink(l);
              close();
            };
            return (
              <>
                <MenuItem selected={!link.channelId && !link.projectId} onClick={() => pick({ channelId: null, projectId: null })}>
                  No link, independent canvas
                </MenuItem>
                {linkableChannels.length > 0 && <GroupLabel>Channels</GroupLabel>}
                {linkableChannels.map((c) => (
                  <MenuItem
                    key={c.id}
                    icon={c.type === 'PRIVATE' ? <Lock size={14} /> : <Hash size={14} />}
                    selected={c.id === link.channelId}
                    onClick={() => pick({ channelId: c.id, projectId: null })}
                  >
                    {c.name}
                  </MenuItem>
                ))}
                {linkableChats.length > 0 && <GroupLabel>Direct messages</GroupLabel>}
                {linkableChats.map((c) => (
                  <MenuItem key={c.id} selected={c.id === link.channelId} onClick={() => pick({ channelId: c.id, projectId: null })}>
                    {channelLabel(c)}
                  </MenuItem>
                ))}
                {projects.length > 0 && <GroupLabel>Projects</GroupLabel>}
                {projects.map((p) => (
                  <MenuItem
                    key={p.id}
                    icon={<Board size={14} />}
                    selected={p.id === link.projectId}
                    onClick={() => pick({ channelId: null, projectId: p.id })}
                  >
                    {p.name}
                  </MenuItem>
                ))}
              </>
            );
          }}
        </Popover>
        <p className="text-xs leading-4" style={{ color: 'var(--theme-text-muted)' }}>
          You can link it to a channel or direct message now or later.
        </p>
      </div>

      {error && (
        <p className="text-[13px]" style={{ color: '#DC2626' }}>
          {error}
        </p>
      )}
    </ModalFrame>
  );
};

const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
    {children}
  </p>
);

const TemplateCard: React.FC<{
  selected: boolean;
  onSelect: () => void;
  label: string;
  children: React.ReactNode;
}> = ({ selected, onSelect, label, children }) => (
  <button
    type="button"
    onClick={onSelect}
    className="p-2 rounded-xl flex flex-col gap-2 text-left transition"
    style={{
      border: selected ? '1.5px solid var(--theme-primary)' : '1px solid var(--theme-border)',
      backgroundColor: selected ? 'var(--theme-bg-surface)' : 'var(--theme-bg-app)',
    }}
  >
    {children}
    <span
      className="text-[13px] font-semibold"
      style={{ color: selected ? 'var(--theme-primary-hover)' : 'var(--theme-text)' }}
    >
      {label}
    </span>
  </button>
);
