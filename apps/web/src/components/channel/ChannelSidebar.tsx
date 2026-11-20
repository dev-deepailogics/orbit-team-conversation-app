"use client";

import React, { useState, useRef, useEffect } from "react";
import { Avatar } from "@/components/project/projectViewUtils";
import { Workspace, Channel, UserProfile, Project, UserStatus } from "@orbit/types";
import { Presence } from "../availability/useTeamPresence";
import { StatusEmoji } from "../availability/StatusEmoji";
import { isLiveOnline } from "./useLiveUserStatus";
import { useResizableSidebar } from "../layout/useResizableSidebar";
import {
  Hash,
  Lock,
  Plus,
  ChevronDown,
  PhoneCall,
  Bot,
  UserPlus,
  HardDrive,
  X,
  Search,
  FolderKanban,
  Palette,
  Check,
  Building2,
  
  FileText,
  Trash2,
  Share2,
  Canvas,
  Board,
  Pen,
  Mask,
  Pin,
} from "@/components/ui/icons";
import { ProjectDocument } from "@orbit/types";
import { api } from "../../lib/api";
import { useChatStore } from "../../stores/chatStore";
import { usePinStore } from "../../stores/pinnedStore";
import { WorkspaceStorageModal } from "../workspace/WorkspaceStorageModal";
import { AddWorkspaceMemberDialog } from "../workspace/AddWorkspaceMemberDialog";
import { ThemeModal } from "../theme/ThemeModal";
import { OrganizationControlModal } from "../availability/OrganizationControlModal";
import { CreateChannelModal } from "./CreateChannelModal";
import { NewDirectMessageModal } from "./NewDirectMessageModal";

/** Animates a section open/closed (grid 0fr -> 1fr). Collapsed content is inert so it can't be tabbed into. */
const Collapse: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => (
  <div
    className="grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none"
    style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
    // React 18 drops boolean `inert`; the empty-string attribute is what browsers read.
    {...(open ? {} : ({ inert: "" } as object))}
  >
    <div className="min-h-0 overflow-hidden">{children}</div>
  </div>
);

const SectionHeader: React.FC<{
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  addTitle?: string;
}> = ({ label, collapsed, onToggle, onAdd, addTitle }) => (
  <div className="flex items-center h-[26px] pr-2 select-none" style={{ color: "var(--theme-section)" }}>
    <button
      onClick={onToggle}
      className="flex-1 h-full flex items-center gap-1.5 pl-1 text-left text-xs font-semibold transition hover:opacity-75 focus:outline-none min-w-0"
    >
      <ChevronDown
        size={14}
        className={`transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
      />
      <span className="truncate">{label}</span>
    </button>
    {onAdd && (
      <button
        onClick={onAdd}
        title={addTitle}
        className="shrink-0 rounded transition hover:opacity-70"
        style={{ color: "var(--theme-text-muted)" }}
      >
        <Plus size={16} />
      </button>
    )}
  </div>
);

const ActiveBar = () => (
  <span
    className="absolute left-0 top-[6px] w-[3px] h-5 rounded-[2px]"
    style={{ backgroundColor: "var(--theme-accent)" }}
  />
);

const UnreadBadge: React.FC<{ count: number }> = ({ count }) => (
  <span
    className="ml-2 shrink-0 min-w-[22px] h-5 px-1.5 rounded-[10px] flex items-center justify-center text-xs font-bold"
    style={{ backgroundColor: "var(--theme-accent)", color: "var(--theme-primary-text)" }}
  >
    {count}
  </span>
);

const rowClass = (active: boolean) =>
  `group relative flex items-center h-8 pr-3 rounded-lg cursor-pointer transition-colors ${
    active ? "" : "hover:bg-[var(--theme-fill-hover)]"
  }`;

const rowStyle = (active: boolean): React.CSSProperties | undefined =>
  active ? { backgroundColor: "var(--theme-selected)" } : undefined;

const rowLabel = (active: boolean, unread = false) => ({
  className: `flex-1 truncate text-sm ${active || unread ? "font-semibold" : ""}`,
  style: { color: "var(--theme-text)", opacity: active || unread ? 1 : 0.9 },
});

const RowIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    className="ml-[10px] mr-2 w-[18px] h-[18px] shrink-0 flex items-center justify-center"
    style={{ color: "var(--theme-text-muted)" }}
  >
    {children}
  </span>
);

interface ChannelSidebarProps {
  workspace: Workspace;
  channels: Channel[];
  currentChannel: Channel | null;
  currentUser: UserProfile | null;
  members: any[];
  projects?: Project[];
  currentProject?: Project | null;
  activeHuddleChannelId?: string | null;
  onSelectChannel: (channel: Channel) => void;
  onSelectUserDM: (targetUser: UserProfile) => void;
  onChannelCreated: (channel: Channel) => void;
  onSelectProject?: (project: Project) => void;
  onOpenCreateProject?: () => void;
  showProjects?: boolean;
  showCanvas?: boolean;
  showDocs?: boolean;
  onClosePanel?: () => void;
  // Canvas props
  canvases?: any[];
  currentCanvasId?: string | null;
  onSelectCanvas?: (canvasId: string) => void;
  onOpenCreateCanvas?: () => void;
  onDeleteCanvas?: (canvasId: string) => void;
  // Docs props
  documents?: ProjectDocument[];
  currentDocument?: ProjectDocument | null;
  onSelectDocument?: (doc: ProjectDocument) => void;
  onOpenCreateDoc?: () => void;
  onShareDocument?: (doc: ProjectDocument) => void;
  onDeleteDocument?: (docId: string) => void;
  onOpenBotPortal: () => void;
  onStartHuddle: (channel: Channel) => void;
  presence?: Record<string, Presence>;
  /** userId -> reason of their open break (only for members currently on break). */
  breakReasons?: Record<string, string>;
  liveStatus?: Record<string, UserStatus>;
  onOpenSearch?: () => void;
  onOpenOrganizationControl?: () => void;
  onCloseMobile?: () => void;
  onMemberAdded?: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  workspace,
  channels,
  currentChannel,
  currentUser,
  members,
  projects = [],
  currentProject,
  activeHuddleChannelId,
  onSelectChannel,
  onSelectUserDM,
  onChannelCreated,
  onSelectProject,
  onOpenCreateProject,
  showProjects = false,
  showCanvas = false,
  showDocs = false,
  onClosePanel,
  canvases = [],
  currentCanvasId,
  onSelectCanvas,
  onOpenCreateCanvas,
  onDeleteCanvas,
  documents = [],
  currentDocument,
  onSelectDocument,
  onOpenCreateDoc,
  onShareDocument,
  onDeleteDocument,
  onOpenBotPortal,
  onStartHuddle,
  presence = {},
  breakReasons = {},
  liveStatus = {},
  onOpenSearch,
  onOpenOrganizationControl,
  onCloseMobile,
  onMemberAdded,
}) => {
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const sidebar = useResizableSidebar({ storageKey: "orbit_sidebar_width", defaultWidth: 208 });
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showOrgControlModal, setShowOrgControlModal] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const [isChannelsCollapsed, setIsChannelsCollapsed] = useState(false);
  const [isDmsCollapsed, setIsDmsCollapsed] = useState(false);
  const [dmSearchQuery, setDmSearchQuery] = useState("");
  const [showDmSearch, setShowDmSearch] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [canvasSearchQuery, setCanvasSearchQuery] = useState("");
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [docActiveFilter, setDocActiveFilter] = useState<"all" | "project" | "shared" | "private">("all");
  const unreadCounts = useChatStore((s) => s.unreadCounts);

  // Pin state
  const pinnedChannelIds = usePinStore((s) => (workspace?.id ? s.getPinnedChannels(workspace.id) : []));
  const pinnedUserIds = usePinStore((s) => (workspace?.id ? s.getPinnedUsers(workspace.id) : []));
  const pinnedProjectIds = usePinStore((s) => (workspace?.id ? s.getPinnedProjects(workspace.id) : []));
  const togglePinChannel = usePinStore((s) => s.togglePinChannel);
  const togglePinUser = usePinStore((s) => s.togglePinUser);
  const togglePinProject = usePinStore((s) => s.togglePinProject);

  useEffect(() => {
    if (workspace?.id && currentUser?.id) {
      const memberObj = members?.find(
        (m: any) => m.userId === currentUser.id || m.user?.id === currentUser.id
      );
      usePinStore.getState().initPins(workspace.id, currentUser.id, memberObj?.settings);
    }
  }, [workspace?.id, currentUser?.id, members]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        workspaceMenuRef.current &&
        !workspaceMenuRef.current.contains(e.target as Node)
      ) {
        setShowWorkspaceMenu(false);
      }
    };
    if (showWorkspaceMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showWorkspaceMenu]);

  const currentUserMember = members?.find(
    (m: any) => m.userId === currentUser?.id || m.user?.id === currentUser?.id,
  );
  const isAdminOrOwner =
    currentUser?.systemRole === "SUPER_ADMIN" ||
    currentUserMember?.role === "OWNER" ||
    currentUserMember?.role === "ADMIN" ||
    workspace.ownerId === currentUser?.id;

  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}/join/${(workspace as any).inviteCode || workspace.id}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  return (
    <div
      className="relative w-64 md:w-[var(--sidebar-w)] shrink-0 flex flex-col h-full select-none"
      style={{
        backgroundColor: "var(--theme-bg-sidebar)",
        ...sidebar.style,
      }}
    >
      {sidebar.handle}

      {/* Workspace Header with Dropdown */}
      <div
        ref={workspaceMenuRef}
        className="relative h-14 shrink-0 border-b pl-4 pr-3 flex items-center justify-between gap-2.5 select-none z-30"
        style={{
          borderColor: "var(--theme-fill)",
          color: "var(--theme-text-primary)",
        }}
      >
        {showProjects ? (
          <span className="flex items-center gap-2 truncate font-bold text-[17px]">
            <Board size={18} style={{ color: "var(--theme-text-muted)" }} />
            Projects & Boards
          </span>
        ) : showCanvas ? (
          <span className="flex items-center gap-2 truncate font-bold text-[17px]">
            <Canvas size={18} style={{ color: "var(--theme-text-muted)" }} />
            Canvases
          </span>
        ) : showDocs ? (
          <span className="flex items-center gap-2 truncate font-bold text-[17px]">
            <FileText size={18} style={{ color: "var(--theme-text-muted)" }} />
            Docs
          </span>
        ) : (
          <button
            onClick={() => setShowWorkspaceMenu((prev) => !prev)}
            title="Workspace options"
            className="flex-1 flex items-center justify-between gap-1.5 rounded-lg py-1 -ml-1.5 pl-1.5 pr-0.5 transition hover:bg-[var(--theme-fill-hover)] text-left min-w-0"
          >
            <span className="truncate font-bold text-[17px] leading-tight">
              {workspace.name}
            </span>
            <ChevronDown
              size={16}
              className={`shrink-0 transition-transform duration-200 ${
                showWorkspaceMenu ? "rotate-180" : ""
              }`}
              style={{ color: "var(--theme-text-muted)" }}
            />
          </button>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {showProjects ? (
            <>
              {onOpenCreateProject && (
                <button
                  onClick={onOpenCreateProject}
                  title="Create Project Board"
                  style={{ color: "var(--theme-text-muted)" }}
                  className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10 hover:opacity-100"
                >
                  <Plus size={18} />
                </button>
              )}
              <button
                onClick={() => {
                  onClosePanel?.();
                  onCloseMobile?.();
                }}
                title="Close Projects"
                style={{ color: "var(--theme-text-muted)" }}
                className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10 hover:opacity-100"
              >
                <X size={18} />
              </button>
            </>
          ) : showCanvas ? (
            <>
              {onOpenCreateCanvas && (
                <button
                  onClick={onOpenCreateCanvas}
                  title="Create Canvas"
                  style={{ color: "var(--theme-text-muted)" }}
                  className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10 hover:opacity-100"
                >
                  <Plus size={18} />
                </button>
              )}
              <button
                onClick={() => {
                  onClosePanel?.();
                  onCloseMobile?.();
                }}
                title="Close Canvases"
                style={{ color: "var(--theme-text-muted)" }}
                className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10 hover:opacity-100"
              >
                <X size={18} />
              </button>
            </>
          ) : showDocs ? (
            <>
              {onOpenCreateDoc && (
                <button
                  onClick={onOpenCreateDoc}
                  title="Create Document"
                  style={{ color: "var(--theme-text-muted)" }}
                  className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10 hover:opacity-100"
                >
                  <Plus size={18} />
                </button>
              )}
              <button
                onClick={() => {
                  onClosePanel?.();
                  onCloseMobile?.();
                }}
                title="Close Docs"
                style={{ color: "var(--theme-text-muted)" }}
                className="p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10 hover:opacity-100"
              >
                <X size={18} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowNewDm(true)}
                title="New message"
                className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:brightness-95"
                style={{ backgroundColor: "var(--theme-fill)", color: "var(--theme-text-muted)" }}
              >
                <Pen size={18} />
              </button>
              {onCloseMobile && (
                <button
                  onClick={onCloseMobile}
                  title="Close Menu"
                  style={{ color: "var(--theme-text-muted)" }}
                  className="md:hidden p-1.5 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10 hover:opacity-100"
                >
                  <X size={18} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Workspace Dropdown Menu */}
        {!showProjects && showWorkspaceMenu && (
          <div
            className="absolute top-full left-3 mt-1.5 w-64 rounded-xl border shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
            style={{
              backgroundColor: "var(--theme-bg-surface)",
              borderColor: "var(--theme-border)",
              color: "var(--theme-text-primary)",
            }}
          >
            {/* Header info */}
            <div
              className="px-3.5 py-2 border-b"
              style={{ borderColor: "var(--theme-border)" }}
            >
              <p className="text-xs font-bold truncate">{workspace.name}</p>
              <p
                className="text-[11px] truncate mt-0.5"
                style={{ color: "var(--theme-text-muted)" }}
              >
                {isAdminOrOwner
                  ? "Workspace Administrator"
                  : "Workspace Member"}
              </p>
            </div>

            <div className="py-1">
              {/* Organization Control (Employee Availability & Shift Management) */}
              <button
                onClick={() => {
                  setShowWorkspaceMenu(false);
                  if (onOpenOrganizationControl) {
                    onOpenOrganizationControl();
                  } else {
                    setShowOrgControlModal(true);
                  }
                }}
                className="w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition hover:bg-black/5 dark:hover:bg-white/10 group"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 size={15} className="text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-blue-700 dark:text-blue-300">
                    Organization Control
                  </span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:scale-125 transition" />
              </button>

              {/* Theme & Appearance */}
              <button
                onClick={() => {
                  setShowWorkspaceMenu(false);
                  setShowThemeModal(true);
                }}
                className="w-full px-3.5 py-2 text-left text-xs flex items-center gap-2.5 transition hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Palette size={15} style={{ color: "var(--theme-primary)" }} />
                <span>Customize Theme & Colors</span>
              </button>

              {/* Chatbot Integrations & Bots */}
              <button
                onClick={() => {
                  setShowWorkspaceMenu(false);
                  onOpenBotPortal();
                }}
                className="w-full px-3.5 py-2 text-left text-xs flex items-center gap-2.5 transition hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Bot size={15} style={{ color: "var(--theme-primary)" }} />
                <span>Chatbot Integrations & Bots</span>
              </button>

              {/* Workspace Files & Storage */}
              <button
                onClick={() => {
                  setShowWorkspaceMenu(false);
                  setShowStorageModal(true);
                }}
                className="w-full px-3.5 py-2 text-left text-xs flex items-center gap-2.5 transition hover:bg-black/5 dark:hover:bg-white/10"
              >
                <HardDrive
                  size={15}
                  style={{ color: "var(--theme-primary)" }}
                />
                <span>Workspace Files & Storage</span>
              </button>

              <div
                className="h-px my-1"
                style={{ backgroundColor: "var(--theme-border)" }}
              />

              <button
                onClick={() => {
                  setShowWorkspaceMenu(false);
                  setShowAddMemberModal(true);
                }}
                className="w-full px-3.5 py-2 text-left text-xs flex items-center gap-2.5 transition hover:bg-[var(--theme-fill-hover)]"
              >
                <UserPlus size={15} style={{ color: "var(--theme-primary)" }} />
                <span>Invite & Add Members</span>
              </button>

              {/* Copy Invite Link */}
              <button
                onClick={() => {
                  copyInviteLink();
                }}
                className="w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="flex items-center gap-2.5">
                  <UserPlus
                    size={15}
                    style={{ color: "var(--theme-primary)" }}
                  />
                  <span>
                    {copiedInvite
                      ? "Invite Link Copied!"
                      : "Copy Workspace Invite Link"}
                  </span>
                </span>
                {copiedInvite && <Check size={13} className="text-green-500" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Channel & DMs List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
        {/* Quick Search Bar */}
        {showProjects ? (
          <div className="px-1 mb-2">
            <div
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs"
              style={{
                backgroundColor: "var(--theme-bg-surface)",
                borderColor: "var(--theme-border)",
              }}
            >
              <Search
                size={14}
                style={{ color: "var(--theme-primary)" }}
                className="shrink-0"
              />
              <input
                type="text"
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-transparent outline-none"
                style={{ color: "var(--theme-text-primary)" }}
              />
              {projectSearchQuery && (
                <button
                  onClick={() => setProjectSearchQuery("")}
                  title="Clear"
                  style={{ color: "var(--theme-text-muted)" }}
                  className="shrink-0 hover:opacity-80"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        ) : showCanvas ? (
          <div className="px-1 mb-2">
            <div
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs"
              style={{
                backgroundColor: "var(--theme-bg-surface)",
                borderColor: "var(--theme-border)",
              }}
            >
              <Search
                size={14}
                style={{ color: "var(--theme-primary)" }}
                className="shrink-0"
              />
              <input
                type="text"
                value={canvasSearchQuery}
                onChange={(e) => setCanvasSearchQuery(e.target.value)}
                placeholder="Search canvases..."
                className="w-full bg-transparent outline-none"
                style={{ color: "var(--theme-text-primary)" }}
              />
              {canvasSearchQuery && (
                <button
                  onClick={() => setCanvasSearchQuery("")}
                  title="Clear"
                  style={{ color: "var(--theme-text-muted)" }}
                  className="shrink-0 hover:opacity-80"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        ) : showDocs ? (
          <div className="px-1 mb-2 space-y-2">
            <div
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs"
              style={{
                backgroundColor: "var(--theme-bg-surface)",
                borderColor: "var(--theme-border)",
              }}
            >
              <Search
                size={14}
                style={{ color: "var(--theme-primary)" }}
                className="shrink-0"
              />
              <input
                type="text"
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full bg-transparent outline-none"
                style={{ color: "var(--theme-text-primary)" }}
              />
              {docSearchQuery && (
                <button
                  onClick={() => setDocSearchQuery("")}
                  title="Clear"
                  style={{ color: "var(--theme-text-muted)" }}
                  className="shrink-0 hover:opacity-80"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            {/* Filter pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "project", label: "Public" },
                  { id: "shared", label: "Shared" },
                  { id: "private", label: "Drafts" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDocActiveFilter(tab.id)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition shrink-0 ${
                    docActiveFilter === tab.id
                      ? "font-semibold shadow-xs"
                      : "hover:bg-black/5 dark:hover:bg-white/10"
                  }`}
                  style={{
                    backgroundColor:
                      docActiveFilter === tab.id
                        ? "var(--theme-bg-surface)"
                        : "transparent",
                    color:
                      docActiveFilter === tab.id
                        ? "var(--theme-text-primary)"
                        : "var(--theme-text-muted)",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          onOpenSearch && (
            <div className="px-1">
              <button
                onClick={onOpenSearch}
                title="Search messages (Cmd+K / Ctrl+K)"
                className="w-full h-8 flex items-center gap-[9px] pl-[9px] pr-4 rounded-lg transition hover:brightness-95"
                style={{ backgroundColor: "var(--theme-fill)", color: "var(--theme-text-muted)" }}
              >
                <Search size={16} />
                <span className="flex-1 text-left text-[13px]" style={{ color: "var(--theme-text)", opacity: 0.8 }}>
                  Search
                </span>
                <kbd className="font-sans text-[11px] font-medium opacity-80">⌘K</kbd>
              </button>
            </div>
          )
        )}

        {/* Projects & Boards Section (Trello-like) — shown when toggled from the rail's Projects icon; title + create button live in the header above */}
        {showProjects && (
          <div>
            <div className="space-y-0.5">
              {(() => {
                const activeProjects = projects
                  .filter(
                    (p) => (p.status || "active").toLowerCase() === "active",
                  )
                  .filter((p) =>
                    p.name.toLowerCase().includes(projectSearchQuery.trim().toLowerCase()),
                  );

                const pinnedProjects = activeProjects.filter((p) => pinnedProjectIds.includes(p.id));
                const unpinnedProjects = activeProjects.filter((p) => !pinnedProjectIds.includes(p.id));
                const sortedProjects = [...pinnedProjects, ...unpinnedProjects];

                return sortedProjects.map((project, idx) => {
                  const isActive = currentProject?.id === project.id;
                  const isPinned = pinnedProjectIds.includes(project.id);
                  const ticketCount =
                    project._count?.tickets ?? project.tickets?.length ?? 0;
                  const showDivider =
                    pinnedProjects.length > 0 &&
                    idx === pinnedProjects.length - 1 &&
                    unpinnedProjects.length > 0;

                  return (
                    <React.Fragment key={project.id}>
                      <div
                        onClick={() => onSelectProject?.(project)}
                        className={`group flex items-center justify-between h-7 pl-5 pr-2 rounded-md text-[15px] transition cursor-pointer ${
                          isActive
                            ? "font-semibold"
                            : "hover:bg-black/5 dark:hover:bg-white/10"
                        }`}
                        style={
                          isActive
                            ? {
                                backgroundColor: "var(--theme-selected)",
                                color: "var(--theme-text)",
                              }
                            : {
                                color: "var(--theme-text-primary)",
                              }
                        }
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <span className="text-sm shrink-0">
                            {project.icon || "📋"}
                          </span>
                          <span className="truncate">{project.name}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinProject(workspace.id, project.id);
                            }}
                            title={isPinned ? "Unpin project" : "Pin project to top"}
                            className={`p-1 rounded transition ${
                              isPinned
                                ? "text-amber-500 dark:text-amber-400 opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                                : "opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                            }`}
                            style={isPinned ? undefined : { color: "var(--theme-text-muted)" }}
                          >
                            <Pin
                              size={12}
                              className={isPinned ? "fill-amber-500 dark:fill-amber-400 rotate-45" : ""}
                            />
                          </button>
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full transition"
                            style={
                              isActive
                                ? {
                                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                                    color: "inherit",
                                  }
                                : {
                                    backgroundColor:
                                      "var(--theme-bg-surface-hover)",
                                    color: "var(--theme-text-muted)",
                                  }
                            }
                          >
                            {ticketCount}
                          </span>
                        </div>
                      </div>
                      {showDivider && (
                        <div className="my-1 border-b border-black/5 dark:border-white/5 mx-2" />
                      )}
                    </React.Fragment>
                  );
                });
              })()}

              {projects.length === 0 && onOpenCreateProject && (
                <button
                  onClick={onOpenCreateProject}
                  className="w-full text-left h-7 pl-5 pr-2 rounded-md text-[15px] hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center gap-2 cursor-pointer"
                  style={{ color: "var(--theme-text-muted)" }}
                >
                  <Plus size={12} />
                  <span>Create a project board...</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Canvases Section — shown when toggled from rail */}
        {showCanvas && (
          <div>
            <div className="space-y-0.5">
              {canvases
                .filter((c: any) =>
                  (c.title || "Untitled canvas")
                    .toLowerCase()
                    .includes(canvasSearchQuery.trim().toLowerCase()),
                )
                .map((canvas: any) => {
                  const isActive = currentCanvasId === canvas.id;
                  const canDelete =
                    canvas.createdById === currentUser?.id ||
                    currentUser?.systemRole === "SUPER_ADMIN";

                  return (
                    <div
                      key={canvas.id}
                      onClick={() => onSelectCanvas?.(canvas.id)}
                      className={`group flex items-center justify-between h-7 pl-5 pr-2 rounded-md text-[15px] transition cursor-pointer ${
                        isActive
                          ? "font-semibold"
                          : "hover:bg-black/5 dark:hover:bg-white/10"
                      }`}
                      style={
                        isActive
                          ? {
                              backgroundColor: "var(--theme-selected)",
                              color: "var(--theme-text)",
                            }
                          : {
                              color: "var(--theme-text-primary)",
                            }
                      }
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Canvas size={14} className="shrink-0" />
                        <span className="truncate">
                          {canvas.title || "Untitled canvas"}
                        </span>
                      </div>

                      {canDelete && onDeleteCanvas && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCanvas(canvas.id);
                          }}
                          title="Delete canvas"
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}

              {canvases.length === 0 && onOpenCreateCanvas && (
                <button
                  onClick={onOpenCreateCanvas}
                  className="w-full text-left h-7 pl-5 pr-2 rounded-md text-[15px] hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center gap-2 cursor-pointer"
                  style={{ color: "var(--theme-text-muted)" }}
                >
                  <Plus size={12} />
                  <span>Create a canvas...</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Docs Section — shown when toggled from rail */}
        {showDocs && (
          <div>
            <div className="space-y-0.5">
              {documents
                .filter((doc) => {
                  if (docActiveFilter === "project") return doc.isPublicInProject;
                  if (docActiveFilter === "shared") {
                    return (
                      !doc.isPublicInProject &&
                      doc.shares &&
                      doc.shares.length > 0
                    );
                  }
                  if (docActiveFilter === "private") {
                    return (
                      !doc.isPublicInProject &&
                      doc.createdById === currentUser?.id &&
                      (!doc.shares || doc.shares.length === 0)
                    );
                  }
                  return true;
                })
                .filter((doc) =>
                  (doc.title || "Untitled Document")
                    .toLowerCase()
                    .includes(docSearchQuery.trim().toLowerCase()),
                )
                .map((doc) => {
                  const isActive = currentDocument?.id === doc.id;
                  const isCreator = doc.createdById === currentUser?.id;
                  const canDelete =
                    isCreator || currentUser?.systemRole === "SUPER_ADMIN";

                  return (
                    <div
                      key={doc.id}
                      onClick={() => onSelectDocument?.(doc)}
                      className={`group flex items-center justify-between h-7 pl-5 pr-2 rounded-md text-[15px] transition cursor-pointer ${
                        isActive
                          ? "font-semibold"
                          : "hover:bg-black/5 dark:hover:bg-white/10"
                      }`}
                      style={
                        isActive
                          ? {
                              backgroundColor: "var(--theme-selected)",
                              color: "var(--theme-text)",
                            }
                          : {
                              color: "var(--theme-text-primary)",
                            }
                      }
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-sm shrink-0 leading-none">
                          {doc.icon || "📄"}
                        </span>
                        <span className="truncate">
                          {doc.title || "Untitled Document"}
                        </span>
                        {!doc.isPublicInProject && (
                          <Lock size={12} className="shrink-0 opacity-60" />
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                        {onShareDocument && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onShareDocument(doc);
                            }}
                            title="Share document"
                            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition"
                          >
                            <Share2 size={13} />
                          </button>
                        )}
                        {canDelete && onDeleteDocument && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDocument(doc.id);
                            }}
                            title="Delete document"
                            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

              {documents.length === 0 && onOpenCreateDoc && (
                <button
                  onClick={onOpenCreateDoc}
                  className="w-full text-left h-7 pl-5 pr-2 rounded-md text-[15px] hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center gap-2 cursor-pointer"
                  style={{ color: "var(--theme-text-muted)" }}
                >
                  <Plus size={12} />
                  <span>Create a document...</span>
                </button>
              )}
            </div>
          </div>
        )}

        {!showProjects && !showCanvas && !showDocs && (
        <>
        {/* Channels Section */}
        <div>
          <SectionHeader
            label="Channels"
            collapsed={isChannelsCollapsed}
            onToggle={() => setIsChannelsCollapsed((prev) => !prev)}
            onAdd={() => setShowCreateChannel(true)}
            addTitle="Create a channel"
          />

          <Collapse open={!isChannelsCollapsed}>
            <div className="space-y-0.5">
              {(() => {
                const nonDirectChannels = channels.filter((c) => c.type !== "DIRECT");
                const pinnedChannels = nonDirectChannels.filter((c) => pinnedChannelIds.includes(c.id));
                const unpinnedChannels = nonDirectChannels.filter((c) => !pinnedChannelIds.includes(c.id));
                const sortedChannels = [...pinnedChannels, ...unpinnedChannels];

                return sortedChannels.map((channel, idx) => {
                  const isActive = currentChannel?.id === channel.id;
                  const isPinned = pinnedChannelIds.includes(channel.id);
                  const hasHuddle = activeHuddleChannelId === channel.id;
                  const unread = unreadCounts[channel.id] || 0;
                  const showDivider =
                    pinnedChannels.length > 0 &&
                    idx === pinnedChannels.length - 1 &&
                    unpinnedChannels.length > 0;

                  return (
                    <React.Fragment key={channel.id}>
                      <div
                        onClick={() => onSelectChannel(channel)}
                        className={rowClass(isActive)}
                        style={rowStyle(isActive)}
                      >
                        {isActive && <ActiveBar />}
                        <RowIcon>
                          {channel.isAnonymous ? (
                            <Mask size={18} aria-label="Anonymous channel" />
                          ) : channel.type === "PRIVATE" ? (
                            <Lock size={18} aria-label="Private channel" />
                          ) : (
                            <Hash size={16} />
                          )}
                        </RowIcon>
                        <span {...rowLabel(isActive, unread > 0)}>{channel.name}</span>

                        {hasHuddle && (
                          <span
                            className="ml-2 shrink-0 flex items-center gap-1 px-1.5 h-5 rounded-full text-[10px] font-bold animate-pulse"
                            style={{
                              backgroundColor: "color-mix(in srgb, var(--theme-primary) 15%, transparent)",
                              color: "var(--theme-primary)",
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--theme-primary)" }} />
                            LIVE
                          </span>
                        )}

                        {/* Pin Channel Action */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinChannel(workspace.id, channel.id);
                          }}
                          title={isPinned ? "Unpin channel" : "Pin channel to top"}
                          className={`ml-1 shrink-0 p-1 rounded transition ${
                            isPinned
                              ? "text-amber-500 dark:text-amber-400 opacity-100 hover:bg-[var(--theme-fill)]"
                              : "opacity-0 group-hover:opacity-100 hover:bg-[var(--theme-fill)]"
                          }`}
                          style={isPinned ? undefined : { color: "var(--theme-text-muted)" }}
                        >
                          <Pin
                            size={12}
                            className={isPinned ? "fill-amber-500 dark:fill-amber-400 rotate-45" : ""}
                          />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartHuddle(channel);
                          }}
                          title={hasHuddle ? "Active Call - Click to join" : "Start Call"}
                          className={`ml-1 shrink-0 p-1 rounded transition ${
                            hasHuddle ? "" : "hidden group-hover:block hover:bg-[var(--theme-fill)]"
                          }`}
                          style={
                            hasHuddle
                              ? { backgroundColor: "var(--theme-primary)", color: "var(--theme-primary-text)" }
                              : { color: "var(--theme-text-muted)" }
                          }
                        >
                          <PhoneCall size={13} />
                        </button>

                        {unread > 0 && <UnreadBadge count={unread} />}
                      </div>
                      {showDivider && (
                        <div className="my-1 border-b border-black/5 dark:border-white/5 mx-2" />
                      )}
                    </React.Fragment>
                  );
                });
              })()}
            </div>
          </Collapse>
        </div>

        {/* Direct Messages Section */}
        <div>
          <SectionHeader
            label="Direct messages"
            collapsed={isDmsCollapsed}
            onToggle={() => setIsDmsCollapsed((prev) => !prev)}
            onAdd={() => setShowNewDm(true)}
            addTitle="New message"
          />

          <Collapse open={!isDmsCollapsed}>
            <div className="space-y-0.5">
              {showDmSearch && (
                <div className="px-1 pt-1 pb-1.5">
                  <div
                    className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px]"
                    style={{
                      backgroundColor: "var(--theme-fill)",
                      color: "var(--theme-text-primary)",
                    }}
                  >
                    <Search size={12} className="shrink-0 opacity-60" />
                    <input
                      type="text"
                      value={dmSearchQuery}
                      onChange={(e) => setDmSearchQuery(e.target.value)}
                      placeholder="Search users..."
                      autoFocus
                      className="bg-transparent border-none outline-none w-full text-xs placeholder:text-[var(--theme-text-muted)] focus:outline-none"
                    />
                    {dmSearchQuery && (
                      <button
                        onClick={() => setDmSearchQuery("")}
                        className="opacity-60 hover:opacity-100 transition focus:outline-none"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {(() => {
                // Collect users from members + any user from existing DIRECT channels (e.g. kicked users with chat history)
                const userMap = new Map<string, { user: any; id: string }>();

                // 1. Add current workspace members
                members.forEach((m) => {
                  if (m?.user) {
                    userMap.set(m.user.id, {
                      user: m.user,
                      id: m.id || m.user.id,
                    });
                  }
                });

                // 2. Add any other participant in an existing 1:1 DIRECT channel
                channels
                  .filter(
                    (c) => c.type === "DIRECT" && Array.isArray(c.members),
                  )
                  .forEach((c) => {
                    c.members?.forEach((cm: any) => {
                      if (cm?.user && !userMap.has(cm.user.id)) {
                        userMap.set(cm.user.id, {
                          user: cm.user,
                          id: `dm-peer-${cm.user.id}`,
                        });
                      }
                    });
                  });

                let dmList = Array.from(userMap.values());

                if (dmSearchQuery.trim()) {
                  const query = dmSearchQuery.toLowerCase().trim();
                  dmList = dmList.filter((m) => {
                    const u = m.user;
                    if (!u) return false;
                    const name = (u.displayName || "").toLowerCase();
                    const username = (u.username || "").toLowerCase();
                    const email = (u.email || "").toLowerCase();
                    return (
                      name.includes(query) ||
                      username.includes(query) ||
                      email.includes(query)
                    );
                  });
                }

                if (dmList.length === 0 && dmSearchQuery.trim()) {
                  return (
                    <div
                      className="px-3 py-2 text-xs text-center italic"
                      style={{ color: "var(--theme-text-muted)" }}
                    >
                      No users found
                    </div>
                  );
                }

                const pinnedDMs = dmList.filter((m) => m?.user && pinnedUserIds.includes(m.user.id));
                const unpinnedDMs = dmList.filter((m) => m?.user && !pinnedUserIds.includes(m.user.id));
                const sortedDMs = [...pinnedDMs, ...unpinnedDMs];

                return sortedDMs.map((member, idx) => {
                  const user = member.user;
                  if (!user) return null;
                  const userPresence = presence[user.id] || "offline";
                  const inOrbit = isLiveOnline(liveStatus[user.id]);
                  const isSelf = user.id === currentUser?.id;
                  const isPinned = pinnedUserIds.includes(user.id);
                  const showDivider =
                    pinnedDMs.length > 0 &&
                    idx === pinnedDMs.length - 1 &&
                    unpinnedDMs.length > 0;

                  // Find matching DM channel to check selection and unread counts
                  const dmChannel = channels.find(
                    (c) =>
                      c.type === "DIRECT" &&
                      c.members &&
                      (isSelf
                        ? c.members.length === 1 ||
                          c.members.every((m) => m.userId === currentUser?.id)
                        : c.members.some((m) => m.userId === user.id) &&
                          c.members.some((m) => m.userId === currentUser?.id)),
                  );

                  const isSelectedDM =
                    currentChannel?.type === "DIRECT" &&
                    (isSelf
                      ? !currentChannel.members ||
                        currentChannel.members.length <= 1 ||
                        currentChannel.members.every(
                          (m) => m.userId === currentUser?.id,
                        )
                      : currentChannel.members?.some(
                          (m) => m.userId === user.id,
                        ) &&
                        currentChannel.members?.some(
                          (m) => m.userId === currentUser?.id,
                        ));

                  const unread = dmChannel
                    ? unreadCounts[dmChannel.id] || 0
                    : 0;

                  return (
                    <React.Fragment key={member.id}>
                      <div
                        onClick={() => onSelectUserDM(user)}
                        className={rowClass(!!isSelectedDM)}
                        style={rowStyle(!!isSelectedDM)}
                      >
                        {isSelectedDM && <ActiveBar />}
                        <span className="relative ml-2 mr-1 w-6 h-6 shrink-0">
                          <Avatar name={user.displayName || user.username} src={user.avatarUrl} size={24} />
                          {/* Dot = connected to Orbit (web/app) right now; check-in status lives in the pill */}
                          <span
                            title={inOrbit ? "In Orbit right now" : "Not in Orbit"}
                            className={`absolute bottom-0 right-0 w-[7px] h-[7px] rounded-full ${inOrbit ? "bg-emerald-500" : "bg-black"}`}
                            style={{
                              boxShadow: `0 0 0 1.5px ${isSelectedDM ? "var(--theme-selected)" : "var(--theme-bg-sidebar)"}`,
                            }}
                          />
                        </span>
                        <span {...rowLabel(!!isSelectedDM, unread > 0)}>
                          {user.displayName}
                          <StatusEmoji presence={userPresence} breakReason={breakReasons[user.id]} />
                          {user.customStatusEmoji && (
                            <span className="ml-1.5 text-xs inline-block align-middle" title="Status">
                              {user.customStatusEmoji}
                            </span>
                          )}
                          {isSelf && (
                            <span className="ml-1.5 text-[11px] font-normal" style={{ color: "var(--theme-text-muted)" }}>
                              you
                            </span>
                          )}
                        </span>

                        {/* Pin User Action (hidden for self DM) */}
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinUser(workspace.id, user.id);
                            }}
                            title={isPinned ? "Unpin user" : "Pin user to top"}
                            className={`ml-1 shrink-0 p-1 rounded transition ${
                              isPinned
                                ? "text-amber-500 dark:text-amber-400 opacity-100 hover:bg-[var(--theme-fill)]"
                                : "opacity-0 group-hover:opacity-100 hover:bg-[var(--theme-fill)]"
                            }`}
                            style={isPinned ? undefined : { color: "var(--theme-text-muted)" }}
                          >
                            <Pin
                              size={12}
                              className={isPinned ? "fill-amber-500 dark:fill-amber-400 rotate-45" : ""}
                            />
                          </button>
                        )}

                        {unread > 0 && <UnreadBadge count={unread} />}
                      </div>
                      {showDivider && (
                        <div className="my-1 border-b border-black/5 dark:border-white/5 mx-2" />
                      )}
                    </React.Fragment>
                  );
                });
              })()}
            </div>
          </Collapse>
        </div>
        </>
        )}
      </div>

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <CreateChannelModal
          workspaceId={workspace.id}
          members={members}
          currentUserId={currentUser?.id}
          onClose={() => setShowCreateChannel(false)}
          onCreated={(channel) => {
            onChannelCreated(channel);
            setShowCreateChannel(false);
          }}
        />
      )}

      {showNewDm && (
        <NewDirectMessageModal
          members={members}
          presence={presence}
          currentUserId={currentUser?.id}
          onClose={() => setShowNewDm(false)}
          onSelectUser={(u) => {
            setShowNewDm(false);
            onSelectUserDM(u);
          }}
        />
      )}

      {/* Workspace Storage & File Management Modal */}
      {showStorageModal && (
        <WorkspaceStorageModal
          workspace={workspace}
          currentUser={currentUser}
          onClose={() => setShowStorageModal(false)}
          onFileDeleted={(id) => useChatStore.getState().removeAttachment(id)}
        />
      )}

      {/* Add Workspace Member Modal */}
      {showAddMemberModal && (
        <AddWorkspaceMemberDialog
          workspace={workspace}
          currentUser={currentUser}
          onClose={() => setShowAddMemberModal(false)}
          onMemberAdded={onMemberAdded}
        />
      )}

      {/* Theme Customizer Modal */}
      {showThemeModal && (
        <ThemeModal
          isOpen={showThemeModal}
          onClose={() => setShowThemeModal(false)}
          workspace={workspace}
          isAdminOrOwner={isAdminOrOwner}
        />
      )}

      {/* Organization Control Modal */}
      {showOrgControlModal && (
        <OrganizationControlModal
          isOpen={showOrgControlModal}
          onClose={() => setShowOrgControlModal(false)}
          workspace={workspace}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
