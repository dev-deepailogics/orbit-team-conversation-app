'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UserProfile } from '@orbit/types';
import { X, Upload, Check, LogOut, User, Loader2, Pencil, Mail, Clock, Calendar } from '@/components/ui/icons';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { useProjectStore } from '../../stores/projectStore';
import { Presence } from '../availability/useTeamPresence';
import { TimeFormat, getTimeFormat, setTimeFormat } from '../../lib/timeFormat';
import { identityColor, initialsOf } from '../project/projectViewUtils';

const AVATAR_STYLES = ['bottts', 'avataaars', 'open-peeps', 'lorelei', 'notionists', 'thumbs'];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const defaultAvatar = (username: string) => `/api/avatar/bottts/svg?seed=${username}`;

const PRESENCE_OPTIONS: Record<Presence, { label: string; hint: string; icon: string }> = {
  working: { label: 'Available', hint: 'Online and reachable', icon: '/icons/status-on.svg' },
  break: { label: 'On break', hint: 'Pauses notifications', icon: '/icons/status-away.svg' },
  offline: { label: 'Checked out', hint: 'Done for the day', icon: '/icons/status-off.svg' },
};

const DANGER = '#DC2626';
const SUCCESS = '#1F9D63';

const inputClass =
  'w-full h-10 px-3 rounded-[10px] border text-sm outline-none transition focus:border-[var(--theme-primary)] disabled:opacity-60 placeholder:text-[var(--theme-text-muted)]';
const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--theme-bg-app)',
  borderColor: 'var(--theme-border)',
  color: 'var(--theme-text)',
};
const fieldLabel = 'block text-xs font-semibold mb-1.5';

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--theme-bg-app)',
  borderColor: 'var(--theme-border)',
  boxShadow: '0 1px 1px rgba(20, 26, 46, 0.06)',
};

interface ProfileModalProps {
  user: UserProfile;
  workspaceId?: string;
  presence: Presence;
  onClose: () => void;
  onLogout: () => void;
}

type Tab = 'overview' | 'preferences';

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  workspaceId,
  presence,
  onClose,
  onLogout,
}) => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const workspace = useChatStore((s) => s.currentWorkspace);
  const channels = useChatStore((s) => s.channels);
  const projects = useProjectStore((s) => s.projects);
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);

  // Profile edit
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || defaultAvatar(user.username));
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>(getTimeFormat);
  const fileRef = useRef<HTMLInputElement>(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);


  const presets = AVATAR_STYLES.flatMap((style) =>
    [user.username, `${user.username}-alt`].map((seed) => `/api/avatar/${style}/svg?seed=${encodeURIComponent(seed)}`),
  );

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setEditing(false);
    resetMessages();
  };

  const startEditing = () => {
    setTab('overview');
    setEditing(true);
    resetMessages();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.');
    if (file.size > MAX_AVATAR_BYTES) return setError('Image must be 5 MB or smaller.');

    setError('');
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
      const res = await api.post(`/api/files/upload${query}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUrl(res.data.fileUrl);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsSaving(true);
    try {
      const res = await api.patch('/api/auth/me', { displayName, username, avatarUrl });
      setAuth(res.data.user, res.data.accessToken);
      setSuccess('Profile updated');
      setEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimeFormatChange = (format: TimeFormat) => {
    setTimeFormatState(format);
    setTimeFormat(format);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (newPassword !== confirmPassword) return setError('New passwords do not match.');
    setIsSaving(true);
    try {
      await api.post('/api/auth/me/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password changed');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const status = PRESENCE_OPTIONS[presence];
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localTime = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: timeFormat === '12' });
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })
    : null;
  const subtitle = [user.role, workspace?.name].filter(Boolean).join(' · ') || `@${user.username}`;
  const teamChips = [
    ...channels.filter((c) => c.type !== 'DIRECT').map((c) => ({ id: c.id, label: `# ${c.name}` })),
    ...projects
      .filter((p) => (p.status || 'active').toLowerCase() === 'active')
      .map((p) => ({ id: p.id, label: p.name })),
  ];
  const shownAvatar = editing ? avatarUrl : user.avatarUrl;
  const fallback = identityColor(user.displayName || user.username);

  return (
    <div className="flex-1 min-w-0 h-full flex">
      <div
        aria-label="Your profile"
        className="w-full h-full overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--theme-bg-app)' }}
      >
        {/* Header */}
        <div className="shrink-0 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="h-16 px-6 flex items-center gap-4">
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <span
                className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--theme-selected)', color: 'var(--theme-primary-hover)' }}
              >
                <User size={20} />
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-[17px] font-bold leading-[22px]" style={{ color: 'var(--theme-text)' }}>
                  Profile
                </span>
                <span className="text-[13px] leading-[18px]" style={{ color: 'var(--theme-text-muted)' }}>
                  How you appear to teammates
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-10 h-10 rounded-xl flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <X size={20} />
            </button>
          </div>
          <div className="h-12 px-6 flex items-center justify-between">
            <div className="h-12 flex items-start gap-5">
              {(['overview', 'preferences'] as Tab[]).map((t) => {
                const active = tab === t;
                return (
                  <button key={t} type="button" onClick={() => switchTab(t)} className="h-12 flex flex-col items-center">
                    <span
                      className={`h-[46px] px-1 flex items-center text-sm ${active ? 'font-semibold' : 'font-medium'}`}
                      style={{ color: active ? 'var(--theme-primary-hover)' : 'var(--theme-text-muted)' }}
                    >
                      {t === 'overview' ? 'Overview' : 'Preferences'}
                    </span>
                    <span className="h-0.5 w-full" style={{ backgroundColor: active ? 'var(--theme-primary)' : 'transparent' }} />
                  </button>
                );
              })}
            </div>
            {!editing && (
              <PrimaryButton onClick={startEditing}>
                <Pencil size={15} />
                Edit profile
              </PrimaryButton>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
          {(error || success) && (
            <p
              className="mb-4 text-[13px] rounded-[10px] px-3 py-2"
              style={{
                color: error ? DANGER : SUCCESS,
                backgroundColor: `color-mix(in srgb, ${error ? DANGER : SUCCESS} 12%, transparent)`,
              }}
            >
              {error || success}
            </p>
          )}

          {tab === 'overview' && !editing && (
            <div className="flex flex-col lg:flex-row gap-6 items-stretch lg:items-start">
              {/* Profile card */}
              <section className="lg:w-[360px] shrink-0 rounded-2xl border p-6 flex flex-col items-center gap-2.5" style={cardStyle}>
                <span className="relative w-[104px] h-[104px]">
                  {shownAvatar ? (
                    <img src={shownAvatar} alt="" className="w-full h-full rounded-full object-cover" style={{ backgroundColor: 'var(--theme-bg-surface)' }} />
                  ) : (
                    <span
                      className="w-full h-full rounded-full flex items-center justify-center text-[42px] font-semibold"
                      style={{ backgroundColor: fallback.bg, color: fallback.fg }}
                    >
                      {initialsOf(user.displayName || user.username)}
                    </span>
                  )}
                  <span
                    className="absolute left-[81px] top-[81px] w-[26px] h-[26px] rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--theme-bg-app)' }}
                    title={status.label}
                  >
                    <img src={status.icon} alt="" width={24} height={24} />
                  </span>
                </span>
                <p className="text-[22px] font-bold text-center" style={{ color: 'var(--theme-text)' }}>
                  {user.displayName}
                </p>
                <p className="text-sm text-center" style={{ color: 'var(--theme-text-muted)' }}>
                  {subtitle}
                </p>
                <span className="h-8 px-3 rounded-2xl border flex items-center gap-2" style={{ borderColor: 'var(--theme-border)' }}>
                  <img src={status.icon} alt="" width={12} height={12} />
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--theme-text)' }}>
                    {status.label}
                  </span>
                </span>

                <div className="w-full pt-3 flex flex-col gap-0.5">
                  <ContactRow Icon={Mail} text={user.email} />
                  <ContactRow Icon={User} text={`@${user.username}`} />
                  <ContactRow Icon={Clock} text={`${localTime} · ${timeZone}`} />
                  {memberSince && <ContactRow Icon={Calendar} text={`Member since ${memberSince}`} />}
                </div>

                <div className="pt-1.5 flex items-center gap-2">
                  <PrimaryButton onClick={startEditing}>
                    <Pencil size={15} />
                    Edit profile
                  </PrimaryButton>
                  <OutlineButton onClick={onLogout}>
                    <LogOut size={15} />
                    Log out
                  </OutlineButton>
                </div>
              </section>

              {/* Right column */}
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                <section className="rounded-[14px] border p-5 flex flex-col gap-3" style={cardStyle}>
                  <CardHeading title="Status" subtitle="What teammates see next to your name" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(Object.keys(PRESENCE_OPTIONS) as Presence[]).map((p) => {
                      const opt = PRESENCE_OPTIONS[p];
                      const active = p === presence;
                      return (
                        <div
                          key={p}
                          className={`rounded-xl p-[14px] flex flex-col gap-1.5 ${active ? 'border-2' : 'border'}`}
                          style={{
                            borderColor: active ? 'var(--theme-primary)' : 'var(--theme-border)',
                            backgroundColor: active ? 'var(--theme-bg-surface)' : 'var(--theme-bg-app)',
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <img src={opt.icon} alt="" width={12} height={12} />
                            <span className="text-sm font-bold" style={{ color: 'var(--theme-text)' }}>
                              {opt.label}
                            </span>
                          </span>
                          <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                            {opt.hint}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    Your status follows check-in. Use the status button in the sidebar to take a break or check out.
                  </p>
                </section>

                {teamChips.length > 0 && (
                  <section className="rounded-[14px] border p-5 flex flex-col gap-3" style={cardStyle}>
                    <CardHeading title="Teams & channels" />
                    <div className="flex flex-wrap gap-2">
                      {teamChips.map((c) => (
                        <span
                          key={c.id}
                          className="h-7 px-3 rounded-[14px] flex items-center text-[13px] font-medium"
                          style={{ backgroundColor: 'var(--theme-bg-surface-hover)', color: 'var(--theme-text)' }}
                        >
                          {c.label}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}

          {tab === 'overview' && editing && (
            <form onSubmit={handleSaveProfile} className="max-w-[720px] rounded-[14px] border p-5 flex flex-col gap-4" style={cardStyle}>
              <CardHeading title="Edit profile" subtitle="Picture, name and username" />
              <div>
                <span className={fieldLabel} style={{ color: 'var(--theme-text-muted)' }}>
                  Picture
                </span>
                <div className="flex items-center gap-3 mb-3">
                  <img src={avatarUrl} alt="Selected avatar" className="w-16 h-16 rounded-full object-cover" style={{ backgroundColor: 'var(--theme-bg-surface)' }} />
                  <OutlineButton type="button" onClick={() => fileRef.current?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    Upload photo
                  </OutlineButton>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload} />
                </div>
                <p className="text-xs mb-2" style={{ color: 'var(--theme-text-muted)' }}>
                  Or pick an avatar
                </p>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                  {presets.map((url) => {
                    const selected = url === avatarUrl;
                    return (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setAvatarUrl(url)}
                        aria-label="Select avatar"
                        aria-pressed={selected}
                        className="relative aspect-square rounded-full overflow-hidden transition hover:scale-105"
                        style={{
                          backgroundColor: 'var(--theme-bg-surface)',
                          boxShadow: selected ? '0 0 0 2px var(--theme-primary)' : undefined,
                        }}
                      >
                        <img src={url} alt="" loading="lazy" className="w-full h-full" />
                        {selected && (
                          <span
                            className="absolute top-0.5 right-0.5 rounded-full p-0.5"
                            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
                          >
                            <Check size={10} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="profile-display-name" className={fieldLabel} style={{ color: 'var(--theme-text-muted)' }}>
                    Display name
                  </label>
                  <input id="profile-display-name" required maxLength={50} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="profile-username" className={fieldLabel} style={{ color: 'var(--theme-text-muted)' }}>
                    Username
                  </label>
                  <input
                    id="profile-username"
                    required
                    minLength={3}
                    maxLength={30}
                    pattern="[a-zA-Z0-9_\-]+"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="profile-email" className={fieldLabel} style={{ color: 'var(--theme-text-muted)' }}>
                  Email
                </label>
                <input id="profile-email" value={user.email} disabled className={inputClass} style={inputStyle} />
              </div>

              <div className="flex justify-end gap-2">
                <OutlineButton type="button" onClick={() => (setEditing(false), resetMessages())}>
                  Cancel
                </OutlineButton>
                <PrimaryButton type="submit" disabled={isSaving || isUploading}>
                  {isSaving && <Loader2 size={15} className="animate-spin" />}
                  Save changes
                </PrimaryButton>
              </div>
            </form>
          )}

          {tab === 'preferences' && (
            <div className="max-w-[720px] flex flex-col gap-4">
              <section className="rounded-[14px] border p-5 flex flex-col gap-3" style={cardStyle}>
                <CardHeading title="Time format" subtitle={`Current time: ${localTime}`} />
                <div className="grid grid-cols-2 gap-2.5">
                  {(['12', '24'] as TimeFormat[]).map((f) => {
                    const active = timeFormat === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => handleTimeFormatChange(f)}
                        aria-pressed={active}
                        className={`rounded-xl p-[14px] text-left text-sm font-bold ${active ? 'border-2' : 'border'}`}
                        style={{
                          borderColor: active ? 'var(--theme-primary)' : 'var(--theme-border)',
                          backgroundColor: active ? 'var(--theme-bg-surface)' : 'var(--theme-bg-app)',
                          color: 'var(--theme-text)',
                        }}
                      >
                        {f === '12' ? '12-hour (AM/PM)' : '24-hour'}
                      </button>
                    );
                  })}
                </div>
              </section>

              {user.canChangePassword && (
                <form onSubmit={handleChangePassword} className="rounded-[14px] border p-5 flex flex-col gap-4" style={cardStyle}>
                  <CardHeading title="Password" subtitle="Change the password you sign in with" />
                  <div>
                    <label htmlFor="profile-current-password" className={fieldLabel} style={{ color: 'var(--theme-text-muted)' }}>
                      Current password
                    </label>
                    <input
                      id="profile-current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="profile-new-password" className={fieldLabel} style={{ color: 'var(--theme-text-muted)' }}>
                        New password
                      </label>
                      <input id="profile-new-password" type="password" autoComplete="new-password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} style={inputStyle} />
                    </div>
                    <div>
                      <label htmlFor="profile-confirm-password" className={fieldLabel} style={{ color: 'var(--theme-text-muted)' }}>
                        Confirm new password
                      </label>
                      <input id="profile-confirm-password" type="password" autoComplete="new-password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} style={inputStyle} />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <PrimaryButton type="submit" disabled={isSaving}>
                      {isSaving && <Loader2 size={15} className="animate-spin" />}
                      Update password
                    </PrimaryButton>
                  </div>
                </form>
              )}

              <section className="rounded-[14px] border p-5 flex items-center justify-between gap-3" style={cardStyle}>
                <CardHeading title="Sign out" subtitle="End your session on this device" />
                <button
                  type="button"
                  onClick={onLogout}
                  className="h-9 px-[14px] rounded-[18px] border flex items-center gap-1.5 text-[13px] font-medium transition"
                  style={{ borderColor: `color-mix(in srgb, ${DANGER} 40%, transparent)`, color: DANGER }}
                >
                  <LogOut size={15} />
                  Log out
                </button>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CardHeading: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[15px] font-bold" style={{ color: 'var(--theme-text)' }}>
      {title}
    </span>
    {subtitle && (
      <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
        {subtitle}
      </span>
    )}
  </div>
);

const ContactRow: React.FC<{ Icon: React.ElementType; text: string }> = ({ Icon, text }) => (
  <div className="h-9 flex items-center gap-3 min-w-0">
    <Icon size={16} style={{ color: 'var(--theme-text-muted)' }} />
    <span className="text-sm truncate" style={{ color: 'var(--theme-text)' }}>
      {text}
    </span>
  </div>
);

const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className = '', type = 'button', ...rest }) => (
  <button
    type={type}
    {...rest}
    className={`h-9 px-4 rounded-[18px] flex items-center justify-center gap-1.5 text-[13px] font-semibold transition hover:brightness-95 disabled:opacity-50 ${className}`}
    style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
  >
    {children}
  </button>
);

const OutlineButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className = '', type = 'button', ...rest }) => (
  <button
    type={type}
    {...rest}
    className={`h-9 px-[14px] rounded-[18px] border flex items-center justify-center gap-1.5 text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)] disabled:opacity-50 ${className}`}
    style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-app)', color: 'var(--theme-text)' }}
  >
    {children}
  </button>
);
