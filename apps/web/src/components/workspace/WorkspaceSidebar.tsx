'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/project/projectViewUtils';
import Link from 'next/link';
import { Workspace, UserProfile } from '@orbit/types';
import {
  Plus,
  Layers,
  ShieldCheck,
  Canvas,
  FileText,
  Home,
  Board,
  Settings,
  Pinwheel,
  User,
  Palette,
  Bot,
  HardDrive,
  Link2,
  LogOut,
  ChevronRight,
  ChevronDown,
  Check,
} from '@/components/ui/icons';
import { api } from '../../lib/api';
import { EmployeeAvailabilityHeader } from '../availability/EmployeeAvailabilityHeader';
import { Presence, PRESENCE_STYLE } from '../availability/useTeamPresence';
import { ThemeModal } from '../theme/ThemeModal';
import { WorkspaceStorageModal } from './WorkspaceStorageModal';
import { useChatStore } from '../../stores/chatStore';

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
  onOpenBotPortal?: () => void;
  // Opens the profile page in the main area
  onOpenProfile: () => void;
  members?: any[];
  presence?: Record<string, Presence>;
  onLogout: () => void;
}

const railLabel = 'mt-1 w-16 text-center text-[10px] font-medium leading-3';

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
  onOpenBotPortal,
  onOpenProfile,
  members = [],
  presence = {},
  onLogout,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [themeExpanded, setThemeExpanded] = useState(false);
  const [themeModalTab, setThemeModalTab] = useState<'presets' | 'custom' | null>(null);
  const [showStorage, setShowStorage] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const openProfile = () => onOpenProfile();
  const accountRef = useRef<HTMLDivElement>(null);

  // Account and Settings menus share the avatar anchor; a click outside it closes both
  const menuOpen = showAccount || showSettings;
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setShowAccount(false);
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);
  const myPresence = (currentUser && presence[currentUser.id]) || 'offline';
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myMembership = members.find((m: any) => m.userId === currentUser?.id || m.user?.id === currentUser?.id);
  const isAdminOrOwner =
    currentUser?.systemRole === 'SUPER_ADMIN' ||
    myMembership?.role === 'OWNER' ||
    myMembership?.role === 'ADMIN' ||
    (!!currentWorkspace && currentWorkspace.ownerId === currentUser?.id);

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

  const copyInviteLink = () => {
    if (!currentWorkspace) return;
    navigator.clipboard.writeText(
      `${window.location.origin}/join/${(currentWorkspace as any).inviteCode || currentWorkspace.id}`,
    );
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  const closeMenuThen = (fn: () => void) => () => {
    setShowSettings(false);
    setThemeExpanded(false);
    fn();
  };

  const ActiveBar = ({ top = 6 }: { top?: number }) => (
    <span
      className="absolute left-0 w-[3px] h-8 rounded-[2px]"
      style={{ top, backgroundColor: 'var(--theme-accent)' }}
    />
  );

  return (
    <div
      className="w-16 shrink-0 border-r flex flex-col items-center select-none z-20"
      style={{
        backgroundColor: 'var(--theme-bg-workspace)',
        borderColor: 'var(--theme-fill)',
      }}
    >
      {/* Brand mark */}
      <button
        onClick={onGoHome}
        disabled={!onGoHome}
        title="Orbit"
        className="mt-[17px] mb-3 shrink-0 rounded-lg transition hover:opacity-80 disabled:cursor-default"
      >
        <Pinwheel size={34} />
      </button>

      {/* Workspace Icons */}
      <div className="min-h-0 shrink flex flex-col items-center gap-2 overflow-y-auto w-full py-1">
        {workspaces.map((ws) => {
          const isActive = currentWorkspace?.id === ws.id;
          return (
            <button
              key={ws.id}
              onClick={() => onSelectWorkspace(ws)}
              title={ws.name}
              className="relative w-full flex justify-center shrink-0"
            >
              {isActive && <ActiveBar />}
              <span
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-[13px] font-bold overflow-hidden transition-colors ${
                  isActive ? '' : 'hover:brightness-95'
                }`}
                style={{
                  backgroundColor: isActive ? 'var(--theme-selected)' : 'var(--theme-fill)',
                  color: isActive ? 'var(--theme-accent)' : 'var(--theme-text)',
                }}
              >
                {ws.iconUrl ? (
                  <img src={ws.iconUrl} alt={ws.name} className="w-7 h-7 rounded-lg object-cover" />
                ) : (
                  ws.name.substring(0, 2).toUpperCase()
                )}
              </span>
            </button>
          );
        })}

        {/* Super Admin Control Center Button */}
        {currentUser?.systemRole === 'SUPER_ADMIN' && (
          <Link
            href="/admin"
            title="Super Admin Control Center"
            className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center transition hover:brightness-95"
            style={{ backgroundColor: 'var(--theme-fill)', color: 'var(--theme-accent)' }}
          >
            <ShieldCheck size={20} />
          </Link>
        )}
      </div>

      {/* Feature Shortcuts */}
      {currentWorkspace && (
        <nav className="mt-4 flex flex-col items-center gap-2 w-full">
          {([
            { key: 'home', label: 'Home', Icon: Home, onClick: onGoHome },
            { key: 'canvas', label: 'Canvas', Icon: Canvas, onClick: onOpenCanvas },
            { key: 'docs', label: 'Docs', Icon: FileText, onClick: onOpenDocs },
            { key: 'projects', label: 'Projects', Icon: Board, onClick: onOpenProjects },
          ] as const).map(({ key, label, Icon, onClick }) => {
            const isActive = activeFeature === key;
            return (
              <button
                key={key}
                onClick={onClick}
                disabled={!onClick}
                title={label}
                className="group relative w-full flex flex-col items-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isActive && <ActiveBar />}
                <span
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                    isActive ? '' : 'group-enabled:group-hover:bg-[var(--theme-fill-hover)]'
                  }`}
                  style={{
                    backgroundColor: isActive ? 'var(--theme-selected)' : undefined,
                    color: isActive ? 'var(--theme-text)' : 'var(--theme-text-muted)',
                  }}
                >
                  <Icon size={20} />
                </span>
                <span
                  className={railLabel}
                  style={{ color: isActive ? 'var(--theme-text)' : 'var(--theme-text-muted)' }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      <div className="mt-auto pt-4 pb-5 flex flex-col items-center gap-4 shrink-0">
        {currentWorkspace && (
          <EmployeeAvailabilityHeader currentUserId={currentUser?.id} />
        )}

        {/* Add Workspace (Super Admin and Workspace Admins) */}
        {(currentUser?.systemRole === 'SUPER_ADMIN' || currentUser?.systemRole === 'WORKSPACE_ADMIN') && (
          <button
            onClick={() => setShowCreateModal(true)}
            title="Create a Workspace"
            className="w-9 h-9 rounded-full flex items-center justify-center transition hover:brightness-95"
            style={{ backgroundColor: 'var(--theme-fill)', color: 'var(--theme-text-muted)' }}
          >
            <Plus size={18} />
          </button>
        )}

        {/* Profile */}
        {currentUser && (
          <div ref={accountRef} className="relative">
            <button
              onClick={() => {
                if (showSettings) return setShowSettings(false);
                setShowAccount((v) => !v);
              }}
              title={`${currentUser.displayName} · ${PRESENCE_STYLE[myPresence].label}`}
              className="relative w-6 h-6 shrink-0 rounded-full transition hover:opacity-85 block"
            >
              <Avatar name={currentUser.displayName || currentUser.username} src={currentUser.avatarUrl} size={24} />
              <span
                className={`absolute left-4 top-4 w-2.5 h-2.5 rounded-full ${PRESENCE_STYLE[myPresence].dot}`}
                style={{ boxShadow: '0 0 0 2px var(--theme-bg-workspace)' }}
              />
            </button>

            {showAccount && (
              <div
                className="absolute left-full bottom-0 ml-3 w-[288px] rounded-[14px] border p-2 flex flex-col gap-0.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                style={{
                  backgroundColor: 'var(--theme-bg-app)',
                  borderColor: 'var(--theme-border)',
                  boxShadow: '0 12px 16px rgba(20, 26, 46, 0.2)',
                }}
              >
                <div className="px-2.5 py-2 flex items-center gap-2.5">
                  <Avatar name={currentUser.displayName || currentUser.username} src={currentUser.avatarUrl} size={36} />
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-bold truncate" style={{ color: 'var(--theme-text)' }}>
                      {currentUser.displayName || currentUser.username}
                    </span>
                    <span className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                      {PRESENCE_STYLE[myPresence].label}
                    </span>
                  </span>
                </div>
                <div className="py-1">
                  <div className="h-px" style={{ backgroundColor: 'var(--theme-border)' }} />
                </div>
                <AccountRow Icon={User} label="View profile" onClick={() => { setShowAccount(false); openProfile(); }} />
                <AccountRow Icon={Settings} label="Settings" onClick={() => { setShowAccount(false); setShowSettings(true); }} />
                <AccountRow Icon={LogOut} label="Sign out" onClick={() => { setShowAccount(false); onLogout(); }} />
              </div>
            )}
            {showSettings && (
              <div
                className="absolute left-full bottom-0 ml-3 w-[264px] rounded-[14px] border p-2 flex flex-col gap-0.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                style={{
                  backgroundColor: 'var(--theme-bg-app)',
                  borderColor: 'var(--theme-border)',
                  boxShadow: '0 12px 16px rgba(20, 26, 46, 0.2)',
                  color: 'var(--theme-text)',
                }}
              >
                <p
                  className="px-2.5 py-1.5 text-[11px] font-bold tracking-[0.6px]"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  SETTINGS
                </p>

                <SettingsRow Icon={User} label="Profile & status" onClick={closeMenuThen(() => openProfile())} />

                <SettingsRow
                  Icon={Palette}
                  label="Theme & appearance"
                  expanded={themeExpanded}
                  onClick={() => setThemeExpanded((v) => !v)}
                />
                {themeExpanded && (
                  <>
                    <SettingsSubRow label="Theme templates" onClick={closeMenuThen(() => setThemeModalTab('presets'))} />
                    <SettingsSubRow label="Custom theme" badge="New" onClick={closeMenuThen(() => setThemeModalTab('custom'))} />
                  </>
                )}

                {onOpenBotPortal && (
                  <SettingsRow Icon={Bot} label="Bot & app integrations" onClick={closeMenuThen(onOpenBotPortal)} />
                )}
                {currentWorkspace && (
                  <SettingsRow Icon={HardDrive} label="Workspace storage" onClick={closeMenuThen(() => setShowStorage(true))} />
                )}
                {currentWorkspace && (
                  <SettingsRow
                    Icon={copiedInvite ? Check : Link2}
                    label={copiedInvite ? 'Invite link copied' : 'Invite link'}
                    onClick={copyInviteLink}
                  />
                )}

                <div className="py-1">
                  <div className="h-px" style={{ backgroundColor: 'var(--theme-border)' }} />
                </div>

                <SettingsRow Icon={LogOut} label="Sign out" onClick={closeMenuThen(onLogout)} />
              </div>
            )}
          </div>
        )}
      </div>

      {themeModalTab && (
        <ThemeModal
          isOpen
          initialTab={themeModalTab}
          onClose={() => setThemeModalTab(null)}
          workspace={currentWorkspace}
          isAdminOrOwner={isAdminOrOwner}
          onOpenProfile={() => {
            setThemeModalTab(null);
            openProfile();
          }}
          onSignOut={onLogout}
        />
      )}

      {showStorage && currentWorkspace && currentUser && (
        <WorkspaceStorageModal
          workspace={currentWorkspace}
          currentUser={currentUser}
          onClose={() => setShowStorage(false)}
          onFileDeleted={(id) => useChatStore.getState().removeAttachment(id)}
          onOpenProfile={() => {
            setShowStorage(false);
            openProfile();
          }}
          onSignOut={onLogout}
        />
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-[var(--theme-text)] mb-2 flex items-center gap-2">
              <Layers style={{ color: 'var(--theme-primary)' }} size={22} />
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
                  className="w-full bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-primary)] text-sm"
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
                  className="px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-primary-text)]"
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

const SettingsRow: React.FC<{
  Icon: React.ElementType;
  label: string;
  onClick: () => void;
  expanded?: boolean;
}> = ({ Icon, label, onClick, expanded }) => (
  <button
    onClick={onClick}
    className="w-full h-10 px-2.5 flex items-center gap-2.5 rounded-[10px] text-left transition-colors hover:bg-[var(--theme-fill-hover)]"
  >
    <span
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: 'var(--theme-bg-surface-hover)', color: 'var(--theme-text-muted)' }}
    >
      <Icon size={16} />
    </span>
    <span
      className={`flex-1 truncate text-sm ${expanded ? 'font-semibold' : 'font-medium'}`}
      style={{ color: expanded ? 'var(--theme-primary-hover)' : 'var(--theme-text)' }}
    >
      {label}
    </span>
    {expanded === undefined ? (
      <ChevronRight size={14} style={{ color: 'var(--theme-text-muted)' }} />
    ) : (
      <ChevronDown
        size={14}
        className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        style={{ color: 'var(--theme-text-muted)' }}
      />
    )}
  </button>
);

const AccountRow: React.FC<{ Icon: React.ElementType; label: string; onClick: () => void }> = ({ Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full h-9 px-2.5 rounded-[10px] flex items-center gap-2.5 text-left text-sm font-medium transition hover:bg-[var(--theme-fill-hover)]"
    style={{ color: 'var(--theme-text)' }}
  >
    <Icon size={17} style={{ color: 'var(--theme-text-muted)' }} />
    {label}
  </button>
);

const SettingsSubRow: React.FC<{ label: string; onClick: () => void; badge?: string }> = ({ label, onClick, badge }) => (
  <button
    onClick={onClick}
    className="group w-full h-9 pl-[38px] pr-2.5 flex items-center gap-2 rounded-[10px] text-left text-sm font-medium transition-colors hover:bg-[var(--theme-selected)]"
    style={{ color: 'var(--theme-text)' }}
  >
    <span
      className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--theme-border)] group-hover:bg-[var(--theme-primary)]"
    />
    <span className="flex-1 truncate group-hover:text-[var(--theme-primary-hover)] group-hover:font-semibold">{label}</span>
    {badge && (
      <span
        className="h-[18px] px-[7px] rounded-[9px] flex items-center text-[10px] font-bold"
        style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
      >
        {badge}
      </span>
    )}
  </button>
);
