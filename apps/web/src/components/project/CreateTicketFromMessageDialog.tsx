'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Message, Project, ProjectColumn, Ticket, WorkspaceMember } from '@orbit/types';
import { api } from '../../lib/api';
import { RichTextEditorRef } from '../chat/RichTextEditor';
import { Plus, Board } from '@/components/ui/icons';
import { TicketFields, TicketDraft, ProjectTile, saveTicketLabels } from './TicketModal';
import { ModalShell, SelectField, SecondaryButton, PrimaryButton, ErrorNote } from '../channel/modalKit';

interface CreateTicketFromMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  projects: Project[];
  workspaceId: string;
  members: WorkspaceMember[];
  onTicketCreated?: (ticket: Ticket) => void;
  onOpenCreateProject?: () => void;
}

const EMPTY_DRAFT: TicketDraft = {
  title: '',
  columnId: '',
  priority: 'MEDIUM',
  assigneeId: null,
  dueDate: '',
  labels: [],
};

export const CreateTicketFromMessageDialog: React.FC<CreateTicketFromMessageDialogProps> = ({
  isOpen,
  onClose,
  message,
  projects,
  members,
  onTicketCreated,
  onOpenCreateProject,
}) => {
  const editorRef = useRef<RichTextEditorRef>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [draft, setDraft] = useState<TicketDraft>(EMPTY_DRAFT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const patch = (p: Partial<TicketDraft>) => setDraft((d) => ({ ...d, ...p }));

  const loadProjectColumns = async (projId: string) => {
    try {
      // Only columns are needed; keep the ticket payload minimal.
      const res = await api.get(`/api/projects/${projId}`, { params: { ticketLimit: 1 } });
      const cols: ProjectColumn[] = res.data.columns || [];
      setColumns(cols);
      patch({ columnId: cols[0]?.id || '' });
    } catch (err) {
      console.error('Failed to load project columns', err);
    }
  };

  useEffect(() => {
    if (!isOpen || !message) return;

    const proj = projects[0];
    if (proj) {
      setSelectedProjectId(proj.id);
      loadProjectColumns(proj.id);
    } else {
      setSelectedProjectId('');
      setColumns([]);
    }

    const cleanContent = (message.content || '').trim();
    const firstLine =
      cleanContent.split('\n')[0]?.replace(/^[#*`\-~>\s]+/, '').trim() || 'New Ticket from Message';
    setDraft({ ...EMPTY_DRAFT, title: firstLine.slice(0, 100) });
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, message, projects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return setError('Please select a project board first');
    if (!draft.title.trim()) return setError('Title cannot be empty');
    if (!draft.columnId) return setError('Please select a column');

    setIsSubmitting(true);
    setError('');
    const desc = editorRef.current?.getMarkdown()?.trim() || '';

    try {
      const res = await api.post(`/api/projects/${selectedProjectId}/tickets`, {
        title: draft.title.trim(),
        description: desc || null,
        columnId: draft.columnId,
        priority: draft.priority,
        assigneeId: draft.assigneeId || null,
        dueDate: draft.dueDate ? new Date(draft.dueDate).toISOString() : null,
      });
      const created = await saveTicketLabels(selectedProjectId, res.data, draft.labels);
      onTicketCreated?.(created);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !message) return null;

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  if (projects.length === 0) {
    return (
      <ModalShell
        width={520}
        title="Create ticket"
        subtitle="Turn this message into a ticket on a project board."
        onClose={onClose}
        footer={
          <>
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton
              type="button"
              onClick={() => {
                onClose();
                onOpenCreateProject?.();
              }}
            >
              <Plus size={16} />
              Create project board
            </PrimaryButton>
          </>
        }
      >
        <div className="flex flex-col items-center text-center gap-2 py-4">
          <span
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--theme-bg-surface-hover)', color: 'var(--theme-text-muted)' }}
          >
            <Board size={24} />
          </span>
          <p className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
            No project boards yet
          </p>
          <p className="text-[13px] max-w-sm" style={{ color: 'var(--theme-text-muted)' }}>
            You need at least one project board to turn messages into tickets.
          </p>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      width={640}
      title="Create ticket"
      subtitle={`Add a ticket to the ${selectedProject?.name || 'selected'} board.`}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={isSubmitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton disabled={isSubmitting || !draft.title.trim() || !draft.columnId}>
            <Plus size={16} />
            {isSubmitting ? 'Creating…' : 'Create ticket'}
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
        initialDescription={message.content || ''}
        projectField={
          <SelectField
            value={selectedProjectId}
            options={projects.map((p) => ({ value: p.id, label: p.name, leading: <ProjectTile /> }))}
            onChange={(id) => {
              setSelectedProjectId(id);
              loadProjectColumns(id);
            }}
          />
        }
      />
    </ModalShell>
  );
};
