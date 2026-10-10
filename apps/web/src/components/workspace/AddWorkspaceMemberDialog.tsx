'use client';

import React, { useState } from 'react';
import { Workspace, UserProfile } from '@orbit/types';
import { UserPlus, Copy, Check, X, Shield, Mail, Loader2, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';

interface AddWorkspaceMemberDialogProps {
  workspace: Workspace;
  currentUser: UserProfile | null;
  onClose: () => void;
  onMemberAdded?: () => void;
}

export const AddWorkspaceMemberDialog: React.FC<AddWorkspaceMemberDialogProps> = ({
  workspace,
  currentUser,
  onClose,
  onMemberAdded,
}) => {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [role, setRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${(workspace as any).inviteCode || workspace.id}`
    : '';

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim()) return;

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.post(`/api/workspaces/${workspace.id}/members`, {
        emailOrUsername: emailOrUsername.trim(),
        role,
      });

      setSuccessMsg(`Successfully added ${res.data.user?.displayName || emailOrUsername} to ${workspace.name}!`);
      setEmailOrUsername('');
      if (onMemberAdded) {
        onMemberAdded();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add member to workspace');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#1A1D21] border border-gray-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-800 bg-[#1F2326] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slack-green/15 text-slack-green border border-slack-green/30">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Add People to {workspace.name}</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Invite team members or add existing signed-up users directly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* Direct Add Form */}
          <form onSubmit={handleAddMember} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Email Address or Username
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. teammate@company.com or alex"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className="w-full bg-[#222529] border border-gray-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-slack-green"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                The user must have an account on Orbit first.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Workspace Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('MEMBER')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                    role === 'MEMBER'
                      ? 'bg-slack-activeChannel/15 border-slack-activeChannel text-white'
                      : 'bg-[#222529] border-gray-700 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="text-xs font-bold text-white">Regular Member</span>
                  <span className="text-[10px] text-gray-400 leading-tight">Can chat, start huddles, and share files</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('ADMIN')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                    role === 'ADMIN'
                      ? 'bg-slack-activeChannel/15 border-slack-activeChannel text-white'
                      : 'bg-[#222529] border-gray-700 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    <Shield size={12} className="text-slack-green" />
                    <span>Workspace Admin</span>
                  </span>
                  <span className="text-[10px] text-gray-400 leading-tight">Can manage channels, bots, and add members</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-1.5">
                <Sparkles size={14} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !emailOrUsername.trim()}
              className="w-full py-2.5 px-4 bg-slack-green hover:bg-[#008a65] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Adding Teammate...</span>
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  <span>Add to {workspace.name}</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <span className="w-full h-px bg-gray-800" />
            <span className="absolute px-3 bg-[#1A1D21] text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Or share invite link
            </span>
          </div>

          {/* Shareable Link Box */}
          <div className="bg-[#222529] border border-gray-700/80 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 font-mono text-[11px] text-gray-300 truncate">
              {inviteLink}
            </div>
            <button
              type="button"
              onClick={copyInvite}
              className="px-3 py-1.5 rounded-lg bg-[#2C3136] hover:bg-[#3E4348] text-xs font-medium text-gray-200 hover:text-white transition shrink-0 flex items-center gap-1.5 border border-gray-700"
            >
              {copiedLink ? (
                <>
                  <Check size={13} className="text-slack-green" />
                  <span className="text-slack-green font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
