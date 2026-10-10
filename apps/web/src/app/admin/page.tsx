'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Users,
  Building2,
  Hash,
  MessageSquare,
  HardDrive,
  KeyRound,
  Trash2,
  Search,
  RefreshCw,
  ArrowLeft,
  Plus,
  Check,
  AlertTriangle,
  Lock,
  Mail,
  UserCheck,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';

interface AdminStats {
  totalUsers: number;
  totalWorkspaces: number;
  totalChannels: number;
  totalMessages: number;
  totalAttachments: number;
  totalStorageBytes: number;
  formattedStorage: string;
  onlineUsers: number;
  roles: Record<string, number>;
}

interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  systemRole: 'SUPER_ADMIN' | 'WORKSPACE_ADMIN' | 'USER';
  status: string;
  createdAt: string;
  updatedAt: string;
  memberships: Array<{
    role: string;
    workspace: { id: string; name: string; slug: string };
  }>;
  _count: {
    memberships: number;
    ownedWorkspaces: number;
    messages: number;
  };
}

interface AdminWorkspace {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  owner?: {
    id: string;
    email: string;
    username: string;
    displayName: string;
  };
  _count: {
    members: number;
    channels: number;
    attachments: number;
  };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, token, isLoading: isAuthLoading } = useAuthStore();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'workspaces'>('users');
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [workspaceSearch, setWorkspaceSearch] = useState('');

  // Modals
  const [selectedUserForRole, setSelectedUserForRole] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState<'SUPER_ADMIN' | 'WORKSPACE_ADMIN' | 'USER'>('USER');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [selectedUserForPassword, setSelectedUserForPassword] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<AdminWorkspace | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showCreateWsModal, setShowCreateWsModal] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsSlug, setWsSlug] = useState('');
  const [wsOwnerEmail, setWsOwnerEmail] = useState('');
  const [isCreatingWs, setIsCreatingWs] = useState(false);

  // Feedback notification
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  useEffect(() => {
    if (!isAuthLoading && (!token || user?.systemRole !== 'SUPER_ADMIN')) {
      router.push('/');
    }
  }, [isAuthLoading, token, user, router]);

  const fetchAdminData = async () => {
    try {
      setIsLoading(true);
      const [statsRes, usersRes, wsRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/users'),
        api.get('/api/admin/workspaces'),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setWorkspaces(wsRes.data);
    } catch (err: any) {
      console.error('Failed to load admin data', err);
      showFeedback('error', err.response?.data?.error || 'Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.systemRole === 'SUPER_ADMIN') {
      fetchAdminData();
    }
  }, [user]);

  // Handle Role Update
  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForRole) return;
    setIsUpdatingRole(true);
    try {
      await api.patch(`/api/admin/users/${selectedUserForRole.id}/role`, { systemRole: newRole });
      showFeedback('success', `Updated ${selectedUserForRole.displayName}'s role to ${newRole}`);
      setSelectedUserForRole(null);
      fetchAdminData();
    } catch (err: any) {
      showFeedback('error', err.response?.data?.error || 'Failed to update role');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword || !newPassword) return;
    setIsResettingPassword(true);
    try {
      await api.post(`/api/admin/users/${selectedUserForPassword.id}/reset-password`, {
        newPassword,
      });
      showFeedback('success', `Password reset successfully for ${selectedUserForPassword.displayName}`);
      setSelectedUserForPassword(null);
      setNewPassword('');
    } catch (err: any) {
      showFeedback('error', err.response?.data?.error || 'Failed to reset password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/admin/users/${userToDelete.id}`);
      showFeedback('success', `Deleted user ${userToDelete.displayName}`);
      setUserToDelete(null);
      fetchAdminData();
    } catch (err: any) {
      showFeedback('error', err.response?.data?.error || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Create Workspace on behalf of user
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName || !wsSlug || !wsOwnerEmail) return;
    setIsCreatingWs(true);
    try {
      const res = await api.post('/api/admin/workspaces', {
        name: wsName,
        slug: wsSlug,
        ownerEmailOrId: wsOwnerEmail,
      });
      showFeedback('success', `Created workspace "${res.data.name}" successfully!`);
      setShowCreateWsModal(false);
      setWsName('');
      setWsSlug('');
      setWsOwnerEmail('');
      fetchAdminData();
    } catch (err: any) {
      showFeedback('error', err.response?.data?.error || 'Failed to create workspace');
    } finally {
      setIsCreatingWs(false);
    }
  };

  // Handle Delete Workspace
  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/admin/workspaces/${workspaceToDelete.id}`);
      showFeedback('success', `Deleted workspace "${workspaceToDelete.name}"`);
      setWorkspaceToDelete(null);
      fetchAdminData();
    } catch (err: any) {
      showFeedback('error', err.response?.data?.error || 'Failed to delete workspace');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered lists
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.systemRole === roleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredWorkspaces = workspaces.filter((ws) => {
    return (
      ws.name.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
      ws.slug.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
      (ws.owner?.displayName || '').toLowerCase().includes(workspaceSearch.toLowerCase()) ||
      (ws.owner?.email || '').toLowerCase().includes(workspaceSearch.toLowerCase())
    );
  });

  if (isAuthLoading || user?.systemRole !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen bg-[#141618] flex items-center justify-center text-gray-400">
        <Loader2 className="animate-spin text-purple-400 mr-2" size={24} />
        <span>Verifying Super Admin Authorization...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141618] text-gray-200 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-gray-800 bg-[#1A1D20]/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition text-xs font-semibold border border-gray-700/60"
          >
            <ArrowLeft size={14} />
            <span>Back to App</span>
          </Link>

          <span className="w-px h-6 bg-gray-700 mx-1 hidden sm:inline" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shadow">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-tight">Orbit Control Center</h1>
                <span className="text-[10px] uppercase font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full">
                  Super Admin
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAdminData}
            title="Refresh statistics and data"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition border border-gray-700/60"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
              : 'bg-red-950/90 border-red-500 text-red-200'
          }`}
        >
          {feedback.type === 'success' ? <Check size={15} /> : <AlertTriangle size={15} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* KPI Platform Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-[#1C1F22] border border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-2">
              <span>Total Users</span>
              <Users size={16} className="text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats?.totalUsers ?? '...'}</span>
              {stats && (
                <span className="text-[11px] text-emerald-400 font-medium">
                  • {stats.onlineUsers} online
                </span>
              )}
            </div>
          </div>

          <div className="bg-[#1C1F22] border border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-2">
              <span>Workspaces</span>
              <Building2 size={16} className="text-purple-400" />
            </div>
            <span className="text-2xl font-black text-white">{stats?.totalWorkspaces ?? '...'}</span>
          </div>

          <div className="bg-[#1C1F22] border border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-2">
              <span>Channels</span>
              <Hash size={16} className="text-pink-400" />
            </div>
            <span className="text-2xl font-black text-white">{stats?.totalChannels ?? '...'}</span>
          </div>

          <div className="bg-[#1C1F22] border border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-2">
              <span>Messages</span>
              <MessageSquare size={16} className="text-amber-400" />
            </div>
            <span className="text-2xl font-black text-white">{stats?.totalMessages ?? '...'}</span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-[#1C1F22] border border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-2">
              <span>Total Storage</span>
              <HardDrive size={16} className="text-emerald-400" />
            </div>
            <span className="text-2xl font-black text-white">{stats?.formattedStorage ?? '...'}</span>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'users'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'bg-[#1C1F22] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              <Users size={15} />
              <span>User Management ({users.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('workspaces')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'workspaces'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'bg-[#1C1F22] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              <Building2 size={15} />
              <span>Workspaces ({workspaces.length})</span>
            </button>
          </div>

          {activeTab === 'workspaces' && (
            <button
              onClick={() => setShowCreateWsModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slack-green hover:bg-[#008a65] text-white rounded-xl text-xs font-bold transition shadow"
            >
              <Plus size={14} />
              <span>Create Workspace</span>
            </button>
          )}
        </div>

        {/* TAB 1: USERS */}
        {activeTab === 'users' && (
          <div className="bg-[#1A1D20] border border-gray-800 rounded-2xl overflow-hidden shadow-lg space-y-4">
            {/* Filter / Search Bar */}
            <div className="p-4 border-b border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, username, or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-[#222529] border border-gray-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Role Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                {['ALL', 'SUPER_ADMIN', 'WORKSPACE_ADMIN', 'USER'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition shrink-0 ${
                      roleFilter === r
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                        : 'bg-[#222529] text-gray-400 hover:text-white border border-gray-800'
                    }`}
                  >
                    {r === 'ALL' ? 'All Roles' : r.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#16181B] text-gray-400 uppercase font-semibold text-[10px] tracking-wider border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Platform Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Workspaces</th>
                    <th className="py-3 px-4">Joined Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        No users found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSuper = u.systemRole === 'SUPER_ADMIN';
                      const isWsAdmin = u.systemRole === 'WORKSPACE_ADMIN';

                      return (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition">
                          <td className="py-3 px-4 flex items-center gap-2.5">
                            <img
                              src={u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                              alt={u.displayName}
                              className="w-8 h-8 rounded-xl object-cover border border-gray-700"
                            />
                            <div>
                              <span className="font-bold text-white block">{u.displayName}</span>
                              <span className="text-[11px] text-gray-400 font-mono">@{u.username}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-gray-300 font-mono text-[11px]">
                            {u.email}
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase inline-block border ${
                                isSuper
                                  ? 'bg-purple-900/30 text-purple-300 border-purple-500/50'
                                  : isWsAdmin
                                  ? 'bg-blue-900/30 text-blue-300 border-blue-500/50'
                                  : 'bg-gray-800 text-gray-300 border-gray-700'
                              }`}
                            >
                              {u.systemRole}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                                u.status === 'ONLINE' ? 'text-emerald-400' : 'text-gray-500'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  u.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'
                                }`}
                              />
                              {u.status}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-gray-300 font-medium">
                            <span title={u.memberships.map((m) => m.workspace.name).join(', ')}>
                              {u._count.memberships} {u._count.memberships === 1 ? 'workspace' : 'workspaces'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-gray-400 text-[11px]">
                            {new Date(u.createdAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Change Role Button */}
                              <button
                                onClick={() => {
                                  setSelectedUserForRole(u);
                                  setNewRole(u.systemRole);
                                }}
                                title="Change User System Role"
                                className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition font-medium text-[11px] border border-gray-700"
                              >
                                Role
                              </button>

                              {/* Reset Password Button */}
                              <button
                                onClick={() => {
                                  setSelectedUserForPassword(u);
                                  setNewPassword('');
                                }}
                                title="Reset User Password"
                                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-amber-400 hover:text-amber-300 transition border border-gray-700"
                              >
                                <KeyRound size={13} />
                              </button>

                              {/* Delete User Button */}
                              {u.id !== user.id && (
                                <button
                                  onClick={() => setUserToDelete(u)}
                                  title="Delete User"
                                  className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-400 hover:text-red-300 transition border border-red-800/50"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: WORKSPACES */}
        {activeTab === 'workspaces' && (
          <div className="bg-[#1A1D20] border border-gray-800 rounded-2xl overflow-hidden shadow-lg space-y-4">
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-800/80 flex items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search workspaces or owner..."
                  value={workspaceSearch}
                  onChange={(e) => setWorkspaceSearch(e.target.value)}
                  className="w-full bg-[#222529] border border-gray-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Workspaces Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#16181B] text-gray-400 uppercase font-semibold text-[10px] tracking-wider border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4">Workspace / Organization</th>
                    <th className="py-3 px-4">URL Slug</th>
                    <th className="py-3 px-4">Owner / Admin</th>
                    <th className="py-3 px-4">Members</th>
                    <th className="py-3 px-4">Channels</th>
                    <th className="py-3 px-4">Files</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filteredWorkspaces.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-500">
                        No workspaces found.
                      </td>
                    </tr>
                  ) : (
                    filteredWorkspaces.map((ws) => (
                      <tr key={ws.id} className="hover:bg-white/[0.02] transition">
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slack-activeChannel text-white flex items-center justify-center font-bold text-xs shadow">
                            {ws.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span>{ws.name}</span>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-gray-300">
                          /{ws.slug}
                        </td>

                        <td className="py-3 px-4">
                          <div>
                            <span className="text-white font-medium block">
                              {ws.owner?.displayName || 'Unknown'}
                            </span>
                            <span className="text-[11px] text-gray-400 font-mono">
                              {ws.owner?.email || ''}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-gray-300 font-medium">
                          {ws._count.members}
                        </td>

                        <td className="py-3 px-4 text-gray-300 font-medium">
                          {ws._count.channels}
                        </td>

                        <td className="py-3 px-4 text-gray-300 font-medium">
                          {ws._count.attachments}
                        </td>

                        <td className="py-3 px-4 text-gray-400 text-[11px]">
                          {new Date(ws.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setWorkspaceToDelete(ws)}
                            title="Delete Workspace and Data"
                            className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-400 hover:text-red-300 transition border border-red-800/50"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: CHANGE SYSTEM ROLE */}
      {selectedUserForRole && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedUserForRole(null)}
        >
          <div
            className="bg-[#1A1D21] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-purple-400" />
                <span>Assign Platform Role</span>
              </h3>
              <button
                onClick={() => setSelectedUserForRole(null)}
                className="text-gray-400 hover:text-white p-1 rounded transition"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Select platform authority for <strong>{selectedUserForRole.displayName}</strong> (
              <span className="font-mono text-gray-400">{selectedUserForRole.email}</span>):
            </p>

            <form onSubmit={handleUpdateRole} className="space-y-3">
              <div className="space-y-2">
                <label
                  onClick={() => setNewRole('USER')}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                    newRole === 'USER'
                      ? 'bg-purple-900/20 border-purple-500 text-white'
                      : 'bg-[#222529] border-gray-700/80 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    checked={newRole === 'USER'}
                    onChange={() => setNewRole('USER')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Standard User</span>
                    <span className="text-[11px] text-gray-400 leading-tight">
                      Cannot create workspaces. Can only join workspaces when added by an admin.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setNewRole('WORKSPACE_ADMIN')}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                    newRole === 'WORKSPACE_ADMIN'
                      ? 'bg-blue-900/20 border-blue-500 text-white'
                      : 'bg-[#222529] border-gray-700/80 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    checked={newRole === 'WORKSPACE_ADMIN'}
                    onChange={() => setNewRole('WORKSPACE_ADMIN')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Workspace Admin / CEO</span>
                    <span className="text-[11px] text-gray-400 leading-tight">
                      Authorized to create company workspaces and invite members.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setNewRole('SUPER_ADMIN')}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                    newRole === 'SUPER_ADMIN'
                      ? 'bg-purple-900/30 border-purple-500 text-white'
                      : 'bg-[#222529] border-gray-700/80 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    checked={newRole === 'SUPER_ADMIN'}
                    onChange={() => setNewRole('SUPER_ADMIN')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-purple-300 block flex items-center gap-1.5">
                      <span>Super Admin</span>
                      <span className="text-[9px] bg-purple-500/30 px-1 rounded uppercase">Owner</span>
                    </span>
                    <span className="text-[11px] text-gray-400 leading-tight">
                      Full platform control, access to this Control Center, password resets, and user management.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForRole(null)}
                  className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingRole}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition flex items-center gap-1.5"
                >
                  {isUpdatingRole && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Role</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESET PASSWORD */}
      {selectedUserForPassword && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedUserForPassword(null)}
        >
          <div
            className="bg-[#1A1D21] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound size={18} className="text-amber-400" />
                <span>Reset User Password</span>
              </h3>
              <button
                onClick={() => setSelectedUserForPassword(null)}
                className="text-gray-400 hover:text-white p-1 rounded transition"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Set a new password for <strong>{selectedUserForPassword.displayName}</strong> (
              <span className="font-mono text-gray-400">{selectedUserForPassword.email}</span>):
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Enter at least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#222529] border border-gray-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPassword(null)}
                  className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword || newPassword.length < 6}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-black transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  {isResettingPassword && <Loader2 size={13} className="animate-spin" />}
                  <span>Set New Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE WORKSPACE AS SUPER ADMIN */}
      {showCreateWsModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
          onClick={() => setShowCreateWsModal(false)}
        >
          <div
            className="bg-[#1A1D21] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 size={18} className="text-slack-green" />
                <span>Create Company Workspace</span>
              </h3>
              <button
                onClick={() => setShowCreateWsModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1">
                  Company / Workspace Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Technologies"
                  value={wsName}
                  onChange={(e) => {
                    setWsName(e.target.value);
                    if (!wsSlug) {
                      setWsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }
                  }}
                  className="w-full bg-[#222529] border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-slack-green"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1">
                  URL Slug
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. acme-tech"
                  value={wsSlug}
                  onChange={(e) => setWsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="w-full bg-[#222529] border border-gray-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-slack-green"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1">
                  Owner / CEO Email or Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ceo@acme.com"
                  value={wsOwnerEmail}
                  onChange={(e) => setWsOwnerEmail(e.target.value)}
                  className="w-full bg-[#222529] border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-slack-green"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  This user will be assigned as Workspace Owner and promoted to Workspace Admin.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateWsModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingWs}
                  className="px-4 py-2 rounded-xl bg-slack-green hover:bg-[#008a65] text-xs font-bold text-white transition flex items-center gap-1.5"
                >
                  {isCreatingWs && <Loader2 size={13} className="animate-spin" />}
                  <span>Create Workspace</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION */}
      {(userToDelete || workspaceToDelete) && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
          onClick={() => {
            setUserToDelete(null);
            setWorkspaceToDelete(null);
          }}
        >
          <div
            className="bg-[#1A1D21] border border-red-500/50 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Confirm Permanent Deletion
                </h3>
                <p className="text-xs text-gray-400">
                  This action is irreversible and deletes all associated data.
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300">
              Are you sure you want to delete{' '}
              <strong className="text-white">
                {userToDelete ? userToDelete.displayName : workspaceToDelete?.name}
              </strong>
              ?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setUserToDelete(null);
                  setWorkspaceToDelete(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={userToDelete ? handleDeleteUser : handleDeleteWorkspace}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition flex items-center gap-1.5"
              >
                {isDeleting && <Loader2 size={13} className="animate-spin" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
