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
import { ProjectViewSwitcher } from './ProjectViewSwitcher';
import { ProjectDocsView } from './ProjectDocsView';
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
  Bell,
  GripVertical,
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
  const [targetColumnId, setTargetColumnId] = useState<string | undefined>(undefined);

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
      {/* Top Project Header */}
      <div
        className="h-14 border-b px-4 sm:px-6 flex items-center justify-between shrink-0"
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBackToChat}
            title="Back to Channel Chat"
            className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition flex items-center gap-1 text-xs"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>

          <span className="w-px h-5" style={{ backgroundColor: 'var(--theme-border)' }} />

          {/* Project Identity */}
          <div className="flex items-center gap-2 truncate">
            <span
              style={{ backgroundColor: (project.color || '#007A5A') + '25' }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
            >
              {project.icon || '📋'}
            </span>
            <div className="truncate">
              <h1 className="text-sm font-bold truncate flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
                {project.name}
              </h1>
              {project.description && (
                <p className="text-[11px] truncate hidden md:block" style={{ color: 'var(--theme-text-muted)' }}>
                  {project.description}
                </p>
              )}
            </div>
          </div>

          <span className="w-px h-5 hidden sm:inline" style={{ backgroundColor: 'var(--theme-border)' }} />

          {/* View Switcher: Board vs Docs */}
          <div className="flex items-center">
            <ProjectViewSwitcher
              activeSection={activeSection}
              onSectionChange={(sec) => setActiveSection(sec as any)}
              ticketCount={totalTickets}
              docCount={documents.length}
            />
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2">
          {activeSection === 'board' && (
            <>
              {/* Notification Channel Selector */}
              <div
                className="flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-xs"
                style={{
                  backgroundColor: 'var(--theme-bg-surface-hover)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
                title="Channel where Orbit Bot broadcasts activity updates"
              >
                <Bell size={13} className="shrink-0" style={{ color: 'var(--theme-primary)' }} />
                <span className="text-[11px] hidden xl:inline" style={{ color: 'var(--theme-text-muted)' }}>Notify:</span>
                <select
                  value={project.notificationChannelId || ''}
                  onChange={(e) => handleUpdateNotificationChannel(e.target.value)}
                  className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer max-w-[120px] sm:max-w-[150px] truncate"
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

              {/* New Ticket Button */}
              <button
                onClick={() => {
                  setEditingTicket(null);
                  setTargetColumnId(columns[0]?.id);
                  setShowTicketModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 active:scale-95"
                style={{
                  backgroundColor: 'var(--theme-primary)',
                  color: 'var(--theme-primary-text)',
                }}
              >
                <Plus size={15} />
                <span>New Ticket</span>
              </button>

              {/* Add Column Button */}
              <button
                onClick={() => setShowAddColumn(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 active:scale-95 hidden sm:flex hover:bg-black/5 dark:hover:bg-white/10"
                style={{
                  backgroundColor: 'var(--theme-bg-surface-hover)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-primary)',
                }}
              >
                <Columns3 size={15} />
                <span>Add Column</span>
              </button>
            </>
          )}

          {/* Delete Project */}
          <button
            onClick={handleDeleteProject}
            title="Delete Project Board"
            className="p-1.5 hover:bg-red-500/10 rounded-lg transition"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {activeSection === 'board' ? (
        <>
          {/* Filter & Search Bar */}
      <div
        className="h-11 border-b px-4 sm:px-6 flex items-center justify-between gap-3 text-xs shrink-0 overflow-x-auto scrollbar-none"
        style={{
          backgroundColor: 'var(--theme-bg-surface)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-[200px] max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" style={{ color: 'var(--theme-text-muted)' }} />
            <input
              type="text"
              placeholder="Filter tickets by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border rounded-lg pl-8 pr-3 py-1 text-xs focus:outline-none"
              style={{
                backgroundColor: 'var(--theme-bg-surface-hover)',
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
        </div>

        {/* Priority & Assignee Filters */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <Filter size={13} style={{ color: 'var(--theme-text-muted)' }} />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs focus:outline-none"
              style={{
                backgroundColor: 'var(--theme-bg-surface-hover)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">🔥 Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <User size={13} style={{ color: 'var(--theme-text-muted)' }} />
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs focus:outline-none"
              style={{
                backgroundColor: 'var(--theme-bg-surface-hover)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
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
                      className={`border rounded-xl p-3 shadow-sm transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-md ${
                        isBeingDragged ? 'opacity-40 scale-95 border-dashed ring-2 ring-slack-green' : ''
                      }`}
                      style={{
                        backgroundColor: 'var(--theme-bg-surface-hover)',
                        borderColor: 'var(--theme-border)',
                      }}
                    >
                      {/* Priority Badge & ID */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${priorityMeta.bg} ${priorityMeta.text}`}
                        >
                          <PriorityIcon size={11} />
                          {priorityMeta.label}
                        </span>

                        <span className="text-[10px] font-mono" style={{ color: 'var(--theme-text-muted)' }}>
                          #{ticket.id.slice(0, 6)}
                        </span>
                      </div>

                      {/* Ticket Title */}
                      <h4 className="text-xs font-semibold leading-snug mb-1.5 break-words" style={{ color: 'var(--theme-text-primary)' }}>
                        {ticket.title}
                      </h4>

                      {/* Description Preview */}
                      {ticket.description && (
                        <p className="text-[11px] line-clamp-2 mb-2.5 leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
                          {ticket.description}
                        </p>
                      )}

                      {/* Footer: Due Date & Assignee Avatar */}
                      <div
                        className="flex items-center justify-between pt-2 border-t text-[11px]"
                        style={{ borderColor: 'var(--theme-border)' }}
                      >
                        {/* Due Date */}
                        {ticket.dueDate ? (
                          <div
                            className={`flex items-center gap-1 font-medium ${
                              isOverdue ? 'text-red-400 font-bold' : ''
                            }`}
                            style={!isOverdue ? { color: 'var(--theme-text-muted)' } : undefined}
                          >
                            <Calendar size={12} />
                            <span>
                              {new Date(ticket.dueDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
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
                              className="w-5 h-5 rounded-full object-cover ring-1 ring-black/20 dark:ring-white/20"
                            />
                            <span className="text-[10px] font-medium hidden sm:inline max-w-[80px] truncate" style={{ color: 'var(--theme-text-primary)' }}>
                              {ticket.assignee.displayName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--theme-text-muted)' }}>
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
    </div>
  );
};
