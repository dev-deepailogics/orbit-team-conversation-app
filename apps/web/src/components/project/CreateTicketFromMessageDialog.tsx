'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Message, Project, ProjectColumn, Ticket, TicketPriority, WorkspaceMember } from '@orbit/types';
import { api } from '../../lib/api';
import { RichTextEditor, RichTextEditorRef } from '../chat/RichTextEditor';
import {
  X,
  CheckSquare,
  Columns3,
  Calendar,
  User,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FolderKanban,
  Plus,
} from 'lucide-react';

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

const PRIORITIES: { value: TicketPriority; label: string; color: string; icon: any }[] = [
  { value: 'LOW', label: 'Low', color: '#64748B', icon: CheckCircle2 },
  { value: 'MEDIUM', label: 'Medium', color: '#3B82F6', icon: Clock },
  { value: 'HIGH', label: 'High', color: '#F59E0B', icon: AlertCircle },
  { value: 'URGENT', label: 'Urgent', color: '#EF4444', icon: AlertTriangle },
];

export const CreateTicketFromMessageDialog: React.FC<CreateTicketFromMessageDialogProps> = ({
  isOpen,
  onClose,
  message,
  projects,
  workspaceId,
  members,
  onTicketCreated,
  onOpenCreateProject,
}) => {
  const editorRef = useRef<RichTextEditorRef>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [columnId, setColumnId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // When dialog opens or message/projects change, set up initial values
  useEffect(() => {
    if (!isOpen || !message) return;

    // Pick first project if available
    const proj = projects[0];
    if (proj) {
      setSelectedProjectId(proj.id);
      loadProjectColumns(proj.id);
    } else {
      setSelectedProjectId('');
      setColumns([]);
      setColumnId('');
    }

    // Extract title from message
    const cleanContent = (message.content || '').trim();
    const firstLine = cleanContent.split('\n')[0]?.replace(/^[#*`\-~>\s]+/, '').trim() || 'New Ticket from Message';
    setTitle(firstLine.slice(0, 100));

    // Reset priority & assignee
    setPriority('MEDIUM');
    setAssigneeId(null);
    setDueDate('');
    setError('');
  }, [isOpen, message, projects]);

  const loadProjectColumns = async (projId: string) => {
    try {
      const res = await api.get(`/api/projects/${projId}`);
      const cols = res.data.columns || [];
      setColumns(cols);
      if (cols.length > 0) {
        setColumnId(cols[0].id);
      } else {
        setColumnId('');
      }
    } catch (err) {
      console.error('Failed to load project columns', err);
    }
  };

  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId);
    loadProjectColumns(projId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError('Please select a project board first');
      return;
    }
    if (!title.trim()) {
      setError('Title cannot be empty');
      return;
    }
    if (!columnId) {
      setError('Please select a column');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const desc = editorRef.current?.getMarkdown()?.trim() || '';

    try {
      const res = await api.post(`/api/projects/${selectedProjectId}/tickets`, {
        title: title.trim(),
        description: desc || null,
        columnId,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      });

      onTicketCreated?.(res.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !message) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div
        className="rounded-2xl w-full max-w-xl p-6 shadow-2xl overflow-hidden relative border"
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-primary)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between pb-4 border-b"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1.5"
              style={{
                color: 'var(--theme-primary)',
                backgroundColor: 'rgba(var(--theme-primary-rgb, 0, 122, 90), 0.1)',
                borderColor: 'var(--theme-primary)',
              }}
            >
              <CheckSquare size={13} />
              Create Ticket from Message
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:opacity-80 transition"
            style={{
              color: 'var(--theme-text-muted)',
              backgroundColor: 'var(--theme-bg-surface-hover)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
            {error}
          </div>
        )}

        {projects.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
              style={{
                backgroundColor: 'var(--theme-bg-surface-hover)',
                color: 'var(--theme-text-muted)',
              }}
            >
              <FolderKanban size={24} />
            </div>
            <h4
              className="text-sm font-semibold"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              No Project Boards in Workspace
            </h4>
            <p
              className="text-xs max-w-sm mx-auto"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              You need at least one project board to convert messages into Kanban tickets.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCreateProject?.();
              }}
              className="px-4 py-2 text-xs font-semibold rounded-xl shadow transition inline-flex items-center gap-1.5 cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-primary)',
                color: 'var(--theme-primary-text)',
              }}
            >
              <Plus size={15} />
              Create Project Board
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Project Selection */}
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                Target Project Board <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => handleSelectProject(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm transition font-medium border focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-bg-surface-hover)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                {projects.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    style={{
                      backgroundColor: 'var(--theme-bg-surface)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    {p.icon || '📋'} {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ticket title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm transition font-medium border focus:outline-none"
                style={{
                  backgroundColor: 'var(--theme-bg-surface-hover)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              />
            </div>

            {/* Description (Rich Text Editor pre-filled with message markdown) */}
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center justify-between"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                <span>Description <span className="font-normal lowercase opacity-75">(rich formatting)</span></span>
              </label>
              <div
                className="rounded-xl overflow-hidden transition border"
                style={{
                  backgroundColor: 'var(--theme-bg-surface-hover)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <RichTextEditor
                  ref={editorRef}
                  initialValue={message.content || ''}
                  placeholder="Ticket description..."
                  minHeight="80px"
                />
              </div>
            </div>

            {/* Column & Priority Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Column Status */}
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <Columns3 size={14} style={{ color: 'var(--theme-text-muted)' }} />
                  Column / Status
                </label>
                <select
                  value={columnId}
                  onChange={(e) => setColumnId(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-xs border focus:outline-none transition cursor-pointer"
                  style={{
                    backgroundColor: 'var(--theme-bg-surface-hover)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  {columns.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                      style={{
                        backgroundColor: 'var(--theme-bg-surface)',
                        color: 'var(--theme-text-primary)',
                      }}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <Clock size={14} style={{ color: 'var(--theme-text-muted)' }} />
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="w-full rounded-xl px-3 py-2 text-xs border focus:outline-none transition cursor-pointer"
                  style={{
                    backgroundColor: 'var(--theme-bg-surface-hover)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  {PRIORITIES.map((p) => (
                    <option
                      key={p.value}
                      value={p.value}
                      style={{
                        backgroundColor: 'var(--theme-bg-surface)',
                        color: 'var(--theme-text-primary)',
                      }}
                    >
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assignee & Due Date Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Assignee */}
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <User size={14} style={{ color: 'var(--theme-text-muted)' }} />
                  Assignee
                </label>
                <select
                  value={assigneeId || ''}
                  onChange={(e) => setAssigneeId(e.target.value || null)}
                  className="w-full rounded-xl px-3 py-2 text-xs border focus:outline-none transition cursor-pointer"
                  style={{
                    backgroundColor: 'var(--theme-bg-surface-hover)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  <option
                    value=""
                    style={{
                      backgroundColor: 'var(--theme-bg-surface)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    Unassigned
                  </option>
                  {members.map((m) => {
                    const u = m.user;
                    if (!u) return null;
                    return (
                      <option
                        key={u.id}
                        value={u.id}
                        style={{
                          backgroundColor: 'var(--theme-bg-surface)',
                          color: 'var(--theme-text-primary)',
                        }}
                      >
                        {u.displayName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <Calendar size={14} style={{ color: 'var(--theme-text-muted)' }} />
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-xs border focus:outline-none transition"
                  style={{
                    backgroundColor: 'var(--theme-bg-surface-hover)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div
              className="flex items-center justify-end gap-3 pt-3 border-t"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs hover:opacity-80 transition cursor-pointer"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !columnId}
                className="px-5 py-2.5 disabled:opacity-50 text-xs font-semibold rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95"
                style={{
                  backgroundColor: 'var(--theme-primary)',
                  color: 'var(--theme-primary-text)',
                }}
              >
                <CheckSquare size={14} />
                {isSubmitting ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
