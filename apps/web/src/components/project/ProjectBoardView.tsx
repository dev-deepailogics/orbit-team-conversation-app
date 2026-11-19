"use client";

import React, { useState, useEffect, useRef } from "react";

const TICKET_PAGE = 20;
import {
  Project,
  ProjectColumn,
  Ticket,
  TicketPriority,
  WorkspaceMember,
  UserProfile,
  Channel,
  SOCKET_EVENTS,
} from "@orbit/types";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { useProjectStore } from "../../stores/projectStore";
import { TicketModal } from "./TicketModal";
import { TicketDetailModal } from "./TicketDetailModal";
import { ProjectViewSwitcher } from "./ProjectViewSwitcher";
import { ProjectListView } from "./ProjectListView";
import { ProjectSummaryView } from "./ProjectSummaryView";
import { IssueChatModal } from "./IssueChatModal";
import { IssueTimelineModal } from "./IssueTimelineModal";
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  X,
  MessageSquare,
  Columns3,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Bell,
  Eye,
  Board,
  More,
  Loader2,
} from "@/components/ui/icons";
import {
  Avatar,
  FilterMenu,
  LabelChip,
  PRIORITY_META,
  PrimaryPill,
  PriorityPill,
  ToolbarPill,
  columnKinds,
  commentCount,
  formatShortDate,
  isOverdue,
  matchesFilters,
  ticketAssignees,
  ticketKey,
  ticketLabels,
} from "./projectViewUtils";

const DANGER = "#DC2626";

interface ProjectBoardViewProps {
  project: Project;
  currentUser: UserProfile | null;
  members: WorkspaceMember[];
  channels?: Channel[];
  onBackToChat: () => void;
  onDeleteProject?: (projectId: string) => void;
}

const COLUMN_COLORS = [
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#10B981", // Green
  "#8B5CF6", // Purple
  "#06B6D4", // Cyan
  "#EF4444", // Red
  "#64748B", // Slate
];

export const ProjectBoardView: React.FC<ProjectBoardViewProps> = ({
  project: initialProject,
  currentUser,
  members,
  channels = [],
  onBackToChat,
  onDeleteProject,
}) => {
  const {
    currentProject,
    setCurrentProject,
    updateProject,
    setColumns,
    addColumn,
    updateColumn,
    removeColumn,
    addTicket,
    appendTickets,
    updateTicket,
    removeTicket,
    moveTicket,
    activeSection,
    setActiveSection,
    documents,
  } = useProjectStore();

  const project = currentProject || initialProject;

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [filterAssignee, setFilterAssignee] = useState<string>("ALL");
  const [filterLabel, setFilterLabel] = useState<string>("ALL");
  const [showSearch, setShowSearch] = useState(false);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [colMenuId, setColMenuId] = useState<string | null>(null);

  // Ticket paging: columns whose older tickets are fully loaded / loading now
  const [exhaustedCols, setExhaustedCols] = useState<Record<string, boolean>>({});
  const [loadingCols, setLoadingCols] = useState<Record<string, boolean>>({});
  const loadingRef = useRef<Set<string>>(new Set());

  // Modals & Popovers
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [viewingDetailTicket, setViewingDetailTicket] = useState<Ticket | null>(
    null,
  );
  const [targetColumnId, setTargetColumnId] = useState<string | undefined>(
    undefined,
  );
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [chatTicket, setChatTicket] = useState<any | null>(null);
  const [timelineTicket, setTimelineTicket] = useState<any | null>(null);

  // Edit Project Modal State
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDesc, setEditProjectDesc] = useState("");
  const [editProjectStatus, setEditProjectStatus] = useState<
    "active" | "inactive" | "delivered"
  >("active");
  const [editAssignedEmployees, setEditAssignedEmployees] = useState<
    Array<{ name: string; uid?: string }>
  >([]);
  const [editEmployeeDropdownOpen, setEditEmployeeDropdownOpen] =
    useState(false);
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);

  const handleOpenEditProject = () => {
    setEditProjectName(project.name || "");
    setEditProjectDesc(project.description || "");
    setEditProjectStatus((project.status as any) || "active");
    setEditAssignedEmployees(
      Array.isArray(project.assignedEmployees)
        ? (project.assignedEmployees as any)
        : [],
    );
    setEditEmployeeDropdownOpen(false);
    setShowEditProjectModal(true);
  };

  const handleToggleEditEmployee = (empName: string, empUid?: string) => {
    setEditAssignedEmployees((prev) => {
      const exists = prev.some((e) => e.name === empName);
      if (exists) {
        return prev.filter((e) => e.name !== empName);
      }
      return [...prev, { name: empName, uid: empUid || empName }];
    });
  };

  const handleSaveEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProjectName.trim()) return;
    setIsUpdatingProject(true);
    try {
      const res = await api.put(`/api/projects/${project.id}`, {
        name: editProjectName.trim(),
        description: editProjectDesc.trim() || undefined,
        status: editProjectStatus,
        assignedEmployees: editAssignedEmployees,
      });
      updateProject(res.data);
      setCurrentProject(res.data);
      setShowEditProjectModal(false);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update project");
    } finally {
      setIsUpdatingProject(false);
    }
  };

  // Direct Ticket Actions
  const handleToggleWatch = async (ticket: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.post(
        `/api/projects/${project.id}/tickets/${ticket.id}/watch`,
      );
      updateTicket({
        ...ticket,
        watchers: res.data.watchers,
      });
    } catch (err: any) {
      console.error("Failed to toggle watch", err);
    }
  };

  const handleDeleteTicketDirect = async (ticket: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Delete issue "${ticket.title}"?`);
    if (!confirmed) return;
    try {
      await api.delete(`/api/projects/${project.id}/tickets/${ticket.id}`);
      removeTicket(ticket.id);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete ticket");
    }
  };

  // Column creation & editing state
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState("#3B82F6");
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState("");

  // Drag and drop state
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  // Column reordering helper (button click: left/right)
  const handleMoveColumn = async (
    columnId: string,
    direction: "left" | "right",
  ) => {
    const cols = [...(project.columns || [])];
    const index = cols.findIndex((c) => c.id === columnId);
    if (index === -1) return;
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cols.length) return;

    const temp = cols[index];
    cols[index] = cols[targetIndex];
    cols[targetIndex] = temp;

    const updatedCols = cols.map((col, idx) => ({ ...col, orderIndex: idx }));
    setColumns(updatedCols);

    try {
      await api.patch(`/api/projects/${project.id}/columns/reorder`, {
        columnOrders: updatedCols.map((c) => ({
          id: c.id,
          orderIndex: c.orderIndex,
        })),
      });
    } catch (err) {
      console.error("Failed to reorder columns", err);
    }
  };

  // Notification channel update helper
  const handleUpdateNotificationChannel = async (channelId: string) => {
    try {
      const res = await api.put(`/api/projects/${project.id}`, {
        notificationChannelId: channelId || null,
      });
      updateProject(res.data);
    } catch (err: any) {
      alert(
        err.response?.data?.error || "Failed to update notification channel",
      );
    }
  };

  // Load latest project details on mount or project switch
  useEffect(() => {
    let isMounted = true;
    const fetchProjectDetails = async () => {
      try {
        const res = await api.get(`/api/projects/${initialProject.id}`, {
          params: { ticketLimit: TICKET_PAGE },
        });
        if (isMounted) {
          setExhaustedCols({});
          setCurrentProject(res.data);
        }
      } catch (err) {
        console.error("Failed to load project details", err);
      }
    };

    fetchProjectDetails();
    return () => {
      isMounted = false;
    };
  }, [initialProject.id, setCurrentProject]);

  // List and Summary need every ticket, not just the board's first page per column.
  const [loadingAll, setLoadingAll] = useState(false);
  const needsAllTickets = activeSection === "list" || activeSection === "summary";
  const projectLoaded = !!currentProject && currentProject.id === initialProject.id;
  useEffect(() => {
    if (!needsAllTickets || !projectLoaded) return;
    let cancelled = false;
    const loadAll = async () => {
      setLoadingAll(true);
      try {
        const cols = useProjectStore.getState().currentProject?.columns || [];
        await Promise.all(
          cols.map(async (col) => {
            let loaded = col.tickets?.length || 0;
            if (exhaustedCols[col.id] || loaded < TICKET_PAGE) return;
            while (!cancelled) {
              const res = await api.get<Ticket[]>(
                `/api/projects/${initialProject.id}/columns/${col.id}/tickets`,
                { params: { skip: loaded, take: TICKET_PAGE } },
              );
              if (cancelled) return;
              appendTickets(col.id, res.data);
              loaded += res.data.length;
              if (res.data.length < TICKET_PAGE) {
                setExhaustedCols((prev) => ({ ...prev, [col.id]: true }));
                return;
              }
            }
          }),
        );
      } catch (err) {
        console.error("Failed to load all tickets", err);
      } finally {
        if (!cancelled) setLoadingAll(false);
      }
    };
    loadAll();
    return () => {
      cancelled = true;
      setLoadingAll(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAllTickets, projectLoaded, initialProject.id]);

  const hasMoreTickets = (column: ProjectColumn) =>
    !exhaustedCols[column.id] && (column.tickets?.length || 0) >= TICKET_PAGE;

  const loadMoreTickets = async (column: ProjectColumn) => {
    if (!hasMoreTickets(column) || loadingRef.current.has(column.id)) return;
    loadingRef.current.add(column.id);
    setLoadingCols((prev) => ({ ...prev, [column.id]: true }));
    try {
      const res = await api.get<Ticket[]>(
        `/api/projects/${project.id}/columns/${column.id}/tickets`,
        { params: { skip: column.tickets?.length || 0, take: TICKET_PAGE } },
      );
      appendTickets(column.id, res.data);
      if (res.data.length < TICKET_PAGE) {
        setExhaustedCols((prev) => ({ ...prev, [column.id]: true }));
      }
    } catch (err) {
      console.error("Failed to load more tickets", err);
    } finally {
      loadingRef.current.delete(column.id);
      setLoadingCols((prev) => ({ ...prev, [column.id]: false }));
    }
  };

  // Real-time Socket.IO Listeners for Kanban Board
  useEffect(() => {
    const socket = getSocket();

    const onTicketNew = (ticket: Ticket) => {
      if (ticket.projectId === project.id) {
        addTicket(ticket);
      }
    };

    const onTicketUpdate = (ticket: Ticket) => {
      if (ticket.projectId === project.id) {
        updateTicket(ticket);
      }
    };

    const onTicketDelete = (payload: {
      ticketId: string;
      projectId: string;
    }) => {
      if (payload.projectId === project.id) {
        removeTicket(payload.ticketId);
      }
    };

    const onTicketMove = (payload: {
      ticket: Ticket;
      fromColumnId: string;
      toColumnId: string;
      orderIndex: number;
      projectId: string;
    }) => {
      if (payload.projectId === project.id) {
        moveTicket(
          payload.ticket,
          payload.fromColumnId,
          payload.toColumnId,
          payload.orderIndex,
        );
      }
    };

    const onColumnNew = (col: ProjectColumn) => {
      if (col.projectId === project.id) {
        addColumn(col);
      }
    };

    const onColumnUpdate = (col: ProjectColumn) => {
      if (col.projectId === project.id) {
        updateColumn(col);
      }
    };

    const onColumnDelete = (payload: {
      columnId: string;
      projectId: string;
    }) => {
      if (payload.projectId === project.id) {
        removeColumn(payload.columnId);
      }
    };

    const onColumnReorder = (payload: {
      projectId: string;
      columns: ProjectColumn[];
    }) => {
      if (payload.projectId === project.id) {
        setColumns(payload.columns);
      }
    };

    socket.on(SOCKET_EVENTS.TICKET_NEW, onTicketNew);
    socket.on(SOCKET_EVENTS.TICKET_UPDATE, onTicketUpdate);
    socket.on(SOCKET_EVENTS.TICKET_DELETE, onTicketDelete);
    socket.on(SOCKET_EVENTS.TICKET_MOVE, onTicketMove);
    socket.on(SOCKET_EVENTS.COLUMN_NEW, onColumnNew);
    socket.on(SOCKET_EVENTS.COLUMN_UPDATE, onColumnUpdate);
    socket.on(SOCKET_EVENTS.COLUMN_DELETE, onColumnDelete);
    socket.on(SOCKET_EVENTS.COLUMN_REORDER, onColumnReorder);

    return () => {
      socket.off(SOCKET_EVENTS.TICKET_NEW, onTicketNew);
      socket.off(SOCKET_EVENTS.TICKET_UPDATE, onTicketUpdate);
      socket.off(SOCKET_EVENTS.TICKET_DELETE, onTicketDelete);
      socket.off(SOCKET_EVENTS.TICKET_MOVE, onTicketMove);
      socket.off(SOCKET_EVENTS.COLUMN_NEW, onColumnNew);
      socket.off(SOCKET_EVENTS.COLUMN_UPDATE, onColumnUpdate);
      socket.off(SOCKET_EVENTS.COLUMN_DELETE, onColumnDelete);
      socket.off(SOCKET_EVENTS.COLUMN_REORDER, onColumnReorder);
    };
  }, [
    project.id,
    addTicket,
    updateTicket,
    removeTicket,
    moveTicket,
    addColumn,
    updateColumn,
    removeColumn,
    setColumns,
  ]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, ticket: Ticket) => {
    setDraggedTicketId(ticket.id);
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "ticket",
        ticketId: ticket.id,
        fromColumnId: ticket.columnId,
      }),
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColId !== columnId) {
      setDragOverColId(columnId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColId(null);
  };

  const handleDrop = async (e: React.DragEvent, toColumnId: string) => {
    e.preventDefault();
    setDragOverColId(null);
    setDraggedTicketId(null);
    setDraggedColId(null);

    try {
      const dataStr = e.dataTransfer.getData("text/plain");
      if (!dataStr) return;
      const parsed = JSON.parse(dataStr);

      // 1. Column drag & drop reorder
      if (parsed.type === "column") {
        const fromColId = parsed.columnId;
        if (fromColId && fromColId !== toColumnId) {
          const cols = [...(project.columns || [])];
          const fromIdx = cols.findIndex((c) => c.id === fromColId);
          const toIdx = cols.findIndex((c) => c.id === toColumnId);
          if (fromIdx !== -1 && toIdx !== -1) {
            const [movedCol] = cols.splice(fromIdx, 1);
            cols.splice(toIdx, 0, movedCol);
            const updatedCols = cols.map((c, i) => ({ ...c, orderIndex: i }));
            setColumns(updatedCols);
            await api.patch(`/api/projects/${project.id}/columns/reorder`, {
              columnOrders: updatedCols.map((c) => ({
                id: c.id,
                orderIndex: c.orderIndex,
              })),
            });
          }
        }
        return;
      }

      // 2. Ticket move
      const { ticketId, fromColumnId } = parsed;
      if (!ticketId || !fromColumnId) return;

      const columns = project.columns || [];
      const targetColumn = columns.find((c) => c.id === toColumnId);
      if (!targetColumn) return;

      const sourceCol = columns.find((c) => c.id === fromColumnId);
      const ticketToMove = sourceCol?.tickets?.find((t) => t.id === ticketId);
      if (!ticketToMove) return;

      // Drop on top: loaded tickets are newest first, so the max is in the first page
      const newOrderIndex =
        Math.max(
          -1,
          ...(targetColumn.tickets || [])
            .filter((t) => t.id !== ticketId)
            .map((t) => t.orderIndex),
        ) + 1;

      // Optimistic update in Zustand store
      moveTicket(ticketToMove, fromColumnId, toColumnId, newOrderIndex);

      // Persist to backend API (triggers Orbit Bot notifications & socket broadcasts)
      await api.patch(`/api/projects/${project.id}/tickets/${ticketId}/move`, {
        columnId: toColumnId,
        orderIndex: newOrderIndex,
      });
    } catch (err) {
      console.error("Failed to move ticket", err);
    }
  };

  // Create Column handler
  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;

    try {
      const res = await api.post(`/api/projects/${project.id}/columns`, {
        name: newColumnName.trim(),
        color: newColumnColor,
      });
      addColumn(res.data);
      setNewColumnName("");
      setShowAddColumn(false);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create column");
    }
  };

  // Update Column handler
  const handleUpdateColumnName = async (columnId: string) => {
    if (!editingColName.trim()) {
      setEditingColId(null);
      return;
    }
    try {
      const res = await api.put(
        `/api/projects/${project.id}/columns/${columnId}`,
        {
          name: editingColName.trim(),
        },
      );
      updateColumn(res.data);
    } catch (err: any) {
      console.error("Failed to update column", err);
    } finally {
      setEditingColId(null);
    }
  };

  // Delete Column handler
  const handleDeleteColumn = async (columnId: string, colName: string) => {
    if (!confirm(`Delete column "${colName}" and all tickets inside it?`))
      return;
    try {
      await api.delete(`/api/projects/${project.id}/columns/${columnId}`);
      removeColumn(columnId);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete column");
    }
  };

  // Delete Project handler
  const handleDeleteProject = async () => {
    if (
      !confirm(
        `Are you sure you want to delete project board "${project.name}"?`,
      )
    )
      return;
    try {
      await api.delete(`/api/projects/${project.id}`);
      onDeleteProject?.(project.id);
      onBackToChat();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete project");
    }
  };

  const filterTicket = (t: Ticket): boolean =>
    matchesFilters(
      t,
      { query: searchQuery, assignee: filterAssignee, priority: filterPriority, label: filterLabel },
      members,
      currentUser?.id,
    );

  const columns = project.columns || [];
  const totalTickets =
    project._count?.tickets ??
    columns.reduce((acc, c) => acc + (c.tickets?.length || 0), 0);

  const kinds = columnKinds(columns);
  const filtersActive =
    !!searchQuery.trim() || filterPriority !== "ALL" || filterAssignee !== "ALL" || filterLabel !== "ALL";
  const clearFilters = () => {
    setSearchQuery("");
    setFilterPriority("ALL");
    setFilterAssignee("ALL");
    setFilterLabel("ALL");
    setShowSearch(false);
  };
  const allLabels = Array.from(
    new Set(columns.flatMap((c) => (c.tickets || []).flatMap((t) => ticketLabels(t).map((l) => l.name)))),
  ).sort();
  const projectTeam = (() => {
    const seen = new Map<string, UserProfile>();
    columns.forEach((c) => c.tickets?.forEach((t) => ticketAssignees(t, members).forEach((u) => seen.set(u.id, u))));
    return Array.from(seen.values());
  })();
  const loadedTickets = columns.reduce((acc, c) => acc + (c.tickets?.length || 0), 0);
  const boardIsEmpty = projectLoaded && loadedTickets === 0 && !columns.some(hasMoreTickets);
  const openCreateTicket = (columnId?: string) => {
    setEditingTicket(null);
    setTargetColumnId(columnId ?? columns[0]?.id);
    setShowTicketModal(true);
  };
  const VIEW_SUBTITLE: Record<string, string> = {
    board: "Project board. Drag tickets between columns to update their status.",
    list: "Project list. Sort and review every ticket in one table.",
    summary: "Project summary. Track progress, workload and recent activity.",
  };

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden select-none"
      style={{
        backgroundColor: "var(--theme-bg-surface)",
        color: "var(--theme-text)",
      }}
    >
      {/* Header: project row + view row */}
      <header
        className="shrink-0 border-b"
        style={{ backgroundColor: "var(--theme-bg-app)", borderColor: "var(--theme-border)" }}
      >
        <div className="h-16 px-3 sm:px-6 flex items-center gap-4">
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <button
              onClick={onBackToChat}
              title="Back to Channel Chat"
              className="w-8 h-8 -ml-1 rounded-lg flex items-center justify-center shrink-0 transition hover:bg-[var(--theme-fill-hover)]"
              style={{ color: "var(--theme-text-muted)" }}
            >
              <ChevronLeft size={18} />
            </button>
            <span
              className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--theme-selected)", color: "var(--theme-primary-hover)" }}
            >
              {project.icon ? <span className="text-lg leading-none">{project.icon}</span> : <Board size={20} />}
            </span>
            <div className="min-w-0 flex flex-col">
              <h1 className="text-[17px] font-bold leading-[22px] truncate" title={project.name}>
                {project.name}
              </h1>
              <p
                className="text-[13px] leading-[18px] truncate hidden sm:block"
                style={{ color: "var(--theme-text-muted)" }}
              >
                {project.description || VIEW_SUBTITLE[activeSection] || VIEW_SUBTITLE.board}
              </p>
            </div>
            {projectTeam.length > 0 && (
              <div className="hidden md:flex items-center px-1.5 py-1 shrink-0">
                {projectTeam.slice(0, 4).map((u, i) => (
                  <Avatar
                    key={u.id}
                    name={u.displayName}
                    src={u.avatarUrl}
                    size={28}
                    ring="var(--theme-bg-app)"
                    className={i ? "-ml-[5px]" : ""}
                  />
                ))}
                {projectTeam.length > 4 && (
                  <span
                    className="-ml-[5px] w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                    style={{
                      backgroundColor: "var(--theme-bg-surface-hover)",
                      color: "var(--theme-text)",
                      boxShadow: "0 0 0 2px var(--theme-bg-app)",
                    }}
                  >
                    +{projectTeam.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Project options */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowProjectMenu(!showProjectMenu)}
              title="Project options"
              className="w-10 h-10 rounded-xl flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
              style={{ color: "var(--theme-text-muted)" }}
            >
              <More size={20} />
            </button>
            {showProjectMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProjectMenu(false)} />
                <div
                  className="absolute right-0 top-full mt-1.5 w-64 rounded-[14px] border p-2 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
                  style={{
                    backgroundColor: "var(--theme-bg-app)",
                    borderColor: "var(--theme-border)",
                    boxShadow: "0 12px 16px rgba(20, 26, 46, 0.2)",
                  }}
                >
                  <p
                    className="px-2.5 py-1.5 text-[11px] font-bold tracking-[0.6px]"
                    style={{ color: "var(--theme-text-muted)" }}
                  >
                    PROJECT
                  </p>
                  <MenuRow
                    Icon={Edit2}
                    label="Edit project"
                    onClick={() => {
                      setShowProjectMenu(false);
                      handleOpenEditProject();
                    }}
                  />
                  <MenuRow
                    Icon={Columns3}
                    label="Add column"
                    onClick={() => {
                      setShowProjectMenu(false);
                      setActiveSection("board" as any);
                      setShowAddColumn(true);
                    }}
                  />
                  <label
                    className="h-10 px-2.5 flex items-center gap-2.5 rounded-[10px] text-sm"
                    title="Channel where Orbit Bot broadcasts board activities"
                  >
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "var(--theme-bg-surface-hover)", color: "var(--theme-text-muted)" }}
                    >
                      <Bell size={16} />
                    </span>
                    <span className="font-medium shrink-0">Notify</span>
                    <select
                      value={project.notificationChannelId || ""}
                      onChange={(e) => handleUpdateNotificationChannel(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent text-[13px] font-semibold focus:outline-none cursor-pointer truncate text-right"
                      style={{ color: "var(--theme-primary-hover)" }}
                    >
                      {channels.length > 0 ? (
                        channels.map((ch) => (
                          <option key={ch.id} value={ch.id}>
                            #{ch.name}
                          </option>
                        ))
                      ) : (
                        <option value="">#general</option>
                      )}
                    </select>
                  </label>
                  <div className="py-1">
                    <div className="h-px" style={{ backgroundColor: "var(--theme-border)" }} />
                  </div>
                  <MenuRow
                    Icon={Trash2}
                    label="Delete project"
                    danger
                    onClick={() => {
                      setShowProjectMenu(false);
                      handleDeleteProject();
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="h-12 px-3 sm:px-6 flex items-center justify-between gap-3">
          <ProjectViewSwitcher
            activeSection={activeSection}
            onSectionChange={(sec) => setActiveSection(sec as any)}
          />
          <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
            {loadingAll && (
              <span
                className="flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0"
                style={{ color: "var(--theme-text-muted)" }}
              >
                <Loader2 size={12} className="animate-spin" />
                Loading all tickets…
              </span>
            )}
            {activeSection === "summary" ? (
              <FilterMenu
                plain
                label="Range"
                icon={<Calendar size={14} style={{ color: "var(--theme-text-muted)" }} />}
                value={String(rangeDays)}
                options={[7, 30, 90].map((d) => ({ value: String(d), label: `Last ${d} days` }))}
                onChange={(v) => setRangeDays(Number(v) as 7 | 30 | 90)}
              />
            ) : (
              <>
                {showSearch && (
                  <div
                    className="h-8 w-52 px-3 rounded-2xl border flex items-center gap-2 shrink-0"
                    style={{ borderColor: "var(--theme-border)", backgroundColor: "var(--theme-bg-app)" }}
                  >
                    <Search size={14} style={{ color: "var(--theme-text-muted)" }} />
                    <input
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search tickets"
                      className="flex-1 min-w-0 bg-transparent outline-none text-[13px]"
                      style={{ color: "var(--theme-text)" }}
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} title="Clear" style={{ color: "var(--theme-text-muted)" }}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}
                <ToolbarPill
                  active={filtersActive}
                  title={filtersActive ? "Clear all filters" : "Search tickets"}
                  onClick={() => (filtersActive ? clearFilters() : setShowSearch((v) => !v))}
                >
                  <Filter size={14} />
                  Filters
                  {filtersActive && <X size={12} />}
                </ToolbarPill>
                <FilterMenu
                  label="Assignee"
                  value={filterAssignee}
                  onChange={setFilterAssignee}
                  options={[
                    { value: "ALL", label: "Anyone" },
                    { value: "ME", label: "Assigned to me" },
                    { value: "UNASSIGNED", label: "Unassigned" },
                    ...members.filter((m) => m.user).map((m) => ({ value: m.userId, label: m.user!.displayName })),
                  ]}
                />
                <FilterMenu
                  label="Priority"
                  value={filterPriority}
                  onChange={setFilterPriority}
                  options={[
                    { value: "ALL", label: "Any priority" },
                    ...(Object.keys(PRIORITY_META) as TicketPriority[]).map((p) => ({
                      value: p,
                      label: PRIORITY_META[p].label,
                    })),
                  ]}
                />
                <FilterMenu
                  label="Label"
                  value={filterLabel}
                  onChange={setFilterLabel}
                  options={[{ value: "ALL", label: "Any label" }, ...allLabels.map((l) => ({ value: l, label: l }))]}
                />
              </>
            )}
            <PrimaryPill onClick={() => openCreateTicket()} disabled={columns.length === 0}>
              <Plus size={14} />
              Create ticket
            </PrimaryPill>
          </div>
        </div>
      </header>

      {activeSection === "board" ? (
        !projectLoaded ? (
          <BoardSkeleton />
        ) : boardIsEmpty ? (
          <EmptyBoard
            projectName={project.name}
            hasColumns={columns.length > 0}
            onCreateTicket={() => openCreateTicket()}
            onAddColumn={() => setShowAddColumn(true)}
            addColumnForm={
              showAddColumn ? (
                <AddColumnForm
                  name={newColumnName}
                  color={newColumnColor}
                  onName={setNewColumnName}
                  onColor={setNewColumnColor}
                  onCancel={() => setShowAddColumn(false)}
                  onSubmit={handleCreateColumn}
                />
              ) : null
            }
          />
        ) : (
          <div className="flex-1 min-h-0 overflow-x-auto px-3 sm:px-6 py-4 flex items-stretch gap-4">
            {columns.map((column, colIndex) => {
              const colTickets = (column.tickets || []).filter(filterTicket);
              const isDragTarget = dragOverColId === column.id;
              const isTicketDropTarget =
                isDragTarget &&
                !!draggedTicketId &&
                !colTickets.some((t) => t.id === draggedTicketId);
              const done = kinds[column.id] === "done";

              return (
                <div
                  key={column.id}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.id)}
                  className={`flex-1 min-w-[272px] max-w-[420px] rounded-[14px] p-2 flex flex-col gap-2 min-h-0 transition-colors ${
                    draggedColId === column.id ? "opacity-50" : ""
                  }`}
                  style={{
                    backgroundColor: isDragTarget ? "var(--theme-bg-surface)" : "var(--theme-selected)",
                    outline: isDragTarget ? "2px dashed var(--theme-primary)" : undefined,
                    outlineOffset: -2,
                  }}
                >
                  {/* Column header (drag to reorder) */}
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      setDraggedColId(column.id);
                      e.dataTransfer.setData("text/plain", JSON.stringify({ type: "column", columnId: column.id }));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDraggedColId(null)}
                    className="h-8 px-2 flex items-center justify-between gap-2 shrink-0 cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {editingColId === column.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingColName}
                          onChange={(e) => setEditingColName(e.target.value)}
                          onBlur={() => handleUpdateColumnName(column.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdateColumnName(column.id);
                            if (e.key === "Escape") setEditingColId(null);
                          }}
                          className="h-7 min-w-0 rounded-md border px-2 text-[13px] font-bold outline-none"
                          style={{
                            backgroundColor: "var(--theme-bg-app)",
                            borderColor: "var(--theme-primary)",
                            color: "var(--theme-text)",
                          }}
                        />
                      ) : (
                        <h3
                          onDoubleClick={() => {
                            setEditingColId(column.id);
                            setEditingColName(column.name);
                          }}
                          title="Double-click to rename"
                          className="text-[13px] font-bold truncate"
                        >
                          {column.name}
                        </h3>
                      )}
                      <span
                        className="h-5 min-w-5 px-[7px] rounded-[10px] flex items-center justify-center text-xs font-semibold shrink-0"
                        style={{ backgroundColor: "var(--theme-border)", color: "var(--theme-text-muted)" }}
                      >
                        {colTickets.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreateTicket(column.id);
                        }}
                        title="Add ticket to this column"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:bg-[var(--theme-fill)]"
                        style={{ color: "var(--theme-text-muted)" }}
                      >
                        <Plus size={16} />
                      </button>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setColMenuId(colMenuId === column.id ? null : column.id);
                          }}
                          title="Column options"
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:bg-[var(--theme-fill)]"
                          style={{ color: "var(--theme-text-muted)" }}
                        >
                          <More size={16} />
                        </button>
                        {colMenuId === column.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setColMenuId(null)} />
                            <div
                              className="absolute right-0 top-full mt-1 w-48 rounded-xl border p-1.5 z-50 flex flex-col gap-0.5 shadow-xl"
                              style={{ backgroundColor: "var(--theme-bg-app)", borderColor: "var(--theme-border)" }}
                            >
                              <MenuRow
                                compact
                                Icon={Edit2}
                                label="Rename"
                                onClick={() => {
                                  setColMenuId(null);
                                  setEditingColId(column.id);
                                  setEditingColName(column.name);
                                }}
                              />
                              <MenuRow
                                compact
                                Icon={ChevronLeft}
                                label="Move left"
                                disabled={colIndex === 0}
                                onClick={() => {
                                  setColMenuId(null);
                                  handleMoveColumn(column.id, "left");
                                }}
                              />
                              <MenuRow
                                compact
                                Icon={ChevronRight}
                                label="Move right"
                                disabled={colIndex === columns.length - 1}
                                onClick={() => {
                                  setColMenuId(null);
                                  handleMoveColumn(column.id, "right");
                                }}
                              />
                              <MenuRow
                                compact
                                danger
                                Icon={Trash2}
                                label="Delete column"
                                onClick={() => {
                                  setColMenuId(null);
                                  handleDeleteColumn(column.id, column.name);
                                }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tickets */}
                  <div
                    className="flex-1 min-h-[120px] overflow-y-auto flex flex-col gap-2"
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) loadMoreTickets(column);
                    }}
                  >
                    {colTickets.map((ticket) => {
                      const overdue = isOverdue(ticket, done);
                      const people = ticketAssignees(ticket, members);
                      const labels = ticketLabels(ticket);
                      const comments = commentCount(ticket);
                      return (
                        <div
                          key={ticket.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, ticket)}
                          onDragEnd={() => {
                            setDraggedTicketId(null);
                            setDragOverColId(null);
                          }}
                          onClick={() => {
                            setEditingTicket(ticket);
                            setTargetColumnId(column.id);
                            setShowTicketModal(true);
                          }}
                          className={`group relative shrink-0 rounded-xl border p-3 flex flex-col gap-2.5 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${
                            draggedTicketId === ticket.id ? "opacity-40" : ""
                          }`}
                          style={{
                            backgroundColor: "var(--theme-bg-app)",
                            borderColor: "var(--theme-border)",
                            boxShadow: "0 1px 1px rgba(20, 26, 46, 0.05)",
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs font-medium truncate" style={{ color: "var(--theme-text-muted)" }}>
                                {ticketKey(ticket)}
                              </span>
                            </span>
                            <PriorityPill priority={ticket.priority} size="sm" />
                          </div>

                          {/* Quick actions (hover) */}
                          <div
                            className="absolute top-2 right-2 hidden group-hover:flex items-center gap-0.5 rounded-lg border p-0.5"
                            style={{
                              backgroundColor: "var(--theme-bg-app)",
                              borderColor: "var(--theme-border)",
                              boxShadow: "0 1px 3px rgba(20, 26, 46, 0.14)",
                            }}
                          >
                            {[
                              { title: "View ticket details", Icon: Eye, run: () => setViewingDetailTicket(ticket) },
                              { title: "Issue chat & notes", Icon: MessageSquare, run: () => setChatTicket(ticket) },
                              { title: "Issue timeline", Icon: Clock, run: () => setTimelineTicket(ticket) },
                            ].map(({ title, Icon, run }) => (
                              <button
                                key={title}
                                type="button"
                                title={title}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  run();
                                }}
                                className="w-6 h-6 rounded-md flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
                                style={{ color: "var(--theme-text-muted)" }}
                              >
                                <Icon size={14} />
                              </button>
                            ))}
                            <button
                              type="button"
                              title="Delete ticket"
                              onClick={(e) => handleDeleteTicketDirect(ticket, e)}
                              className="w-6 h-6 rounded-md flex items-center justify-center transition hover:bg-[var(--theme-fill-hover)]"
                              style={{ color: DANGER }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <p
                            className="text-sm font-semibold leading-5 break-words"
                            style={{ color: done ? "var(--theme-text-muted)" : "var(--theme-text)" }}
                          >
                            {ticket.title}
                          </p>

                          {labels.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {labels.map((l) => (
                                <LabelChip key={l.name} name={l.name} color={l.color} />
                              ))}
                            </div>
                          )}

                          {(ticket.dueDate || comments > 0 || people.length > 0) && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-3 min-w-0">
                                {ticket.dueDate && (
                                  <span
                                    className={`flex items-center gap-1 text-xs ${overdue ? "font-semibold" : "font-medium"}`}
                                    style={{ color: overdue ? DANGER : "var(--theme-text-muted)" }}
                                  >
                                    <Calendar size={13} />
                                    {formatShortDate(ticket.dueDate)}
                                  </span>
                                )}
                                {comments > 0 && (
                                  <button
                                    type="button"
                                    title="Open discussion"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setChatTicket(ticket);
                                    }}
                                    className="flex items-center gap-1 text-xs font-medium hover:opacity-80"
                                    style={{ color: "var(--theme-text-muted)" }}
                                  >
                                    <MessageSquare size={13} />
                                    {comments}
                                  </button>
                                )}
                              </span>
                              {people.length > 0 && (
                                <span className="flex items-center shrink-0" title={people.map((p) => p.displayName).join(", ")}>
                                  {people.slice(0, 2).map((u, i) => (
                                    <Avatar
                                      key={u.id}
                                      name={u.displayName}
                                      src={u.avatarUrl}
                                      size={24}
                                      ring={i ? "var(--theme-bg-app)" : undefined}
                                      className={i ? "-ml-1.5" : ""}
                                    />
                                  ))}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {isTicketDropTarget && (
                      <div
                        className="h-[72px] shrink-0 rounded-xl flex items-center justify-center text-[13px] font-semibold"
                        style={{
                          backgroundColor: "var(--theme-bg-surface)",
                          border: "1.5px dashed var(--theme-primary)",
                          color: "var(--theme-primary-hover)",
                        }}
                      >
                        Drop ticket here
                      </div>
                    )}

                    {hasMoreTickets(column) && (
                      <button
                        onClick={() => loadMoreTickets(column)}
                        disabled={loadingCols[column.id]}
                        className="w-full h-8 shrink-0 rounded-lg text-xs font-medium transition hover:bg-[var(--theme-fill-hover)] disabled:opacity-60"
                        style={{ color: "var(--theme-text-muted)" }}
                      >
                        {loadingCols[column.id] ? "Loading…" : "Load older tickets"}
                      </button>
                    )}

                    {colTickets.length === 0 && !hasMoreTickets(column) && !isTicketDropTarget && (
                      <div
                        className="h-[72px] shrink-0 rounded-xl border border-dashed flex items-center justify-center text-xs"
                        style={{ borderColor: "var(--theme-border)", color: "var(--theme-text-muted)" }}
                      >
                        {filtersActive ? "No matching tickets" : "No tickets"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add column */}
            {showAddColumn ? (
              <AddColumnForm
                name={newColumnName}
                color={newColumnColor}
                onName={setNewColumnName}
                onColor={setNewColumnColor}
                onCancel={() => setShowAddColumn(false)}
                onSubmit={handleCreateColumn}
              />
            ) : (
              <button
                onClick={() => setShowAddColumn(true)}
                className="w-[272px] shrink-0 h-12 rounded-[14px] border-2 border-dashed flex items-center justify-center gap-2 text-[13px] font-semibold transition hover:bg-[var(--theme-fill-hover)]"
                style={{ borderColor: "var(--theme-border)", color: "var(--theme-text-muted)" }}
              >
                <Plus size={16} />
                Add column
              </button>
            )}
          </div>
        )
      ) : activeSection === "list" ? (
        <ProjectListView
          project={project}
          members={members}
          loadingAll={loadingAll}
          filterTicket={filterTicket}
          onOpenTicket={setViewingDetailTicket}
        />
      ) : activeSection === "summary" ? (
        <ProjectSummaryView
          project={project}
          members={members}
          currentUser={currentUser}
          rangeDays={rangeDays}
          onOpenTicket={setViewingDetailTicket}
        />
      ) : null}

      {/* Ticket Create / Edit Modal */}
      {showTicketModal && (
        <TicketModal
          projectId={project.id}
          columns={columns}
          defaultColumnId={targetColumnId}
          ticket={editingTicket}
          members={members}
          onClose={() => {
            setShowTicketModal(false);
            setEditingTicket(null);
          }}
          onTicketCreated={(created) => addTicket(created)}
          onTicketUpdated={(updated) => updateTicket(updated)}
          onTicketDeleted={(id) => removeTicket(id)}
        />
      )}

      {/* Issue Chat Modal (Matching Image 3) */}
      {chatTicket && (
        <IssueChatModal
          projectId={project.id}
          ticket={chatTicket}
          currentUser={currentUser}
          onClose={() => setChatTicket(null)}
        />
      )}

      {/* Issue Timeline Modal (Matching Image 4) */}
      {timelineTicket && (
        <IssueTimelineModal
          ticket={timelineTicket}
          members={members}
          columns={columns}
          onClose={() => setTimelineTicket(null)}
        />
      )}

      {/* Ticket Detail Modal (Matching Image 2 - Eye Button) */}
      {viewingDetailTicket && (
        <TicketDetailModal
          projectId={project.id}
          ticket={viewingDetailTicket}
          columns={columns}
          members={members}
          onClose={() => setViewingDetailTicket(null)}
          onEditTicket={(t) => {
            setEditingTicket(t);
            setTargetColumnId(t.columnId);
            setShowTicketModal(true);
          }}
          onTicketUpdated={(updated) => {
            updateTicket(updated);
            setViewingDetailTicket(updated);
          }}
        />
      )}

      {/* Edit Project Modal */}
      {showEditProjectModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
            style={{
              backgroundColor: "var(--theme-bg-surface, #1e293b)",
              borderColor: "var(--theme-border, #334155)",
              color: "var(--theme-text-primary)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between pb-3 border-b"
              style={{ borderColor: "var(--theme-border)" }}
            >
              <div className="flex items-center gap-2">
                <Edit2 size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-[var(--theme-text)]">Edit Project</h3>
              </div>
              <button
                onClick={() => setShowEditProjectModal(false)}
                className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleSaveEditProject}
              className="space-y-4 text-xs"
            >
              {/* Field 1: Project Title */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-[var(--theme-text)]">
                  <span className="text-rose-500 mr-1">*</span>Project Title
                </label>
                <input
                  type="text"
                  required
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  placeholder="Project name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--theme-bg-app)] border border-[var(--theme-border)] text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-blue-500 transition text-xs"
                />
              </div>

              {/* Field 2: Project Details */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-[var(--theme-text)]">
                  Project Details
                </label>
                <textarea
                  rows={4}
                  value={editProjectDesc}
                  onChange={(e) => setEditProjectDesc(e.target.value)}
                  placeholder="Project description and notes..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--theme-bg-app)] border border-[var(--theme-border)] text-[var(--theme-text)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-blue-500 transition resize-none text-xs"
                />
              </div>

              {/* Field 3: Status */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-[var(--theme-text)]">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={editProjectStatus}
                    onChange={(e: any) => setEditProjectStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--theme-bg-app)] border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none focus:border-blue-500 transition appearance-none cursor-pointer text-xs pr-9"
                  >
                    <option value="active" className="bg-[var(--theme-bg-app)] text-[var(--theme-text)]">
                      Active
                    </option>
                    <option
                      value="inactive"
                      className="bg-[var(--theme-bg-app)] text-[var(--theme-text)]"
                    >
                      Inactive
                    </option>
                    <option
                      value="delivered"
                      className="bg-[var(--theme-bg-app)] text-[var(--theme-text)]"
                    >
                      Delivered
                    </option>
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)] pointer-events-none"
                  />
                </div>
              </div>

              {/* Field 4: Assign Employees */}
              <div className="relative">
                <label className="block text-xs font-semibold mb-1.5 text-[var(--theme-text)]">
                  Assign Employees
                </label>
                <div
                  onClick={() => setEditEmployeeDropdownOpen((prev) => !prev)}
                  className="min-h-[46px] w-full px-2.5 py-2 rounded-xl bg-[var(--theme-bg-app)] border border-[var(--theme-border)] flex flex-wrap items-center gap-1.5 cursor-pointer hover:border-[var(--theme-border)] transition pr-8 relative"
                >
                  {editAssignedEmployees.length === 0 ? (
                    <span className="text-[var(--theme-text-muted)] text-xs px-1 select-none">
                      Select employees to assign...
                    </span>
                  ) : (
                    editAssignedEmployees.map((emp) => (
                      <span
                        key={emp.name}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--theme-bg-surface)] text-[var(--theme-text)] border border-[var(--theme-border)] shadow-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {emp.name}
                        <button
                          type="button"
                          onClick={() =>
                            setEditAssignedEmployees((prev) =>
                              prev.filter((e) => e.name !== emp.name),
                            )
                          }
                          className="text-[var(--theme-text-muted)] hover:text-rose-400 transition ml-0.5"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]"
                  />
                </div>

                {editEmployeeDropdownOpen && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border p-2 shadow-2xl max-h-52 overflow-y-auto space-y-1 animate-in fade-in zoom-in-95"
                    style={{
                      backgroundColor: "var(--theme-bg-surface, #1e293b)",
                      borderColor: "var(--theme-border, #334155)",
                    }}
                  >
                    {members && members.length > 0 ? (
                      members.map((member: any) => {
                        const mName =
                          member.user?.displayName ||
                          member.user?.name ||
                          member.displayName ||
                          member.name ||
                          "Member";
                        const mUid =
                          member.userId || member.user?.id || member.id;
                        const isAssigned = editAssignedEmployees.some(
                          (e) => e.name === mName,
                        );
                        return (
                          <div
                            key={mUid || mName}
                            onClick={() =>
                              handleToggleEditEmployee(mName, mUid)
                            }
                            className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer text-xs transition ${
                              isAssigned
                                ? "bg-blue-600/20 text-blue-700 dark:text-blue-300 font-semibold"
                                : "hover:bg-[var(--theme-bg-surface-hover)] text-[var(--theme-text)]"
                            }`}
                          >
                            <span>{mName}</span>
                            {isAssigned && (
                              <Check size={14} className="text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-xs text-[var(--theme-text-muted)] text-center">
                        No team members found in workspace
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons: Cancel and Save */}
              <div
                className="flex items-center justify-end gap-3 pt-3 border-t"
                style={{ borderColor: "var(--theme-border)" }}
              >
                <button
                  type="button"
                  onClick={() => setShowEditProjectModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--theme-border)] bg-transparent text-[var(--theme-text)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg-surface-hover)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProject}
                  className="px-6 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-98 shadow-sm transition disabled:opacity-50"
                >
                  {isUpdatingProject ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const MenuRow: React.FC<{
  Icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  compact?: boolean;
}> = ({ Icon, label, onClick, danger, disabled, compact }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center gap-2.5 text-left font-medium transition hover:bg-[var(--theme-fill-hover)] disabled:opacity-40 disabled:pointer-events-none ${
      compact ? "h-8 px-2 rounded-lg text-[13px]" : "h-10 px-2.5 rounded-[10px] text-sm"
    }`}
    style={{ color: danger ? DANGER : "var(--theme-text)" }}
  >
    {compact ? (
      <Icon size={14} style={{ color: danger ? DANGER : "var(--theme-text-muted)" }} />
    ) : (
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{
          backgroundColor: "var(--theme-bg-surface-hover)",
          color: danger ? DANGER : "var(--theme-text-muted)",
        }}
      >
        <Icon size={16} />
      </span>
    )}
    <span className="truncate">{label}</span>
  </button>
);

const SkeletonBar: React.FC<{ className: string }> = ({ className }) => (
  <span className={`block ${className}`} style={{ backgroundColor: "var(--theme-border)" }} />
);

const BoardSkeleton: React.FC = () => (
  <div className="flex-1 min-h-0 overflow-hidden px-3 sm:px-6 py-4 flex items-start gap-4 animate-pulse">
    {[0, 1, 2, 3].map((col) => (
      <div
        key={col}
        className="flex-1 min-w-[272px] max-w-[420px] rounded-xl p-2 flex flex-col gap-2"
        style={{ backgroundColor: "var(--theme-selected)" }}
      >
        <SkeletonBar className="h-3.5 w-20 rounded" />
        {[0, 1, 2].map((card) => (
          <div
            key={card}
            className="rounded-xl border p-3 flex flex-col gap-2"
            style={{ backgroundColor: "var(--theme-bg-app)", borderColor: "var(--theme-border)" }}
          >
            <SkeletonBar className="h-3 w-full rounded-md" />
            <SkeletonBar className="h-3 w-[70px] rounded-md" />
            <div className="flex items-center gap-2">
              <SkeletonBar className="h-2.5 w-10 rounded-md" />
              <span className="flex-1" />
              <SkeletonBar className="w-5 h-5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

const EmptyBoard: React.FC<{
  projectName: string;
  hasColumns: boolean;
  onCreateTicket: () => void;
  onAddColumn: () => void;
  addColumnForm: React.ReactNode;
}> = ({ projectName, hasColumns, onCreateTicket, onAddColumn, addColumnForm }) => (
  <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center p-4">
    {addColumnForm ?? (
      <div className="flex flex-col items-center justify-center gap-3 p-8">
        <span
          className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--theme-bg-app)", color: "var(--theme-text-muted)" }}
        >
          <Board size={32} />
        </span>
        <p className="text-[17px] font-bold" style={{ color: "var(--theme-text)" }}>
          No tickets yet
        </p>
        <p className="w-[360px] max-w-full text-sm leading-[21px] text-center" style={{ color: "var(--theme-text-muted)" }}>
          {hasColumns
            ? `Create the first ticket for ${projectName}.`
            : `Add a column to ${projectName} to start tracking tickets.`}
        </p>
        <div className="flex items-center gap-2 pt-1">
          {hasColumns ? (
            <button
              type="button"
              onClick={onCreateTicket}
              className="h-9 px-4 rounded-[18px] flex items-center gap-1.5 text-[13px] font-semibold transition hover:bg-[var(--theme-primary-hover)]"
              style={{ backgroundColor: "var(--theme-primary)", color: "var(--theme-primary-text)" }}
            >
              <Plus size={15} />
              Create ticket
            </button>
          ) : null}
          <button
            type="button"
            onClick={onAddColumn}
            className="h-9 px-3.5 rounded-[18px] border flex items-center gap-1.5 text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
            style={{
              backgroundColor: hasColumns ? "var(--theme-bg-app)" : "var(--theme-primary)",
              borderColor: hasColumns ? "var(--theme-border)" : "transparent",
              color: hasColumns ? "var(--theme-text)" : "var(--theme-primary-text)",
            }}
          >
            <Columns3 size={15} />
            Add column
          </button>
        </div>
      </div>
    )}
  </div>
);

const AddColumnForm: React.FC<{
  name: string;
  color: string;
  onName: (v: string) => void;
  onColor: (v: string) => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}> = ({ name, color, onName, onColor, onCancel, onSubmit }) => (
  <form
    onSubmit={onSubmit}
    className="w-[272px] shrink-0 self-start rounded-[14px] border p-3 flex flex-col gap-3"
    style={{
      backgroundColor: "var(--theme-bg-app)",
      borderColor: "var(--theme-primary)",
      boxShadow: "0 1px 4px rgba(20, 26, 46, 0.16)",
    }}
  >
    <p className="text-[13px] font-bold" style={{ color: "var(--theme-text)" }}>
      New column
    </p>
    <input
      type="text"
      autoFocus
      required
      placeholder="Column name (e.g. QA, Review)"
      value={name}
      onChange={(e) => onName(e.target.value)}
      className="h-9 w-full rounded-[10px] border px-3 text-[13px] outline-none focus:border-[var(--theme-primary)]"
      style={{
        backgroundColor: "var(--theme-bg-app)",
        borderColor: "var(--theme-border)",
        color: "var(--theme-text)",
      }}
    />
    <div className="flex items-center gap-1.5">
      {COLUMN_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onColor(c)}
          className="w-5 h-5 rounded-full transition hover:scale-110"
          style={{
            backgroundColor: c,
            boxShadow: color === c ? `0 0 0 2px var(--theme-bg-app), 0 0 0 4px ${c}` : undefined,
          }}
        />
      ))}
    </div>
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="h-8 px-3 rounded-2xl text-[13px] font-medium transition hover:bg-[var(--theme-fill-hover)]"
        style={{ color: "var(--theme-text-muted)" }}
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={!name.trim()}
        className="h-8 px-3.5 rounded-2xl text-[13px] font-semibold transition hover:bg-[var(--theme-primary-hover)] disabled:opacity-50"
        style={{ backgroundColor: "var(--theme-primary)", color: "var(--theme-primary-text)" }}
      >
        Add column
      </button>
    </div>
  </form>
);
