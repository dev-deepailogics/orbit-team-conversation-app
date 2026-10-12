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
      <div className="bg-[#1A1D21] border border-gray-700/80 rounded-2xl w-full max-w-xl p-6 shadow-2xl overflow-hidden relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slack-green bg-slack-green/10 px-2 py-0.5 rounded-md border border-slack-green/30">
              {isEditing ? 'Edit Ticket' : 'New Ticket'}
            </span>
            {ticket && (
              <span className="text-xs text-gray-400 font-mono">
                #{ticket.id.slice(0, 8)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Design auth screens, Fix database indexing, Write unit tests"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#222529] border border-gray-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-slack-green transition font-medium"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5 flex items-center justify-between">
              <span>Description <span className="text-gray-500 font-normal lowercase">(rich formatting)</span></span>
            </label>
            <div className="bg-[#222529] border border-gray-700/80 rounded-xl overflow-hidden focus-within:border-slack-green transition">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Columns3 size={14} className="text-gray-400" />
                Column / Status
              </label>
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full bg-[#222529] border border-gray-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-slack-green transition"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Flag size={14} className="text-gray-400" />
                Priority
              </label>
              <div className="flex items-center gap-1 bg-[#222529] border border-gray-700/80 p-1 rounded-xl">
                {PRIORITIES.map(({ value, label, color }) => {
                  const isSelected = priority === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPriority(value)}
                      className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition ${
                        isSelected
                          ? 'text-white shadow'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                      style={{
                        backgroundColor: isSelected ? color : 'transparent',
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5 flex items-center gap-1.5">
                <User size={14} className="text-gray-400" />
                Assignee
              </label>
              <select
                value={assigneeId || ''}
                onChange={(e) => setAssigneeId(e.target.value || null)}
                className="w-full bg-[#222529] border border-gray-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-slack-green transition"
              >
                <option value="">Unassigned</option>
                {members.map((m) => {
                  const u = m.user;
                  if (!u) return null;
                  return (
                    <option key={u.id} value={u.id}>
                      {u.displayName} (@{u.username})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-400" />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#222529] border border-gray-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-slack-green transition"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-800">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3.5 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition flex items-center gap-1.5"
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
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="px-5 py-2.5 bg-slack-green hover:bg-[#008a65] disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg transition flex items-center gap-2"
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
