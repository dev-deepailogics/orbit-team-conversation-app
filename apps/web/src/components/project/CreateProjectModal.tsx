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
      <div
        className="rounded-2xl w-full max-w-lg p-6 shadow-2xl overflow-hidden relative border"
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
          <div className="flex items-center gap-2.5">
            <div
              style={{ backgroundColor: color + '25', color }}
              className="p-2 rounded-xl text-xl"
            >
              {icon}
            </div>
            <div>
              <h2
                className="text-lg font-bold leading-tight"
                style={{ color: 'var(--theme-text-primary)' }}
              >
                Create Project Board
              </h2>
              <p
                className="text-xs"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                Kanban workflow with custom columns & tickets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:opacity-80 transition cursor-pointer"
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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Project Name */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Q4 Product Launch, Mobile App, Marketing Sprint"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm transition border focus:outline-none"
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
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Description <span className="font-normal lowercase opacity-75">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Brief overview of goals, scope or deliverables..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2 text-sm resize-none transition border focus:outline-none"
              style={{
                backgroundColor: 'var(--theme-bg-surface-hover)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
            />
          </div>

          {/* Icon Selector */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Board Icon
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition cursor-pointer ${
                    icon === ic
                      ? 'ring-2 scale-110 shadow'
                      : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: icon === ic ? 'rgba(var(--theme-primary-rgb, 0, 122, 90), 0.2)' : 'var(--theme-bg-surface-hover)',
                    outlineColor: 'var(--theme-primary)',
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selector */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Theme Color
            </label>
            <div className="flex items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full transition transform hover:scale-110 cursor-pointer ${
                    color === c ? 'ring-2 ring-white ring-offset-2 scale-110' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Activity Notifications Channel */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <Bell size={13} style={{ color: 'var(--theme-primary)' }} />
              Activity Notifications Channel
            </label>
            <select
              value={notificationChannelId}
              onChange={(e) => setNotificationChannelId(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm transition border focus:outline-none cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-bg-surface-hover)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
            >
              {channels.length > 0 ? (
                channels.map((ch) => (
                  <option
                    key={ch.id}
                    value={ch.id}
                    style={{
                      backgroundColor: 'var(--theme-bg-surface)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    #{ch.name} {ch.name.toLowerCase() === 'general' ? '(Default)' : ''}
                  </option>
                ))
              ) : (
                <option
                  value=""
                  style={{
                    backgroundColor: 'var(--theme-bg-surface)',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  #general (Default)
                </option>
              )}
            </select>
            <span
              className="text-[11px] mt-1 block"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Orbit Bot will send notifications for new tickets and column movements here.
            </span>
          </div>

          {/* Default Columns Hint */}
          <div
            className="p-3 rounded-xl text-xs flex items-center gap-2 border"
            style={{
              backgroundColor: 'var(--theme-bg-surface-hover)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
          >
            <Sparkles size={16} className="shrink-0" style={{ color: 'var(--theme-primary)' }} />
            <span>
              Includes default columns: <strong style={{ color: 'var(--theme-text-primary)' }}>Todo</strong>,{' '}
              <strong style={{ color: 'var(--theme-text-primary)' }}>Inprogress</strong>,{' '}
              <strong style={{ color: 'var(--theme-text-primary)' }}>In review</strong>, and{' '}
              <strong style={{ color: 'var(--theme-text-primary)' }}>Done</strong> (fully reorderable & customizable!).
            </span>
          </div>

          {/* Action Buttons */}
          <div
            className="flex items-center justify-end gap-3 pt-3 border-t"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm hover:opacity-80 transition cursor-pointer"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2.5 disabled:opacity-50 text-sm font-semibold rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95"
              style={{
                backgroundColor: 'var(--theme-primary)',
                color: 'var(--theme-primary-text)',
              }}
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
