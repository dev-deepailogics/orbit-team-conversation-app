"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import {
  SOCKET_EVENTS,
  UserAvailabilityRecord,
  Workspace,
  UserProfile,
} from "@orbit/types";
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
  HardDrive,
  UploadCloud,
  Gauge,
  Video,
} from "lucide-react";

const BREAK_REASONS = [
  "Lunch",
  "Namaz",
  "Tea Break",
  "Personal",
  "Meeting / Discussion",
  "Other",
];

interface OrganizationControlViewProps {
  workspace: Workspace;
  currentUser: UserProfile | null;
  members: any[];
  channels?: any[];
  resetKey?: number;
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

import { UserAvailabilityView } from "./UserAvailabilityView";
import { EmployeeStatusView } from "./EmployeeStatusView";
import { ProjectPortfolioView } from "../project/ProjectPortfolioView";
import { MediaManagementView } from "../media/MediaManagementView";

export const OrganizationControlView: React.FC<
  OrganizationControlViewProps
> = ({
  workspace,
  currentUser,
  members,
  channels = [],
  resetKey,
  onClose,
  onOpenAddMembers,
  onOpenBotPortal,
  onOpenProjectBoard,
}) => {
  // Navigation: Toggle between Org Control overview, Employee Status page, User Availability page, View Projects page, & Media Management page
  const [showUserAvailabilityPage, setShowUserAvailabilityPage] =
    useState<boolean>(false);
  const [showEmployeeStatusPage, setShowEmployeeStatusPage] =
    useState<boolean>(false);
  const [showProjectsPage, setShowProjectsPage] = useState<boolean>(false);
  const [showMediaManagementPage, setShowMediaManagementPage] =
    useState<boolean>(false);
  const [targetUserIdForAvailability, setTargetUserIdForAvailability] =
    useState<string>("");

  // Synchronize subview with URL query parameter
  const updateUrlParam = (subview?: string) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "org-control");
      if (subview) {
        url.searchParams.set("subview", subview);
      } else {
        url.searchParams.delete("subview");
      }
      window.history.replaceState(null, "", url.toString());
    }
  };

  const syncFromUrl = () => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const subview = params.get("subview");
      setShowUserAvailabilityPage(subview === "availability");
      setShowEmployeeStatusPage(subview === "employee-status");
      setShowProjectsPage(subview === "projects");
      setShowMediaManagementPage(subview === "media");
    }
  };

  useEffect(() => {
    syncFromUrl();
  }, [resetKey]);

  useEffect(() => {
    const handlePopState = () => syncFromUrl();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Selected Card / Tab in Governance Modules (null or module name)
  const [selectedModule, setSelectedModule] = useState<
    | "availability"
    | "roles"
    | "members"
    | "shifts"
    | "policies"
    | "media"
    | "integrations"
    | null
  >(null);
  const [availabilityExpanded, setAvailabilityExpanded] =
    useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Self Availability state
  const [availability, setAvailability] =
    useState<UserAvailabilityRecord | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isActionLocked, setIsActionLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modals inside
  const [showBreakModal, setShowBreakModal] = useState<boolean>(false);
  const [selectedBreakReason, setSelectedBreakReason] = useState<string>(
    BREAK_REASONS[0],
  );
  const [customBreakReason, setCustomBreakReason] = useState<string>("");
  const [showCheckoutConfirm, setShowCheckoutConfirm] =
    useState<boolean>(false);
  const [checkoutWarningHours, setCheckoutWarningHours] = useState<string>("0");

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
      const res = await api.get("/api/availability/current");
      const serverTime = new Date(res.data.serverTime).getTime();
      const localTime = Date.now();
      setServerTimeOffset(serverTime - localTime);
      setAvailability(res.data.availability);
    } catch (err) {
      console.error("Failed to load availability:", err);
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
      console.error("Failed to load team availability:", err);
    } finally {
      setIsLoadingTeam(false);
    }
  };

  useEffect(() => {
    loadAvailability();
    loadTeamAvailability();

    const socket = getSocket();
    const handleUpdate = (payload: {
      userId: string;
      availability: UserAvailabilityRecord;
    }) => {
      if (payload.userId === currentUser?.id) {
        setAvailability(payload.availability);
      }
      setTeamMembers((prev) =>
        prev.map((item) =>
          item.user.id === payload.userId
            ? { ...item, availability: payload.availability }
            : item,
        ),
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
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Actions
  const handleCheckIn = async () => {
    if (isActionLocked) return;
    lockActions();
    try {
      const res = await api.post("/api/availability/checkin");
      setAvailability(res.data.availability);
      loadTeamAvailability();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to check in");
    }
  };

  const handleStartBreak = async () => {
    if (isActionLocked) return;
    lockActions();
    const reason =
      selectedBreakReason === "Other" && customBreakReason.trim()
        ? customBreakReason.trim()
        : selectedBreakReason;

    try {
      const res = await api.post("/api/availability/break/start", { reason });
      setAvailability(res.data.availability);
      setShowBreakModal(false);
      setCustomBreakReason("");
      loadTeamAvailability();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to start break");
    }
  };

  const handleResumeWork = async () => {
    if (isActionLocked) return;
    lockActions();
    try {
      const res = await api.post("/api/availability/break/resume");
      setAvailability(res.data.availability);
      loadTeamAvailability();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to resume work");
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
      const res = await api.post("/api/availability/checkout");
      setAvailability(res.data.availability);
      setShowCheckoutConfirm(false);
      loadTeamAvailability();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to checkout");
    }
  };

  const isAvailable = availability?.isAvailable ?? false;
  const isOnBreak = availability?.isOnBreak ?? false;

  const onlineCount = teamMembers.filter(
    (m) => m.availability?.isAvailable && !m.availability?.isOnBreak,
  ).length;
  const onBreakCount = teamMembers.filter(
    (m) => m.availability?.isOnBreak,
  ).length;

  if (showMediaManagementPage) {
    return (
      <MediaManagementView
        workspace={workspace}
        currentUser={currentUser}
        onBackToOrganizationControl={() => {
          setShowMediaManagementPage(false);
          updateUrlParam();
        }}
        onOpenProjectBoard={onOpenProjectBoard}
      />
    );
  }

  if (showProjectsPage) {
    return (
      <ProjectPortfolioView
        workspace={workspace}
        currentUser={currentUser}
        members={members}
        channels={channels}
        onBackToOrganizationControl={() => {
          setShowProjectsPage(false);
          updateUrlParam();
        }}
        onOpenProjectBoard={onOpenProjectBoard}
      />
    );
  }

  if (showEmployeeStatusPage) {
    return (
      <EmployeeStatusView
        workspace={workspace}
        currentUser={currentUser}
        onBackToOrganizationControl={() => {
          setShowEmployeeStatusPage(false);
          updateUrlParam();
        }}
        onSelectEmployeeForAvailability={(uid) => {
          setTargetUserIdForAvailability(uid);
          setShowEmployeeStatusPage(false);
          setShowUserAvailabilityPage(true);
          updateUrlParam("availability");
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
          setTargetUserIdForAvailability("");
          updateUrlParam();
        }}
      />
    );
  }

  return (
    <div
      className="flex-1 flex flex-col h-full w-full overflow-hidden"
      style={{
        backgroundColor: "var(--theme-bg-app)",
        color: "var(--theme-text-primary)",
      }}
    >
      {/* 1. Top Navbar Header - Modernized Sleek Glassmorphic Bar */}
      <div
        className="h-16 px-4 sm:px-8 border-b flex items-center justify-between gap-4 shrink-0 backdrop-blur-md sticky top-0 z-20"
        style={{
          backgroundColor: "var(--theme-bg-surface)",
          borderColor: "var(--theme-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Building2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white">
                Organization Control
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Root Level
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 hidden sm:block">
              {workspace.name} • Workspace Infrastructure & Governance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search control panels with shortcut badge */}
          <div
            className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs transition-all focus-within:ring-2 focus-within:ring-indigo-500/40"
            style={{
              backgroundColor: "var(--theme-bg-app)",
              borderColor: "var(--theme-border)",
              color: "var(--theme-text-muted)",
            }}
          >
            <Search size={14} className="text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search governance modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-48 lg:w-60 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500"
            />
            <kbd className="hidden lg:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700">
              ⌘K
            </kbd>
          </div>

          {/* Notifications / Alerts icon */}
          <button
            title="Notifications"
            className="p-2.5 rounded-xl border hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all text-slate-600 dark:text-zinc-400"
            style={{
              backgroundColor: "var(--theme-bg-app)",
              borderColor: "var(--theme-border)",
            }}
          >
            <Bell size={16} />
          </button>

          {/* Close Panel Button */}
          <button
            onClick={onClose}
            title="Return to Chat"
            className="p-2.5 rounded-xl border hover:border-rose-500/40 hover:bg-rose-500/10 transition-all text-slate-600 dark:text-zinc-400 hover:text-rose-500 ml-1"
            style={{
              backgroundColor: "var(--theme-bg-app)",
              borderColor: "var(--theme-border)",
            }}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* 2. Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 relative">
        {/* Subtle background ambient mesh glow matching marketing page */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-cyan-400/5 blur-[120px] rounded-full pointer-events-none -z-10" />

        {/* Section Header: Styled identically to the reference screenshot */}
        <div className="pt-1 pb-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "var(--theme-text-primary)" }}>
            Core Governance <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400">Modules</span>
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--theme-text-muted)" }}>
            Manage and configure essential system modules for better control and efficiency.
          </p>
        </div>

        {/* 6 Cards Grid - Exact match to user reference screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Availability Card */}
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setShowUserAvailabilityPage(true);
              updateUrlParam("availability");
            }}
            className="relative p-6 rounded-2xl border cursor-pointer text-left flex flex-col justify-between group shadow-lg overflow-hidden"
            style={{
              backgroundColor: "var(--theme-bg-surface)",
              borderColor: "var(--theme-border)",
            }}
          >
            {/* Ambient Blue Glow Backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/15 via-blue-500/5 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3.5">
                  {/* Glowing Blue Squircle Icon */}
                  <div
                    className="w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                    style={{
                      background: "linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)",
                      boxShadow: "0 0 20px rgba(59, 130, 246, 0.4)",
                      color: "#FFFFFF",
                    }}
                  >
                    <Gauge size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base" style={{ color: "var(--theme-text-primary)" }}>
                      Availability
                    </h3>
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border mt-1"
                      style={{
                        backgroundColor: "rgba(16, 185, 129, 0.15)",
                        borderColor: "rgba(16, 185, 129, 0.3)",
                        color: "#10B981",
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Active • 1:00 - 18:00
                    </span>
                  </div>
                </div>

                {/* Circular Arrow Button */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                  style={{
                    backgroundColor: "var(--theme-bg-app)",
                    borderColor: "var(--theme-border)",
                    color: "var(--theme-text-muted)",
                    borderWidth: "1px",
                  }}
                >
                  <ArrowRight size={14} />
                </div>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: "var(--theme-text-muted)" }}>
                Set core operational hours, global team shifts, away presets, check-in rules, and auto-replies.
              </p>
            </div>

            {/* Bottom SVG wave curve with continuous animation */}
            <div className="relative z-0 mt-5 -mb-6 -mx-6 h-11 overflow-hidden opacity-85">
              <svg viewBox="0 0 400 48" preserveAspectRatio="none" fill="none" className="w-full h-full">
                <defs>
                  <linearGradient id="availBlueWave" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#1E40AF" stopOpacity="0.2" />
                    <stop offset="60%" stopColor="#2563EB" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#60A5FA" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13"
                  stroke="url(#availBlueWave)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{
                    d: [
                      "M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13",
                      "M0 37 C 90 37, 160 36, 230 36 C 290 36, 330 20, 370 11 C 385 8, 395 15, 400 10",
                      "M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13",
                    ],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
              </svg>
            </div>
          </motion.div>

          {/* 2. Roles & Permissions Card */}
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSelectedModule(selectedModule === "roles" ? null : "roles")}
            className="relative p-6 rounded-2xl border cursor-pointer text-left flex flex-col justify-between group shadow-lg overflow-hidden"
            style={{
              backgroundColor: "var(--theme-bg-surface)",
              borderColor: selectedModule === "roles" ? "#A855F7" : "var(--theme-border)",
            }}
          >
            {/* Ambient Purple Glow Backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/15 via-purple-500/5 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3.5">
                  {/* Glowing Purple Squircle Icon */}
                  <div
                    className="w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                    style={{
                      background: "linear-gradient(135deg, #6B21A8 0%, #A855F7 100%)",
                      boxShadow: "0 0 20px rgba(168, 85, 247, 0.4)",
                      color: "#FFFFFF",
                    }}
                  >
                    <Shield size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base" style={{ color: "var(--theme-text-primary)" }}>
                      Roles & Permissions
                    </h3>
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border mt-1"
                      style={{
                        backgroundColor: "rgba(168, 85, 247, 0.15)",
                        borderColor: "rgba(168, 85, 247, 0.3)",
                        color: "#C084FC",
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      4 Custom Roles
                    </span>
                  </div>
                </div>

                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                  style={{
                    backgroundColor: "var(--theme-bg-app)",
                    borderColor: "var(--theme-border)",
                    color: "var(--theme-text-muted)",
                    borderWidth: "1px",
                  }}
                >
                  <ArrowRight size={14} />
                </div>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: "var(--theme-text-muted)" }}>
                Configure administrative privileges, granular channel access, ticket assignments, and member roles.
              </p>
            </div>

            {/* Bottom SVG wave curve with continuous animation */}
            <div className="relative z-0 mt-5 -mb-6 -mx-6 h-11 overflow-hidden opacity-85">
              <svg viewBox="0 0 400 48" preserveAspectRatio="none" fill="none" className="w-full h-full">
                <defs>
                  <linearGradient id="rolesPurpleWave" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6B21A8" stopOpacity="0.2" />
                    <stop offset="60%" stopColor="#9333EA" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#C084FC" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13"
                  stroke="url(#rolesPurpleWave)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{
                    d: [
                      "M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13",
                      "M0 37 C 90 37, 160 36, 230 36 C 290 36, 330 20, 370 11 C 385 8, 395 15, 400 10",
                      "M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13",
                    ],
                  }}
                  transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
                />
              </svg>
            </div>
          </motion.div>

          {/* 3. Members & Invites Card */}
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSelectedModule(selectedModule === "members" ? null : "members")}
            className="relative p-6 rounded-2xl border cursor-pointer text-left flex flex-col justify-between group shadow-lg overflow-hidden"
            style={{
              backgroundColor: "var(--theme-bg-surface)",
              borderColor: selectedModule === "members" ? "#10B981" : "var(--theme-border)",
            }}
          >
            {/* Ambient Emerald Glow Backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/15 via-teal-500/5 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3.5">
                  {/* Glowing Emerald Squircle Icon */}
                  <div
                    className="w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                    style={{
                      background: "linear-gradient(135deg, #065F46 0%, #10B981 100%)",
                      boxShadow: "0 0 20px rgba(16, 185, 129, 0.4)",
                      color: "#FFFFFF",
                    }}
                  >
                    <Users size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base" style={{ color: "var(--theme-text-primary)" }}>
                      Members & Invites
                    </h3>
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border mt-1"
                      style={{
                        backgroundColor: "rgba(16, 185, 129, 0.15)",
                        borderColor: "rgba(16, 185, 129, 0.3)",
                        color: "#34D399",
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {teamMembers.length || members.length} Active • 50 Seats
                    </span>
                  </div>
                </div>

                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                  style={{
                    backgroundColor: "var(--theme-bg-app)",
                    borderColor: "var(--theme-border)",
                    color: "var(--theme-text-muted)",
                    borderWidth: "1px",
                  }}
                >
                  <ArrowRight size={14} />
                </div>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: "var(--theme-text-muted)" }}>
                Provision staff accounts, dispatch magic invite links, monitor presence, and manage seat licenses.
              </p>
            </div>

            {/* Bottom SVG wave curve with continuous animation */}
            <div className="relative z-0 mt-5 -mb-6 -mx-6 h-11 overflow-hidden opacity-85">
              <svg viewBox="0 0 400 48" preserveAspectRatio="none" fill="none" className="w-full h-full">
                <defs>
                  <linearGradient id="membersGreenWave" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#065F46" stopOpacity="0.2" />
                    <stop offset="60%" stopColor="#059669" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#34D399" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13"
                  stroke="url(#membersGreenWave)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{
                    d: [
                      "M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13",
                      "M0 37 C 90 37, 160 36, 230 36 C 290 36, 330 20, 370 11 C 385 8, 395 15, 400 10",
                      "M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13",
                    ],
                  }}
                  transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
                />
              </svg>
            </div>
          </motion.div>

          {/* 4. Employee Status Dashboard */}
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setShowEmployeeStatusPage(true);
              updateUrlParam("employee-status");
            }}
            className="relative p-6 rounded-2xl border cursor-pointer text-left flex flex-col justify-between group shadow-lg overflow-hidden"
            style={{
              backgroundColor: "var(--theme-bg-surface)",
              borderColor: "var(--theme-border)",
            }}
          >
            {/* Ambient Orange/Gold Glow Backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/15 via-orange-500/5 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3.5">
                  {/* Glowing Amber Squircle Icon */}
                  <div
                    className="w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                    style={{
                      background: "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)",
                      boxShadow: "0 0 20px rgba(245, 158, 11, 0.4)",
                      color: "#FFFFFF",
                    }}
                  >
                    <Activity size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base" style={{ color: "var(--theme-text-primary)" }}>
                      Employee Status
                    </h3>
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border mt-1"
                      style={{
                        backgroundColor: "rgba(16, 185, 129, 0.15)",
                        borderColor: "rgba(16, 185, 129, 0.3)",
                        color: "#10B981",
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Active • Live
                    </span>
                  </div>
                </div>

                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                  style={{
                    backgroundColor: "var(--theme-bg-app)",
                    borderColor: "var(--theme-border)",
                    color: "var(--theme-text-muted)",
                    borderWidth: "1px",
                  }}
                >
                  <ArrowRight size={14} />
                </div>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: "var(--theme-text-muted)" }}>
                Live visual employee dashboard, real-time presence indicators, on-break rosters, and shift inspections.
              </p>
            </div>

            {/* Bottom SVG wave curve with continuous animation */}
            <div className="relative z-0 mt-5 -mb-6 -mx-6 h-11 overflow-hidden opacity-85">
              <svg viewBox="0 0 400 48" preserveAspectRatio="none" fill="none" className="w-full h-full">
                <defs>
                  <linearGradient id="employeeAmberWave" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#B45309" stopOpacity="0.2" />
                    <stop offset="60%" stopColor="#D97706" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#FBBF24" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13"
                  stroke="url(#employeeAmberWave)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{
                    d: [
                      "M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13",
                      "M0 37 C 90 37, 160 36, 230 36 C 290 36, 330 20, 370 11 C 385 8, 395 15, 400 10",
                      "M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13",
                    ],
                  }}
                  transition={{ duration: 4.1, repeat: Infinity, ease: "easeInOut" }}
                />
              </svg>
            </div>
          </motion.div>

          {/* 5. View Projects Portfolio */}
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setShowProjectsPage(true);
              updateUrlParam("projects");
            }}
            className="relative p-6 rounded-2xl border cursor-pointer text-left flex flex-col justify-between group shadow-lg overflow-hidden"
            style={{
              backgroundColor: "var(--theme-bg-surface)",
              borderColor: "var(--theme-border)",
            }}
          >
            {/* Ambient Royal Indigo/Purple Glow Backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/15 via-purple-500/5 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3.5">
                  {/* Glowing Indigo Squircle Icon */}
                  <div
                    className="w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                    style={{
                      background: "linear-gradient(135deg, #3730A3 0%, #6366F1 100%)",
                      boxShadow: "0 0 20px rgba(99, 102, 241, 0.4)",
                      color: "#FFFFFF",
                    }}
                  >
                    <FolderKanban size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base" style={{ color: "var(--theme-text-primary)" }}>
                      View Projects
                    </h3>
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border mt-1"
                      style={{
                        backgroundColor: "rgba(245, 158, 11, 0.15)",
                        borderColor: "rgba(245, 158, 11, 0.3)",
                        color: "#FBBF24",
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Project Portfolio
                    </span>
                  </div>
                </div>

                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                  style={{
                    backgroundColor: "var(--theme-bg-app)",
                    borderColor: "var(--theme-border)",
                    color: "var(--theme-text-muted)",
                    borderWidth: "1px",
                  }}
                >
                  <ArrowRight size={14} />
                </div>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: "var(--theme-text-muted)" }}>
                Browse active, inactive, and delivered client projects, assign teams, and inspect advancement configurations.
              </p>
            </div>

            {/* Bottom SVG wave curve with continuous animation */}
            <div className="relative z-0 mt-5 -mb-6 -mx-6 h-11 overflow-hidden opacity-85">
              <svg viewBox="0 0 400 48" preserveAspectRatio="none" fill="none" className="w-full h-full">
                <defs>
                  <linearGradient id="projectsIndigoWave" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3730A3" stopOpacity="0.2" />
                    <stop offset="60%" stopColor="#4F46E5" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#818CF8" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13"
                  stroke="url(#projectsIndigoWave)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{
                    d: [
                      "M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13",
                      "M0 37 C 90 37, 160 36, 230 36 C 290 36, 330 20, 370 11 C 385 8, 395 15, 400 10",
                      "M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13",
                    ],
                  }}
                  transition={{ duration: 4.3, repeat: Infinity, ease: "easeInOut" }}
                />
              </svg>
            </div>
          </motion.div>

          {/* 6. Media Management Card */}
          <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setShowMediaManagementPage(true);
              updateUrlParam("media");
            }}
            className="relative p-6 rounded-2xl border cursor-pointer text-left flex flex-col justify-between group shadow-lg overflow-hidden"
            style={{
              backgroundColor: "var(--theme-bg-surface)",
              borderColor: "var(--theme-border)",
            }}
          >
            {/* Ambient Cyan/Sky Glow Backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/15 via-blue-500/5 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3.5">
                  {/* Glowing Cyan Squircle Icon */}
                  <div
                    className="w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                    style={{
                      background: "linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)",
                      boxShadow: "0 0 20px rgba(14, 165, 233, 0.4)",
                      color: "#FFFFFF",
                    }}
                  >
                    <Video size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base" style={{ color: "var(--theme-text-primary)" }}>
                      Media Management
                    </h3>
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border mt-1"
                      style={{
                        backgroundColor: "rgba(14, 165, 233, 0.15)",
                        borderColor: "rgba(14, 165, 233, 0.3)",
                        color: "#38BDF8",
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      Media Drive Sync
                    </span>
                  </div>
                </div>

                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                  style={{
                    backgroundColor: "var(--theme-bg-app)",
                    borderColor: "var(--theme-border)",
                    color: "var(--theme-text-muted)",
                    borderWidth: "1px",
                  }}
                >
                  <ArrowRight size={14} />
                </div>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: "var(--theme-text-muted)" }}>
                Manage project media folders, upload large assets via 16MB direct chunked streams, and share via visitor links.
              </p>
            </div>

            {/* Bottom SVG wave curve with continuous animation */}
            <div className="relative z-0 mt-5 -mb-6 -mx-6 h-11 overflow-hidden opacity-85">
              <svg viewBox="0 0 400 48" preserveAspectRatio="none" fill="none" className="w-full h-full">
                <defs>
                  <linearGradient id="mediaCyanWave" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0369A1" stopOpacity="0.2" />
                    <stop offset="60%" stopColor="#0284C7" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13"
                  stroke="url(#mediaCyanWave)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  animate={{
                    d: [
                      "M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13",
                      "M0 37 C 90 37, 160 36, 230 36 C 290 36, 330 20, 370 11 C 385 8, 395 15, 400 10",
                      "M0 38 C 90 38, 160 38, 230 38 C 290 38, 330 24, 370 14 C 385 10, 395 18, 400 13",
                    ],
                  }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                />
              </svg>
            </div>
          </motion.div>
        </div>

        {/* Roles Detail Panel */}
        {selectedModule === "roles" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-6 sm:p-7 rounded-3xl border shadow-sm relative overflow-hidden"
            style={{
              backgroundColor: "var(--theme-bg-surface)",
              borderColor: "rgba(168, 85, 247, 0.3)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Shield size={18} />
                </div>
                <div>
                  <h4 className="font-display font-bold text-base text-slate-900 dark:text-white">
                    Workspace Roles & Permission Levels
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Administrative boundaries for Super Admins, Workspace Admins, Managers, and Employees.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedModule(null)}
                className="text-xs font-mono text-slate-400 hover:text-slate-600 dark:hover:text-white transition px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              {[
                {
                  name: "SUPER_ADMIN",
                  badge: "Full Root",
                  color: "from-rose-500/10 border-rose-500/20 text-rose-500",
                  desc: "Full root access to system consoles, workspaces, and user directories.",
                },
                {
                  name: "WORKSPACE_ADMIN",
                  badge: "Admin",
                  color: "from-purple-500/10 border-purple-500/20 text-purple-400",
                  desc: "Can manage channels, bots, organization controls, and members.",
                },
                {
                  name: "MANAGER",
                  badge: "Staff Lead",
                  color: "from-blue-500/10 border-blue-500/20 text-blue-400",
                  desc: "Can supervise team attendance, create project boards, and assign tickets.",
                },
                {
                  name: "EMPLOYEE",
                  badge: "Member",
                  color: "from-emerald-500/10 border-emerald-500/20 text-emerald-400",
                  desc: "Can chat, join calls, take breaks, and manage personal shift availability.",
                },
              ].map((r) => (
                <div
                  key={r.name}
                  className="p-5 rounded-2xl border bg-slate-50/50 dark:bg-zinc-950/40 border-slate-200 dark:border-white/10 flex flex-col justify-between hover:border-purple-500/40 transition-all shadow-xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-xs tracking-tight text-slate-900 dark:text-white">
                      {r.name}
                    </span>
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${r.color}`}>
                      {r.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed mt-1">
                    {r.desc}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Members Detail Panel */}
        {selectedModule === "members" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-6 sm:p-7 rounded-3xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden"
            style={{
              backgroundColor: "var(--theme-bg-surface)",
              borderColor: "rgba(6, 182, 212, 0.3)",
            }}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Users size={20} />
              </div>
              <div>
                <h4 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  Team Roster & Invitations
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Invite teammates to <strong className="text-slate-800 dark:text-zinc-200">{workspace.name}</strong>, assign departments, or configure seat licenses.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setSelectedModule(null)}
                className="text-xs font-mono text-slate-400 hover:text-slate-600 dark:hover:text-white transition px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10"
              >
                Close
              </button>
              {onOpenAddMembers && (
                <button
                  onClick={onOpenAddMembers}
                  className="px-4 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:opacity-95 shadow-md shadow-cyan-500/20 flex items-center gap-2 transition"
                >
                  <UserCheck size={14} />
                  <span>Invite New Members</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Break Reason Selection Modal */}
      {showBreakModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-60 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl animate-in zoom-in-95 duration-150"
            style={{
              backgroundColor: "var(--theme-bg-surface)",
              borderColor: "var(--theme-border)",
              color: "var(--theme-text-primary)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Coffee size={18} className="text-amber-700 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-[var(--theme-text)]">
                  Select Break Reason
                </h3>
              </div>
              <button
                onClick={() => setShowBreakModal(false)}
                className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
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
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50"
                      : "bg-[var(--theme-bg-surface-hover)] text-[var(--theme-text)] border-[var(--theme-border)] hover:bg-[var(--theme-bg-surface-hover)]"
                  }`}
                >
                  <span>{reason}</span>
                  {selectedBreakReason === reason && (
                    <CheckCircle2 size={14} className="text-amber-700 dark:text-amber-400" />
                  )}
                </button>
              ))}
            </div>

            {selectedBreakReason === "Other" && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Specify other reason..."
                  value={customBreakReason}
                  onChange={(e) => setCustomBreakReason(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--theme-bg-app)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBreakModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)]"
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
              backgroundColor: "var(--theme-bg-surface)",
              borderColor: "var(--theme-border)",
              color: "var(--theme-text-primary)",
            }}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-base font-bold text-center text-[var(--theme-text)] mb-2">
              Less Than 8 Hours Active
            </h3>

            <p
              className="text-xs text-center leading-relaxed mb-5"
              style={{ color: "var(--theme-text-muted)" }}
            >
              Your calculated active working time today is{" "}
              <strong className="text-amber-700 dark:text-amber-300">
                {checkoutWarningHours} hours
              </strong>
              , which is less than the standard 8 hours. Are you sure you want
              to checkout now?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCheckoutConfirm(false)}
                className="flex-1 px-3.5 py-2 rounded-xl text-xs font-medium text-[var(--theme-text)] bg-[var(--theme-bg-surface-hover)] hover:bg-[var(--theme-bg-surface-hover)] transition"
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
