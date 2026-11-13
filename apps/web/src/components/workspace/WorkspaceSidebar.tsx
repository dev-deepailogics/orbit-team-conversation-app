'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Workspace, UserProfile } from '@orbit/types';
import { Plus, Layers, ShieldCheck, PenTool, FileText, Home, FolderKanban } from 'lucide-react';
import { api } from '../../lib/api';
import { EmployeeAvailabilityHeader } from '../availability/EmployeeAvailabilityHeader';
import { Presence, PRESENCE_STYLE } from '../availability/useTeamPresence';
import { ProfileModal, defaultAvatar } from '../profile/ProfileModal';

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentUser?: UserProfile | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  onWorkspaceCreated: (workspace: Workspace) => void;
  activeFeature?: 'home' | 'canvas' | 'docs' | 'projects' | null;
  // Handlers are undefined when the feature has no target (no channel / no project)
  onGoHome?: () => void;
  onOpenCanvas?: () => void;
  onOpenDocs?: () => void;
  onOpenProjects?: () => void;
  presence?: Record<string, Presence>;
  onLogout: () => void;
}

const railLabel = 'text-[10px] font-semibold leading-none';

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  workspaces,
  currentWorkspace,
  currentUser,
  onSelectWorkspace,
  onWorkspaceCreated,
  activeFeature,
  onGoHome,
  onOpenCanvas,
  onOpenDocs,
  onOpenProjects,
  presence = {},
  onLogout,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const myPresence = (currentUser && presence[currentUser.id]) || 'offline';
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
      <div className="min-h-0 shrink flex flex-col items-center gap-3 overflow-y-auto w-full px-2">
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

      {/* Feature Shortcuts */}
      {currentWorkspace && (
        <div className="flex flex-col items-center gap-2 w-full px-1 pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          {([
            { key: 'home', label: 'Home', Icon: Home, onClick: onGoHome },
            { key: 'canvas', label: 'Canvas', Icon: PenTool, onClick: onOpenCanvas },
            { key: 'docs', label: 'Docs', Icon: FileText, onClick: onOpenDocs },
            { key: 'projects', label: 'Projects', Icon: FolderKanban, onClick: onOpenProjects },
          ] as const).map(({ key, label, Icon, onClick }) => {
            const isActive = activeFeature === key;
            return (
              <button
                key={key}
                onClick={onClick}
                disabled={!onClick}
                title={label}
                className="group flex flex-col items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:rounded-2xl"
                  style={{
                    backgroundColor: isActive ? 'var(--theme-primary)' : 'var(--theme-bg-surface)',
                    color: isActive ? 'var(--theme-primary-text)' : 'var(--theme-text-primary)',
                  }}
                >
                  <Icon size={20} />
                </span>
                <span className={railLabel} style={{ color: isActive ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)' }}>
                  {label}
                </span>
              </button>
            );
          })}

          <div className="flex flex-col items-center gap-1">
            <EmployeeAvailabilityHeader currentUserId={currentUser?.id} />
            <span className={railLabel} style={{ color: 'var(--theme-text-muted)' }}>Status</span>
          </div>
        </div>
      )}

      {/* Profile */}
      {currentUser && (
        <button
          onClick={() => setShowProfile(true)}
          title={`${currentUser.displayName} · ${PRESENCE_STYLE[myPresence].label}`}
          className="group mt-auto flex flex-col items-center gap-1 shrink-0"
        >
          <span className="relative w-11 h-11">
            <img
              src={currentUser.avatarUrl || defaultAvatar(currentUser.username)}
              alt={currentUser.displayName}
              className="w-11 h-11 rounded-xl object-cover transition-all duration-200 group-hover:rounded-2xl"
              style={{ backgroundColor: 'var(--theme-bg-surface)' }}
            />
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${PRESENCE_STYLE[myPresence].dot}`}
              style={{ boxShadow: '0 0 0 2px var(--theme-bg-workspace)' }}
            />
          </span>
          <span className={railLabel} style={{ color: 'var(--theme-text-muted)' }}>Profile</span>
        </button>
      )}

      {showProfile && currentUser && (
        <ProfileModal
          user={currentUser}
          workspaceId={currentWorkspace?.id}
          presence={myPresence}
          onClose={() => setShowProfile(false)}
          onLogout={onLogout}
        />
      )}

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
