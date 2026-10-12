'use client';

import React, { useState, useEffect } from 'react';
import {
  Project,
  ProjectColumn,
  Ticket,
  TicketPriority,
  WorkspaceMember,
  UserProfile,
  SOCKET_EVENTS,
} from '@orbit/types';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useProjectStore } from '../../stores/projectStore';
import { TicketModal } from './TicketModal';
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
} from 'lucide-react';

interface ProjectBoardViewProps {
  project: Project;
  currentUser: UserProfile | null;
  members: WorkspaceMember[];
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
  onBackToChat,
  onDeleteProject,
}) => {
  const {
    currentProject,
    setCurrentProject,
    addColumn,
    updateColumn,
    removeColumn,
    addTicket,
    updateTicket,
    removeTicket,
    moveTicket,
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
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

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

    socket.on(SOCKET_EVENTS.TICKET_NEW, onTicketNew);
    socket.on(SOCKET_EVENTS.TICKET_UPDATE, onTicketUpdate);
    socket.on(SOCKET_EVENTS.TICKET_DELETE, onTicketDelete);
    socket.on(SOCKET_EVENTS.TICKET_MOVE, onTicketMove);
    socket.on(SOCKET_EVENTS.COLUMN_NEW, onColumnNew);
    socket.on(SOCKET_EVENTS.COLUMN_UPDATE, onColumnUpdate);
    socket.on(SOCKET_EVENTS.COLUMN_DELETE, onColumnDelete);

    return () => {
      socket.off(SOCKET_EVENTS.TICKET_NEW, onTicketNew);
      socket.off(SOCKET_EVENTS.TICKET_UPDATE, onTicketUpdate);
      socket.off(SOCKET_EVENTS.TICKET_DELETE, onTicketDelete);
      socket.off(SOCKET_EVENTS.TICKET_MOVE, onTicketMove);
      socket.off(SOCKET_EVENTS.COLUMN_NEW, onColumnNew);
      socket.off(SOCKET_EVENTS.COLUMN_UPDATE, onColumnUpdate);
      socket.off(SOCKET_EVENTS.COLUMN_DELETE, onColumnDelete);
    };
  }, [project.id, addTicket, updateTicket, removeTicket, moveTicket, addColumn, updateColumn, removeColumn]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, ticket: Ticket) => {
    setDraggedTicketId(ticket.id);
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({ ticketId: ticket.id, fromColumnId: ticket.columnId })
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

    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const { ticketId, fromColumnId } = JSON.parse(dataStr);

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
    <div className="flex-1 flex flex-col h-full bg-[#1A1D21] text-gray-200 overflow-hidden select-none">
      {/* Top Project Header */}
      <div className="h-14 border-b border-[#383F45]/40 px-4 sm:px-6 flex items-center justify-between bg-[#1F2326] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBackToChat}
            title="Back to Channel Chat"
            className="p-1.5 hover:bg-gray-700/60 rounded-lg text-gray-400 hover:text-white transition flex items-center gap-1 text-xs"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>

          <span className="w-px h-5 bg-gray-700" />

          {/* Project Identity */}
          <div className="flex items-center gap-2 truncate">
            <span
              style={{ backgroundColor: (project.color || '#007A5A') + '25' }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
            >
              {project.icon || '📋'}
            </span>
            <div className="truncate">
              <h1 className="text-sm font-bold text-white truncate flex items-center gap-2">
                {project.name}
                <span className="text-[11px] font-normal text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                  {totalTickets} {totalTickets === 1 ? 'ticket' : 'tickets'}
                </span>
              </h1>
              {project.description && (
                <p className="text-[11px] text-gray-400 truncate hidden md:block">
                  {project.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2">
          {/* New Ticket Button */}
          <button
            onClick={() => {
              setEditingTicket(null);
              setTargetColumnId(columns[0]?.id);
              setShowTicketModal(true);
            }}
            className="px-3 py-1.5 bg-slack-green hover:bg-[#008a65] text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 active:scale-95"
          >
            <Plus size={15} />
            <span>New Ticket</span>
          </button>

          {/* Add Column Button */}
          <button
            onClick={() => setShowAddColumn(true)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white text-xs font-semibold rounded-lg border border-gray-700 transition flex items-center gap-1.5 active:scale-95 hidden sm:flex"
          >
            <Columns3 size={15} />
            <span>Add Column</span>
          </button>

          {/* Delete Project */}
          <button
            onClick={handleDeleteProject}
            title="Delete Project Board"
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="h-11 border-b border-[#383F45]/30 px-4 sm:px-6 flex items-center justify-between gap-3 bg-[#19171D] text-xs shrink-0 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2.5 flex-1 min-w-[200px] max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Filter tickets by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#222529] border border-gray-700/60 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-slack-green"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Priority & Assignee Filters */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <Filter size={13} className="text-gray-500" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-[#222529] border border-gray-700/60 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-hidden"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">🔥 Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <User size={13} className="text-gray-500" />
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="bg-[#222529] border border-gray-700/60 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-hidden"
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
        {columns.map((column) => {
          const colTickets = (column.tickets || []).filter(filterTicket);
          const isDragTarget = dragOverColId === column.id;

          return (
            <div
              key={column.id}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
              className={`w-72 sm:w-80 shrink-0 bg-[#1F2326] border rounded-2xl flex flex-col max-h-full transition-all duration-200 ${
                isDragTarget
                  ? 'border-slack-green bg-[#24292E] ring-2 ring-slack-green/40 shadow-xl'
                  : 'border-gray-800'
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-gray-800/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
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
                      className="bg-[#2A2E33] border border-gray-700 rounded px-2 py-0.5 text-xs text-white font-bold w-full"
                    />
                  ) : (
                    <h3
                      onDoubleClick={() => {
                        setEditingColId(column.id);
                        setEditingColName(column.name);
                      }}
                      title="Double-click to rename column"
                      className="text-xs font-bold text-white truncate cursor-pointer hover:text-gray-300"
                    >
                      {column.name}
                    </h3>
                  )}
                  <span className="text-[11px] font-semibold text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full shrink-0">
                    {colTickets.length}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Quick Add Ticket to this Column */}
                  <button
                    onClick={() => {
                      setEditingTicket(null);
                      setTargetColumnId(column.id);
                      setShowTicketModal(true);
                    }}
                    title="Add ticket to this column"
                    className="p-1 hover:bg-gray-700/60 rounded text-gray-400 hover:text-white transition"
                  >
                    <Plus size={15} />
                  </button>

                  {/* Column Settings / Delete */}
                  <button
                    onClick={() => handleDeleteColumn(column.id, column.name)}
                    title="Delete column"
                    className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition"
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
                      className={`bg-[#272B30] hover:bg-[#2E3339] border border-gray-700/70 hover:border-gray-600 rounded-xl p-3 shadow-sm transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-md ${
                        isBeingDragged ? 'opacity-40 scale-95 border-dashed border-slack-green' : ''
                      }`}
                    >
                      {/* Priority Badge & ID */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${priorityMeta.bg} ${priorityMeta.text}`}
                        >
                          <PriorityIcon size={11} />
                          {priorityMeta.label}
                        </span>

                        <span className="text-[10px] text-gray-500 font-mono">
                          #{ticket.id.slice(0, 6)}
                        </span>
                      </div>

                      {/* Ticket Title */}
                      <h4 className="text-xs font-semibold text-white leading-snug mb-1.5 break-words">
                        {ticket.title}
                      </h4>

                      {/* Description Preview */}
                      {ticket.description && (
                        <p className="text-[11px] text-gray-400 line-clamp-2 mb-2.5 leading-relaxed">
                          {ticket.description}
                        </p>
                      )}

                      {/* Footer: Due Date & Assignee Avatar */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-700/40 text-[11px]">
                        {/* Due Date */}
                        {ticket.dueDate ? (
                          <div
                            className={`flex items-center gap-1 font-medium ${
                              isOverdue ? 'text-red-400 font-bold' : 'text-gray-400'
                            }`}
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
                              className="w-5 h-5 rounded-full object-cover ring-1 ring-gray-600"
                            />
                            <span className="text-[10px] text-gray-300 font-medium hidden sm:inline max-w-[80px] truncate">
                              {ticket.assignee.displayName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <User size={11} />
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {colTickets.length === 0 && (
                  <div className="h-24 border border-dashed border-gray-800 rounded-xl flex items-center justify-center text-[11px] text-gray-500">
                    No tickets
                  </div>
                )}
              </div>

              {/* Add Ticket Shortcut at column bottom */}
              <div className="p-2 border-t border-gray-800/60 shrink-0">
                <button
                  onClick={() => {
                    setEditingTicket(null);
                    setTargetColumnId(column.id);
                    setShowTicketModal(true);
                  }}
                  className="w-full py-1.5 px-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-700/40 transition flex items-center justify-center gap-1.5"
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
          <div className="w-72 sm:w-80 shrink-0 bg-[#1F2326] border border-slack-green rounded-2xl p-4 shadow-xl">
            <h4 className="text-xs font-bold text-white mb-2">Create New Column</h4>
            <form onSubmit={handleCreateColumn} className="space-y-3">
              <input
                type="text"
                autoFocus
                required
                placeholder="Column Name (e.g. QA, Review, Staging)"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                className="w-full bg-[#2A2E33] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-slack-green"
              />

              <div>
                <label className="block text-[10px] uppercase font-semibold text-gray-400 mb-1">
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
                        newColumnColor === c ? 'ring-2 ring-white scale-110' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddColumn(false)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newColumnName.trim()}
                  className="px-3.5 py-1.5 bg-slack-green hover:bg-[#008a65] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow transition"
                >
                  Add Column
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowAddColumn(true)}
            className="w-72 sm:w-80 shrink-0 h-16 rounded-2xl border-2 border-dashed border-gray-800 hover:border-gray-600 bg-[#1F2326]/40 hover:bg-[#1F2326] text-gray-400 hover:text-white transition flex items-center justify-center gap-2 text-xs font-semibold"
          >
            <Plus size={16} />
            <span>Add another column</span>
          </button>
        )}
      </div>

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
