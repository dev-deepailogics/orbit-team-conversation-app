'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Workspace, UserProfile } from '@orbit/types';
import {
  ArrowLeft,
  Users,
  Search,
  Clock,
  Coffee,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  LogOut,
  SlidersHorizontal,
} from 'lucide-react';

interface EmployeeStatusViewProps {
  workspace: Workspace;
  currentUser: UserProfile | null;
  onBackToOrganizationControl: () => void;
  onSelectEmployeeForAvailability?: (userId: string) => void;
}

interface TeamMemberStatusItem {
  user: {
    id: string;
    displayName: string;
    username: string;
    email: string;
    avatarUrl?: string;
    status?: string;
    role?: string;
  };
  role: string;
  availability: {
    id: string;
    date: string;
    isAvailable: boolean;
    isOnBreak: boolean;
    availableTime: string;
    offTime: string | null;
    totalWorkingMinutes: number;
    breaks?: Array<{
      id: string;
      breakReason: string;
      breakDurationMinutes: number;
    }>;
  } | null;
  latestSession?: any;
}

export const EmployeeStatusView: React.FC<EmployeeStatusViewProps> = ({
  workspace,
  currentUser,
  onBackToOrganizationControl,
  onSelectEmployeeForAvailability,
}) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberStatusItem[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'break' | 'offline'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchTeamStatus = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/api/availability/team/${workspace.id}`);
      setTeamMembers(res.data.team || []);
    } catch (err) {
      console.error('Failed to load employee status list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamStatus();
  }, [workspace.id]);

  // Derived counts
  const activeCount = teamMembers.filter(
    (m) => m.availability?.isAvailable && !m.availability?.isOnBreak
  ).length;

  const onBreakCount = teamMembers.filter(
    (m) => m.availability?.isAvailable && m.availability?.isOnBreak
  ).length;

  const offlineCount = teamMembers.filter(
    (m) => !m.availability?.isAvailable || Boolean(m.availability?.offTime)
  ).length;

  const totalCount = teamMembers.length;

  // Filtered list
  const filteredList = teamMembers.filter((item) => {
    const isWorking = item.availability?.isAvailable && !item.availability?.isOnBreak;
    const isOnBreak = item.availability?.isAvailable && item.availability?.isOnBreak;
    const isOffline = !item.availability?.isAvailable || Boolean(item.availability?.offTime);

    if (filterTab === 'active' && !isWorking) return false;
    if (filterTab === 'break' && !isOnBreak) return false;
    if (filterTab === 'offline' && !isOffline) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.user.displayName.toLowerCase().includes(q) ||
      item.user.email.toLowerCase().includes(q) ||
      item.user.username.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="flex-1 flex flex-col h-full w-full overflow-hidden"
      style={{
        backgroundColor: 'var(--theme-bg-app)',
        color: 'var(--theme-text-primary)',
      }}
    >
      {/* 1. Top Navbar Header */}
      <div
        className="h-16 px-6 sm:px-8 border-b flex items-center justify-between gap-4 shrink-0"
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToOrganizationControl}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold hover:opacity-85 transition"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
          >
            <ArrowLeft size={14} />
            <span>Organization control</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Search box */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs w-48 sm:w-64"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
          >
            <Search size={14} />
            <input
              type="text"
              placeholder="Filter employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full text-white placeholder-gray-500"
            />
          </div>

          {/* Detailed Hours / Switch to User Availability */}
          {onSelectEmployeeForAvailability && (
            <button
              onClick={() => onSelectEmployeeForAvailability(teamMembers[0]?.user.id || '')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition hover:opacity-85"
              style={{
                backgroundColor: 'var(--theme-bg-app)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <Clock size={14} className="text-blue-400" />
              <span>Detailed Hours</span>
            </button>
          )}

          <button
            onClick={fetchTeamStatus}
            title="Refresh list"
            className="p-2 rounded-xl border hover:opacity-85 transition"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Main Content Body */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6">
        {/* Title */}
        <div className="text-center pt-2 pb-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Employee Status Dashboard
          </h1>
        </div>

        {/* Top 3 KPI Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Active Employees (Green Gradient Card) */}
          <div
            onClick={() => setFilterTab('active')}
            className={`p-5 rounded-2xl cursor-pointer transition transform hover:scale-[1.01] shadow-lg flex items-center gap-4 border ${
              filterTab === 'active' ? 'ring-2 ring-emerald-400' : ''
            }`}
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              borderColor: 'rgba(52, 211, 153, 0.4)',
              color: '#FFFFFF',
            }}
          >
            <div className="w-13 h-13 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
              <Users size={24} className="text-white" />
            </div>
            <div>
              <span className="text-3xl sm:text-4xl font-extrabold block leading-none">
                {activeCount}
              </span>
              <span className="text-xs sm:text-sm font-semibold tracking-wide block mt-1 text-white/95">
                Active Employees
              </span>
            </div>
          </div>

          {/* 2. On Break (Amber Gradient Card) */}
          <div
            onClick={() => setFilterTab('break')}
            className={`p-5 rounded-2xl cursor-pointer transition transform hover:scale-[1.01] shadow-lg flex items-center gap-4 border ${
              filterTab === 'break' ? 'ring-2 ring-amber-400' : ''
            }`}
            style={{
              background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
              borderColor: 'rgba(251, 191, 36, 0.4)',
              color: '#FFFFFF',
            }}
          >
            <div className="w-13 h-13 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
              <Coffee size={24} className="text-white" />
            </div>
            <div>
              <span className="text-3xl sm:text-4xl font-extrabold block leading-none">
                {onBreakCount}
              </span>
              <span className="text-xs sm:text-sm font-semibold tracking-wide block mt-1 text-white/95">
                On Break
              </span>
            </div>
          </div>

          {/* 3. Offline (Dark Surface Card) */}
          <div
            onClick={() => setFilterTab('offline')}
            className={`p-5 rounded-2xl cursor-pointer transition transform hover:scale-[1.01] shadow-lg flex items-center gap-4 border ${
              filterTab === 'offline' ? 'ring-2 ring-blue-500' : ''
            }`}
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'var(--theme-border)',
              color: '#FFFFFF',
            }}
          >
            <div
              className="w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: 'var(--theme-bg-app)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <LogOut size={22} className="text-slate-400" />
            </div>
            <div>
              <span className="text-3xl sm:text-4xl font-extrabold block leading-none text-white">
                {offlineCount}
              </span>
              <span className="text-xs sm:text-sm font-semibold tracking-wide block mt-1 text-slate-400">
                Offline
              </span>
            </div>
          </div>
        </div>

        {/* Displaying Filter Pills Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span style={{ color: 'var(--theme-text-muted)' }} className="font-semibold mr-1">
              Displaying:
            </span>

            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-full font-bold transition border ${
                filterTab === 'all'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                  : 'text-gray-400 border-white/5 hover:border-white/20'
              }`}
              style={{
                backgroundColor: filterTab === 'all' ? undefined : 'var(--theme-bg-surface)',
                borderColor: filterTab === 'all' ? undefined : 'var(--theme-border)',
              }}
            >
              All ({totalCount})
            </button>

            <button
              onClick={() => setFilterTab('active')}
              className={`px-3 py-1.5 rounded-full font-bold transition border ${
                filterTab === 'active'
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                  : 'text-emerald-400 hover:border-emerald-500/30'
              }`}
              style={{
                backgroundColor: filterTab === 'active' ? undefined : 'var(--theme-bg-surface)',
                borderColor: filterTab === 'active' ? undefined : 'var(--theme-border)',
              }}
            >
              Active ({activeCount})
            </button>

            <button
              onClick={() => setFilterTab('break')}
              className={`px-3 py-1.5 rounded-full font-bold transition border ${
                filterTab === 'break'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-sm'
                  : 'text-amber-400 hover:border-amber-500/30'
              }`}
              style={{
                backgroundColor: filterTab === 'break' ? undefined : 'var(--theme-bg-surface)',
                borderColor: filterTab === 'break' ? undefined : 'var(--theme-border)',
              }}
            >
              On Break ({onBreakCount})
            </button>

            <button
              onClick={() => setFilterTab('offline')}
              className={`px-3 py-1.5 rounded-full font-bold transition border ${
                filterTab === 'offline'
                  ? 'bg-slate-700 text-white border-slate-500 shadow-sm'
                  : 'text-gray-400 hover:border-white/20'
              }`}
              style={{
                backgroundColor: filterTab === 'offline' ? undefined : 'var(--theme-bg-surface)',
                borderColor: filterTab === 'offline' ? undefined : 'var(--theme-border)',
              }}
            >
              Offline ({offlineCount})
            </button>
          </div>

          <span className="text-[11px] italic" style={{ color: 'var(--theme-text-muted)' }}>
            Click any card to open detailed User Availability
          </span>
        </div>

        {/* Grid of Employee Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {filteredList.map((item) => {
            const avail = item.availability;
            const isOnlineWorking = avail?.isAvailable && !avail?.isOnBreak;
            const isOnMemberBreak = avail?.isAvailable && avail?.isOnBreak;
            const isOffline = !avail?.isAvailable || Boolean(avail?.offTime);

            const topStripeColor = isOnlineWorking
              ? '#10B981'
              : isOnMemberBreak
              ? '#F59E0B'
              : '#475569';

            return (
              <div
                key={item.user.id}
                onClick={() => onSelectEmployeeForAvailability?.(item.user.id)}
                className="rounded-2xl border p-4 transition duration-150 transform hover:-translate-y-0.5 hover:shadow-xl cursor-pointer relative flex flex-col justify-between group overflow-hidden"
                style={{
                  backgroundColor: 'var(--theme-bg-surface)',
                  borderColor: 'var(--theme-border)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                }}
              >
                {/* Top colored status accent bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: topStripeColor }}
                />

                {/* Card Top: Avatar + Name + Email */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center font-bold text-blue-300 text-sm shadow-inner">
                      {item.user.displayName?.[0]?.toUpperCase() || item.user.username?.[0]?.toUpperCase()}
                    </div>
                    {/* Status dot */}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#1E293B] ${
                        isOnlineWorking
                          ? 'bg-emerald-500 animate-pulse'
                          : isOnMemberBreak
                          ? 'bg-amber-500'
                          : 'bg-slate-500'
                      }`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-blue-400 transition">
                      {item.user.displayName}
                    </h3>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                      {item.user.email}
                    </p>
                  </div>
                </div>

                {/* Card Bottom: Status Pill Badge + Arrow */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                  {isOnlineWorking ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Active
                    </span>
                  ) : isOnMemberBreak ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      On Break
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-400 border border-white/10 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                      Offline
                    </span>
                  )}

                  <ChevronRight
                    size={15}
                    className="text-gray-400 group-hover:text-blue-400 group-hover:translate-x-0.5 transition"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {filteredList.length === 0 && !isLoading && (
          <div className="py-16 text-center text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            No employees match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
};
