'use client';

import React, { useState } from 'react';
import { AssignableWorkspaceRole, UserProfile, Workspace } from '@orbit/types';
import { Briefcase, Check, Contact, Loader2, Mail, Shield, UserPlus, Users } from '@/components/ui/icons';
import { api } from '../../lib/api';
import { Card, CardTitle, PageHeader, PrimaryButton, SUCCESS, DANGER, onTint, tint } from './ui';

export const InviteSettings: React.FC<{
  workspace: Workspace;
  currentUser: UserProfile | null;
  onMemberAdded?: () => void;
}> = ({ workspace, onMemberAdded }) => {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [role, setRole] = useState<AssignableWorkspaceRole>('MEMBER');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim()) return;
    setAdding(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post(`/api/workspaces/${workspace.id}/members`, { emailOrUsername: emailOrUsername.trim(), role });
      setSuccess(`Added ${res.data.user?.displayName || emailOrUsername} to ${workspace.name}.`);
      setEmailOrUsername('');
      onMemberAdded?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add member to workspace');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader title="Add people" subtitle={`Add teammates to ${workspace.name}.`} />
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 flex flex-col gap-4" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
        <Card>
          <CardTitle title="Add people directly" subtitle="Add someone who already has an Orbit account" />
          <form onSubmit={addMember} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <label
                className="flex-1 min-w-[240px] h-11 px-3.5 rounded-xl border flex items-center gap-2.5 focus-within:border-[var(--theme-primary)]"
                style={{ backgroundColor: 'var(--theme-bg-app)', borderColor: 'var(--theme-border)' }}
              >
                <Mail size={16} style={{ color: 'var(--theme-text-muted)' }} />
                <input
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="teammate@company.com or username"
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-[var(--theme-text-muted)]"
                  style={{ color: 'var(--theme-text)' }}
                />
              </label>
              <div className="h-11 p-1 rounded-xl flex items-center gap-0.5" style={{ backgroundColor: 'var(--theme-bg-surface-hover)' }}>
                {(
                  [
                    ['MEMBER', 'Employee', Users],
                    ['MANAGER', 'Manager', Briefcase],
                    ['HR', 'HR', Contact],
                    ['ADMIN', 'Admin', Shield],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className="h-9 px-3 rounded-[9px] flex items-center gap-1.5 text-[13px] transition"
                    style={
                      role === value
                        ? { backgroundColor: 'var(--theme-bg-app)', color: 'var(--theme-primary-hover)', fontWeight: 700, boxShadow: '0 1px 1px rgba(20, 26, 46, 0.06)' }
                        : { color: 'var(--theme-text-muted)', fontWeight: 500 }
                    }
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
              <PrimaryButton
                type="submit"
                disabled={adding || !emailOrUsername.trim()}
                className="!h-11 !rounded-[22px]"
                icon={adding ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              >
                {adding ? 'Adding…' : 'Add to workspace'}
              </PrimaryButton>
            </div>
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              Employees can chat, start huddles and share files and see only their own availability. Managers and HR can also see everyone's availability (managers manage all projects too). Admins can also manage channels, bots, members and roles.
            </p>
            {error && (
              <span className="self-start px-3 py-2 rounded-[10px] text-[13px] font-semibold" style={{ backgroundColor: tint(DANGER, 12), color: DANGER }}>
                {error}
              </span>
            )}
            {success && (
              <span
                className="self-start h-[34px] px-3 rounded-[10px] flex items-center gap-2 text-[13px] font-semibold"
                style={{ backgroundColor: tint(SUCCESS), color: onTint(SUCCESS) }}
              >
                <Check size={15} />
                {success}
              </span>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
};
