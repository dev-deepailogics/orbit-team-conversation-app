'use client';

import React, { useState } from 'react';
import { Project, Channel } from '@orbit/types';
import { api } from '../../lib/api';
import { X, FolderKanban, Sparkles, Bell } from 'lucide-react';

interface CreateProjectModalProps {
  workspaceId: string;
  channels?: Channel[];
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

const ICONS = ['📋', '🚀', '💻', '🎯', '⚡', '🛠️', '📊', '🎨', '🧪', '💡', '🔥', '📦'];
const COLORS = [
  '#007A5A', // Slack Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#64748B', // Slate
];

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  workspaceId,
  channels = [],
  onClose,
  onProjectCreated,
}) => {
  const defaultCh = channels.find((c) => c.name.toLowerCase() === 'general') || channels[0];
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📋');
  const [color, setColor] = useState('#007A5A');
  const [notificationChannelId, setNotificationChannelId] = useState(defaultCh?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const res = await api.post(`/api/projects/workspaces/${workspaceId}/projects`, {
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        color,
        notificationChannelId: notificationChannelId || undefined,
      });

      onProjectCreated(res.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create project board');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-[#1A1D21] border border-gray-700/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div
              style={{ backgroundColor: color + '20', color }}
              className="p-2 rounded-xl text-xl"
            >
              {icon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Create Project Board</h2>
              <p className="text-xs text-gray-400">Kanban workflow with custom columns & tickets</p>
            </div>
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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Q4 Product Launch, Mobile App, Marketing Sprint"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#222529] border border-gray-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-slack-green transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
              Description <span className="text-gray-500 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Brief overview of goals, scope or deliverables..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#222529] border border-gray-700/80 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-slack-green resize-none transition"
            />
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
              Board Icon
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition ${
                    icon === ic
                      ? 'bg-slack-green/20 ring-2 ring-slack-green scale-110'
                      : 'bg-[#222529] hover:bg-gray-700/60'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
              Theme Color
            </label>
            <div className="flex items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full transition transform hover:scale-110 ${
                    color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1A1D21] scale-110' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Activity Notifications Channel */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Bell size={13} className="text-slack-green" />
              Activity Notifications Channel
            </label>
            <select
              value={notificationChannelId}
              onChange={(e) => setNotificationChannelId(e.target.value)}
              className="w-full bg-[#222529] border border-gray-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-slack-green transition"
            >
              {channels.length > 0 ? (
                channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name} {ch.name.toLowerCase() === 'general' ? '(Default)' : ''}
                  </option>
                ))
              ) : (
                <option value="">#general (Default)</option>
              )}
            </select>
            <span className="text-[11px] text-gray-500 mt-1 block">
              Orbit Bot will send notifications for new tickets and column movements here.
            </span>
          </div>

          {/* Default Columns Hint */}
          <div className="p-3 bg-[#222529]/60 border border-gray-800 rounded-xl text-xs text-gray-400 flex items-center gap-2">
            <Sparkles size={16} className="text-slack-green shrink-0" />
            <span>
              Includes default columns: <strong className="text-gray-200">Todo</strong>,{' '}
              <strong className="text-gray-200">Inprogress</strong>,{' '}
              <strong className="text-gray-200">In review</strong>, and{' '}
              <strong className="text-gray-200">Done</strong> (fully reorderable & customizable!).
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
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
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2.5 bg-slack-green hover:bg-[#008a65] disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg transition flex items-center gap-2"
            >
              <FolderKanban size={16} />
              {isSubmitting ? 'Creating...' : 'Create Project Board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
