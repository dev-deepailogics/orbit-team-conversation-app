'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Workspace, UserProfile, UserAvailabilityRecord } from '@orbit/types';
import {
  ArrowLeft,
  Search,
  Download,
  Calendar,
  Clock,
  Coffee,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Users,
  Activity,
  AlertCircle,
  FileSpreadsheet,
  UserMinus,
  Loader2,
} from 'lucide-react';

interface UserAvailabilityViewProps {
  workspace: Workspace;
  currentUser: UserProfile | null;
  initialUserId?: string;
  onBackToOrganizationControl: () => void;
}

interface TeamMemberItem {
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
  availability: UserAvailabilityRecord | null;
  latestSession?: UserAvailabilityRecord | null;
}

export const UserAvailabilityView: React.FC<UserAvailabilityViewProps> = ({
  workspace,
  currentUser,
  initialUserId,
  onBackToOrganizationControl,
}) => {
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [teamMembers, setTeamMembers] = useState<TeamMemberItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(initialUserId || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Calendar State
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [monthRecords, setMonthRecords] = useState<UserAvailabilityRecord[]>([]);
  const [isLoadingMonth, setIsLoadingMonth] = useState<boolean>(false);

  // Selected date modal (Image 3)
  const [selectedRecordForModal, setSelectedRecordForModal] = useState<UserAvailabilityRecord | null>(null);
  const [modalDateLabel, setModalDateLabel] = useState<string>('');
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [isKicking, setIsKicking] = useState<boolean>(false);

  // Check if current logged-in user can kick members (Super Admin or Workspace Owner/Admin)
  const myMemberItem = teamMembers.find((m) => m.user.id === currentUser?.id);
  const canKick =
    currentUser?.systemRole === 'SUPER_ADMIN' ||
    workspace.ownerId === currentUser?.id ||
    myMemberItem?.role === 'OWNER' ||
    myMemberItem?.role === 'ADMIN';

  const fetchTeam = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/api/availability/team/${workspace.id}`);
      const list: TeamMemberItem[] = res.data.team || [];
      setTeamMembers(list);

      // Auto-select initial user, current logged-in user, or first user
      if (list.length > 0) {
        if (initialUserId && list.some((m) => m.user.id === initialUserId)) {
          setSelectedUserId(initialUserId);
        } else {
          const selfMatch = list.find((m) => m.user.id === currentUser?.id);
          setSelectedUserId(selfMatch ? selfMatch.user.id : list[0].user.id);
        }
      }
    } catch (err) {
      console.error('Failed to load team availability:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKickMember = async (memberToKick: TeamMemberItem) => {
    if (!confirm(`Are you sure you want to kick ${memberToKick.user.displayName} from ${workspace.name}?`)) {
      return;
    }
    try {
      setIsKicking(true);
      await api.delete(`/api/workspaces/${workspace.id}/members/${memberToKick.user.id}`);
      alert(`Successfully removed ${memberToKick.user.displayName} from ${workspace.name}.`);
      await fetchTeam();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove member from workspace');
    } finally {
      setIsKicking(false);
    }
  };

  // 1. Fetch Workspace Team List
  useEffect(() => {
    fetchTeam();
  }, [workspace.id, currentUser?.id]);

  // Selected Member Object
  const selectedMember = teamMembers.find((m) => m.user.id === selectedUserId) || teamMembers[0];

  // 2. Fetch History Calendar records when selected user or month changes
  useEffect(() => {
    if (!selectedUserId || activeTab !== 'history') return;

    const fetchHistory = async () => {
      try {
        setIsLoadingMonth(true);
        const res = await api.get(`/api/availability/history/${selectedUserId}?year=${currentYear}&month=${currentMonth}`);
        setMonthRecords(res.data.records || []);
      } catch (err) {
        console.error('Failed to load history calendar:', err);
      } finally {
        setIsLoadingMonth(false);
      }
    };

    fetchHistory();
  }, [selectedUserId, currentYear, currentMonth, activeTab]);

  // Calendar Math
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  // Build calendar matrix (Monday to Sunday)
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOffset = (year: number, month: number) => {
    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const day = new Date(year, month - 1, 1).getDay();
    // Convert to Monday = 0, Sunday = 6
    return day === 0 ? 6 : day - 1;
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOffset = getFirstDayOffset(currentYear, currentMonth);

  // Map records by day string "YYYY-MM-DD"
  const recordsByDate = new Map<string, UserAvailabilityRecord>();
  monthRecords.forEach((r) => {
    recordsByDate.set(r.date, r);
  });

  // Calculate stats for today
  const todayRecord = selectedMember?.availability;
  const isAvailableToday = todayRecord?.isAvailable ?? false;
  const isOnBreakToday = todayRecord?.isOnBreak ?? false;

  // Filtered members by search query
  const filteredMembers = teamMembers.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.user.displayName.toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q) ||
      m.user.username.toLowerCase().includes(q)
    );
  });

  // Click on a calendar day
  const handleDayClick = (dayNumber: number) => {
    const dayStr = dayNumber.toString().padStart(2, '0');
    const monthStr = currentMonth.toString().padStart(2, '0');
    const dateKey = `${currentYear}-${monthStr}-${dayStr}`;

    const rec = recordsByDate.get(dateKey);
    const dateFormatted = `${monthNames[currentMonth - 1]} ${dayNumber}, ${currentYear}`;
    setModalDateLabel(dateFormatted);

    if (rec) {
      setSelectedRecordForModal(rec);
    } else {
      // Empty mock/null record for day without check-in
      setSelectedRecordForModal(null);
    }
    setShowDetailModal(true);
  };

  // Helper formatting minutes
  const formatMins = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  // Helper calculating effective working minutes dynamically
  const getEffectiveWorkingMinutes = (rec: UserAvailabilityRecord | null | undefined): number => {
    if (!rec) return 0;
    const breaks = rec.breaks || [];
    const breakMins = breaks.reduce((acc, b) => acc + (b.breakDurationMinutes || 0), 0);

    if (rec.totalWorkingMinutes && rec.totalWorkingMinutes > 0) {
      return rec.totalWorkingMinutes;
    }

    if (rec.availableTime && rec.offTime) {
      const startMs = new Date(rec.availableTime).getTime();
      const endMs = new Date(rec.offTime).getTime();
      const grossMins = Math.max(0, Math.round((endMs - startMs) / 60000));
      return Math.max(0, grossMins - breakMins);
    }

    if (rec.availableTime && rec.isAvailable) {
      const startMs = new Date(rec.availableTime).getTime();
      const grossMins = Math.max(0, Math.round((Date.now() - startMs) / 60000));
      return Math.max(0, grossMins - breakMins);
    }

    return 0;
  };

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
          <div className="h-4 w-px bg-gray-600/40" />
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
            User Availability
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            Timezone: <strong className="text-white">PKT (UTC+5)</strong>
          </span>

          <button
            onClick={() => {
              alert('Exporting availability sheet (CSV/Excel)...');
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            <Download size={14} />
            <span>Export Sheet</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Split View (Sidebar list on left, Details on right) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Active Users List */}
        <div
          className="w-full md:w-80 lg:w-96 border-r flex flex-col shrink-0"
          style={{
            backgroundColor: 'var(--theme-bg-surface)',
            borderColor: 'var(--theme-border)',
          }}
        >
          {/* List Header */}
          <div className="p-4 border-b space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Users size={16} className="text-blue-400" />
                <span>Active Users ({teamMembers.length})</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                ALL PRESENT
              </span>
            </div>

            {/* Filter Search Box */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs"
              style={{
                backgroundColor: 'var(--theme-bg-app)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                placeholder="Filter active users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full text-white placeholder-gray-500"
              />
            </div>
          </div>

          {/* User Cards Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredMembers.map((item) => {
              const isSelected = item.user.id === selectedMember?.user.id;
              const isOnline = item.availability?.isAvailable && !item.availability?.isOnBreak;
              const isOnBreak = item.availability?.isOnBreak;

              return (
                <div
                  key={item.user.id}
                  onClick={() => setSelectedUserId(item.user.id)}
                  className={`p-3 rounded-2xl border cursor-pointer transition flex items-center gap-3 ${
                    isSelected
                      ? 'border-blue-500 shadow-md ring-1 ring-blue-500/50'
                      : 'hover:border-white/20'
                  }`}
                  style={{
                    backgroundColor: isSelected ? 'rgba(0, 145, 255, 0.08)' : 'var(--theme-bg-app)',
                    borderColor: isSelected ? '#0091FF' : 'var(--theme-border)',
                  }}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center font-bold text-blue-300 text-sm">
                      {item.user.displayName[0]?.toUpperCase() || item.user.username[0]?.toUpperCase()}
                    </div>
                    {isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#1E1E1E]" />
                    )}
                    {isOnBreak && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-full border-2 border-[#1E1E1E]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {item.user.displayName}
                    </p>
                    <p className="text-[11px] truncate text-gray-400 mt-0.5">
                      {item.user.email}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: User Details & Attendance (Image 1 & Image 2) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {selectedMember ? (
            <>
              {/* Profile Header Banner */}
              <div
                className="p-5 sm:p-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                style={{
                  backgroundColor: '#1E293B',
                  borderColor: '#334155',
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600/40 border border-blue-400/40 flex items-center justify-center text-xl font-bold text-blue-200 shadow-inner">
                    {selectedMember.user.displayName[0]?.toUpperCase() || selectedMember.user.username[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">
                      {selectedMember.user.displayName}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${
                        isAvailableToday
                          ? 'bg-emerald-400 animate-pulse'
                          : isOnBreakToday
                          ? 'bg-amber-400'
                          : 'bg-slate-500'
                      }`} />
                      <span className="text-xs text-slate-300">
                        {isAvailableToday
                          ? 'Available & Working'
                          : isOnBreakToday
                          ? 'On Break'
                          : todayRecord?.offTime
                          ? 'Shift Concluded'
                          : 'Offline'} • {selectedMember.user.role || 'Software Developer'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300 flex items-center gap-1.5">
                      <span>✉</span> {selectedMember.user.email}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-200 border border-white/10">
                      {selectedMember.role}
                    </span>
                  </div>

                  {/* Kick from Workspace Button for SuperAdmin / Workspace Admin */}
                  {canKick && selectedMember.user.id !== currentUser?.id && selectedMember.role !== 'OWNER' && (
                    <button
                      onClick={() => handleKickMember(selectedMember)}
                      disabled={isKicking}
                      title={`Kick ${selectedMember.user.displayName} from this workspace`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-800/60 shadow-sm transition disabled:opacity-50"
                    >
                      {isKicking ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <UserMinus size={13} className="text-rose-400" />
                      )}
                      <span>Kick from Workspace</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-tabs: Today / History Calendar */}
              <div className="flex items-center gap-6 border-b" style={{ borderColor: 'var(--theme-border)' }}>
                <button
                  onClick={() => setActiveTab('today')}
                  className={`pb-3 text-sm font-semibold transition border-b-2 ${
                    activeTab === 'today'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`pb-3 text-sm font-semibold transition border-b-2 ${
                    activeTab === 'history'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  History Calendar
                </button>
              </div>

              {/* TAB 1: TODAY'S ACTIVE SESSION (Image 1) */}
              {activeTab === 'today' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Working Hours Card */}
                  <div
                    className="rounded-2xl border p-6 space-y-6 shadow-sm"
                    style={{
                      backgroundColor: '#1E293B',
                      borderColor: '#334155',
                    }}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
                      <div className="flex items-center gap-2 font-bold text-sm text-white">
                        <Clock size={16} className="text-blue-400" />
                        <span>Working Hours</span>
                      </div>
                      {todayRecord?.isAvailable && !todayRecord?.offTime ? (
                        <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Session in progress
                        </span>
                      ) : todayRecord?.offTime ? (
                        <span className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                          <CheckCircle2 size={13} className="text-blue-400" />
                          Shift Completed
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-slate-500" />
                          Not Checked In Today
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Date
                        </span>
                        <p className="text-sm sm:text-base font-bold text-white mt-1">
                          {todayRecord?.availableTime
                            ? new Date(todayRecord.availableTime).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : new Date().toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                        </p>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Available From
                        </span>
                        <p className="text-sm sm:text-base font-bold text-white mt-1">
                          {todayRecord?.availableTime
                            ? new Date(todayRecord.availableTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </p>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Off Time
                        </span>
                        <p className={`text-sm sm:text-base font-semibold mt-1 ${
                          todayRecord?.offTime ? 'text-white' : todayRecord?.isAvailable ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {todayRecord?.offTime
                            ? new Date(todayRecord.offTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : todayRecord?.isAvailable
                            ? 'Still Active'
                            : '—'}
                        </p>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Total Hours
                        </span>
                        <p className="text-sm sm:text-base font-bold text-blue-400 mt-1">
                          {todayRecord ? (
                            <>
                              {formatMins(getEffectiveWorkingMinutes(todayRecord))}{' '}
                              <span className="text-xs font-normal text-slate-400">
                                {todayRecord.isAvailable && !todayRecord.offTime
                                  ? '(Net Working Time - ongoing)'
                                  : '(Net Working Time)'}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400 font-normal">0h 0m</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Calculation Summary Box */}
                    {todayRecord ? (
                      <div className="pt-4 border-t border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {(() => {
                          const breaks = todayRecord?.breaks || [];
                          const breakMins = breaks.reduce((acc, b) => acc + (b.breakDurationMinutes || 0), 0);

                          let grossMins = 0;
                          if (todayRecord?.availableTime && todayRecord?.offTime) {
                            const startMs = new Date(todayRecord.availableTime).getTime();
                            const endMs = new Date(todayRecord.offTime).getTime();
                            grossMins = Math.max(0, Math.round((endMs - startMs) / 60000));
                          } else if (todayRecord?.availableTime) {
                            const startMs = new Date(todayRecord.availableTime).getTime();
                            grossMins = Math.max(0, Math.round((Date.now() - startMs) / 60000));
                          }

                          const computedNetMins = Math.max(0, grossMins - breakMins);

                          return (
                            <>
                              <div className="space-y-1 text-xs text-slate-300">
                                <div className="flex items-center gap-4">
                                  <span className="text-slate-400">Total Time:</span>
                                  <strong className="text-white">{formatMins(grossMins)}</strong>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-slate-400">Break Time:</span>
                                  <strong className="text-white">{formatMins(breakMins)}</strong>
                                </div>
                              </div>

                              <div className="px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs">
                                <span className="text-[10px] uppercase font-bold text-blue-400 block tracking-wider">
                                  Calculation:
                                </span>
                                <span className="font-mono font-bold text-blue-200">
                                  {formatMins(grossMins)} – {formatMins(breakMins)} = {formatMins(computedNetMins)}
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                        <span>No working session initiated for today.</span>
                        {selectedMember.latestSession && (
                          <span className="text-[11px] text-slate-400">
                            Last active on{' '}
                            <strong className="text-slate-300">
                              {new Date(selectedMember.latestSession.availableTime).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Attendance Timeline & Checkpoints */}
                  <div
                    className="rounded-2xl border p-6 space-y-4"
                    style={{
                      backgroundColor: 'var(--theme-bg-surface)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      Attendance Timeline & Checkpoints
                    </span>

                    {todayRecord?.availableTime ? (
                      <div className="space-y-3">
                        {/* Check-in Checkpoint */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5 text-xs">
                          <div className="flex items-center gap-3">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                            <strong className="text-white">
                              {new Date(todayRecord.availableTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </strong>
                            <span className="text-gray-300">Logged into workspace via Orbit Desktop / Web</span>
                          </div>
                          <span className="text-gray-400 text-[11px]">System Verified</span>
                        </div>

                        {/* Break Checkpoints */}
                        {todayRecord.breaks?.map((b, idx) => (
                          <div key={b.id || idx} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5 text-xs">
                            <div className="flex items-center gap-3">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                              <strong className="text-white">
                                {new Date(b.breakStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </strong>
                              <span className="text-gray-300">
                                Took Break: <span className="capitalize text-amber-300 font-medium">{b.breakReason}</span> ({b.breakDurationMinutes} mins)
                              </span>
                            </div>
                            <span className="text-gray-400 text-[11px]">
                              {b.availableAfterBreak
                                ? `Resumed: ${new Date(b.availableAfterBreak).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : 'On Break'}
                            </span>
                          </div>
                        ))}

                        {/* Check-out / Current Status Checkpoint */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5 text-xs">
                          <div className="flex items-center gap-3">
                            <span className={`w-2.5 h-2.5 rounded-full ${todayRecord.offTime ? 'bg-blue-400' : 'bg-emerald-400 animate-pulse'}`} />
                            <strong className="text-white">
                              {todayRecord.offTime
                                ? new Date(todayRecord.offTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : 'Ongoing'}
                            </strong>
                            <span className="text-gray-300">
                              {todayRecord.offTime
                                ? `Checked out (Total Net: ${formatMins(getEffectiveWorkingMinutes(todayRecord))})`
                                : 'Status set to Available & Working'}
                            </span>
                          </div>
                          <span className="text-emerald-400 font-semibold text-[11px]">
                            {todayRecord.offTime ? 'Shift Concluded' : 'Active Window'}
                          </span>
                        </div>
                      </div>
                    ) : selectedMember.latestSession ? (
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-xs text-gray-400 flex items-center justify-between">
                          <span>
                            No attendance recorded for today ({new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}).
                          </span>
                          <button
                            onClick={() => setActiveTab('history')}
                            className="text-blue-400 hover:text-blue-300 font-semibold underline"
                          >
                            View in History Calendar →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-gray-400">
                        No check-in activity recorded yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: HISTORY CALENDAR (Image 2) */}
              {activeTab === 'history' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div
                    className="p-6 rounded-2xl border shadow-sm"
                    style={{
                      backgroundColor: 'var(--theme-bg-surface)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    {/* Calendar Month Selector Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-700/50">
                      <div>
                        <h3 className="text-base font-bold text-white">
                          Attendance Log — {monthNames[currentMonth - 1]} {currentYear}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Overview of worked days, leaves, and calculated net duration. Click any date to view detailed breakdown.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          onClick={handlePrevMonth}
                          className="p-1.5 rounded-lg border hover:bg-white/10 transition"
                          style={{ borderColor: 'var(--theme-border)' }}
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-black/20 border border-white/5 min-w-[120px] text-center">
                          {monthNames[currentMonth - 1]} {currentYear}
                        </span>
                        <button
                          onClick={handleNextMonth}
                          className="p-1.5 rounded-lg border hover:bg-white/10 transition"
                          style={{ borderColor: 'var(--theme-border)' }}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Day-of-week Headers (M, T, W, T, F, S, S) */}
                    <div className="grid grid-cols-7 gap-2.5 mb-2 text-center text-xs font-semibold text-gray-400">
                      <span>M</span>
                      <span>T</span>
                      <span>W</span>
                      <span>T</span>
                      <span>F</span>
                      <span>S</span>
                      <span>S</span>
                    </div>

                    {/* Calendar Grid of Day Cards */}
                    <div className="grid grid-cols-7 gap-2.5">
                      {/* Empty padding boxes before first day */}
                      {Array.from({ length: firstDayOffset }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-16 sm:h-20 rounded-xl opacity-20 border border-transparent" />
                      ))}

                      {/* Actual Days 1..N */}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const dayNum = i + 1;
                        const dayStr = dayNum.toString().padStart(2, '0');
                        const monthStr = currentMonth.toString().padStart(2, '0');
                        const dateKey = `${currentYear}-${monthStr}-${dayStr}`;
                        const record = recordsByDate.get(dateKey);

                        // Check if today
                        const isCurrentDay =
                          dayNum === new Date().getDate() &&
                          currentMonth === new Date().getMonth() + 1 &&
                          currentYear === new Date().getFullYear();

                        const hasShift = Boolean(record);
                        const durationMins = getEffectiveWorkingMinutes(record);

                        return (
                          <div
                            key={dateKey}
                            onClick={() => handleDayClick(dayNum)}
                            className={`h-16 sm:h-20 p-2 rounded-xl border flex flex-col justify-between cursor-pointer transition transform hover:scale-[1.02] shadow-xs ${
                              isCurrentDay
                                ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-2 ring-blue-400/50'
                                : hasShift
                                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                                : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs sm:text-sm">{dayNum}</span>
                              {isCurrentDay && (
                                <span className="text-[9px] font-bold px-1 rounded bg-white/20">
                                  Today
                                </span>
                              )}
                            </div>

                            <div className="text-right">
                              {hasShift ? (
                                <span className="text-[10px] sm:text-xs font-mono font-medium block">
                                  {formatMins(durationMins)}
                                </span>
                              ) : (
                                <span className="text-[10px] opacity-40">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs">
              Select an active user from the left list to inspect availability.
            </div>
          )}
        </div>
      </div>

      {/* 3. Modern Availability Details Modal (IMAGE 3 & Detailed Break History) */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/35 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E2E8F0',
              color: '#0F172A',
            }}
          >
            {/* Header: Coral / Crimson Red Pill Header */}
            <div className="bg-gradient-to-r from-[#F43F5E] via-[#EF4444] to-[#E11D48] px-6 py-4 flex items-center justify-between text-white shadow-sm shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                  <Calendar size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold tracking-wide">
                    Availability Details - {modalDateLabel}
                  </h3>
                  <p className="text-[11px] text-white/80">
                    {selectedMember?.user.displayName} • {selectedMember?.user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Top 3 KPI Summary Cards */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-gradient-to-b from-[#F0F9FF] to-[#E0F2FE]/40 border border-[#BAE6FD]/80 shadow-xs">
                {/* 1. Net Working Hours */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#0284C7] flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Clock size={19} />
                  </div>
                  <div>
                    <strong className="text-sm sm:text-base text-[#0C4A6E] block font-bold leading-tight">
                      {selectedRecordForModal
                        ? formatMins(getEffectiveWorkingMinutes(selectedRecordForModal))
                        : '0h 0m'}
                    </strong>
                    <span className="text-[10px] font-bold text-[#0369A1] tracking-wider uppercase mt-0.5 block">
                      Net Working Hours
                    </span>
                  </div>
                </div>

                {/* 2. Breaks Taken */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#0284C7] flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Coffee size={19} />
                  </div>
                  <div>
                    <strong className="text-sm sm:text-base text-[#0C4A6E] block font-bold leading-tight">
                      {selectedRecordForModal?.breaks?.length || 0}
                    </strong>
                    <span className="text-[10px] font-bold text-[#0369A1] tracking-wider uppercase mt-0.5 block">
                      Breaks Taken
                    </span>
                  </div>
                </div>

                {/* 3. Status */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#0284C7] flex items-center justify-center text-white shrink-0 shadow-sm">
                    <CheckCircle2 size={19} />
                  </div>
                  <div>
                    <strong className="text-sm sm:text-base text-[#0C4A6E] block font-bold leading-tight">
                      {selectedRecordForModal?.offTime ? 'Completed' : 'Active'}
                    </strong>
                    <span className="text-[10px] font-bold text-[#0369A1] tracking-wider uppercase mt-0.5 block">
                      Status
                    </span>
                  </div>
                </div>
              </div>

              {/* Time Details Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                  Time Details
                </h4>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="space-y-3 flex-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#64748B] block tracking-wide">
                          Start Time:
                        </span>
                        <strong className="text-sm font-bold text-[#0F172A] mt-0.5 block">
                          {selectedRecordForModal?.availableTime
                            ? new Date(selectedRecordForModal.availableTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '09:58 AM'}
                        </strong>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#64748B] block tracking-wide">
                          End Time:
                        </span>
                        <strong className="text-sm font-bold text-[#0F172A] mt-0.5 block">
                          {selectedRecordForModal?.offTime
                            ? new Date(selectedRecordForModal.offTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '07:41 PM'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Sky Blue Summary Calculation Box */}
                  <div className="p-4 rounded-2xl bg-[#F0F9FF] border border-[#BAE6FD] min-w-[210px] space-y-2 text-xs shadow-xs">
                    {(() => {
                      const netWorkingMinutes = selectedRecordForModal?.totalWorkingMinutes || 0;
                      const breaks = selectedRecordForModal?.breaks || [];
                      const totalBreakMin = breaks.reduce((acc, b) => acc + (b.breakDurationMinutes || 0), 0);

                      let grossMinutes = 0;
                      if (selectedRecordForModal?.availableTime && selectedRecordForModal?.offTime) {
                        const startMs = new Date(selectedRecordForModal.availableTime).getTime();
                        const endMs = new Date(selectedRecordForModal.offTime).getTime();
                        grossMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
                      } else {
                        grossMinutes = netWorkingMinutes + totalBreakMin;
                      }

                      const finalNetMinutes = Math.max(0, grossMinutes - totalBreakMin);

                      return (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-bold uppercase text-[#64748B]">
                              Total Time:
                            </span>
                            <strong className="text-xs font-bold text-[#0F172A]">
                              {formatMins(grossMinutes)}
                            </strong>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-bold uppercase text-[#64748B]">
                              Break Time:
                            </span>
                            <strong className="text-xs font-bold text-[#0F172A]">
                              {formatMins(totalBreakMin)}
                            </strong>
                          </div>

                          <div className="pt-1.5 border-t border-[#BAE6FD] flex items-center justify-between gap-3">
                            <span className="text-[10px] font-bold uppercase text-[#0369A1]">
                              Net Working Time:
                            </span>
                            <strong className="text-xs font-bold text-[#0284C7]">
                              {formatMins(finalNetMinutes)}
                            </strong>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Enhanced Break History Section with Detailed Cards */}
              <div className="pt-2 border-t border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#1E293B] flex items-center gap-1.5">
                    <Coffee size={14} className="text-[#0284C7]" />
                    <span>Break History</span>
                  </h4>
                  {selectedRecordForModal?.breaks && selectedRecordForModal.breaks.length > 0 && (
                    <span className="text-[11px] font-semibold text-[#64748B]">
                      {selectedRecordForModal.breaks.length} break{selectedRecordForModal.breaks.length > 1 ? 's' : ''} logged
                    </span>
                  )}
                </div>

                {selectedRecordForModal?.breaks && selectedRecordForModal.breaks.length > 0 ? (
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {selectedRecordForModal.breaks.map((b, idx) => {
                      const startTime = b.breakStartTime
                        ? new Date(b.breakStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '—';
                      const endTime = b.availableAfterBreak
                        ? new Date(b.availableAfterBreak).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'In progress';
                      const duration = b.breakDurationMinutes || 0;
                      const reasonName = b.breakReason || 'Break';

                      return (
                        <div
                          key={b.id || idx}
                          className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] hover:border-[#BAE6FD] shadow-xs hover:shadow-sm transition space-y-2.5"
                        >
                          {/* Break Title Header & Duration Pill */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-[#E0F2FE] flex items-center justify-center text-[#0284C7]">
                                <Coffee size={14} />
                              </div>
                              <span className="font-bold text-xs text-[#0F172A]">
                                Break {idx + 1}
                              </span>
                            </div>

                            <span className="px-3 py-1 rounded-full text-xs font-bold text-[#0284C7] bg-[#F0F9FF] border border-[#BAE6FD]">
                              {duration} min
                            </span>
                          </div>

                          {/* Detailed Start, End, and Reason Rows (Matching user design) */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs text-[#475569]">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                                Start:
                              </span>
                              <strong className="text-xs text-[#0F172A]">{startTime}</strong>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                                End:
                              </span>
                              <strong className="text-xs text-[#0F172A]">{endTime}</strong>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                                Reason:
                              </span>
                              <span className="font-semibold capitalize text-[#0284C7]">{reasonName}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] flex flex-col items-center justify-center text-center text-[#94A3B8] text-xs">
                    <Coffee size={32} className="opacity-35 mb-2 text-[#64748B]" />
                    <span className="font-medium text-[#64748B]">No breaks taken on this day</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Footer */}
            <div className="px-6 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-end shrink-0">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#E2E8F0] hover:bg-[#CBD5E1] text-[#1E293B] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
