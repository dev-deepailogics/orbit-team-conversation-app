'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { SOCKET_EVENTS, UserAvailabilityRecord, Workspace, UserProfile } from '@orbit/types';
import {
  Building2,
  Users,
  Clock,
  Coffee,
  Play,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  RefreshCw,
  LogOut,
  Calendar,
  Sparkles,
  ArrowRight,
  Shield,
  Activity,
} from 'lucide-react';

const BREAK_REASONS = [
  'Lunch',
  'Namaz',
  'Tea Break',
  'Personal',
  'Meeting / Discussion',
  'Other',
];

interface OrganizationControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  currentUser: UserProfile | null;
}

interface TeamMemberAvailability {
  user: {
    id: string;
    displayName: string;
    username: string;
    email: string;
    avatarUrl?: string;
    status?: string;
  };
  role: string;
  availability: UserAvailabilityRecord | null;
}

export const OrganizationControlModal: React.FC<OrganizationControlModalProps> = ({
  isOpen,
  onClose,
  workspace,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'self' | 'team'>('self');

  // Self Availability state
  const [availability, setAvailability] = useState<UserAvailabilityRecord | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isActionLocked, setIsActionLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modals inside
  const [showBreakModal, setShowBreakModal] = useState<boolean>(false);
  const [selectedBreakReason, setSelectedBreakReason] = useState<string>(BREAK_REASONS[0]);
  const [customBreakReason, setCustomBreakReason] = useState<string>('');
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState<boolean>(false);
  const [checkoutWarningHours, setCheckoutWarningHours] = useState<string>('0');

  // Team tracking state
  const [teamMembers, setTeamMembers] = useState<TeamMemberAvailability[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState<boolean>(false);

  const actionLockTimer = useRef<NodeJS.Timeout | null>(null);

  const lockActions = () => {
    setIsActionLocked(true);
    if (actionLockTimer.current) clearTimeout(actionLockTimer.current);
    actionLockTimer.current = setTimeout(() => {
      setIsActionLocked(false);
    }, 2000);
  };

  // 1. Fetch current user availability
  const loadAvailability = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/api/availability/current');
      const serverTime = new Date(res.data.serverTime).getTime();
      const localTime = Date.now();
      setServerTimeOffset(serverTime - localTime);
      setAvailability(res.data.availability);
    } catch (err) {
      console.error('Failed to load availability:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch Team Availability
  const loadTeamAvailability = async () => {
    if (!workspace?.id) return;
    try {
      setIsLoadingTeam(true);
      const res = await api.get(`/api/availability/team/${workspace.id}`);
      setTeamMembers(res.data.team || []);
    } catch (err) {
      console.error('Failed to load team availability:', err);
    } finally {
      setIsLoadingTeam(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadAvailability();
    loadTeamAvailability();

    const socket = getSocket();
    const handleUpdate = (payload: { userId: string; availability: UserAvailabilityRecord }) => {
      if (payload.userId === currentUser?.id) {
        setAvailability(payload.availability);
      }
      setTeamMembers((prev) =>
        prev.map((item) =>
          item.user.id === payload.userId
            ? { ...item, availability: payload.availability }
            : item
        )
      );
    };

    if (socket) {
      socket.on(SOCKET_EVENTS.AVAILABILITY_UPDATE, handleUpdate);
    }

    return () => {
      if (socket) {
        socket.off(SOCKET_EVENTS.AVAILABILITY_UPDATE, handleUpdate);
      }
    };
  }, [isOpen, workspace?.id, currentUser?.id]);

  // Live stopwatch calculation
  useEffect(() => {
    if (!availability || !availability.isAvailable) {
      setElapsedSeconds(0);
      return;
    }

    const computeSeconds = () => {
      const nowMs = Date.now() + serverTimeOffset;
      const startMs = new Date(availability.availableTime).getTime();

      let totalBreakMs = 0;
      if (availability.breaks && availability.breaks.length > 0) {
        for (const b of availability.breaks) {
          const bStart = new Date(b.breakStartTime).getTime();
          if (b.availableAfterBreak) {
            const bEnd = new Date(b.availableAfterBreak).getTime();
            totalBreakMs += Math.max(0, bEnd - bStart);
          } else if (availability.isOnBreak) {
            totalBreakMs += Math.max(0, nowMs - bStart);
          }
        }
      }

      const netMs = Math.max(0, nowMs - startMs - totalBreakMs);
      return Math.floor(netMs / 1000);
    };

    setElapsedSeconds(computeSeconds());

    if (availability.isOnBreak) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(computeSeconds());
    }, 1000);

    return () => clearInterval(interval);
  }, [availability, serverTimeOffset]);

  const formatStopwatch = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Actions
  const handleCheckIn = async () => {
    if (isActionLocked) return;
    lockActions();
    try {
      const res = await api.post('/api/availability/checkin');
      setAvailability(res.data.availability);
      loadTeamAvailability();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to check in');
    }
  };

  const handleStartBreak = async () => {
    if (isActionLocked) return;
    lockActions();
    const reason =
      selectedBreakReason === 'Other' && customBreakReason.trim()
        ? customBreakReason.trim()
        : selectedBreakReason;

    try {
      const res = await api.post('/api/availability/break/start', { reason });
      setAvailability(res.data.availability);
      setShowBreakModal(false);
      setCustomBreakReason('');
      loadTeamAvailability();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to start break');
    }
  };

  const handleResumeWork = async () => {
    if (isActionLocked) return;
    lockActions();
    try {
      const res = await api.post('/api/availability/break/resume');
      setAvailability(res.data.availability);
      loadTeamAvailability();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to resume work');
    }
  };

  const handleRequestCheckout = () => {
    if (isActionLocked) return;
    const workingHours = elapsedSeconds / 3600;
    if (workingHours < 8) {
      setCheckoutWarningHours(workingHours.toFixed(1));
      setShowCheckoutConfirm(true);
    } else {
      executeCheckout();
    }
  };

  const executeCheckout = async () => {
    lockActions();
    try {
      const res = await api.post('/api/availability/checkout');
      setAvailability(res.data.availability);
      setShowCheckoutConfirm(false);
      loadTeamAvailability();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to checkout');
    }
  };

  if (!isOpen) return null;

  const isAvailable = availability?.isAvailable ?? false;
  const isOnBreak = availability?.isOnBreak ?? false;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: '#303030',
          borderColor: '#424242',
          color: '#F0F0F0',
        }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{
            backgroundColor: '#262626',
            borderColor: '#3D3D3D',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Building2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Organization Control
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {workspace.name}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Manage employee shift availability, breaks, active working hours, and team presence.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          className="flex items-center gap-2 px-6 pt-3 border-b shrink-0 text-xs font-semibold"
          style={{
            backgroundColor: '#2A2A2A',
            borderColor: '#3D3D3D',
          }}
        >
          <button
            onClick={() => setActiveTab('self')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
              activeTab === 'self'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Clock size={15} className={activeTab === 'self' ? 'text-blue-400' : ''} />
            <span>My Shift & Availability</span>
          </button>

          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
              activeTab === 'team'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users size={15} className={activeTab === 'team' ? 'text-blue-400' : ''} />
            <span>Team Live Attendance</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-gray-300">
              {teamMembers.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'self' ? (
            <div className="space-y-6">
              {/* Employee Availability Toolbar Showcase */}
              <div
                className="p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg"
                style={{
                  backgroundColor: '#262626',
                  borderColor: '#404040',
                }}
              >
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-blue-400 uppercase">
                    <Activity size={14} />
                    <span>Active Employee Availability Controls</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mt-1">
                    {isAvailable
                      ? isOnBreak
                        ? 'You are currently on break'
                        : 'You are currently working'
                      : 'You are currently offline'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-md">
                    {isAvailable
                      ? isOnBreak
                        ? 'Stopwatch is paused while you are on break. Click "Available after Break" to resume shift.'
                        : 'Your active shift is running. Your time is being tracked and synced in real-time.'
                      : 'Click "Available" to check in and begin your tracked shift today.'}
                  </p>
                </div>

                {/* The 4 Buttons & Stopwatch Pill as shown in the screenshot */}
                <div
                  className="p-3.5 rounded-xl border flex flex-wrap items-center gap-2 shrink-0 self-start md:self-center shadow-inner"
                  style={{
                    backgroundColor: '#1E1E1E',
                    borderColor: '#383838',
                  }}
                >
                  {/* 1. Available Button */}
                  <button
                    onClick={handleCheckIn}
                    disabled={isAvailable || isActionLocked}
                    title={isAvailable ? 'Already checked in' : 'Start working / Check in'}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm ${
                      isAvailable && !isOnBreak
                        ? 'bg-[#007A5A] text-white cursor-default ring-1 ring-emerald-400'
                        : !isAvailable
                        ? 'bg-[#0091FF] hover:bg-[#007AE6] text-white active:scale-95'
                        : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    <Play size={13} className={!isAvailable ? 'fill-current' : ''} />
                    <span>Available</span>
                  </button>

                  {/* 2. Break Button */}
                  <button
                    onClick={() => setShowBreakModal(true)}
                    disabled={!isAvailable || isOnBreak || isActionLocked}
                    title="Take a break (Lunch, Namaz, Tea)"
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      isOnBreak
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-default'
                        : isAvailable
                        ? 'bg-[#2A2F35] hover:bg-[#343B42] text-slate-200 border border-white/10 active:scale-95'
                        : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    <Coffee size={13} />
                    <span>Break</span>
                  </button>

                  {/* 3. Available after Break Button */}
                  <button
                    onClick={handleResumeWork}
                    disabled={!isOnBreak || isActionLocked}
                    title="Resume work after break"
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      isOnBreak
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg animate-pulse active:scale-95'
                        : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    <span>Available after Break</span>
                  </button>

                  {/* 4. Checkout Button */}
                  <button
                    onClick={handleRequestCheckout}
                    disabled={!isAvailable || isOnBreak || isActionLocked}
                    title="End shift and checkout"
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      isAvailable && !isOnBreak
                        ? 'bg-[#2A2F35] hover:bg-rose-950/40 text-slate-200 hover:text-rose-300 border border-white/10 hover:border-rose-500/40 active:scale-95'
                        : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    <LogOut size={13} />
                    <span>Checkout</span>
                  </button>

                  {/* 5. Live Stopwatch Pill (00:00:00) */}
                  <div
                    title="Live calculated net active working time"
                    className={`px-3.5 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-2 border shadow-sm transition ${
                      isOnBreak
                        ? 'bg-amber-950/30 text-amber-300 border-amber-500/30'
                        : isAvailable
                        ? 'bg-[#0091FF]/20 text-[#38B6FF] border-[#0091FF]/40'
                        : 'bg-white/5 text-slate-500 border-white/5'
                    }`}
                  >
                    <Clock size={13} className={isAvailable && !isOnBreak ? 'animate-spin' : ''} />
                    <span>{formatStopwatch(elapsedSeconds)}</span>
                  </div>
                </div>
              </div>

              {/* Today's Shift Breakdown & Log */}
              <div
                className="p-5 rounded-2xl border"
                style={{
                  backgroundColor: '#262626',
                  borderColor: '#404040',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calendar size={16} className="text-blue-400" />
                    <span>Today's Shift Activity & Break History</span>
                  </h4>
                  <button
                    onClick={loadAvailability}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
                    title="Refresh status"
                  >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                  </button>
                </div>

                {availability ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-black/20 border border-white/5">
                        <span className="text-[11px] text-gray-400 font-medium">Initial Check-in</span>
                        <p className="text-sm font-semibold text-white mt-0.5">
                          {new Date(availability.availableTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-black/20 border border-white/5">
                        <span className="text-[11px] text-gray-400 font-medium">Current Status</span>
                        <p className="text-sm font-semibold mt-0.5">
                          {isOnBreak ? (
                            <span className="text-amber-400 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                              On Break
                            </span>
                          ) : isAvailable ? (
                            <span className="text-emerald-400 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              Working
                            </span>
                          ) : (
                            <span className="text-gray-400">Checked Out / Offline</span>
                          )}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-black/20 border border-white/5">
                        <span className="text-[11px] text-gray-400 font-medium">Recorded Breaks</span>
                        <p className="text-sm font-semibold text-white mt-0.5">
                          {availability.breaks?.length || 0} breaks taken
                        </p>
                      </div>
                    </div>

                    {/* Break Items List */}
                    {availability.breaks && availability.breaks.length > 0 && (
                      <div className="mt-4">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                          Break Details
                        </span>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {availability.breaks.map((b, idx) => (
                            <div
                              key={b.id || idx}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5 text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-[11px]">
                                  {idx + 1}
                                </span>
                                <div>
                                  <span className="font-semibold text-gray-200">{b.breakReason}</span>
                                  <span className="text-[11px] text-gray-400 ml-2">
                                    Started: {new Date(b.breakStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                {b.availableAfterBreak ? (
                                  <span className="text-gray-300 font-medium">
                                    {b.breakDurationMinutes} min
                                  </span>
                                ) : (
                                  <span className="text-amber-400 font-medium animate-pulse">
                                    In progress...
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    No active availability record found for today. Click{' '}
                    <strong className="text-blue-400">Available</strong> above to start your day.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Team Live Attendance View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Live Workspace Attendance</h4>
                  <p className="text-xs text-gray-400">
                    Real-time status of all members in {workspace.name}.
                  </p>
                </div>
                <button
                  onClick={loadTeamAvailability}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs flex items-center gap-1.5 transition border border-white/5"
                >
                  <RefreshCw size={13} className={isLoadingTeam ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#404040' }}>
                <table className="w-full text-left text-xs">
                  <thead style={{ backgroundColor: '#262626', color: '#A0A0A0' }}>
                    <tr className="border-b" style={{ borderColor: '#383838' }}>
                      <th className="py-3 px-4 font-semibold">Employee</th>
                      <th className="py-3 px-4 font-semibold">Role</th>
                      <th className="py-3 px-4 font-semibold">Availability Status</th>
                      <th className="py-3 px-4 font-semibold">Check-in Time</th>
                      <th className="py-3 px-4 font-semibold text-right">Logged Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#333333' }}>
                    {teamMembers.map((item) => {
                      const avail = item.availability;
                      const isOnlineWorking = avail?.isAvailable && !avail?.isOnBreak;
                      const isOnMemberBreak = avail?.isAvailable && avail?.isOnBreak;

                      return (
                        <tr
                          key={item.user.id}
                          className="hover:bg-white/5 transition"
                          style={{ backgroundColor: '#2A2A2A' }}
                        >
                          <td className="py-3 px-4 flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-400/30 flex items-center justify-center font-bold text-blue-300">
                              {item.user.displayName[0]?.toUpperCase() || item.user.username[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-white">{item.user.displayName}</p>
                              <p className="text-[11px] text-gray-400">@{item.user.username}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-gray-300">
                              {item.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {isOnMemberBreak ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                <Coffee size={12} />
                                On Break
                              </span>
                            ) : isOnlineWorking ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Available & Working
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-500/10 text-gray-400 border border-white/5">
                                Offline
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-300">
                            {avail?.availableTime
                              ? new Date(avail.availableTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-gray-200">
                            {avail?.totalWorkingMinutes ? `${Math.floor(avail.totalWorkingMinutes / 60)}h ${avail.totalWorkingMinutes % 60}m` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="flex items-center justify-end px-6 py-3.5 border-t shrink-0"
          style={{
            backgroundColor: '#262626',
            borderColor: '#3D3D3D',
          }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Break Reason Selection Modal */}
      {showBreakModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-60 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl animate-in zoom-in-95 duration-150"
            style={{
              backgroundColor: '#262626',
              borderColor: '#454545',
              color: '#F0F0F0',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Coffee size={18} className="text-amber-400" />
                <h3 className="text-sm font-bold text-white">Select Break Reason</h3>
              </div>
              <button
                onClick={() => setShowBreakModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {BREAK_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSelectedBreakReason(reason)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs text-left font-medium transition flex items-center justify-between border ${
                    selectedBreakReason === reason
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-black/20 text-gray-300 border-white/5 hover:bg-white/5'
                  }`}
                >
                  <span>{reason}</span>
                  {selectedBreakReason === reason && <CheckCircle2 size={14} className="text-amber-400" />}
                </button>
              ))}
            </div>

            {selectedBreakReason === 'Other' && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Specify other reason..."
                  value={customBreakReason}
                  onChange={(e) => setCustomBreakReason(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-gray-600 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBreakModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleStartBreak}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black shadow-lg transition"
              >
                Confirm Break
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8-Hour Warning Checkout Confirmation Modal */}
      {showCheckoutConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-60 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl animate-in zoom-in-95 duration-150"
            style={{
              backgroundColor: '#262626',
              borderColor: '#454545',
              color: '#F0F0F0',
            }}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-base font-bold text-center text-white mb-2">
              Less Than 8 Hours Active
            </h3>

            <p className="text-xs text-center text-gray-300 leading-relaxed mb-5">
              Your calculated active working time today is{' '}
              <strong className="text-amber-300">{checkoutWarningHours} hours</strong>, which is less than the standard 8 hours. Are you sure you want to checkout now?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCheckoutConfirm(false)}
                className="flex-1 px-3.5 py-2 rounded-xl text-xs font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition"
              >
                Continue Working
              </button>
              <button
                onClick={executeCheckout}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition"
              >
                Yes, Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
