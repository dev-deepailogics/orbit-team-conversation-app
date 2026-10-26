'use client';

import React from 'react';
import { X, Clock } from 'lucide-react';
import { WorkspaceMember, ProjectColumn } from '@orbit/types';

interface IssueTimelineModalProps {
  ticket: any;
  members?: WorkspaceMember[];
  columns?: ProjectColumn[];
  onClose: () => void;
}

export const IssueTimelineModal: React.FC<IssueTimelineModalProps> = ({
  ticket,
  members = [],
  columns = [],
  onClose,
}) => {
  // Helper to resolve user name by ID
  const getUserName = (userIdOrName?: string) => {
    if (!userIdOrName) return 'Team Member';
    // If it's already a human name (contains space or doesn't look like an alphanumeric hash)
    if (userIdOrName.includes(' ') && !userIdOrName.startsWith('evt-')) {
      return userIdOrName;
    }

    const member = members.find(
      (m: any) =>
        m.userId === userIdOrName ||
        m.user?.id === userIdOrName ||
        m.id === userIdOrName
    );
    if (member) {
      return (
        member.user?.displayName ||
        member.user?.username ||
        userIdOrName
      );
    }

    if (ticket.creator?.id === userIdOrName && ticket.creator?.displayName) {
      return ticket.creator.displayName;
    }
    if (ticket.assignee?.id === userIdOrName && ticket.assignee?.displayName) {
      return ticket.assignee.displayName;
    }

    return userIdOrName;
  };

  // Helper to resolve status/column name
  const getColumnName = (colIdOrSlug?: string) => {
    if (!colIdOrSlug) return 'todo';
    const col = columns.find(
      (c) =>
        c.id === colIdOrSlug ||
        c.name.toLowerCase() === colIdOrSlug.toLowerCase()
    );
    return col ? col.name : colIdOrSlug;
  };

  const rawEvents = Array.isArray(ticket.events) ? ticket.events : [];

  const timelineItems =
    rawEvents.length > 0
      ? rawEvents.map((ev: any, idx: number) => {
          // Firebase schema: { eventType, fromStatus, toStatus, changeBy, timestamp }
          // Orbit schema: { type, action, user, date, color }
          const eventType = ev.eventType || ev.type || 'status_change';
          const toStatus = getColumnName(ev.toStatus || ev.columnName);
          const fromStatus = ev.fromStatus ? getColumnName(ev.fromStatus) : null;
          const user = getUserName(ev.changeBy || ev.user || ev.by);
          const date = ev.timestamp || ev.date || ev.createdAt;

          let action = ev.action;
          if (!action) {
            if (eventType === 'issue_created' || eventType === 'created') {
              action = `Created to ${toStatus}`;
            } else if (fromStatus) {
              action = `Status Change from ${fromStatus} to ${toStatus}`;
            } else {
              action = `Status Change to ${toStatus}`;
            }
          }

          const isCreated = eventType === 'issue_created' || eventType === 'created';
          const color = ev.color || (isCreated ? '#3B82F6' : '#10B981');

          return {
            id: ev.id || `ev-${idx}`,
            action,
            user,
            date,
            color,
          };
        })
      : [
          {
            id: 'created',
            action: `Created to ${ticket.column?.name || 'todo'}`,
            user: ticket.creator?.displayName || 'Team Member',
            date: ticket.createdAt,
            color: '#3B82F6',
          },
          ...(ticket.updatedAt && ticket.updatedAt !== ticket.createdAt
            ? [
                {
                  id: 'updated',
                  action: `Status Change to ${ticket.column?.name || 'todo'}`,
                  user: ticket.assignee?.displayName || ticket.creator?.displayName || 'Team Member',
                  date: ticket.updatedAt,
                  color: '#10B981',
                },
              ]
            : []),
        ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--theme-bg-surface, #1e293b)',
          borderColor: 'var(--theme-border, #334155)',
          color: 'var(--theme-text-primary, #ffffff)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between pb-3 border-b"
          style={{ borderColor: 'var(--theme-border, #334155)' }}
        >
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-blue-400" />
            <h3 className="text-base font-bold text-white">Issue Timeline</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Timeline Items */}
        <div className="py-2 pl-2 space-y-6 max-h-[420px] overflow-y-auto">
          {timelineItems.map((item: any, idx: number) => {
            const isLast = idx === timelineItems.length - 1;
            const timeFormatted = new Date(item.date || Date.now()).toLocaleString(
              undefined,
              {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              }
            );

            return (
              <div
                key={item.id || idx}
                className="relative flex items-start gap-4 text-xs group"
              >
                {/* Vertical connecting line */}
                {!isLast && (
                  <div className="absolute left-[138px] top-4 bottom-[-24px] w-0.5 bg-slate-700/60" />
                )}

                {/* Left Timestamp */}
                <div className="w-[124px] text-right font-medium text-slate-400 shrink-0 select-none text-[11px] pt-0.5">
                  {timeFormatted}
                </div>

                {/* Colored Timeline Node */}
                <div className="relative z-10 shrink-0 pt-0.5">
                  <div
                    className="w-3.5 h-3.5 rounded-full border-2 bg-slate-900 flex items-center justify-center ring-2 ring-slate-900"
                    style={{
                      borderColor: item.color,
                      backgroundColor: item.color,
                    }}
                  />
                </div>

                {/* Right Description */}
                <div className="flex-1 min-w-0 pt-0.5 leading-relaxed text-slate-200">
                  <span className="font-bold text-white">{item.action}</span>
                  <span className="text-slate-400"> by </span>
                  <span className="font-semibold text-white">{item.user}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Close Button */}
        <div
          className="flex justify-end pt-3 border-t"
          style={{ borderColor: 'var(--theme-border, #334155)' }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
