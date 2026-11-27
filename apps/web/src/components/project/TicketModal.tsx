'use client';

import React, { useRef, useState } from 'react';
import { ProjectColumn, Ticket, TicketPriority, TicketType, WorkspaceMember } from '@orbit/types';
import { TICKET_TYPES } from '../../lib/ticketTypes';
import { TicketTypeIcon } from './TicketTypeIcon';
import { api } from '../../lib/api';
import { RichTextEditor, RichTextEditorRef } from '../chat/RichTextEditor';
import { X, Trash2, Calendar, Plus, Board } from '@/components/ui/icons';
import { useProjectStore } from '../../stores/projectStore';
import { useTicketAttachmentUpload, TicketAttachmentsField } from './TicketAttachments';
import { Avatar, PriorityPill, PRIORITY_META, columnColor, identityColor, tint } from './projectViewUtils';
import {
  ModalShell,
  Field,
  SelectField,
  SelectOption,
  SecondaryButton,
  PrimaryButton,
  ErrorNote,
  CheckboxBox,
  inputClass,
  inputShellClass,
  bareInputClass,
  DANGER,
} from '../channel/modalKit';

interface TicketModalProps {
  projectId: string;
  workspaceId: string;
  columns: ProjectColumn[];
  defaultColumnId?: string;
  ticket?: Ticket | null;
  initialTitle?: string;
  initialDescription?: string;
  members: WorkspaceMember[];
  onClose: () => void;
  onTicketCreated?: (ticket: Ticket) => void;
  onTicketUpdated?: (ticket: Ticket) => void;
  onTicketDeleted?: (ticketId: string) => void;
}

export interface TicketDraft {
  title: string;
  columnId: string;
  priority: TicketPriority;
  type: TicketType;
  assigneeId: string | null;
  dueDate: string;
  // Stored as-is: labels may be strings or { name, color } objects.
  labels: any[];
}

const labelName = (l: any): string => (typeof l === 'string' ? l : l?.name || l?.label || '');

const PRIORITY_ORDER: TicketPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

/** Project / Status, Title, Description, Assignee / Priority, Labels / Due date — the Figma "Create ticket" body. */
export const TicketFields: React.FC<{
  draft: TicketDraft;
  onChange: (patch: Partial<TicketDraft>) => void;
  columns: ProjectColumn[];
  members: WorkspaceMember[];
  projectField: React.ReactNode;
  editorRef: React.RefObject<RichTextEditorRef>;
  initialDescription?: string;
  attachmentsField?: React.ReactNode;
}> = ({ draft, onChange, columns, members, projectField, editorRef, initialDescription, attachmentsField }) => {
  const [labelInput, setLabelInput] = useState('');
  const dateRef = useRef<HTMLInputElement>(null);

  const addLabel = () => {
    const name = labelInput.trim().replace(/,$/, '');
    if (name && !draft.labels.some((l) => labelName(l).toLowerCase() === name.toLowerCase())) {
      onChange({ labels: [...draft.labels, name] });
    }
    setLabelInput('');
  };

  const statusOptions: SelectOption<string>[] = columns.map((c) => ({
    value: c.id,
    label: c.name,
    leading: <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: columnColor(c) }} />,
  }));

  const assigneeOptions: SelectOption<string>[] = [
    {
      value: '',
      label: 'Unassigned',
      leading: (
        <span
          className="w-5 h-5 rounded-full shrink-0 border border-dashed"
          style={{ borderColor: 'var(--theme-text-muted)' }}
        />
      ),
    },
    ...members
      .filter((m) => m.user)
      .map((m) => ({
        value: m.user!.id,
        label: m.user!.displayName,
        leading: <Avatar name={m.user!.displayName} src={m.user!.avatarUrl} size={20} />,
      })),
  ];

  const priorityOptions: SelectOption<TicketPriority>[] = PRIORITY_ORDER.map((p) => ({
    value: p,
    label: PRIORITY_META[p].label,
    display: <PriorityPill priority={p} />,
  }));

  const typeOptions: SelectOption<TicketType>[] = TICKET_TYPES.map((t) => ({
    value: t.value,
    label: t.label,
    display: <TicketTypeIcon type={t.value} showLabel />,
  }));

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Project">{projectField}</Field>
        <Field label="Status">
          <SelectField
            value={draft.columnId}
            options={statusOptions}
            onChange={(columnId) => onChange({ columnId })}
            placeholder="Select a status"
          />
        </Field>
      </div>

      <Field label="Title">
        <input
          type="text"
          required
          autoFocus
          maxLength={255}
          placeholder="What needs to be done?"
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className={inputClass}
        />
      </Field>

      <Field label="Description" optional>
        <div
          className="rounded-[10px] border overflow-hidden transition-[border-color,box-shadow] focus-within:border-[var(--theme-primary)] focus-within:shadow-[0_0_0_0.5px_var(--theme-primary)] [&_[contenteditable]]:px-3 [&_[contenteditable]]:py-2.5 [&_[contenteditable]]:leading-5"
          style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
        >
          <RichTextEditor
            ref={editorRef}
            initialValue={initialDescription || ''}
            placeholder="Add more detail, steps or links"
            minHeight="82px"
          />
        </div>
      </Field>

      {attachmentsField && (
        <Field label="Attachments" optional>
          {attachmentsField}
        </Field>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Type">
          <SelectField value={draft.type} options={typeOptions} onChange={(type) => onChange({ type })} />
        </Field>
        <Field label="Assignee">
          <SelectField
            searchable
            searchPlaceholder="Search people…"
            value={draft.assigneeId ?? ''}
            options={assigneeOptions}
            onChange={(v) => onChange({ assigneeId: v || null })}
          />
        </Field>
        <Field label="Priority">
          <SelectField value={draft.priority} options={priorityOptions} onChange={(priority) => onChange({ priority })} />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Labels" optional>
          <div className={`${inputShellClass} overflow-x-auto`}>
            {draft.labels.map((l, i) => {
              const name = labelName(l);
              const own = typeof l === 'object' && l?.color ? { bg: tint(l.color, 18), fg: l.color } : identityColor(name);
              return (
                <span
                  key={`${name}-${i}`}
                  className="h-6 pl-2 pr-[5px] rounded-md flex items-center gap-1 shrink-0 text-xs font-semibold whitespace-nowrap"
                  style={{ backgroundColor: own.bg, color: own.fg }}
                >
                  {name}
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => onChange({ labels: draft.labels.filter((_, j) => j !== i) })}
                    className="hover:opacity-70"
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
            <input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addLabel();
                } else if (e.key === 'Backspace' && !labelInput && draft.labels.length) {
                  onChange({ labels: draft.labels.slice(0, -1) });
                }
              }}
              onBlur={addLabel}
              placeholder="Add"
              className={`${bareInputClass} min-w-[48px] text-[13px]`}
            />
          </div>
        </Field>
        <Field label="Due date" optional>
          <div className={`${inputShellClass} relative cursor-pointer`} onClick={() => dateRef.current?.showPicker?.()}>
            <Calendar size={16} style={{ color: 'var(--theme-text-muted)' }} />
            <span
              className="flex-1 truncate text-sm"
              style={{ color: draft.dueDate ? 'var(--theme-text)' : 'var(--theme-text-muted)' }}
            >
              {draft.dueDate
                ? new Date(`${draft.dueDate}T00:00:00`).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'No due date'}
            </span>
            {draft.dueDate && (
              <button
                type="button"
                aria-label="Clear due date"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({ dueDate: '' });
                }}
                className="relative z-10 hover:opacity-70"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                <X size={14} />
              </button>
            )}
            <input
              ref={dateRef}
              type="date"
              tabIndex={-1}
              aria-label="Due date"
              value={draft.dueDate}
              onChange={(e) => onChange({ dueDate: e.target.value })}
              className="absolute inset-0 opacity-0 pointer-events-none"
            />
          </div>
        </Field>
      </div>
    </>
  );
};

/** Persists labels after create: the create endpoint has no labels field, the update endpoint does. */
export async function saveTicketLabels(projectId: string, ticket: Ticket, labels: any[]): Promise<Ticket> {
  if (!labels.length) return ticket;
  const res = await api.put(`/api/projects/${projectId}/tickets/${ticket.id}`, { labels });
  return res.data;
}

export const ProjectTile: React.FC = () => (
  <span
    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
    style={{ backgroundColor: 'var(--theme-selected)', color: 'var(--theme-text-muted)' }}
  >
    <Board size={12} />
  </span>
);

export const TicketModal: React.FC<TicketModalProps> = ({
  projectId,
  workspaceId,
  columns,
  defaultColumnId,
  ticket,
  initialTitle,
  initialDescription,
  members,
  onClose,
  onTicketCreated,
  onTicketUpdated,
  onTicketDeleted,
}) => {
  const isEditing = !!ticket;
  const editorRef = useRef<RichTextEditorRef>(null);
  const projectName = useProjectStore(
    (s) =>
      (s.currentProject?.id === projectId ? s.currentProject.name : undefined) ??
      s.projects.find((p) => p.id === projectId)?.name,
  );

  const [draft, setDraft] = useState<TicketDraft>({
    title: ticket?.title || initialTitle || '',
    columnId: ticket?.columnId || defaultColumnId || columns[0]?.id || '',
    priority: ticket?.priority || 'MEDIUM',
    type: (ticket?.type as TicketType) || 'TASK',
    assigneeId: ticket?.assigneeId || null,
    dueDate: ticket?.dueDate ? new Date(ticket.dueDate).toISOString().split('T')[0] : '',
    labels: Array.isArray(ticket?.labels) ? ticket!.labels : [],
  });
  const [createAnother, setCreateAnother] = useState(false);
  const upload = useTicketAttachmentUpload(
    workspaceId,
    Array.isArray((ticket as any)?.images) ? (ticket as any).images : [],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const patch = (p: Partial<TicketDraft>) => setDraft((d) => ({ ...d, ...p }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;

    setIsSubmitting(true);
    setError('');

    const desc = editorRef.current?.getMarkdown()?.trim() || '';
    const body = {
      title: draft.title.trim(),
      description: desc || null,
      columnId: draft.columnId,
      priority: draft.priority,
      type: draft.type,
      assigneeId: draft.assigneeId || null,
      dueDate: draft.dueDate ? new Date(draft.dueDate).toISOString() : null,
      images: upload.attachments,
    };

    try {
      if (isEditing && ticket) {
        const res = await api.put(`/api/projects/${projectId}/tickets/${ticket.id}`, { ...body, labels: draft.labels });
        onTicketUpdated?.(res.data);
        onClose();
      } else {
        const res = await api.post(`/api/projects/${projectId}/tickets`, body);
        const created = await saveTicketLabels(projectId, res.data, draft.labels);
        onTicketCreated?.(created);
        if (createAnother) {
          setDraft((d) => ({ ...d, title: '', dueDate: '', labels: [] }));
          upload.setAttachments([]);
          editorRef.current?.clear();
        } else {
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!ticket || !confirm('Are you sure you want to delete this ticket?')) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/projects/${projectId}/tickets/${ticket.id}`);
      onTicketDeleted?.(ticket.id);
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete ticket');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalShell
      width={640}
      title={isEditing ? 'Edit ticket' : 'Create ticket'}
      subtitle={
        isEditing
          ? `Update this ticket on the ${projectName || 'project'} board.`
          : `Add a ticket to the ${projectName || 'project'} board.`
      }
      onClose={onClose}
      onSubmit={handleSubmit}
      footerAlign="between"
      footer={
        <>
          {isEditing ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-9 px-3 rounded-[10px] flex items-center gap-1.5 text-sm font-semibold transition disabled:opacity-50"
              style={{ color: DANGER }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = tint(DANGER, 10))}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
            >
              <Trash2 size={16} />
              {isDeleting ? 'Deleting…' : 'Delete ticket'}
            </button>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="sr-only"
                checked={createAnother}
                onChange={(e) => setCreateAnother(e.target.checked)}
              />
              <CheckboxBox checked={createAnother} />
              <span className="text-[13px]" style={{ color: 'var(--theme-text)' }}>
                Create another ticket
              </span>
            </label>
          )}
          <span className="flex-1" />
          <SecondaryButton onClick={onClose} disabled={isSubmitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton disabled={isSubmitting || !draft.title.trim() || !draft.columnId}>
            {!isEditing && <Plus size={16} />}
            {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create ticket'}
          </PrimaryButton>
        </>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <TicketFields
        draft={draft}
        onChange={patch}
        columns={columns}
        members={members}
        editorRef={editorRef}
        initialDescription={ticket?.description || initialDescription || ''}
        attachmentsField={<TicketAttachmentsField upload={upload} />}
        projectField={
          <SelectField
            value={projectId}
            disabled
            options={[{ value: projectId, label: projectName || 'This project', leading: <ProjectTile /> }]}
            onChange={() => {}}
          />
        }
      />
    </ModalShell>
  );
};
