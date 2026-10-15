'use client';

import React, { useState } from 'react';
import { ProjectDocument, WorkspaceMember, UserProfile } from '@orbit/types';
import { api } from '../../lib/api';
import {
  X,
  Globe,
  Lock,
  UserPlus,
  Link as LinkIcon,
  Check,
  Trash2,
  Shield,
  Eye,
  Edit3,
  Users,
} from 'lucide-react';

interface ShareDocumentModalProps {
  document: ProjectDocument;
  currentUser: UserProfile | null;
  members: WorkspaceMember[];
  isOpen: boolean;
  onClose: () => void;
  onDocumentUpdated: (doc: ProjectDocument) => void;
}

export const ShareDocumentModal: React.FC<ShareDocumentModalProps> = ({
  document: doc,
  currentUser,
  members,
  isOpen,
  onClose,
  onDocumentUpdated,
}) => {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<'VIEW' | 'EDIT'>('EDIT');
  const [isUpdatingPublic, setIsUpdatingPublic] = useState(false);
  const [isAddingShare, setIsAddingShare] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isCreator = currentUser?.id === doc.createdById;
  const sharedUserIds = new Set((doc.shares || []).map((s) => s.userId));

  // Available members to invite (excluding current creator and already shared users)
  const availableMembers = members.filter(
    (m) => m.userId !== doc.createdById && !sharedUserIds.has(m.userId)
  );

  // Toggle Project-wide public visibility
  const handleToggleProjectPublic = async () => {
    setIsUpdatingPublic(true);
    setError(null);
    try {
      const res = await api.patch(
        `/api/projects/${doc.projectId}/documents/${doc.id}`,
        {
          isPublicInProject: !doc.isPublicInProject,
        }
      );
      onDocumentUpdated(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update document visibility');
    } finally {
      setIsUpdatingPublic(false);
    }
  };

  // Toggle Shareable Link with Token
  const handleTogglePublicLink = async () => {
    setError(null);
    try {
      const res = await api.patch(
        `/api/projects/${doc.projectId}/documents/${doc.id}`,
        {
          isPublicLinkEnabled: !doc.isPublicLinkEnabled,
        }
      );
      onDocumentUpdated(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update share link settings');
    }
  };

  // Add specific member share
  const handleAddMemberShare = async () => {
    if (!selectedUserId) return;
    setIsAddingShare(true);
    setError(null);
    try {
      const res = await api.post(
        `/api/projects/${doc.projectId}/documents/${doc.id}/shares`,
        {
          userId: selectedUserId,
          permission: selectedPermission,
        }
      );
      onDocumentUpdated(res.data);
      setSelectedUserId('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to share document with member');
    } finally {
      setIsAddingShare(false);
    }
  };

  // Remove specific member share
  const handleRemoveShare = async (targetUserId: string) => {
    setError(null);
    try {
      const res = await api.delete(
        `/api/projects/${doc.projectId}/documents/${doc.id}/shares/${targetUserId}`
      );
      onDocumentUpdated(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove member share');
    }
  };

  // Copy shareable link
  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/share/doc/${doc.shareToken || doc.id}`;
    navigator.clipboard.writeText(shareUrl);
    setIsCopying(true);
    setTimeout(() => setIsCopying(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-primary)',
        }}
      >
        {/* Modal Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2.5 truncate">
            <span className="text-xl">{doc.icon || '📄'}</span>
            <div className="truncate">
              <h2 className="text-sm font-bold truncate">
                Share & Permissions
              </h2>
              <p
                className="text-xs truncate opacity-70"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                {doc.title || 'Untitled Document'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="p-3 text-xs rounded-xl bg-red-500/15 border border-red-500/30 text-red-400">
              {error}
            </div>
          )}

          {/* Section 1: Project-wide Visibility Toggle */}
          <div
            className="p-4 rounded-xl border flex items-center justify-between gap-4 transition"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="p-2 rounded-lg mt-0.5 shrink-0"
                style={{
                  backgroundColor: doc.isPublicInProject
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                  color: doc.isPublicInProject ? '#10B981' : '#EF4444',
                }}
              >
                {doc.isPublicInProject ? <Globe size={18} /> : <Lock size={18} />}
              </div>
              <div>
                <h4 className="text-xs font-bold flex items-center gap-2">
                  Share with Workspace Project
                  {doc.isPublicInProject && (
                    <span className="text-[10px] font-semibold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      Public in Project
                    </span>
                  )}
                </h4>
                <p
                  className="text-[11px] mt-0.5 leading-relaxed"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  {doc.isPublicInProject
                    ? 'All workspace members with project access can view and collaborate on this document.'
                    : 'Only you and specific members you invite below can see this document.'}
                </p>
              </div>
            </div>

            {isCreator && (
              <button
                disabled={isUpdatingPublic}
                onClick={handleToggleProjectPublic}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  doc.isPublicInProject ? 'bg-emerald-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    doc.isPublicInProject ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            )}
          </div>

          {/* Section 2: Invite Specific Members */}
          <div>
            <label
              className="block text-xs font-bold mb-2 flex items-center gap-1.5"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              <UserPlus size={14} style={{ color: 'var(--theme-primary)' }} />
              Invite Specific Members
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 rounded-xl px-3 py-2 text-xs border bg-transparent focus:outline-none cursor-pointer"
                style={{
                  borderColor: 'var(--theme-border)',
                  backgroundColor: 'var(--theme-bg-app)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                <option value="" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
                  Select a team member...
                </option>
                {availableMembers.map((m) => (
                  <option
                    key={m.userId}
                    value={m.userId}
                    style={{ backgroundColor: 'var(--theme-bg-surface)' }}
                  >
                    {m.user?.displayName || m.user?.username || m.userId} ({m.role})
                  </option>
                ))}
              </select>

              <select
                value={selectedPermission}
                onChange={(e) => setSelectedPermission(e.target.value as 'VIEW' | 'EDIT')}
                className="rounded-xl px-3 py-2 text-xs border bg-transparent focus:outline-none cursor-pointer"
                style={{
                  borderColor: 'var(--theme-border)',
                  backgroundColor: 'var(--theme-bg-app)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                <option value="EDIT" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
                  Can edit
                </option>
                <option value="VIEW" style={{ backgroundColor: 'var(--theme-bg-surface)' }}>
                  Can view
                </option>
              </select>

              <button
                disabled={!selectedUserId || isAddingShare}
                onClick={handleAddMemberShare}
                className="px-4 py-2 rounded-xl text-xs font-semibold shadow transition disabled:opacity-50 active:scale-95"
                style={{
                  backgroundColor: 'var(--theme-primary)',
                  color: 'var(--theme-primary-text)',
                }}
              >
                {isAddingShare ? 'Adding...' : 'Invite'}
              </button>
            </div>
          </div>

          {/* Section 3: Who Has Access List */}
          <div>
            <h4
              className="text-xs font-bold mb-2 flex items-center gap-1.5"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <Users size={14} />
              Who Has Access ({1 + (doc.shares?.length || 0)})
            </h4>

            <div
              className="rounded-xl border divide-y overflow-hidden"
              style={{
                borderColor: 'var(--theme-border)',
                backgroundColor: 'var(--theme-bg-app)',
              }}
            >
              {/* Document Creator / Owner */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs uppercase"
                    style={{
                      backgroundColor: 'var(--theme-bg-surface-hover)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    {doc.creator?.displayName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold flex items-center gap-1.5">
                      {doc.creator?.displayName || doc.creator?.username || 'Creator'}
                      {currentUser?.id === doc.createdById && (
                        <span className="text-[10px] opacity-60">(You)</span>
                      )}
                    </div>
                    <div
                      className="text-[10px] opacity-60"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      @{doc.creator?.username}
                    </div>
                  </div>
                </div>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1"
                  style={{
                    backgroundColor: 'var(--theme-bg-surface)',
                    color: 'var(--theme-text-muted)',
                  }}
                >
                  <Shield size={11} /> Owner
                </span>
              </div>

              {/* Shared Users */}
              {(doc.shares || []).map((share) => (
                <div
                  key={share.id}
                  className="p-3 flex items-center justify-between group hover:bg-black/5 dark:hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs uppercase"
                      style={{
                        backgroundColor: 'var(--theme-bg-surface-hover)',
                        color: 'var(--theme-text-primary)',
                      }}
                    >
                      {share.user?.displayName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        {share.user?.displayName || share.user?.username || 'Member'}
                        {currentUser?.id === share.userId && (
                          <span className="text-[10px] opacity-60">(You)</span>
                        )}
                      </div>
                      <div
                        className="text-[10px] opacity-60"
                        style={{ color: 'var(--theme-text-muted)' }}
                      >
                        @{share.user?.username}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1"
                      style={{
                        backgroundColor: 'var(--theme-bg-surface)',
                        color: 'var(--theme-text-primary)',
                      }}
                    >
                      {share.permission === 'EDIT' ? (
                        <>
                          <Edit3 size={11} className="text-blue-400" /> Can edit
                        </>
                      ) : (
                        <>
                          <Eye size={11} className="text-emerald-400" /> Can view
                        </>
                      )}
                    </span>

                    {isCreator && (
                      <button
                        onClick={() => handleRemoveShare(share.userId)}
                        title="Remove access"
                        className="p-1 rounded text-red-400 opacity-60 hover:opacity-100 hover:bg-red-500/10 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Public Shareable Link Feature (Future-proof with token) */}
          <div
            className="p-4 rounded-xl border space-y-3"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-app)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon size={14} style={{ color: 'var(--theme-primary)' }} />
                <span className="text-xs font-bold">Public Shareable Link</span>
              </div>
              {isCreator && (
                <button
                  onClick={handleTogglePublicLink}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                    doc.isPublicLinkEnabled
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-black/10 dark:bg-white/5 border-gray-600 text-gray-400'
                  }`}
                >
                  {doc.isPublicLinkEnabled ? 'Link Enabled' : 'Enable Link'}
                </button>
              )}
            </div>

            <p
              className="text-[11px] leading-relaxed"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Share this document with external stakeholders via unique secure token link.
            </p>

            <div className="flex items-center gap-2">
              <input
                readOnly
                value={
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/share/doc/${doc.shareToken || doc.id}`
                    : ''
                }
                className="flex-1 text-xs rounded-xl px-3 py-2 border bg-transparent font-mono opacity-80 select-all"
                style={{
                  borderColor: 'var(--theme-border)',
                  backgroundColor: 'var(--theme-bg-surface)',
                  color: 'var(--theme-text-primary)',
                }}
              />
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 active:scale-95"
                style={{
                  backgroundColor: isCopying
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'var(--theme-bg-surface)',
                  borderColor: isCopying ? '#10B981' : 'var(--theme-border)',
                  color: isCopying ? '#10B981' : 'var(--theme-text-primary)',
                }}
              >
                {isCopying ? (
                  <>
                    <Check size={13} />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <LinkIcon size={13} />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="px-6 py-3 border-t flex justify-end"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border transition hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
