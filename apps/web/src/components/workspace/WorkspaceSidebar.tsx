'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Workspace, UserProfile } from '@orbit/types';
import { Plus, Hash, Layers, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentUser?: UserProfile | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  onWorkspaceCreated: (workspace: Workspace) => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  workspaces,
  currentWorkspace,
  currentUser,
  onSelectWorkspace,
  onWorkspaceCreated,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return;
    setIsSubmitting(true);
    try {
      const res = await api.post('/api/workspaces', { name, slug });
      onWorkspaceCreated(res.data);
      setShowCreateModal(false);
      setName('');
      setSlug('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="w-[68px] border-r flex flex-col items-center py-3 gap-3 select-none z-20"
      style={{
        backgroundColor: 'var(--theme-bg-workspace)',
        borderColor: 'var(--theme-border)',
      }}
    >
      {/* Workspace Icons */}
      <div className="flex-1 flex flex-col items-center gap-3 overflow-y-auto w-full px-2">
        {workspaces.map((ws) => {
          const isActive = currentWorkspace?.id === ws.id;
          return (
            <button
              key={ws.id}
              onClick={() => onSelectWorkspace(ws)}
              title={ws.name}
              className={`relative group w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base transition-all duration-200 ${
                isActive
                  ? 'rounded-2xl shadow-lg ring-2 ring-white/20'
                  : 'hover:rounded-2xl hover:opacity-90'
              }`}
              style={{
                backgroundColor: isActive ? 'var(--theme-primary)' : 'var(--theme-bg-surface)',
                color: isActive ? 'var(--theme-primary-text)' : 'var(--theme-text-primary)',
              }}
            >
              {/* Active Indicator bar */}
              {isActive && (
                <span className="absolute -left-2 w-1.5 h-7 bg-white rounded-r-full" />
              )}
              {ws.iconUrl ? (
                <img src={ws.iconUrl} alt={ws.name} className="w-7 h-7 rounded-lg" />
              ) : (
                ws.name.substring(0, 2).toUpperCase()
              )}
            </button>
          );
        })}

        {/* Add Workspace Button (Only for Super Admin and Workspace Admins) */}
        {(currentUser?.systemRole === 'SUPER_ADMIN' || currentUser?.systemRole === 'WORKSPACE_ADMIN') && (
          <button
            onClick={() => setShowCreateModal(true)}
            title="Create a Workspace"
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
              backgroundColor: 'var(--theme-bg-surface)',
            }}
            className="w-11 h-11 rounded-xl border border-dashed hover:opacity-100 hover:border-gray-400 flex items-center justify-center transition-all duration-200"
          >
            <Plus size={20} />
          </button>
        )}

        {/* Super Admin Control Center Button */}
        {currentUser?.systemRole === 'SUPER_ADMIN' && (
          <Link
            href="/admin"
            title="Super Admin Control Center"
            className="w-11 h-11 rounded-xl bg-purple-900/30 border border-purple-500/40 text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white flex items-center justify-center transition-all duration-200 shadow-lg group relative"
          >
            <ShieldCheck size={20} className="transition group-hover:scale-110" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-500 rounded-full animate-ping" />
          </Link>
        )}
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-[var(--theme-text)] mb-2 flex items-center gap-2">
              <Layers className="text-slack-activeChannel" size={22} />
              Create a new workspace
            </h2>
            <p className="text-sm text-[var(--theme-text-muted)] mb-5">
              Workspaces are shared hubs for your company, team, or project.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--theme-text)] mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }
                  }}
                  className="w-full bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-slack-activeChannel text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--theme-text)] mb-1">
                  Workspace URL Slug
                </label>
                <div className="flex items-center bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-sm text-[var(--theme-text-muted)]">
                  <span>orbit.app/</span>
                  <input
                    type="text"
                    required
                    placeholder="acme-corp"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 bg-transparent text-[var(--theme-text)] focus:outline-none ml-0.5"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-slack-green hover:bg-[#008a65] text-white transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
