'use client';

import React, { useState } from 'react';
import { Channel, UserProfile } from '@orbit/types';
import { UserPlus, X, Check, Search } from 'lucide-react';
import { api } from '../../lib/api';

interface AddMembersDialogProps {
  channel: Channel;
  workspaceMembers: any[];
  onClose: () => void;
  onMembersAdded: () => void;
}

export const AddMembersDialog: React.FC<AddMembersDialogProps> = ({
  channel,
  workspaceMembers,
  onClose,
  onMembersAdded,
}) => {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleSelect = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAddMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await api.post(`/api/channels/${channel.id}/members`, {
        userIds: selectedUserIds,
      });
      onMembersAdded();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add members');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMembers = workspaceMembers.filter((m) => {
    const user = m.user;
    if (!user) return false;
    return (
      user.displayName.toLowerCase().includes(search.toLowerCase()) ||
      user.username.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2.5 sm:p-4">
      <div className="bg-[var(--theme-bg-app)] border border-[var(--theme-border)] rounded-2xl w-full max-w-md max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b border-[var(--theme-border)] px-3.5 sm:px-6 flex items-center justify-between bg-[var(--theme-bg-surface)]">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-slack-green" />
            <h3 className="text-sm font-bold text-[var(--theme-text)]">Add people to #{channel.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface)] rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[var(--theme-border)]">
          <div className="flex items-center bg-[var(--theme-bg-surface)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-xs text-[var(--theme-text-muted)]">
            <Search size={14} className="mr-2 text-[var(--theme-text-muted)]" />
            <input
              type="text"
              placeholder="Search by name or username"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-[var(--theme-text)] focus:outline-none w-full placeholder:text-[var(--theme-text-muted)]"
            />
          </div>
        </div>

        {/* Member List */}
        <div className="max-h-60 overflow-y-auto p-3 space-y-1">
          {filteredMembers.map((member) => {
            const user: UserProfile = member.user;
            if (!user) return null;
            const isSelected = selectedUserIds.includes(user.id);

            return (
              <div
                key={user.id}
                onClick={() => toggleSelect(user.id)}
                className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition ${
                  isSelected ? 'bg-[var(--theme-bg-surface-hover)] text-[var(--theme-text)]' : 'hover:bg-[var(--theme-bg-surface)] text-[var(--theme-text)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                    alt={user.displayName}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                  <div>
                    <p className="text-xs font-semibold text-[var(--theme-text)]">{user.displayName}</p>
                    <p className="text-[10px] text-[var(--theme-text-muted)]">@{user.username}</p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    isSelected
                      ? 'bg-slack-green border-slack-green text-white'
                      : 'border-[var(--theme-border)] bg-[var(--theme-bg-app)]'
                  }`}
                >
                  {isSelected && <Check size={12} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[var(--theme-bg-surface)] border-t border-[var(--theme-border)] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAddMembers}
            disabled={selectedUserIds.length === 0 || isSubmitting}
            className="px-4 py-2 bg-slack-green hover:bg-[#008a65] text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : `Add ${selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};
