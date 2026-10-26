'use client';

import React, { useState } from 'react';
import {
  X,
  Edit,
  Copy,
  Check,
  Calendar,
  AlertCircle,
  Tag,
  Plus,
  Trash2,
} from 'lucide-react';
import { WorkspaceMember, ProjectColumn } from '@orbit/types';
import { api } from '../../lib/api';

interface TicketDetailModalProps {
  projectId: string;
  ticket: any;
  columns?: ProjectColumn[];
  members?: WorkspaceMember[];
  onClose: () => void;
  onEditTicket: (ticket: any) => void;
  onTicketUpdated?: (ticket: any) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  projectId,
  ticket,
  columns = [],
  members = [],
  onClose,
  onEditTicket,
  onTicketUpdated,
}) => {
  const [copiedBranch, setCopiedBranch] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [checklist, setChecklist] = useState<Array<{ id: string; text: string; completed: boolean }>>(
    Array.isArray(ticket.checklist) ? ticket.checklist : []
  );
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);

  // Copy helpers
  const handleCopyBranch = (branch: string) => {
    navigator.clipboard.writeText(branch);
    setCopiedBranch(true);
    setTimeout(() => setCopiedBranch(false), 2000);
  };

  const handleCopyLinkOrTitle = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTitle(true);
    setTimeout(() => setCopiedTitle(false), 2000);
  };

  // Checklist handlers
  const handleToggleChecklist = async (id: string) => {
    const nextList = checklist.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setChecklist(nextList);
    try {
      const res = await api.put(`/api/projects/${projectId}/tickets/${ticket.id}`, {
        checklist: nextList,
      });
      onTicketUpdated?.(res.data);
    } catch (err) {
      console.error('Failed to update checklist item', err);
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;

    const newItem = {
      id: `chk-${Date.now()}`,
      text: newChecklistItem.trim(),
      completed: false,
    };
    const nextList = [...checklist, newItem];
    setChecklist(nextList);
    setNewChecklistItem('');

    try {
      setIsSavingChecklist(true);
      const res = await api.put(`/api/projects/${projectId}/tickets/${ticket.id}`, {
        checklist: nextList,
      });
      onTicketUpdated?.(res.data);
    } catch (err) {
      console.error('Failed to add checklist item', err);
    } finally {
      setIsSavingChecklist(false);
    }
  };

  const handleDeleteChecklistItem = async (id: string) => {
    const nextList = checklist.filter((item) => item.id !== id);
    setChecklist(nextList);
    try {
      const res = await api.put(`/api/projects/${projectId}/tickets/${ticket.id}`, {
        checklist: nextList,
      });
      onTicketUpdated?.(res.data);
    } catch (err) {
      console.error('Failed to remove checklist item', err);
    }
  };

  // Resolve priority badge color
  const priority = (ticket.priority || 'MEDIUM').toUpperCase();
  const priorityBadge =
    priority === 'URGENT'
      ? { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' }
      : priority === 'HIGH'
      ? { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' }
      : priority === 'LOW'
      ? { text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' }
      : { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };

  // Resolve assignee display
  const assigneeName = ticket.assignee?.displayName || ticket.assignee?.username || null;
  const assigneeInitial = assigneeName ? assigneeName.charAt(0).toUpperCase() : null;

  // Due Date & Created Date
  const dueDateFormatted = ticket.dueDate
    ? new Date(ticket.dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const createdDateFormatted = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const labels = Array.isArray(ticket.labels) ? ticket.labels : [];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--theme-bg-surface, #1e293b)',
          borderColor: 'var(--theme-border, #334155)',
          color: 'var(--theme-text-primary, #ffffff)',
        }}
      >
        {/* Top Header: Title, Copy link & Edit Button */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between shrink-0 gap-4"
          style={{ borderColor: 'var(--theme-border, #334155)' }}
        >
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-base font-bold text-white leading-snug break-words">
              {ticket.title}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Copy button */}
            <button
              onClick={() => handleCopyLinkOrTitle(ticket.title)}
              title="Copy Title"
              className="p-1.5 rounded-lg border border-slate-700/80 hover:bg-white/5 text-slate-400 hover:text-white transition"
            >
              {copiedTitle ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>

            {/* Edit button */}
            <button
              onClick={() => {
                onClose();
                onEditTicket(ticket);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
            >
              <Edit size={13} />
              <span>Edit</span>
            </button>

            {/* Close 'X' */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs">
          {/* Row: Git Branch */}
          {ticket.gitbranch && (
            <div className="grid grid-cols-[120px_1fr] items-center gap-4">
              <span className="font-semibold text-slate-400">Git Branch</span>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-black/30 border border-slate-700/80 font-mono text-xs text-slate-200 break-all select-all">
                  {ticket.gitbranch}
                </span>
                <button
                  onClick={() => handleCopyBranch(ticket.gitbranch)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-xs font-medium hover:bg-white/5 text-slate-300 hover:text-white transition shrink-0"
                >
                  {copiedBranch ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Row: Description / Summary / Test Plan */}
          <div className="grid grid-cols-[120px_1fr] items-start gap-4 pt-1">
            <span className="font-semibold text-slate-400 pt-1">Description</span>
            <div className="space-y-3 min-w-0">
              {ticket.description ? (
                <div className="text-slate-200 leading-relaxed whitespace-pre-wrap font-sans text-xs bg-black/10 p-3 rounded-xl border border-white/5">
                  {ticket.description}
                </div>
              ) : (
                <p className="text-slate-500 italic">No description provided.</p>
              )}

              {ticket.testPlan && (
                <div className="pt-2">
                  <h5 className="font-bold text-white text-xs mb-1">Test plan</h5>
                  <div className="text-slate-300 whitespace-pre-wrap bg-black/10 p-3 rounded-xl border border-white/5">
                    {ticket.testPlan}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t my-2" style={{ borderColor: 'var(--theme-border, #334155)' }} />

          {/* Row: Ticket ID */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="font-semibold text-slate-400">Ticket ID</span>
            <span className="font-semibold text-white">
              {ticket.issueNumber || ticket.customId || ticket.id.slice(0, 8)}
            </span>
          </div>

          {/* Row: Checklist */}
          <div className="grid grid-cols-[120px_1fr] items-start gap-4">
            <span className="font-semibold text-slate-400 pt-1.5">Checklist</span>
            <div className="space-y-2.5">
              <form onSubmit={handleAddChecklistItem} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Add checklist item..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-black/20 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 transition"
                />
                <button
                  type="submit"
                  disabled={!newChecklistItem.trim() || isSavingChecklist}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition disabled:opacity-40 shadow-sm"
                >
                  Add
                </button>
              </form>

              {checklist.length === 0 ? (
                <p className="text-slate-500 text-xs py-1">No checklist items yet.</p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-slate-800 text-xs group"
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => handleToggleChecklist(item.id)}
                          className="rounded border-slate-600 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                        <span
                          className={`truncate ${
                            item.completed ? 'line-through text-slate-500' : 'text-slate-200'
                          }`}
                        >
                          {item.text}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDeleteChecklistItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t my-2" style={{ borderColor: 'var(--theme-border, #334155)' }} />

          {/* Row: Priority */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="font-semibold text-slate-400">Priority</span>
            <div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${priorityBadge.bg} ${priorityBadge.text} ${priorityBadge.border}`}
              >
                {priority}
              </span>
            </div>
          </div>

          {/* Row: Labels */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="font-semibold text-slate-400">Labels</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {labels.length > 0 ? (
                labels.map((lbl: any, idx: number) => {
                  const labelText = typeof lbl === 'string' ? lbl : lbl?.name || 'Label';
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    >
                      <Tag size={11} />
                      {labelText}
                    </span>
                  );
                })
              ) : (
                <span className="text-slate-500">-</span>
              )}
            </div>
          </div>

          {/* Row: Assignees */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="font-semibold text-slate-400">Assignees</span>
            <div className="flex items-center gap-2">
              {ticket.assignee ? (
                <div className="flex items-center gap-2">
                  <img
                    src={
                      ticket.assignee.avatarUrl ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${ticket.assignee.username}`
                    }
                    alt={ticket.assignee.displayName}
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-white/10"
                  />
                  <span className="text-slate-200 font-medium">
                    {ticket.assignee.displayName}
                  </span>
                </div>
              ) : assigneeInitial ? (
                <div className="w-6 h-6 rounded-full bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs">
                  {assigneeInitial}
                </div>
              ) : (
                <span className="text-slate-500">Unassigned</span>
              )}
            </div>
          </div>

          {/* Row: Story Points */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="font-semibold text-slate-400">Story Points</span>
            <span className="text-slate-300 font-medium">
              {ticket.storyPoints !== null && ticket.storyPoints !== undefined ? ticket.storyPoints : '-'}
            </span>
          </div>

          {/* Row: Due Date */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="font-semibold text-slate-400">Due Date</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Calendar size={13} className="text-slate-400" />
              <span>{dueDateFormatted || '-'}</span>
            </div>
          </div>

          {/* Row: Created Date */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <span className="font-semibold text-slate-400">Created</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Calendar size={13} className="text-slate-400" />
              <span>{createdDateFormatted || '-'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
