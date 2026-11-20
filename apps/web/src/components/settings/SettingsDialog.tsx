'use client';

import React, { useEffect, useState } from 'react';
import { ThemeConfig, UserProfile, Workspace } from '@orbit/types';
import { ArrowUpDown, Bot, ChevronLeft, HardDrive, Keyboard, Link2, LogOut, Palette, User } from '@/components/ui/icons';
import { DEFAULT_THEME, applyTheme } from '../../lib/theme';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { ThemeSettings, ThemeTab } from './ThemeSettings';
import { BotSettings } from './BotSettings';
import { StorageSettings } from './StorageSettings';
import { InviteSettings } from './InviteSettings';
import { SidebarSettings } from './SidebarSettings';
import { GeneralSettings } from './GeneralSettings';

export type SettingsSection = 'theme-presets' | 'theme-custom' | 'general' | 'sidebar' | 'bots' | 'storage' | 'invite';

export interface SettingsDialogProps {
  initialSection: SettingsSection;
  onClose: () => void;
  workspace?: Workspace | null;
  currentUser?: UserProfile | null;
  isAdminOrOwner?: boolean;
  onFileDeleted?: (fileId: string) => void;
  onMemberAdded?: () => void;
  /** Shown in the nav only when provided (the profile modal and logout live with the caller). */
  onOpenProfile?: () => void;
  onSignOut?: () => void;
}

const navText = 'var(--theme-primary-text)';
const navActiveBg = 'color-mix(in srgb, var(--theme-primary-text) 20%, transparent)';

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  initialSection,
  onClose,
  workspace,
  currentUser: currentUserProp,
  isAdminOrOwner: isAdminProp,
  onFileDeleted,
  onMemberAdded,
  onOpenProfile,
  onSignOut,
}) => {
  const authUser = useAuthStore((s) => s.user);
  const currentUser = currentUserProp ?? authUser;
  const isAdminOrOwner =
    isAdminProp ??
    (currentUser?.systemRole === 'SUPER_ADMIN' || (!!workspace && workspace.ownerId === currentUser?.id));

  const [section, setSection] = useState<SettingsSection>(initialSection);
  const { currentTheme, setTheme } = useThemeStore();
  const [draft, setDraft] = useState<ThemeConfig>(currentTheme);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [setAsDefault, setSetAsDefault] = useState(false);

  const close = () => {
    // Drop any unsaved live preview.
    applyTheme(useThemeStore.getState().currentTheme);
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[data-settings-popover]') && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeDraft = (t: ThemeConfig) => {
    setDraft(t);
    setSaved(false);
    applyTheme(t);
  };

  const save = async () => {
    setSaving(true);
    try {
      await setTheme(draft, workspace?.id, true, setAsDefault);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save theme', err);
    } finally {
      setSaving(false);
    }
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(currentTheme);
  const themeTab: ThemeTab = section === 'theme-custom' ? 'custom' : 'presets';
  const inTheme = section === 'theme-presets' || section === 'theme-custom';

  const NavItem = ({
    icon,
    label,
    active,
    onClick,
    bold,
  }: {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick: () => void;
    bold?: boolean;
  }) => (
    <button
      onClick={onClick}
      className="w-full h-[38px] px-2.5 rounded-[10px] flex items-center gap-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--theme-primary-text)_10%,transparent)]"
      style={{ backgroundColor: active ? navActiveBg : undefined, color: navText }}
    >
      {icon}
      <span className={`text-sm truncate ${active || bold ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </button>
  );

  const SubItem = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="w-full h-[34px] pl-[38px] pr-2.5 rounded-[10px] flex items-center gap-2 text-left transition hover:bg-[color-mix(in_srgb,var(--theme-primary-text)_10%,transparent)]"
      style={{ backgroundColor: active ? navActiveBg : undefined, color: navText }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: active ? navText : 'color-mix(in srgb, var(--theme-primary-text) 55%, transparent)' }}
      />
      <span className={`text-sm truncate ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </button>
  );

  const GroupLabel = ({ label, first }: { label: string; first?: boolean }) => (
    <p className={`pl-2.5 pb-1.5 ${first ? 'pt-1' : 'pt-4'} text-[11px] font-semibold tracking-[0.5px]`} style={{ color: navText }}>
      {label}
    </p>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 animate-in fade-in duration-150"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="w-full h-full max-w-[1440px] max-h-[900px] sm:rounded-2xl overflow-hidden flex shadow-2xl animate-in zoom-in-95 duration-150"
        style={{ backgroundColor: 'var(--theme-bg-surface)' }}
      >
        {/* Settings nav */}
        <nav
          className="hidden md:flex w-[264px] shrink-0 flex-col border-r"
          style={{ backgroundColor: 'var(--theme-primary-hover)', borderColor: 'var(--theme-border)' }}
        >
          <div className="h-14 px-4 flex items-center shrink-0">
            <button
              onClick={close}
              className="h-8 pl-1.5 pr-3 rounded-2xl border flex items-center gap-1.5 text-[13px] font-medium transition hover:brightness-95"
              style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
            >
              <ChevronLeft size={16} />
              Back to Orbit
            </button>
          </div>
          <div className="px-5 pt-2 pb-3 flex flex-col gap-0.5" style={{ color: navText }}>
            <p className="text-xl font-bold">Settings</p>
            <p className="text-xs">Personalize Orbit and manage your workspace</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 flex flex-col">
            <GroupLabel label="PERSONAL" first />
            {onOpenProfile && <NavItem icon={<User size={18} />} label="Profile & status" onClick={onOpenProfile} />}
            <NavItem icon={<Keyboard size={18} />} label="Shortcuts & quick to-dos" active={section === 'general'} onClick={() => setSection('general')} />
            <NavItem icon={<Palette size={18} />} label="Theme & appearance" bold={inTheme} onClick={() => setSection('theme-presets')} />
            <SubItem label="Theme templates" active={section === 'theme-presets'} onClick={() => setSection('theme-presets')} />
            <SubItem label="Custom theme" active={section === 'theme-custom'} onClick={() => setSection('theme-custom')} />
            {workspace && (
              <NavItem icon={<ArrowUpDown size={18} />} label="Sidebar sorting" active={section === 'sidebar'} onClick={() => setSection('sidebar')} />
            )}
            {workspace && (
              <>
                <GroupLabel label="WORKSPACE" />
                <NavItem icon={<Bot size={18} />} label="Bot & app integrations" active={section === 'bots'} onClick={() => setSection('bots')} />
                <NavItem icon={<HardDrive size={18} />} label="Workspace storage" active={section === 'storage'} onClick={() => setSection('storage')} />
                <NavItem icon={<Link2 size={18} />} label="Invite link" active={section === 'invite'} onClick={() => setSection('invite')} />
              </>
            )}
            {onSignOut && (
              <div className="mt-auto pt-3">
                <NavItem icon={<LogOut size={18} />} label="Sign out" onClick={onSignOut} />
              </div>
            )}
          </div>
        </nav>

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Compact section switcher below md, where the nav is hidden */}
          <div className="md:hidden shrink-0 flex items-center gap-1 px-3 py-2 overflow-x-auto border-b" style={{ borderColor: 'var(--theme-border)' }}>
            <button onClick={close} className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ color: 'var(--theme-text-muted)' }}>
              <ChevronLeft size={18} />
            </button>
            {(
              [
                ['general', 'Shortcuts'],
                ['theme-presets', 'Templates'],
                ['theme-custom', 'Custom'],
                ...(workspace ? ([['sidebar', 'Sidebar'], ['bots', 'Bots'], ['storage', 'Storage'], ['invite', 'Invite']] as const) : []),
              ] as [SettingsSection, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className="h-8 px-3 rounded-2xl text-[13px] shrink-0"
                style={
                  section === id
                    ? { backgroundColor: 'var(--theme-selected)', color: 'var(--theme-primary-hover)', fontWeight: 600 }
                    : { color: 'var(--theme-text-muted)' }
                }
              >
                {label}
              </button>
            ))}
          </div>

          {inTheme && (
            <ThemeSettings
              tab={themeTab}
              onTabChange={(t) => setSection(t === 'custom' ? 'theme-custom' : 'theme-presets')}
              draft={draft}
              onDraftChange={changeDraft}
              onReset={() => changeDraft(DEFAULT_THEME)}
              onSave={save}
              saving={saving}
              saved={saved}
              dirty={dirty}
              isAdminOrOwner={isAdminOrOwner}
              setAsDefault={setAsDefault}
              onSetAsDefault={setSetAsDefault}
            />
          )}
          {section === 'general' && <GeneralSettings />}
          {section === 'sidebar' && workspace && <SidebarSettings workspace={workspace} />}
          {section === 'bots' && workspace && <BotSettings workspace={workspace} />}
          {section === 'storage' && workspace && (
            <StorageSettings workspace={workspace} currentUser={currentUser} onFileDeleted={onFileDeleted} />
          )}
          {section === 'invite' && workspace && (
            <InviteSettings workspace={workspace} currentUser={currentUser} onMemberAdded={onMemberAdded} />
          )}
        </div>
      </div>
    </div>
  );
};
