"use client";

import React, { useMemo, useState } from "react";
import { Project, Ticket, WorkspaceMember } from "@orbit/types";
import { ChevronDown, Check, Calendar, SortDown, Loader2 } from "@/components/ui/icons";
import {
  Avatar,
  LabelChip,
  PriorityPill,
  StatusPill,
  columnKinds,
  formatShortDate,
  isOverdue,
  ticketAssignees,
  ticketKey,
  ticketLabels,
} from "./projectViewUtils";

interface ProjectListViewProps {
  project: Project;
  members: WorkspaceMember[];
  loadingAll: boolean;
  filterTicket: (ticket: Ticket) => boolean;
  onOpenTicket: (ticket: Ticket) => void;
}

const GRID = "grid grid-cols-[104px_minmax(220px,1fr)_128px_104px_160px_152px_104px] items-center px-4";
const DONE_GREEN = "#1F9D63";
const DANGER = "#DC2626";

export const ProjectListView: React.FC<ProjectListViewProps> = ({
  project,
  members,
  loadingAll,
  filterTicket,
  onOpenTicket,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dueSort, setDueSort] = useState<"none" | "asc" | "desc">("none");

  const columns = project.columns || [];
  const kinds = useMemo(() => columnKinds(columns), [columns]);

  const sortTickets = (list: Ticket[]) => {
    if (dueSort === "none") return [...list].sort((a, b) => a.orderIndex - b.orderIndex);
    const dir = dueSort === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return dir * (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    });
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto px-3 sm:px-6 py-4" style={{ backgroundColor: "var(--theme-bg-app)" }}>
      <div
        className="min-w-[1000px] rounded-xl border overflow-hidden"
        style={{
          backgroundColor: "var(--theme-bg-app)",
          borderColor: "var(--theme-border)",
          boxShadow: "0 1px 2px rgba(20, 26, 46, 0.05)",
        }}
      >
        <div
          className={`${GRID} h-10 border-b text-xs font-semibold tracking-[0.3px]`}
          style={{
            backgroundColor: "var(--theme-bg-surface)",
            borderColor: "var(--theme-border)",
            color: "var(--theme-text-muted)",
          }}
        >
          <span>Key</span>
          <span>Summary</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Labels</span>
          <span>Assignee</span>
          <button
            onClick={() => setDueSort((s) => (s === "none" ? "asc" : s === "asc" ? "desc" : "none"))}
            className="flex items-center gap-1 text-left font-semibold tracking-[0.3px] hover:opacity-80"
            title="Sort by due date"
          >
            Due date
            <SortDown
              size={12}
              className={dueSort === "desc" ? "rotate-180" : ""}
              style={{ opacity: dueSort === "none" ? 0.45 : 1 }}
            />
          </button>
        </div>

        {columns.map((column) => {
          const tickets = sortTickets((column.tickets || []).filter(filterTicket));
          const open = !collapsed[column.id];
          const done = kinds[column.id] === "done";
          return (
            <React.Fragment key={column.id}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [column.id]: open }))}
                className="w-full h-10 px-4 border-b flex items-center gap-2 text-left"
                style={{ backgroundColor: "var(--theme-bg-surface-hover)", borderColor: "var(--theme-border)" }}
              >
                <ChevronDown
                  size={16}
                  className={`transition-transform ${open ? "" : "-rotate-90"}`}
                  style={{ color: "var(--theme-text-muted)" }}
                />
                <span className="text-[13px] font-bold" style={{ color: "var(--theme-text)" }}>
                  {column.name}
                </span>
                <span
                  className="h-5 min-w-5 px-[7px] rounded-[10px] flex items-center justify-center text-xs font-semibold"
                  style={{ backgroundColor: "var(--theme-border)", color: "var(--theme-text-muted)" }}
                >
                  {tickets.length}
                </span>
              </button>

              {open &&
                tickets.map((t) => {
                  const people = ticketAssignees(t, members);
                  const overdue = isOverdue(t, done);
                  return (
                    <div
                      key={t.id}
                      onClick={() => onOpenTicket(t)}
                      className={`${GRID} h-12 border-b cursor-pointer transition-colors hover:bg-[var(--theme-fill-hover)]`}
                      style={{ borderColor: "var(--theme-border)" }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: done ? DONE_GREEN : "var(--theme-selected)",
                            color: done ? "#FFFFFF" : "var(--theme-text-muted)",
                          }}
                        >
                          <Check size={10} />
                        </span>
                        <span className="text-[13px] font-medium truncate" style={{ color: "var(--theme-text-muted)" }}>
                          {ticketKey(t)}
                        </span>
                      </span>
                      <span
                        className="text-sm font-medium truncate pr-4"
                        style={{ color: done ? "var(--theme-text-muted)" : "var(--theme-text)" }}
                        title={t.title}
                      >
                        {t.title}
                      </span>
                      <span className="min-w-0 pr-2">
                        <StatusPill column={column} />
                      </span>
                      <span>
                        <PriorityPill priority={t.priority} />
                      </span>
                      <span className="flex items-center gap-1.5 min-w-0 overflow-hidden pr-2">
                        {ticketLabels(t)
                          .slice(0, 2)
                          .map((l) => (
                            <LabelChip key={l.name} name={l.name} color={l.color} />
                          ))}
                      </span>
                      <span className="flex items-center gap-2 min-w-0 pr-2">
                        {people.length > 0 ? (
                          <>
                            <Avatar name={people[0].displayName} src={people[0].avatarUrl} size={24} />
                            <span className="text-[13px] font-medium truncate" style={{ color: "var(--theme-text)" }}>
                              {people[0].displayName}
                              {people.length > 1 && (
                                <span style={{ color: "var(--theme-text-muted)" }}> +{people.length - 1}</span>
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="text-[13px]" style={{ color: "var(--theme-text-muted)" }}>
                            Unassigned
                          </span>
                        )}
                      </span>
                      <span
                        className={`flex items-center gap-1.5 text-[13px] ${overdue ? "font-semibold" : "font-medium"}`}
                        style={{ color: overdue ? DANGER : "var(--theme-text-muted)" }}
                      >
                        {t.dueDate ? (
                          <>
                            <Calendar size={14} />
                            {formatShortDate(t.dueDate)}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                  );
                })}
            </React.Fragment>
          );
        })}

        {loadingAll && (
          <div className="h-12 flex items-center justify-center gap-2 text-[13px]" style={{ color: "var(--theme-text-muted)" }}>
            <Loader2 size={14} className="animate-spin" />
            Loading all tickets…
          </div>
        )}
        {!loadingAll && columns.length === 0 && (
          <div className="h-24 flex items-center justify-center text-[13px]" style={{ color: "var(--theme-text-muted)" }}>
            This project has no columns yet.
          </div>
        )}
      </div>
    </div>
  );
};
