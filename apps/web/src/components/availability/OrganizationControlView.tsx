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
  ChevronUp,
  RefreshCw,
  LogOut,
  Calendar,
  Sparkles,
  ArrowRight,
  Shield,
  Activity,
  Search,
  Bell,
  SlidersHorizontal,
  ChevronRight,
  UserCheck,
  Briefcase,
  Layers,
  Settings,
  Mail,
  Zap,
  FolderKanban,
} from 'lucide-react';

const BREAK_REASONS = [
  'Lunch',
  'Namaz',
  'Tea Break',
  'Personal',
  'Meeting / Discussion',
  'Other',
];

interface OrganizationControlViewProps {
  workspace: Workspace;
  currentUser: UserProfile | null;
  members: any[];
  channels?: any[];
  onClose: () => void;
  onOpenAddMembers?: () => void;
  onOpenBotPortal?: () => void;
  onOpenProjectBoard?: (project: any) => void;
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

import { UserAvailabilityView } from './UserAvailabilityView';
import { EmployeeStatusView } from './EmployeeStatusView';
import { ProjectPortfolioView } from '../project/ProjectPortfolioView';

export const OrganizationControlView: React.FC<OrganizationControlViewProps> = ({
  workspace,
  currentUser,
  members,
  channels = [],
  onClose,
  onOpenAddMembers,
  onOpenBotPortal,
  onOpenProjectBoard,
}) => {
  // Navigation: Toggle between Org Control overview, Employee Status page, User Availability page, & View Projects page
  const [showUserAvailabilityPage, setShowUserAvailabilityPage] = useState<boolean>(false);
  const [showEmployeeStatusPage, setShowEmployeeStatusPage] = useState<boolean>(false);
  const [showProjectsPage, setShowProjectsPage] = useState<boolean>(false);
  const [targetUserIdForAvailability, setTargetUserIdForAvailability] = useState<string>('');

  // Selected Card / Tab in Governance Modules
  const [selectedModule, setSelectedModule] = useState<'availability' | 'roles' | 'members' | 'shifts' | 'policies' | 'integrations'>('availability');
  const [availabilityExpanded, setAvailabilityExpanded] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

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
  }, [workspace?.id, currentUser?.id]);

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

  const isAvailable = availability?.isAvailable ?? false;
  const isOnBreak = availability?.isOnBreak ?? false;

  const onlineCount = teamMembers.filter((m) => m.availability?.isAvailable && !m.availability?.isOnBreak).length;
  const onBreakCount = teamMembers.filter((m) => m.availability?.isOnBreak).length;

  if (showProjectsPage) {
    return (
      <ProjectPortfolioView
        workspace={workspace}
        currentUser={currentUser}
        members={members}
        channels={channels}
        onBackToOrganizationControl={() => setShowProjectsPage(false)}
        onOpenProjectBoard={onOpenProjectBoard}
      />
    );
  }

  if (showEmployeeStatusPage) {
    return (
      <EmployeeStatusView
        workspace={workspace}
        currentUser={currentUser}
        onBackToOrganizationControl={() => setShowEmployeeStatusPage(false)}
        onSelectEmployeeForAvailability={(uid) => {
          setTargetUserIdForAvailability(uid);
          setShowEmployeeStatusPage(false);
          setShowUserAvailabilityPage(true);
        }}
      />
    );
  }

  if (showUserAvailabilityPage) {
    return (
      <UserAvailabilityView
        workspace={workspace}
        currentUser={currentUser}
        initialUserId={targetUserIdForAvailability}
        onBackToOrganizationControl={() => {
          setShowUserAvailabilityPage(false);
          setTargetUserIdForAvailability('');
        }}
      />
    );
  }

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
        className="h-14 sm:h-16 px-4 sm:px-8 border-b flex items-center justify-between gap-4 shrink-0"
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: 'var(--theme-text-primary)' }}>
            Organization Control
          </h1>
          <span
            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
          >
            Root Level
          </span>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Search control panels */}
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
          >
            <Search size={14} />
            <input
              type="text"
              placeholder="Search control panels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-44 lg:w-56"
              style={{ color: 'var(--theme-text-primary)' }}
            />
          </div>

          {/* Notifications / Alerts icon */}
          <button
            title="Notifications"
            className="p-2 rounded-xl border hover:opacity-85 transition"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
          >
            <Bell size={16} />
          </button>

          {/* Quick Actions Button */}
          <button
            onClick={() => setSelectedModule('availability')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            <Zap size={14} className="fill-current" />
            <span className="hidden sm:inline">Quick Actions</span>
          </button>

          {/* Close Panel Button */}
          <button
            onClick={onClose}
            title="Return to Chat"
            className="p-2 rounded-xl border hover:opacity-85 transition ml-1"
            style={{
              backgroundColor: 'var(--theme-bg-app)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-muted)',
            }}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* 2. Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Banner: Workspace Master Configuration */}
        <div
          className="p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
          style={{
            backgroundColor: 'var(--theme-bg-surface)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                borderColor: 'rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
              }}
            >
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Workspace Master Configuration
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                Manage organization policies, default working presence, and permission boundaries from this control center.
              </p>
            </div>
          </div>

          <div className="self-start sm:self-center">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                color: '#10b981',
              }}
            >
              <CheckCircle2 size={13} />
              Status: Verified Organization
            </span>
          </div>
        </div>

        {/* Section Header: CORE GOVERNANCE MODULES */}
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Core Governance Modules
            </span>
            <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              Select a card to configure
            </span>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Availability Card */}
            <div
              onClick={() => {
                setShowUserAvailabilityPage(true);
              }}
              className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition text-left flex flex-col justify-between group shadow-sm hover:border-blue-500/80 hover:shadow-md`}
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: '#0091FF',
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center text-blue-400">
                      <Clock size={19} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Availability</h3>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 inline-block mt-0.5">
                        Active • 9:00 - 18:00
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    size={17}
                    className={`text-gray-400 transition-transform ${
                      selectedModule === 'availability' && availabilityExpanded ? 'rotate-180 text-blue-400' : ''
                    }`}
                  />
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                  Set core operational hours, global team shifts, away presets, check-in rules, and auto-replies.
                </p>
              </div>
            </div>

            {/* 2. Roles & Permissions Card */}
            <div
              onClick={() => setSelectedModule('roles')}
              className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition text-left flex flex-col justify-between group shadow-sm ${
                selectedModule === 'roles' ? 'ring-2 ring-blue-500 shadow-md' : 'hover:border-blue-500/50'
              }`}
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: selectedModule === 'roles' ? '#0091FF' : 'var(--theme-border)',
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-400">
                      <Shield size={19} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Roles & Permissions</h3>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 inline-block mt-0.5">
                        4 Custom Roles
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={17} className="text-gray-400 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                  Configure administrative privileges, granular channel access, ticket assignments, and member tiers.
                </p>
              </div>
            </div>

            {/* 3. Members & Invites Card */}
            <div
              onClick={() => setSelectedModule('members')}
              className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition text-left flex flex-col justify-between group shadow-sm ${
                selectedModule === 'members' ? 'ring-2 ring-blue-500 shadow-md' : 'hover:border-blue-500/50'
              }`}
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: selectedModule === 'members' ? '#0091FF' : 'var(--theme-border)',
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                      <Users size={19} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Members & Invites</h3>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 inline-block mt-0.5">
                        {teamMembers.length || members.length} Active / 50 Seats
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={17} className="text-gray-400 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                  Provision staff accounts, dispatch magic invite links, monitor presence, and manage seat licenses.
                </p>
              </div>
            </div>

            {/* 4. Employee Status Dashboard */}
            <div
              onClick={() => setShowEmployeeStatusPage(true)}
              className="p-4 sm:p-5 rounded-2xl border cursor-pointer transition text-left flex flex-col justify-between group shadow-sm hover:border-emerald-500/80 hover:shadow-md"
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                      <Activity size={19} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Employee Status</h3>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-block mt-0.5">
                        {onlineCount} Active Live
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={17} className="text-gray-400 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                  Live visual employee dashboard, real-time presence indicators, on-break rosters, and shift inspections.
                </p>
              </div>
            </div>

            {/* 5. View Projects Portfolio */}
            <div
              onClick={() => setShowProjectsPage(true)}
              className="p-4 sm:p-5 rounded-2xl border cursor-pointer transition text-left flex flex-col justify-between group shadow-sm hover:border-purple-500/80 hover:shadow-md"
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-400">
                      <FolderKanban size={19} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">View Projects</h3>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 inline-block mt-0.5">
                        Project Portfolio
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={17} className="text-gray-400 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                  Browse active, inactive, and delivered client projects, assign teams, and inspect environment configurations.
                </p>
              </div>
            </div>

            {/* 6. Integrations & Webhooks */}
            <div
              onClick={() => {
                if (onOpenBotPortal) {
                  onOpenBotPortal();
                } else {
                  setSelectedModule('integrations');
                }
              }}
              className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition text-left flex flex-col justify-between group shadow-sm ${
                selectedModule === 'integrations' ? 'ring-2 ring-blue-500 shadow-md' : 'hover:border-blue-500/50'
              }`}
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: selectedModule === 'integrations' ? '#0091FF' : 'var(--theme-border)',
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                      <Layers size={19} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Integrations & Slack</h3>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 inline-block mt-0.5">
                        Live Webhooks
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={17} className="text-gray-400 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                  Synchronize availability events, channel broadcasts, and automated notifications with Slack bots.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Detail Panel based on selected module */}
        {selectedModule === 'availability' && (
          <div className="space-y-6 pt-2">
            {/* Availability Toolbar Header Widget */}
            <div
              className="p-6 rounded-2xl border shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-blue-400 uppercase">
                  <Activity size={14} />
                  <span>Employee Availability Control Suite</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mt-1">
                  {isAvailable
                    ? isOnBreak
                      ? 'You are currently on break'
                      : 'You are currently working'
                    : 'You are currently offline'}
                </h3>
                <p className="text-xs mt-1 max-w-lg" style={{ color: 'var(--theme-text-muted)' }}>
                  {isAvailable
                    ? isOnBreak
                      ? 'Stopwatch is paused while you are on break. Click "Available after Break" to resume shift.'
                      : 'Your active shift is running. Your time is being tracked and synced with PostgreSQL in real-time.'
                    : 'Click "Available" to check in and begin your tracked shift today.'}
                </p>
              </div>

              {/* The 4 Action Buttons & Stopwatch Pill */}
              <div
                className="p-3.5 rounded-xl border flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-center shadow-inner"
                style={{
                  backgroundColor: 'var(--theme-bg-app)',
                  borderColor: 'var(--theme-border)',
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

            {/* Team Live Attendance Table */}
            <div
              className="p-5 sm:p-6 rounded-2xl border shadow-xs"
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Users size={17} className="text-blue-400" />
                    <span>Live Team Attendance & Shift Tracker</span>
                  </h4>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                    Real-time status of all employees in {workspace.name}. ({onlineCount} Working, {onBreakCount} on Break)
                  </p>
                </div>

                <button
                  onClick={loadTeamAvailability}
                  className="px-3.5 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition hover:opacity-85 self-start sm:self-auto"
                  style={{
                    backgroundColor: 'var(--theme-bg-app)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  <RefreshCw size={13} className={isLoadingTeam ? 'animate-spin' : ''} />
                  <span>Refresh Team Status</span>
                </button>
              </div>

              <div
                className="border rounded-xl overflow-hidden"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead
                      style={{
                        backgroundColor: 'var(--theme-bg-app)',
                        color: 'var(--theme-text-muted)',
                      }}
                    >
                      <tr className="border-b" style={{ borderColor: 'var(--theme-border)' }}>
                        <th className="py-3 px-4 font-semibold">Employee</th>
                        <th className="py-3 px-4 font-semibold">Role</th>
                        <th className="py-3 px-4 font-semibold">Availability Status</th>
                        <th className="py-3 px-4 font-semibold">Check-in Time</th>
                        <th className="py-3 px-4 font-semibold text-right">Logged Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--theme-border)' }}>
                      {teamMembers.map((item) => {
                        const avail = item.availability;
                        const isOnlineWorking = avail?.isAvailable && !avail?.isOnBreak;
                        const isOnMemberBreak = avail?.isAvailable && avail?.isOnBreak;

                        return (
                          <tr
                            key={item.user.id}
                            className="hover:bg-white/5 transition"
                            style={{ backgroundColor: 'var(--theme-bg-surface)' }}
                          >
                            <td className="py-3 px-4 flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-blue-600/25 border border-blue-400/30 flex items-center justify-center font-bold text-blue-300">
                                {item.user.displayName[0]?.toUpperCase() || item.user.username[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-white">{item.user.displayName}</p>
                                <p className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                                  @{item.user.username}
                                </p>
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
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/5 text-gray-400 border border-white/5">
                                  Offline
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4" style={{ color: 'var(--theme-text-muted)' }}>
                              {avail?.availableTime
                                ? new Date(avail.availableTime).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium text-white">
                              {avail?.totalWorkingMinutes
                                ? `${Math.floor(avail.totalWorkingMinutes / 60)}h ${avail.totalWorkingMinutes % 60}m`
                                : isOnlineWorking
                                ? 'Active Shift'
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Roles Detail Panel */}
        {selectedModule === 'roles' && (
          <div
            className="p-6 rounded-2xl border"
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <h4 className="text-base font-bold text-white mb-2">Workspace Roles & Permission Levels</h4>
            <p className="text-xs mb-4" style={{ color: 'var(--theme-text-muted)' }}>
              Configure administrative boundaries for Super Admins, Workspace Admins, Managers, and Employees.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { name: 'SUPER_ADMIN', desc: 'Full root access to system consoles, workspaces, and user directories' },
                { name: 'WORKSPACE_ADMIN', desc: 'Can manage channels, bots, organization controls, and members' },
                { name: 'MANAGER', desc: 'Can supervise team attendance, create project boards, and assign tickets' },
                { name: 'EMPLOYEE', desc: 'Can chat, join calls, take breaks, and manage personal shift availability' },
              ].map((r) => (
                <div
                  key={r.name}
                  className="p-4 rounded-xl border flex flex-col justify-between"
                  style={{
                    backgroundColor: 'var(--theme-bg-app)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <span className="font-bold text-xs text-blue-400 mb-1">{r.name}</span>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                    {r.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members Detail Panel */}
        {selectedModule === 'members' && (
          <div
            className="p-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div>
              <h4 className="text-base font-bold text-white">Team Roster & Invitations</h4>
              <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                Invite teammates to {workspace.name} or manage existing privileges.
              </p>
            </div>
            {onOpenAddMembers && (
              <button
                onClick={onOpenAddMembers}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm flex items-center gap-2 hover:opacity-90 transition"
                style={{ backgroundColor: 'var(--theme-primary)' }}
              >
                <UserCheck size={14} />
                <span>Invite New Members</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Break Reason Selection Modal */}
      {showBreakModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-60 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl animate-in zoom-in-95 duration-150"
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
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
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-base font-bold text-center text-white mb-2">
              Less Than 8 Hours Active
            </h3>

            <p className="text-xs text-center leading-relaxed mb-5" style={{ color: 'var(--theme-text-muted)' }}>
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
