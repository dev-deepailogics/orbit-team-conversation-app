'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Activity,
  Sparkles,
  TrendingUp,
  LayoutGrid,
  List,
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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
      className="flex-1 flex flex-col h-full w-full overflow-hidden relative"
      style={{
        backgroundColor: 'var(--theme-bg-app)',
        color: 'var(--theme-text-primary)',
      }}
    >
      {/* Subtle Aurora Glow in Background matching marketing page */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-500/10 via-purple-500/5 to-cyan-400/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      {/* 1. Top Navbar Header */}
      <div
        className="h-16 px-6 sm:px-8 border-b flex items-center justify-between gap-4 shrink-0 backdrop-blur-md sticky top-0 z-20"
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToOrganizationControl}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold hover:border-indigo-500/40 hover:bg-indigo-500/5 transition text-slate-700 dark:text-zinc-200"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <ArrowLeft size={14} className="text-indigo-400" />
            <span>Organization Control</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Search box with pill style */}
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs w-52 sm:w-72 transition-all focus-within:ring-2 focus-within:ring-indigo-500/40"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <Search size={14} className="text-slate-400 dark:text-zinc-500 shrink-0" />
            <input
              type="text"
              placeholder="Search employee by name, username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500"
            />
          </div>

          {/* Detailed Hours / Switch to User Availability */}
          {onSelectEmployeeForAvailability && (
            <button
              onClick={() => onSelectEmployeeForAvailability(teamMembers[0]?.user.id || '')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold hover:border-indigo-500/40 hover:bg-indigo-500/5 transition text-slate-700 dark:text-zinc-200"
              style={{
                backgroundColor: 'var(--theme-bg-app)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <Clock size={14} className="text-indigo-600 dark:text-cyan-400" />
              <span>Detailed Hours</span>
            </button>
          )}

          <button
            onClick={fetchTeamStatus}
            title="Refresh list"
            className="p-2.5 rounded-xl border hover:border-indigo-500/40 hover:bg-indigo-500/5 transition text-slate-600 dark:text-zinc-400"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-indigo-400' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Main Content Body */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6">
        {/* Header Title Section - Styled exactly like the provided reference UI */}
        <div className="pt-1 pb-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: 'var(--theme-text-primary)' }}>
            Employee Status <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400">Dashboard</span>
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
            Track your employees&apos; status, manage attendance and stay updated in real-time.
          </p>
        </div>

        {/* Top 3 KPI Metric Cards - Exact layout and wave curves from user's uploaded screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {/* 1. Active Employees Card */}
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            onClick={() => setFilterTab('active')}
            className={`relative p-5 sm:p-6 rounded-2xl cursor-pointer transition-all border overflow-hidden flex flex-col justify-between group shadow-lg ${
              filterTab === 'active' ? 'ring-2 ring-emerald-400' : ''
            }`}
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: filterTab === 'active' ? '#10B981' : 'var(--theme-border)',
            }}
          >
            {/* Emerald ambient glow backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/25 border border-emerald-400/40 flex items-center justify-center shrink-0 text-emerald-400 shadow-sm">
                  <Users size={22} />
                </div>
                <div>
                  <span className="font-display font-black text-3xl sm:text-4xl block leading-none" style={{ color: 'var(--theme-text-primary)' }}>
                    {activeCount}
                  </span>
                  <span className="text-xs font-medium block mt-1.5" style={{ color: 'var(--theme-text-muted)' }}>
                    Active Employees
                  </span>
                </div>
              </div>

              {/* Percentage pill */}
              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <TrendingUp size={11} />
                <span>{totalCount > 0 ? `${Math.round((activeCount / totalCount) * 100)}%` : '0%'}</span>
              </span>
            </div>

            {/* Bottom SVG sparkline wave curve - Full width with subtle pulsing wave animation */}
            <div className="relative z-0 mt-4 -mb-5 -mx-6 h-12 overflow-hidden opacity-90">
              <svg viewBox="0 0 400 48" preserveAspectRatio="none" fill="none" className="w-full h-full">
                <defs>
                  <linearGradient id="emeraldWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                    <stop offset="60%" stopColor="#10B981" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#34D399" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0 36 C 70 36, 130 33, 190 33 C 240 33, 275 36, 320 22 C 350 12, 380 6, 400 9"
                  stroke="url(#emeraldWaveGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0.2, opacity: 0.5 }}
                  animate={{
                    pathLength: [0.85, 1, 0.85],
                    opacity: [0.75, 1, 0.75],
                    d: [
                      "M0 36 C 70 36, 130 33, 190 33 C 240 33, 275 36, 320 22 C 350 12, 380 6, 400 9",
                      "M0 35 C 70 35, 130 31, 190 31 C 240 31, 275 33, 320 18 C 350 9, 380 4, 400 6",
                      "M0 36 C 70 36, 130 33, 190 33 C 240 33, 275 36, 320 22 C 350 12, 380 6, 400 9",
                    ],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </svg>
            </div>
          </motion.div>

          {/* 2. On Break Card */}
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            onClick={() => setFilterTab('break')}
            className={`relative p-5 sm:p-6 rounded-2xl cursor-pointer transition-all border overflow-hidden flex flex-col justify-between group shadow-lg ${
              filterTab === 'break' ? 'ring-2 ring-amber-400' : ''
            }`}
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: filterTab === 'break' ? '#F59E0B' : 'var(--theme-border)',
            }}
          >
            {/* Amber ambient glow backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/25 border border-amber-400/40 flex items-center justify-center shrink-0 text-amber-400 shadow-sm">
                  <Coffee size={22} />
                </div>
                <div>
                  <span className="font-display font-black text-3xl sm:text-4xl block leading-none" style={{ color: 'var(--theme-text-primary)' }}>
                    {onBreakCount}
                  </span>
                  <span className="text-xs font-medium block mt-1.5" style={{ color: 'var(--theme-text-muted)' }}>
                    On Break
                  </span>
                </div>
              </div>

              {/* Percentage pill */}
              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <TrendingUp size={11} />
                <span>{totalCount > 0 ? `${Math.round((onBreakCount / totalCount) * 100)}%` : '0%'}</span>
              </span>
            </div>

            {/* Bottom SVG sparkline wave curve - Full width with subtle pulsing wave animation */}
            <div className="relative z-0 mt-4 -mb-5 -mx-6 h-12 overflow-hidden opacity-90">
              <svg viewBox="0 0 400 48" preserveAspectRatio="none" fill="none" className="w-full h-full">
                <defs>
                  <linearGradient id="amberWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D97706" stopOpacity="0.4" />
                    <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#FBBF24" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0 38 C 70 38, 120 35, 180 35 C 230 35, 270 24, 320 16 C 350 12, 380 20, 400 14"
                  stroke="url(#amberWaveGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0.2, opacity: 0.5 }}
                  animate={{
                    pathLength: [0.85, 1, 0.85],
                    opacity: [0.75, 1, 0.75],
                    d: [
                      "M0 38 C 70 38, 120 35, 180 35 C 230 35, 270 24, 320 16 C 350 12, 380 20, 400 14",
                      "M0 37 C 70 37, 120 33, 180 33 C 230 33, 270 20, 320 12 C 350 9, 380 16, 400 10",
                      "M0 38 C 70 38, 120 35, 180 35 C 230 35, 270 24, 320 16 C 350 12, 380 20, 400 14",
                    ],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </svg>
            </div>
          </motion.div>

          {/* 3. Offline Card */}
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            onClick={() => setFilterTab('offline')}
            className={`relative p-5 sm:p-6 rounded-2xl cursor-pointer transition-all border overflow-hidden flex flex-col justify-between group shadow-lg ${
              filterTab === 'offline' ? 'ring-2 ring-indigo-400' : ''
            }`}
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: filterTab === 'offline' ? 'var(--theme-primary)' : 'var(--theme-border)',
            }}
          >
            {/* Indigo/Primary ambient glow backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/15 via-purple-500/5 to-transparent pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.25)',
                    borderColor: 'rgba(129, 140, 248, 0.4)',
                    color: '#818CF8',
                    borderWidth: '1px',
                  }}
                >
                  <Clock size={22} />
                </div>
                <div>
                  <span className="font-display font-black text-3xl sm:text-4xl block leading-none" style={{ color: 'var(--theme-text-primary)' }}>
                    {offlineCount}
                  </span>
                  <span className="text-xs font-medium block mt-1.5" style={{ color: 'var(--theme-text-muted)' }}>
                    Offline
                  </span>
                </div>
              </div>

              {/* Percentage pill */}
              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                <TrendingUp size={11} />
                <span>{totalCount > 0 ? `${Math.round((offlineCount / totalCount) * 100)}%` : '0%'}</span>
              </span>
            </div>

            {/* Bottom SVG sparkline wave curve - Full width with subtle pulsing wave animation */}
            <div className="relative z-0 mt-4 -mb-5 -mx-6 h-12 overflow-hidden opacity-90">
              <svg viewBox="0 0 400 48" preserveAspectRatio="none" fill="none" className="w-full h-full">
                <defs>
                  <linearGradient id="indigoWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.4" />
                    <stop offset="60%" stopColor="#6366F1" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#818CF8" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0 36 C 70 36, 130 36, 200 36 C 250 36, 285 24, 335 15 C 360 10, 385 18, 400 13"
                  stroke="url(#indigoWaveGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0.2, opacity: 0.5 }}
                  animate={{
                    pathLength: [0.85, 1, 0.85],
                    opacity: [0.75, 1, 0.75],
                    d: [
                      "M0 36 C 70 36, 130 36, 200 36 C 250 36, 285 24, 335 15 C 360 10, 385 18, 400 13",
                      "M0 35 C 70 35, 130 34, 200 34 C 250 34, 285 20, 335 11 C 360 7, 385 14, 400 10",
                      "M0 36 C 70 36, 130 36, 200 36 C 250 36, 285 24, 335 15 C 360 10, 385 18, 400 13",
                    ],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </svg>
            </div>
          </motion.div>
        </div>

        {/* Displaying Filter Pills Row + Search + View Toggle (matching the reference layout) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-3 pb-1">
          {/* Left: Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* All Pill */}
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                filterTab === 'all'
                  ? 'text-white shadow-md'
                  : 'hover:opacity-90'
              }`}
              style={{
                backgroundColor: filterTab === 'all' ? 'var(--theme-primary)' : 'var(--theme-bg-surface)',
                borderColor: filterTab === 'all' ? 'var(--theme-primary)' : 'var(--theme-border)',
                color: filterTab === 'all' ? 'var(--theme-primary-text)' : 'var(--theme-text-muted)',
              }}
            >
              <Users size={13} />
              <span>All ({totalCount})</span>
            </button>

            {/* Active Pill */}
            <button
              onClick={() => setFilterTab('active')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                filterTab === 'active'
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-md'
                  : 'hover:opacity-90'
              }`}
              style={{
                backgroundColor: filterTab === 'active' ? undefined : 'var(--theme-bg-surface)',
                borderColor: filterTab === 'active' ? undefined : 'var(--theme-border)',
                color: filterTab === 'active' ? '#FFFFFF' : 'var(--theme-text-muted)',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Active ({activeCount})</span>
            </button>

            {/* On Break Pill */}
            <button
              onClick={() => setFilterTab('break')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                filterTab === 'break'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-md'
                  : 'hover:opacity-90'
              }`}
              style={{
                backgroundColor: filterTab === 'break' ? undefined : 'var(--theme-bg-surface)',
                borderColor: filterTab === 'break' ? undefined : 'var(--theme-border)',
                color: filterTab === 'break' ? '#000000' : 'var(--theme-text-muted)',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>On Break ({onBreakCount})</span>
            </button>

            {/* Offline Pill */}
            <button
              onClick={() => setFilterTab('offline')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                filterTab === 'offline'
                  ? 'text-white border-slate-500 shadow-md'
                  : 'hover:opacity-90'
              }`}
              style={{
                backgroundColor: filterTab === 'offline' ? 'var(--theme-bg-surface-hover)' : 'var(--theme-bg-surface)',
                borderColor: filterTab === 'offline' ? 'var(--theme-border)' : 'var(--theme-border)',
                color: filterTab === 'offline' ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Offline ({offlineCount})</span>
            </button>
          </div>

          {/* Right: Search box + Grid/List view toggle buttons */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs w-48 sm:w-60 transition-all focus-within:ring-2 focus-within:ring-indigo-500/40"
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-muted)',
              }}
            >
              <Search size={14} className="shrink-0" style={{ color: 'var(--theme-text-muted)' }} />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full"
                style={{ color: 'var(--theme-text-primary)' }}
              />
            </div>

            {/* View Mode Toggle Buttons */}
            <div
              className="flex items-center p-1 rounded-xl border gap-1"
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <button
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'grid'
                    ? 'text-white shadow-xs'
                    : 'hover:opacity-80'
                }`}
                style={{
                  backgroundColor: viewMode === 'grid' ? 'var(--theme-primary)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--theme-primary-text)' : 'var(--theme-text-muted)',
                }}
              >
                <LayoutGrid size={15} />
              </button>

              <button
                onClick={() => setViewMode('list')}
                title="List View"
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'list'
                    ? 'text-white shadow-xs'
                    : 'hover:opacity-80'
                }`}
                style={{
                  backgroundColor: viewMode === 'list' ? 'var(--theme-primary)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--theme-primary-text)' : 'var(--theme-text-muted)',
                }}
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Employee Cards - Exact visual match to the uploaded screenshot with theme variables */}
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 pt-1'
              : 'space-y-3 pt-1'
          }
        >
          {filteredList.map((item) => {
            const avail = item.availability;
            const isOnlineWorking = avail?.isAvailable && !avail?.isOnBreak;
            const isOnMemberBreak = avail?.isAvailable && avail?.isOnBreak;
            const isOffline = !avail?.isAvailable || Boolean(avail?.offTime);

            return (
              <motion.div
                key={item.user.id}
                whileHover={{ y: -3, scale: 1.01 }}
                transition={{ duration: 0.2 }}
                onClick={() => onSelectEmployeeForAvailability?.(item.user.id)}
                className={`rounded-2xl border p-5 transition-all cursor-pointer relative flex ${
                  viewMode === 'list' ? 'flex-row items-center justify-between' : 'flex-col justify-between'
                } group overflow-hidden shadow-md`}
                style={{
                  backgroundColor: 'var(--theme-bg-surface)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                {/* Subtle soft gradient glow */}
                <div
                  className={`absolute inset-0 opacity-15 pointer-events-none ${
                    isOnlineWorking
                      ? 'bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent'
                      : isOnMemberBreak
                      ? 'bg-gradient-to-br from-amber-500/20 via-transparent to-transparent'
                      : 'bg-gradient-to-br from-purple-500/20 via-transparent to-transparent'
                  }`}
                />

                <div className="relative z-10">
                  {/* Avatar + Display Name + Email */}
                  <div className="flex items-center gap-3.5">
                    <div className="relative shrink-0">
                      {/* Purple circular squircle avatar matching screenshot */}
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shadow-inner"
                        style={{
                          backgroundColor: 'rgba(99, 102, 241, 0.25)',
                          borderColor: 'rgba(129, 140, 248, 0.4)',
                          color: '#C7D2FE',
                          borderWidth: '1px',
                        }}
                      >
                        {item.user.displayName?.[0]?.toUpperCase() || item.user.username?.[0]?.toUpperCase()}
                      </div>
                      {/* Status indicator dot */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-[var(--theme-bg-surface)] ${
                          isOnlineWorking
                            ? 'bg-emerald-500 animate-pulse'
                            : isOnMemberBreak
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                        }`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm truncate" style={{ color: 'var(--theme-text-primary)' }}>
                        {item.user.displayName}
                      </h3>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                        {item.user.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Status Pill Badge + Arrow Button */}
                <div
                  className={`flex items-center justify-between relative z-10 ${
                    viewMode === 'list' ? 'gap-4 shrink-0' : 'pt-4 mt-4 border-t'
                  }`}
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  {isOnlineWorking ? (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1.5"
                      style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        borderColor: 'rgba(16, 185, 129, 0.3)',
                        color: '#10B981',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Active
                    </span>
                  ) : isOnMemberBreak ? (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1.5"
                      style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        borderColor: 'rgba(245, 158, 11, 0.3)',
                        color: '#F59E0B',
                      }}
                    >
                      <Coffee size={11} className="text-amber-500" />
                      On Break
                    </span>
                  ) : (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1.5"
                      style={{
                        backgroundColor: 'var(--theme-bg-app)',
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text-muted)',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Offline
                    </span>
                  )}

                  {/* Circular arrow icon button matching the screenshot */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                    style={{
                      backgroundColor: 'var(--theme-bg-app)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text-muted)',
                      borderWidth: '1px',
                    }}
                  >
                    <ChevronRight size={13} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filteredList.length === 0 && !isLoading && (
          <div className="py-20 text-center text-xs font-mono" style={{ color: 'var(--theme-text-muted)' }}>
            No employees match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
};
