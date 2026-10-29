'use client';

import React, { useState, useEffect } from 'react';
import {
  Project,
  ProjectColumn,
  Ticket,
  TicketPriority,
  WorkspaceMember,
  UserProfile,
  Channel,
  SOCKET_EVENTS,
} from '@orbit/types';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useProjectStore } from '../../stores/projectStore';
import { TicketModal } from './TicketModal';
import { TicketDetailModal } from './TicketDetailModal';
import { ProjectViewSwitcher } from './ProjectViewSwitcher';
import { ProjectDocsView } from './ProjectDocsView';
import { IssueChatModal } from './IssueChatModal';
import { IssueTimelineModal } from './IssueTimelineModal';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Calendar,
  User,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  MessageSquare,
  ArrowLeft,
  Columns3,
  Flame,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Bell,
  GripVertical,
  Eye,
  Tag,
  GitBranch,
} from 'lucide-react';

interface ProjectBoardViewProps {
  project: Project;
  currentUser: UserProfile | null;
  members: WorkspaceMember[];
  channels?: Channel[];
  onBackToChat: () => void;
  onDeleteProject?: (projectId: string) => void;
}

const PRIORITY_BADGES: Record<
  TicketPriority,
  { label: string; bg: string; text: string; icon: any }
> = {
  LOW: { label: 'Low', bg: 'bg-slate-500/20', text: 'text-slate-400', icon: CheckCircle2 },
  MEDIUM: { label: 'Medium', bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Clock },
  HIGH: { label: 'High', bg: 'bg-amber-500/20', text: 'text-amber-400', icon: AlertCircle },
  URGENT: { label: 'Urgent', bg: 'bg-red-500/20', text: 'text-red-400', icon: AlertTriangle },
};

const COLUMN_COLORS = [
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#64748B', // Slate
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
    updateTicket,
    removeTicket,
    moveTicket,
    activeSection,
    setActiveSection,
    documents,
  } = useProjectStore();

  const project = currentProject || initialProject;

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterAssignee, setFilterAssignee] = useState<string>('ALL');

  // Modals & Popovers
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [viewingDetailTicket, setViewingDetailTicket] = useState<Ticket | null>(null);
  const [targetColumnId, setTargetColumnId] = useState<string | undefined>(undefined);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [chatTicket, setChatTicket] = useState<any | null>(null);
  const [timelineTicket, setTimelineTicket] = useState<any | null>(null);

  // Edit Project Modal State
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [editProjectStatus, setEditProjectStatus] = useState<'active' | 'inactive' | 'delivered'>('active');
  const [editAssignedEmployees, setEditAssignedEmployees] = useState<Array<{ name: string; uid?: string }>>([]);
  const [editEmployeeDropdownOpen, setEditEmployeeDropdownOpen] = useState(false);
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);

  const handleOpenEditProject = () => {
    setEditProjectName(project.name || '');
    setEditProjectDesc(project.description || '');
    setEditProjectStatus((project.status as any) || 'active');
    setEditAssignedEmployees(Array.isArray(project.assignedEmployees) ? (project.assignedEmployees as any) : []);
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
      alert(err.response?.data?.error || 'Failed to update project');
    } finally {
      setIsUpdatingProject(false);
    }
  };

  // Direct Ticket Actions
  const handleToggleWatch = async (ticket: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/api/projects/${project.id}/tickets/${ticket.id}/watch`);
      updateTicket({
        ...ticket,
        watchers: res.data.watchers,
      });
    } catch (err: any) {
      console.error('Failed to toggle watch', err);
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
      alert(err.response?.data?.error || 'Failed to delete ticket');
    }
  };

  // Column creation & editing state
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('#3B82F6');
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState('');

  // Drag and drop state
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  // Column reordering helper (button click: left/right)
  const handleMoveColumn = async (columnId: string, direction: 'left' | 'right') => {
    const cols = [...(project.columns || [])];
    const index = cols.findIndex((c) => c.id === columnId);
    if (index === -1) return;
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cols.length) return;

    const temp = cols[index];
    cols[index] = cols[targetIndex];
    cols[targetIndex] = temp;

    const updatedCols = cols.map((col, idx) => ({ ...col, orderIndex: idx }));
    setColumns(updatedCols);

    try {
      await api.patch(`/api/projects/${project.id}/columns/reorder`, {
        columnOrders: updatedCols.map((c) => ({ id: c.id, orderIndex: c.orderIndex })),
      });
    } catch (err) {
      console.error('Failed to reorder columns', err);
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
      alert(err.response?.data?.error || 'Failed to update notification channel');
    }
  };

  // Load latest project details on mount or project switch
  useEffect(() => {
    let isMounted = true;
    const fetchProjectDetails = async () => {
      try {
        const res = await api.get(`/api/projects/${initialProject.id}`);
        if (isMounted) {
          setCurrentProject(res.data);
        }
      } catch (err) {
        console.error('Failed to load project details', err);
      }
    };

    fetchProjectDetails();
    return () => {
      isMounted = false;
    };
  }, [initialProject.id, setCurrentProject]);

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

    const onTicketDelete = (payload: { ticketId: string; projectId: string }) => {
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
        moveTicket(payload.ticket, payload.fromColumnId, payload.toColumnId, payload.orderIndex);
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

    const onColumnDelete = (payload: { columnId: string; projectId: string }) => {
      if (payload.projectId === project.id) {
        removeColumn(payload.columnId);
      }
    };

    const onColumnReorder = (payload: { projectId: string; columns: ProjectColumn[] }) => {
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
  }, [project.id, addTicket, updateTicket, removeTicket, moveTicket, addColumn, updateColumn, removeColumn, setColumns]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, ticket: Ticket) => {
    setDraggedTicketId(ticket.id);
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({ type: 'ticket', ticketId: ticket.id, fromColumnId: ticket.columnId })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const parsed = JSON.parse(dataStr);

      // 1. Column drag & drop reorder
      if (parsed.type === 'column') {
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
              columnOrders: updatedCols.map((c) => ({ id: c.id, orderIndex: c.orderIndex })),
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

      const newOrderIndex = (targetColumn.tickets || []).length;

      // Optimistic update in Zustand store
      moveTicket(ticketToMove, fromColumnId, toColumnId, newOrderIndex);

      // Persist to backend API (triggers Orbit Bot notifications & socket broadcasts)
      await api.patch(`/api/projects/${project.id}/tickets/${ticketId}/move`, {
        columnId: toColumnId,
        orderIndex: newOrderIndex,
      });
    } catch (err) {
      console.error('Failed to move ticket', err);
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
      setNewColumnName('');
      setShowAddColumn(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create column');
    }
  };

  // Update Column handler
  const handleUpdateColumnName = async (columnId: string) => {
    if (!editingColName.trim()) {
      setEditingColId(null);
      return;
    }
    try {
      const res = await api.put(`/api/projects/${project.id}/columns/${columnId}`, {
        name: editingColName.trim(),
      });
      updateColumn(res.data);
    } catch (err: any) {
      console.error('Failed to update column', err);
    } finally {
      setEditingColId(null);
    }
  };

  // Delete Column handler
  const handleDeleteColumn = async (columnId: string, colName: string) => {
    if (!confirm(`Delete column "${colName}" and all tickets inside it?`)) return;
    try {
      await api.delete(`/api/projects/${project.id}/columns/${columnId}`);
      removeColumn(columnId);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete column');
    }
  };

  // Delete Project handler
  const handleDeleteProject = async () => {
    if (!confirm(`Are you sure you want to delete project board "${project.name}"?`)) return;
    try {
      await api.delete(`/api/projects/${project.id}`);
      onDeleteProject?.(project.id);
      onBackToChat();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete project');
    }
  };

  // Filtered tickets helper
  const filterTicket = (t: Ticket): boolean => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }

    if (filterPriority !== 'ALL' && t.priority !== filterPriority) {
      return false;
    }

    if (filterAssignee !== 'ALL') {
      if (filterAssignee === 'UNASSIGNED') {
        if (t.assigneeId) return false;
      } else if (filterAssignee === 'ME') {
        if (t.assigneeId !== currentUser?.id) return false;
      } else if (t.assigneeId !== filterAssignee) {
        return false;
      }
    }

    return true;
  };

  const columns = project.columns || [];
  const totalTickets = columns.reduce((acc, c) => acc + (c.tickets?.length || 0), 0);

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden select-none"
      style={{
        backgroundColor: 'var(--theme-bg-app)',
        color: 'var(--theme-text-primary)',
      }}
    >
      {/* Top Project Header (Focused on Project Identity & View Navigation) */}
      <div
        className="h-14 border-b px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0"
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-border)',
        }}
      >
        {/* Left: Back Button + Project Identity */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={onBackToChat}
            title="Back to Channel Chat"
            className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition flex items-center gap-1 text-xs shrink-0"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <ArrowLeft size={16} />
            <span className="hidden md:inline">Back</span>
          </button>

          <span className="w-px h-5 shrink-0" style={{ backgroundColor: 'var(--theme-border)' }} />

          {/* Project Identity: Icon, Title & Description (Always visible on mobile) */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              style={{ backgroundColor: (project.color || '#007A5A') + '25' }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-sm sm:text-base shrink-0 shadow-sm"
            >
              {project.icon || '📋'}
            </span>
            <div className="min-w-0">
              <h1
                className="text-xs sm:text-sm font-bold truncate leading-tight"
                style={{ color: 'var(--theme-text-primary)' }}
                title={project.name}
              >
                {project.name}
              </h1>
              {project.description && (
                <p className="text-[10px] sm:text-[11px] truncate opacity-60 hidden md:block" style={{ color: 'var(--theme-text-muted)' }}>
                  {project.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: View Switcher (Moved to right) + Project Options Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <ProjectViewSwitcher
            activeSection={activeSection}
            onSectionChange={(sec) => setActiveSection(sec as any)}
            ticketCount={totalTickets}
            docCount={documents.length}
          />

          {/* Subtle kebab menu for project settings */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowProjectMenu(!showProjectMenu)}
              title="Project Options"
              className="p-1.5 sm:p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <MoreVertical size={16} />
            </button>

            {showProjectMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProjectMenu(false)}
                />
                <div
                  className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                  style={{
                    backgroundColor: 'var(--theme-bg-surface)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <div
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider opacity-50 border-b mb-1"
                    style={{
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text-muted)',
                    }}
                  >
                    Project Settings
                  </div>
                  <button
                    onClick={() => {
                      setShowProjectMenu(false);
                      handleOpenEditProject();
                    }}
                    className="w-full px-3 py-2 text-xs text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/10 transition"
                    style={{ color: 'var(--theme-text-primary)' }}
                  >
                    <Edit2 size={14} className="text-blue-400" />
                    <span>Edit Project</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowProjectMenu(false);
                      handleDeleteProject();
                    }}
                    className="w-full px-3 py-2 text-xs text-left flex items-center gap-2 text-red-500 hover:bg-red-500/10 transition"
                  >
                    <Trash2 size={14} />
                    <span>Delete Project</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {activeSection === 'board' ? (
        <>
          {/* Dedicated Board Action & Filter Toolbar */}
          <div
            className="border-b px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs shrink-0"
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'var(--theme-border)',
            }}
          >
            {/* Left: Search & Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[200px]">
              {/* Search input */}
              <div className="relative flex-1 sm:flex-initial sm:w-60 min-w-[140px]">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50"
                  style={{ color: 'var(--theme-text-muted)' }}
                />
                <input
                  type="text"
                  placeholder="Filter tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border rounded-lg pl-8 pr-7 py-1.5 text-xs focus:outline-none transition shadow-sm"
                  style={{
                    backgroundColor: 'var(--theme-bg-app)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 hover:opacity-100 opacity-60"
                    style={{ color: 'var(--theme-text-muted)' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Priority Filter */}
              <div
                className="flex items-center gap-1 border rounded-lg px-2 py-1 shadow-sm"
                style={{
                  backgroundColor: 'var(--theme-bg-app)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <Filter size={12} className="opacity-60" style={{ color: 'var(--theme-text-muted)' }} />
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="bg-transparent text-xs focus:outline-none cursor-pointer"
                  style={{ color: 'var(--theme-text-primary)' }}
                >
                  <option value="ALL">All Priorities</option>
                  <option value="URGENT">🔥 Urgent</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              {/* Assignee Filter */}
              <div
                className="flex items-center gap-1 border rounded-lg px-2 py-1 shadow-sm"
                style={{
                  backgroundColor: 'var(--theme-bg-app)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <User size={12} className="opacity-60" style={{ color: 'var(--theme-text-muted)' }} />
                <select
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="bg-transparent text-xs focus:outline-none cursor-pointer max-w-[100px] sm:max-w-[130px] truncate"
                  style={{ color: 'var(--theme-text-primary)' }}
                >
                  <option value="ALL">All Assignees</option>
                  <option value="ME">Assigned to Me</option>
                  <option value="UNASSIGNED">Unassigned</option>
                  {members.map((m) => {
                    const u = m.user;
                    if (!u) return null;
                    return (
                      <option key={u.id} value={u.id}>
                        {u.displayName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Reset filter pill if active */}
              {(searchQuery || filterPriority !== 'ALL' || filterAssignee !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterPriority('ALL');
                    setFilterAssignee('ALL');
                  }}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-md hover:opacity-80 transition"
                  style={{
                    backgroundColor: 'var(--theme-bg-surface-hover)',
                    color: 'var(--theme-text-muted)',
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Right: Board Specific Actions (Channel broadcast, Add Column, New Ticket) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
              {/* Notification Channel Selector */}
              <div
                className="flex items-center gap-1 border rounded-lg px-2 sm:px-2.5 py-1.5 text-xs shadow-sm"
                style={{
                  backgroundColor: 'var(--theme-bg-app)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
                title="Channel where Orbit Bot broadcasts board activities"
              >
                <Bell size={13} className="shrink-0" style={{ color: 'var(--theme-primary)' }} />
                <span className="text-[11px] hidden xl:inline opacity-70" style={{ color: 'var(--theme-text-muted)' }}>
                  Notify:
                </span>
                <select
                  value={project.notificationChannelId || ''}
                  onChange={(e) => handleUpdateNotificationChannel(e.target.value)}
                  className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer max-w-[90px] sm:max-w-[140px] truncate"
                  style={{ color: 'var(--theme-text-primary)' }}
                >
                  {channels && channels.length > 0 ? (
                    channels.map((ch) => (
                      <option
                        key={ch.id}
                        value={ch.id}
                        style={{
                          backgroundColor: 'var(--theme-bg-surface)',
                          color: 'var(--theme-text-primary)',
                        }}
                      >
                        #{ch.name}
                      </option>
                    ))
                  ) : (
                    <option
                      value=""
                      style={{
                        backgroundColor: 'var(--theme-bg-surface)',
                        color: 'var(--theme-text-primary)',
                      }}
                    >
                      #general
                    </option>
                  )}
                </select>
              </div>

              {/* Add Column Button */}
              <button
                onClick={() => setShowAddColumn(true)}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 active:scale-95 hover:bg-black/5 dark:hover:bg-white/10 shadow-sm"
                style={{
                  backgroundColor: 'var(--theme-bg-app)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                <Columns3 size={14} />
                <span className="hidden sm:inline">Add Column</span>
              </button>

              {/* New Ticket Button */}
              <button
                onClick={() => {
                  setEditingTicket(null);
                  setTargetColumnId(columns[0]?.id);
                  setShowTicketModal(true);
                }}
                className="px-3 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5 active:scale-95"
                style={{
                  backgroundColor: 'var(--theme-primary)',
                  color: 'var(--theme-primary-text)',
                }}
              >
                <Plus size={15} />
                <span>New Ticket</span>
              </button>
            </div>
          </div>

      {/* Kanban Board Horizontal Scroll Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 sm:p-6 flex items-start gap-4">
        {columns.map((column, colIndex) => {
          const colTickets = (column.tickets || []).filter(filterTicket);
          const isDragTarget = dragOverColId === column.id;

          return (
            <div
              key={column.id}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
              className={`w-72 sm:w-80 shrink-0 border rounded-2xl flex flex-col max-h-full transition-all duration-200 ${
                isDragTarget
                  ? 'ring-2 ring-slack-green/40 shadow-xl'
                  : ''
              }`}
              style={{
                backgroundColor: 'var(--theme-bg-surface)',
                borderColor: isDragTarget ? 'var(--theme-primary)' : 'var(--theme-border)',
              }}
            >
              {/* Column Header (Draggable for reordering) */}
              <div
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  setDraggedColId(column.id);
                  e.dataTransfer.setData(
                    'text/plain',
                    JSON.stringify({ type: 'column', columnId: column.id })
                  );
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className={`p-3.5 border-b flex items-center justify-between shrink-0 cursor-move ${
                  draggedColId === column.id ? 'opacity-50' : ''
                }`}
                style={{
                  borderColor: 'var(--theme-border)',
                }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0 mr-1.5">
                  <GripVertical size={13} className="shrink-0" style={{ color: 'var(--theme-text-muted)' }} />
                  <span
                    style={{ backgroundColor: column.color || '#3B82F6' }}
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                  />
                  {editingColId === column.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingColName}
                      onChange={(e) => setEditingColName(e.target.value)}
                      onBlur={() => handleUpdateColumnName(column.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateColumnName(column.id);
                        if (e.key === 'Escape') setEditingColId(null);
                      }}
                      className="border rounded px-2 py-0.5 text-xs font-bold w-full"
                      style={{
                        backgroundColor: 'var(--theme-bg-surface-hover)',
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text-primary)',
                      }}
                    />
                  ) : (
                    <h3
                      onDoubleClick={() => {
                        setEditingColId(column.id);
                        setEditingColName(column.name);
                      }}
                      title="Double-click to rename column"
                      className="text-xs font-bold truncate cursor-pointer hover:opacity-80"
                      style={{ color: 'var(--theme-text-primary)' }}
                    >
                      {column.name}
                    </h3>
                  )}
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: 'var(--theme-bg-surface-hover)',
                      color: 'var(--theme-text-muted)',
                    }}
                  >
                    {colTickets.length}
                  </span>
                </div>

                <div className="flex items-center gap-0.5">
                  {/* Reorder Column Left */}
                  <button
                    disabled={colIndex === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveColumn(column.id, 'left');
                    }}
                    title="Move column left"
                    className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded disabled:opacity-20 transition"
                    style={{ color: 'var(--theme-text-muted)' }}
                  >
                    <ChevronLeft size={13} />
                  </button>

                  {/* Reorder Column Right */}
                  <button
                    disabled={colIndex === columns.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveColumn(column.id, 'right');
                    }}
                    title="Move column right"
                    className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded disabled:opacity-20 transition"
                    style={{ color: 'var(--theme-text-muted)' }}
                  >
                    <ChevronRight size={13} />
                  </button>

                  {/* Quick Add Ticket to this Column */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTicket(null);
                      setTargetColumnId(column.id);
                      setShowTicketModal(true);
                    }}
                    title="Add ticket to this column"
                    className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition"
                    style={{ color: 'var(--theme-text-muted)' }}
                  >
                    <Plus size={15} />
                  </button>

                  {/* Column Settings / Delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteColumn(column.id, column.name);
                    }}
                    title="Delete column"
                    className="p-1 hover:bg-red-500/20 rounded text-red-400 transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Column Tickets List (Scrollable vertically) */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[150px]">
                {colTickets.map((ticket) => {
                  const isBeingDragged = draggedTicketId === ticket.id;
                  const priorityMeta = PRIORITY_BADGES[ticket.priority] || PRIORITY_BADGES.MEDIUM;
                  const PriorityIcon = priorityMeta.icon;

                  const isOverdue =
                    ticket.dueDate &&
                    new Date(ticket.dueDate).getTime() < Date.now() &&
                    column.name.toLowerCase() !== 'done' &&
                    column.name.toLowerCase() !== 'completed';

                  const watchersList = Array.isArray(ticket.watchers) ? ticket.watchers : [];
                  const isWatching = currentUser ? watchersList.includes(currentUser.id) : false;
                  const commentCount = (ticket as any)._count?.comments || ((ticket as any).comments?.length ?? 0);

                  return (
                    <div
                      key={ticket.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ticket)}
                      onClick={() => {
                        setEditingTicket(ticket);
                        setTargetColumnId(column.id);
                        setShowTicketModal(true);
                      }}
                      className={`border rounded-2xl p-3.5 shadow-sm transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-md relative group ${
                        isOverdue ? 'ring-2 ring-rose-500/80 border-rose-500/80' : ''
                      } ${
                        isBeingDragged ? 'opacity-40 scale-95 border-dashed ring-2 ring-slack-green' : ''
                      }`}
                      style={{
                        backgroundColor: 'var(--theme-bg-surface-hover)',
                        borderColor: isOverdue ? '#ef4444' : 'var(--theme-border)',
                      }}
                    >
                      {/* Top Header: ID badge on left & 4 Action Buttons on right */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white shadow-xs">
                            ID: {ticket.issueNumber || ticket.customId || ticket.id.slice(0, 5)}
                          </span>

                          {/* Labels */}
                          {ticket.labels && Array.isArray(ticket.labels) && ticket.labels.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <Tag size={10} />
                              {typeof ticket.labels[0] === 'string' ? ticket.labels[0] : ticket.labels[0]?.name || 'Dev'}
                            </span>
                          )}
                        </div>

                        {/* Top-Right 4 Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* 1. Eye Button (View Ticket Details) */}
                          <button
                            type="button"
                            title="View Ticket Details"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingDetailTicket(ticket);
                            }}
                            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
                          >
                            <Eye size={13} />
                          </button>

                          {/* 2. Chat Button (With count badge) */}
                          <button
                            type="button"
                            title="Issue Chat & Notes"
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatTicket(ticket);
                            }}
                            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition relative"
                          >
                            <MessageSquare size={13} />
                            {commentCount > 0 && (
                              <span className="absolute -top-1 -right-1 px-1 min-w-[14px] h-[14px] rounded-full text-[9px] font-bold bg-rose-500 text-white flex items-center justify-center shadow-xs">
                                {commentCount}
                              </span>
                            )}
                          </button>

                          {/* 3. Clock Button (Issue Timeline) */}
                          <button
                            type="button"
                            title="Issue Timeline & Activity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimelineTicket(ticket);
                            }}
                            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
                          >
                            <Clock size={13} />
                          </button>

                          {/* 4. Trash Button (Delete Ticket) */}
                          <button
                            type="button"
                            title="Delete issue"
                            onClick={(e) => handleDeleteTicketDirect(ticket, e)}
                            className="p-1 rounded-full text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Ticket Title */}
                      <h4 className="text-xs font-bold leading-snug mb-1.5 break-words text-white">
                        {ticket.title}
                      </h4>

                      {/* Description Preview */}
                      {ticket.description && (
                        <p className="text-[11px] line-clamp-2 mb-2 leading-relaxed text-slate-400">
                          {ticket.description}
                        </p>
                      )}

                      {/* Git Branch Badge */}
                      {ticket.gitbranch && (
                        <div className="mb-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 border border-slate-700/60 font-mono text-[10px] text-slate-300 max-w-full truncate">
                            <GitBranch size={10} className="shrink-0 text-slate-400" />
                            <span className="truncate">{ticket.gitbranch}</span>
                          </span>
                        </div>
                      )}

                      {/* Footer: Due Date pill & Assignee Avatar */}
                      <div
                        className="flex items-center justify-between pt-2 border-t text-[11px]"
                        style={{ borderColor: 'var(--theme-border)' }}
                      >
                        {/* Due Date */}
                        {ticket.dueDate ? (
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              isOverdue
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/40'
                                : 'bg-slate-800/80 text-slate-300 border-slate-700'
                            }`}
                          >
                            <Calendar size={11} className={isOverdue ? 'text-rose-400' : 'text-slate-400'} />
                            <span>
                              {new Date(ticket.dueDate).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                              })}
                            </span>
                            {isOverdue && <AlertCircle size={12} className="text-rose-400 ml-0.5" />}
                          </div>
                        ) : (
                          <div />
                        )}

                        {/* Assignee Avatar */}
                        {ticket.assignee ? (
                          <div
                            title={`Assigned to ${ticket.assignee.displayName}`}
                            className="flex items-center gap-1.5"
                          >
                            <img
                              src={
                                ticket.assignee.avatarUrl ||
                                `https://api.dicebear.com/7.x/bottts/svg?seed=${ticket.assignee.username}`
                              }
                              alt={ticket.assignee.displayName}
                              className="w-6 h-6 rounded-full object-cover ring-1 ring-black/20 dark:ring-white/20"
                            />
                            <span className="text-[10px] font-medium hidden sm:inline max-w-[80px] truncate" style={{ color: 'var(--theme-text-primary)' }}>
                              {ticket.assignee.displayName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] flex items-center gap-1 text-slate-500">
                            <User size={11} />
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {colTickets.length === 0 && (
                  <div
                    className="h-24 border border-dashed rounded-xl flex items-center justify-center text-[11px]"
                    style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }}
                  >
                    No tickets
                  </div>
                )}
              </div>

              {/* Add Ticket Shortcut at column bottom */}
              <div className="p-2 border-t shrink-0" style={{ borderColor: 'var(--theme-border)' }}>
                <button
                  onClick={() => {
                    setEditingTicket(null);
                    setTargetColumnId(column.id);
                    setShowTicketModal(true);
                  }}
                  className="w-full py-1.5 px-2 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center justify-center gap-1.5"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <Plus size={14} />
                  <span>Add ticket</span>
                </button>
              </div>
            </div>
          );
        })}

        {/* Add Column Button Card */}
        {showAddColumn ? (
          <div
            className="w-72 sm:w-80 shrink-0 border rounded-2xl p-4 shadow-xl"
            style={{
              backgroundColor: 'var(--theme-bg-surface)',
              borderColor: 'var(--theme-primary)',
            }}
          >
            <h4 className="text-xs font-bold mb-2" style={{ color: 'var(--theme-text-primary)' }}>Create New Column</h4>
            <form onSubmit={handleCreateColumn} className="space-y-3">
              <input
                type="text"
                autoFocus
                required
                placeholder="Column Name (e.g. QA, Review, Staging)"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none"
                style={{
                  backgroundColor: 'var(--theme-bg-surface-hover)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              />

              <div>
                <label className="block text-[10px] uppercase font-semibold mb-1" style={{ color: 'var(--theme-text-muted)' }}>
                  Header Color
                </label>
                <div className="flex items-center gap-1.5">
                  {COLUMN_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColumnColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full transition transform hover:scale-110 ${
                        newColumnColor === c ? 'ring-2 ring-offset-1 scale-110' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddColumn(false)}
                  className="px-3 py-1.5 text-xs hover:opacity-80 transition"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newColumnName.trim()}
                  className="px-3.5 py-1.5 disabled:opacity-50 text-xs font-semibold rounded-lg shadow transition"
                  style={{
                    backgroundColor: 'var(--theme-primary)',
                    color: 'var(--theme-primary-text)',
                  }}
                >
                  Add Column
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowAddColumn(true)}
            className="w-72 sm:w-80 shrink-0 h-16 rounded-2xl border-2 border-dashed transition flex items-center justify-center gap-2 text-xs font-semibold hover:opacity-80"
            style={{
              borderColor: 'var(--theme-border)',
              backgroundColor: 'var(--theme-bg-surface)',
              color: 'var(--theme-text-muted)',
            }}
          >
            <Plus size={16} />
            <span>Add another column</span>
          </button>
        )}
      </div>
      </>
      ) : (
        <ProjectDocsView
          project={project}
          currentUser={currentUser}
          members={members}
        />
      )}

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
              backgroundColor: 'var(--theme-bg-surface, #1e293b)',
              borderColor: 'var(--theme-border, #334155)',
              color: 'var(--theme-text-primary)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--theme-border)' }}>
              <div className="flex items-center gap-2">
                <Edit2 size={18} className="text-blue-400" />
                <h3 className="text-base font-bold text-white">Edit Project</h3>
              </div>
              <button
                onClick={() => setShowEditProjectModal(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditProject} className="space-y-4 text-xs">
              {/* Field 1: Project Title */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-200">
                  <span className="text-rose-500 mr-1">*</span>Project Title
                </label>
                <input
                  type="text"
                  required
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  placeholder="Project name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/20 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-xs"
                />
              </div>

              {/* Field 2: Project Details */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-200">
                  Project Details
                </label>
                <textarea
                  rows={4}
                  value={editProjectDesc}
                  onChange={(e) => setEditProjectDesc(e.target.value)}
                  placeholder="Project description and notes..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/20 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none text-xs"
                />
              </div>

              {/* Field 3: Status */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-200">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={editProjectStatus}
                    onChange={(e: any) => setEditProjectStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/20 border border-slate-700/80 text-white focus:outline-none focus:border-blue-500 transition appearance-none cursor-pointer text-xs pr-9"
                  >
                    <option value="active" className="bg-slate-900 text-white">Active</option>
                    <option value="inactive" className="bg-slate-900 text-white">Inactive</option>
                    <option value="delivered" className="bg-slate-900 text-white">Delivered</option>
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Field 4: Assign Employees */}
              <div className="relative">
                <label className="block text-xs font-semibold mb-1.5 text-slate-200">
                  Assign Employees
                </label>
                <div
                  onClick={() => setEditEmployeeDropdownOpen((prev) => !prev)}
                  className="min-h-[46px] w-full px-2.5 py-2 rounded-xl bg-black/20 border border-slate-700/80 flex flex-wrap items-center gap-1.5 cursor-pointer hover:border-slate-600 transition pr-8 relative"
                >
                  {editAssignedEmployees.length === 0 ? (
                    <span className="text-slate-500 text-xs px-1 select-none">
                      Select employees to assign...
                    </span>
                  ) : (
                    editAssignedEmployees.map((emp) => (
                      <span
                        key={emp.name}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 text-slate-200 border border-slate-700 shadow-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {emp.name}
                        <button
                          type="button"
                          onClick={() => setEditAssignedEmployees((prev) => prev.filter((e) => e.name !== emp.name))}
                          className="text-slate-400 hover:text-rose-400 transition ml-0.5"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>

                {editEmployeeDropdownOpen && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border p-2 shadow-2xl max-h-52 overflow-y-auto space-y-1 animate-in fade-in zoom-in-95"
                    style={{
                      backgroundColor: 'var(--theme-bg-surface, #1e293b)',
                      borderColor: 'var(--theme-border, #334155)',
                    }}
                  >
                    {members && members.length > 0 ? (
                      members.map((member: any) => {
                        const mName = member.user?.displayName || member.user?.name || member.displayName || member.name || 'Member';
                        const mUid = member.userId || member.user?.id || member.id;
                        const isAssigned = editAssignedEmployees.some((e) => e.name === mName);
                        return (
                          <div
                            key={mUid || mName}
                            onClick={() => handleToggleEditEmployee(mName, mUid)}
                            className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer text-xs transition ${
                              isAssigned
                                ? 'bg-blue-600/20 text-blue-300 font-semibold'
                                : 'hover:bg-white/5 text-slate-300'
                            }`}
                          >
                            <span>{mName}</span>
                            {isAssigned && <Check size={14} className="text-blue-400" />}
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-xs text-slate-500 text-center">
                        No team members found in workspace
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons: Cancel and Save */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                <button
                  type="button"
                  onClick={() => setShowEditProjectModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-700 bg-transparent text-slate-300 hover:text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProject}
                  className="px-6 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-98 shadow-sm transition disabled:opacity-50"
                >
                  {isUpdatingProject ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
