'use client';

import React, { useState, useRef } from 'react';
import { ProjectColumn, Ticket, TicketPriority, WorkspaceMember } from '@orbit/types';
import { api } from '../../lib/api';
import { RichTextEditor, RichTextEditorRef } from '../chat/RichTextEditor';
import {
  X,
  Trash2,
  Calendar,
  User,
  Flag,
  Columns3,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';

interface TicketModalProps {
  projectId: string;
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

const PRIORITIES: { value: TicketPriority; label: string; color: string; icon: any }[] = [
  { value: 'LOW', label: 'Low', color: '#64748B', icon: CheckCircle2 },
  { value: 'MEDIUM', label: 'Medium', color: '#3B82F6', icon: Clock },
  { value: 'HIGH', label: 'High', color: '#F59E0B', icon: AlertCircle },
  { value: 'URGENT', label: 'Urgent', color: '#EF4444', icon: AlertTriangle },
];

export const TicketModal: React.FC<TicketModalProps> = ({
  projectId,
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

  const [title, setTitle] = useState(ticket?.title || initialTitle || '');
  const [columnId, setColumnId] = useState(ticket?.columnId || defaultColumnId || columns[0]?.id || '');
  const [priority, setPriority] = useState<TicketPriority>(ticket?.priority || 'MEDIUM');
  const [assigneeId, setAssigneeId] = useState<string | null>(ticket?.assigneeId || null);
  const [dueDate, setDueDate] = useState<string>(
    ticket?.dueDate ? new Date(ticket.dueDate).toISOString().split('T')[0] : ''
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError('');

    const desc = editorRef.current?.getMarkdown()?.trim() || '';

    try {
      if (isEditing && ticket) {
        const res = await api.put(`/api/projects/${projectId}/tickets/${ticket.id}`, {
          title: title.trim(),
          description: desc || null,
          columnId,
          priority,
          assigneeId: assigneeId || null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        });
        onTicketUpdated?.(res.data);
      } else {
        const res = await api.post(`/api/projects/${projectId}/tickets`, {
          title: title.trim(),
          description: desc || null,
          columnId,
          priority,
          assigneeId: assigneeId || null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        });
        onTicketCreated?.(res.data);
      }
      onClose();
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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div
        className="rounded-2xl w-full max-w-xl p-6 shadow-2xl overflow-hidden relative border"
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-primary)',
        }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between pb-4 border-b"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border"
              style={{
                color: 'var(--theme-primary)',
                backgroundColor: 'rgba(var(--theme-primary-rgb, 0, 122, 90), 0.1)',
                borderColor: 'var(--theme-primary)',
              }}
            >
              {isEditing ? 'Edit Ticket' : 'New Ticket'}
            </span>
            {ticket && (
              <span className="text-xs font-mono" style={{ color: 'var(--theme-text-muted)' }}>
                #{ticket.id.slice(0, 8)}
              </span>
            )}
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
              autoFocus
              placeholder="e.g. Design auth screens, Fix database indexing, Write unit tests"
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

          {/* Description */}
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
                initialValue={ticket?.description || initialDescription || ''}
                placeholder="Add formatted details, bullet lists, code blocks, or links..."
                minHeight="80px"
              />
            </div>
          </div>

          {/* Column Status & Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Status Column */}
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
                className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none transition cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-bg-surface-hover)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                {columns.map((col) => (
                  <option
                    key={col.id}
                    value={col.id}
                    style={{
                      backgroundColor: 'var(--theme-bg-surface)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Selector */}
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                <Flag size={14} style={{ color: 'var(--theme-text-muted)' }} />
                Priority
              </label>
              <div
                className="flex items-center gap-1 border p-1 rounded-xl"
                style={{
                  backgroundColor: 'var(--theme-bg-surface-hover)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                {PRIORITIES.map(({ value, label, color }) => {
                  const isSelected = priority === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPriority(value)}
                      className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition ${
                        isSelected ? 'shadow' : 'hover:opacity-80'
                      }`}
                      style={{
                        backgroundColor: isSelected ? color : 'transparent',
                        color: isSelected ? '#FFFFFF' : 'var(--theme-text-muted)',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
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
                className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none transition cursor-pointer"
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
                      {u.displayName} (@{u.username})
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
                className="w-full rounded-xl px-3 py-2 text-sm border focus:outline-none transition"
                style={{
                  backgroundColor: 'var(--theme-bg-surface-hover)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div
            className="flex items-center justify-between pt-3 border-t"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3.5 py-2 text-xs font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition flex items-center gap-1.5"
              >
                <Trash2 size={15} />
                {isDeleting ? 'Deleting...' : 'Delete Ticket'}
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm hover:opacity-80 transition"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="px-5 py-2.5 disabled:opacity-50 text-sm font-semibold rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95"
                style={{
                  backgroundColor: 'var(--theme-primary)',
                  color: 'var(--theme-primary-text)',
                }}
              >
                {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
