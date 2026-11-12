'use client';

import React, { useRef, useState } from 'react';
import { UserProfile } from '@orbit/types';
import { X, Upload, Check, LogOut, User, KeyRound, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Presence, PRESENCE_STYLE } from '../availability/useTeamPresence';

const AVATAR_STYLES = ['bottts', 'avataaars', 'adventurer', 'lorelei', 'notionists', 'fun-emoji'];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export const defaultAvatar = (username: string) => `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

const input =
  'w-full bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-primary)] disabled:opacity-60';
const label = 'block text-xs font-semibold uppercase tracking-wider text-[var(--theme-text)] mb-1';
const primaryBtn =
  'px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2';

interface ProfileModalProps {
  user: UserProfile;
  workspaceId?: string;
  presence: Presence;
  onClose: () => void;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, workspaceId, presence, onClose, onLogout }) => {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [tab, setTab] = useState<'profile' | 'password'>('profile');

  // Profile tab
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || defaultAvatar(user.username));
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Password tab
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const presets = AVATAR_STYLES.flatMap((style) =>
    [user.username, `${user.username}-alt`].map((seed) => `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`),
  );

  const switchTab = (t: typeof tab) => {
    setTab(t);
    setError('');
    setSuccess('');
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
    setError('');
    setSuccess('');
    setIsSaving(true);
    try {
      const res = await api.patch('/api/auth/me', { displayName, username, avatarUrl });
      setAuth(res.data.user, res.data.accessToken);
      setSuccess('Profile updated');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
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

  const tabBtn = (t: typeof tab, Icon: typeof User, text: string) => (
    <button
      type="button"
      onClick={() => switchTab(t)}
      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition"
      style={
        tab === t
          ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }
          : { color: 'var(--theme-text-muted)' }
      }
    >
      <Icon size={15} /> {text}
    </button>
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your profile"
        className="bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-[var(--theme-border)]">
          <div className="relative shrink-0">
            <img src={avatarUrl} alt="" className="w-12 h-12 rounded-xl object-cover bg-[var(--theme-bg-surface)]" />
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${PRESENCE_STYLE[presence].dot}`}
              style={{ boxShadow: '0 0 0 2px var(--theme-bg-app)' }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[var(--theme-text)] truncate">{user.displayName}</p>
            <p className="text-xs text-[var(--theme-text-muted)] truncate">
              {user.email} · {PRESENCE_STYLE[presence].label}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <div className="flex gap-1 p-1 mb-5 rounded-xl bg-[var(--theme-bg-surface)]">
            {tabBtn('profile', User, 'Edit info')}
            {tabBtn('password', KeyRound, 'Password')}
          </div>

          {error && <p className="mb-4 text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="mb-4 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">{success}</p>}

          {tab === 'profile' ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <span className={label}>Picture</span>
                <div className="flex items-center gap-3 mb-3">
                  <img src={avatarUrl} alt="Selected avatar" className="w-16 h-16 rounded-xl object-cover bg-[var(--theme-bg-surface)]" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={isUploading}
                    className="px-3 py-2 rounded-lg text-sm font-medium border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface)] flex items-center gap-2 disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    Upload photo
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload} />
                </div>
                <p className="text-xs text-[var(--theme-text-muted)] mb-2">Or pick an avatar</p>
                <div className="grid grid-cols-6 gap-2">
                  {presets.map((url) => {
                    const selected = url === avatarUrl;
                    return (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setAvatarUrl(url)}
                        aria-label="Select avatar"
                        aria-pressed={selected}
                        className={`relative aspect-square rounded-xl overflow-hidden bg-[var(--theme-bg-surface)] transition hover:scale-105 ${
                          selected ? 'ring-2 ring-[var(--theme-primary)]' : ''
                        }`}
                      >
                        <img src={url} alt="" loading="lazy" className="w-full h-full" />
                        {selected && (
                          <span className="absolute top-0.5 right-0.5 rounded-full p-0.5 bg-[var(--theme-primary)] text-[var(--theme-primary-text)]">
                            <Check size={10} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="profile-display-name" className={label}>Display name</label>
                <input id="profile-display-name" required maxLength={50} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={input} />
              </div>
              <div>
                <label htmlFor="profile-username" className={label}>Username</label>
                <input
                  id="profile-username"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[a-zA-Z0-9_\-]+"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label htmlFor="profile-email" className={label}>Email</label>
                <input id="profile-email" value={user.email} disabled className={input} />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className={primaryBtn}
                  style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
                >
                  {isSaving && <Loader2 size={15} className="animate-spin" />} Save changes
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label htmlFor="profile-current-password" className={label}>Current password</label>
                <input
                  id="profile-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Leave empty if you only sign in with Microsoft"
                  className={input}
                />
              </div>
              <div>
                <label htmlFor="profile-new-password" className={label}>New password</label>
                <input id="profile-new-password" type="password" autoComplete="new-password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={input} />
              </div>
              <div>
                <label htmlFor="profile-confirm-password" className={label}>Confirm new password</label>
                <input id="profile-confirm-password" type="password" autoComplete="new-password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={input} />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className={primaryBtn}
                  style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
                >
                  {isSaving && <Loader2 size={15} className="animate-spin" />} Update password
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="p-4 border-t border-[var(--theme-border)] flex justify-start">
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 flex items-center gap-2 transition"
          >
            <LogOut size={15} /> Log out
          </button>
        </div>
      </div>
    </div>
  );
};
