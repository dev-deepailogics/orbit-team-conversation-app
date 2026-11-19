"use client";

import React, { useMemo, useState } from "react";
import { Project, Ticket, UserProfile, WorkspaceMember } from "@orbit/types";
import {
  Board,
  Check,
  Clock,
  AlertTriangle,
  StatusReview,
  StatusProgress,
  StatusTodo,
} from "@/components/ui/icons";
import { useProjectStore } from "../../stores/projectStore";
import {
  Avatar,
  ColumnKind,
  columnKinds,
  isOverdue,
  projectTickets,
  relativeTime,
  startOfDay,
  ticketAssignees,
  ticketKey,
  tint,
} from "./projectViewUtils";

interface ProjectSummaryViewProps {
  project: Project;
  members: WorkspaceMember[];
  currentUser: UserProfile | null;
  rangeDays: number;
  onOpenTicket: (ticket: Ticket) => void;
}

interface TicketEvent {
  type?: string;
  action?: string;
  user?: string;
  date?: string;
}

const DAY = 86_400_000;
const SUCCESS = "#1F9D63";
const WARNING = "#D97706";
const REVIEW = "#D9820B";
const DANGER = "#DC2626";
const TODO = "color-mix(in srgb, var(--theme-text-muted) 65%, var(--theme-bg-app))";

// Figma "Status overview" groups every column into four fixed buckets.
const BUCKETS: { kind: ColumnKind; label: string; color: string }[] = [
  { kind: "done", label: "Done", color: SUCCESS },
  { kind: "review", label: "In review", color: REVIEW },
  { kind: "progress", label: "In progress", color: "var(--theme-primary)" },
  { kind: "todo", label: "To do", color: TODO },
];

const BucketIcon: React.FC<{ kind: ColumnKind }> = ({ kind }) =>
  kind === "done" ? (
    <span
      className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: SUCCESS, color: "#FFFFFF" }}
    >
      <Check size={9} />
    </span>
  ) : kind === "review" ? (
    <StatusReview size={14} color={REVIEW} />
  ) : kind === "progress" ? (
    <StatusProgress size={14} color="var(--theme-primary)" />
  ) : (
    <StatusTodo size={14} color={TODO} />
  );

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--theme-bg-app)",
  borderColor: "var(--theme-border)",
  boxShadow: "0 1px 1px rgba(20, 26, 46, 0.05)",
};

const statusTarget = (e: TicketEvent) => e.action?.match(/ to (.+)$/i)?.[1]?.trim();

export const ProjectSummaryView: React.FC<ProjectSummaryViewProps> = ({
  project,
  members,
  currentUser,
  rangeDays,
  onOpenTicket,
}) => {
  const [showAllActivity, setShowAllActivity] = useState(false);
  const allProjects = useProjectStore((s) => s.projects);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);

  const columns = project.columns || [];
  const kinds = useMemo(() => columnKinds(columns), [columns]);
  const tickets = useMemo(() => projectTickets(project), [project]);
  const now = Date.now();

  const stats = useMemo(() => {
    const kindOf = (t: Ticket): ColumnKind => kinds[t.columnId] ?? "todo";
    const doneNames = new Set(columns.filter((c) => kinds[c.id] === "done").map((c) => c.name.toLowerCase()));
    const count = (k: ColumnKind) => tickets.filter((t) => kindOf(t) === k).length;

    const completionDates: number[] = [];
    const activity: { ticket: Ticket; event: TicketEvent; at: number }[] = [];
    for (const t of tickets) {
      const events: TicketEvent[] = Array.isArray(t.events) ? t.events : [];
      for (const e of events) {
        if (!e.date) continue;
        const at = new Date(e.date).getTime();
        activity.push({ ticket: t, event: e, at });
        const target = statusTarget(e);
        if (e.type === "status_change" && target && doneNames.has(target.toLowerCase())) completionDates.push(at);
      }
    }
    activity.sort((a, b) => b.at - a.at);

    const today = startOfDay(now);
    const days = Array.from({ length: 7 }, (_, i) => {
      const start = today - (6 - i) * DAY;
      return {
        label: new Date(start).toLocaleDateString(undefined, { weekday: "short" }),
        isToday: i === 6,
        count: completionDates.filter((d) => d >= start && d < start + DAY).length,
      };
    });

    const notDone = tickets.filter((t) => kindOf(t) !== "done");
    const dueBetween = (from: number, to: number) =>
      notDone.filter((t) => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate).getTime();
        return due >= from && due < to;
      }).length;
    return {
      total: tickets.length,
      byKind: {
        done: count("done"),
        review: count("review"),
        progress: count("progress"),
        todo: count("todo"),
      } as Record<ColumnKind, number>,
      overdue: notDone.filter((t) => isOverdue(t, false, now)).length,
      dueIn48h: dueBetween(today, now + 2 * DAY),
      dueThisWeek: dueBetween(today, today + 7 * DAY),
      completedThisWeek: completionDates.filter((d) => d >= today - 6 * DAY).length,
      days,
      activity: activity.filter((a) => a.at >= now - rangeDays * DAY),
      doneNames,
    };
  }, [tickets, columns, kinds, rangeDays, now]);

  const pct = (n: number) => (stats.total ? Math.round((n / stats.total) * 100) : 0);
  const pctDone = pct(stats.byKind.done);
  const maxDay = Math.max(1, ...stats.days.map((d) => d.count));
  const weekTotal = stats.days.reduce((a, d) => a + d.count, 0);
  const activeProjects = allProjects.filter((p) => (p.status || "active").toLowerCase() === "active");
  const projectTeam = useMemo(() => {
    const seen = new Map<string, UserProfile>();
    tickets.forEach((t) => ticketAssignees(t, members).forEach((u) => seen.set(u.id, u)));
    return Array.from(seen.values());
  }, [tickets, members]);

  const memberByName = (name?: string) =>
    members.find((m) => m.user && (m.user.displayName === name || m.user.username === name))?.user;
  const isMe = (name?: string) => !!currentUser && (name === currentUser.displayName || name === currentUser.username);

  const openProject = (p: Project) => {
    if (p.id === project.id) return;
    setCurrentProject(p);
    window.history.replaceState(null, "", `?projectId=${p.id}`);
  };

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 flex flex-col gap-3.5"
      style={{ backgroundColor: "var(--theme-bg-surface)" }}
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total tickets"
          value={stats.total}
          note={`across ${columns.length} ${columns.length === 1 ? "status" : "statuses"}`}
          Icon={Board}
          iconColor="var(--theme-text-muted)"
          iconBg="var(--theme-bg-surface)"
        />
        <StatCard
          title="Completed"
          value={stats.byKind.done}
          note={`+${stats.completedThisWeek} this week`}
          noteColor={stats.completedThisWeek ? SUCCESS : undefined}
          Icon={Check}
          iconColor={SUCCESS}
        />
        <StatCard
          title="In progress"
          value={stats.byKind.progress}
          note={`${stats.byKind.review} more in review`}
          Icon={Clock}
          iconColor={WARNING}
        />
        <StatCard
          title="Overdue"
          value={stats.overdue}
          note={`${stats.dueIn48h} due in 48 hours`}
          noteColor={stats.overdue || stats.dueIn48h ? DANGER : undefined}
          Icon={AlertTriangle}
          iconColor={DANGER}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start">
        {/* Status overview */}
        <section className="flex-1 min-w-0 rounded-[14px] border p-5 flex flex-col gap-4" style={cardStyle}>
          <CardTitle
            title="Status overview"
            subtitle={`${stats.total} ${stats.total === 1 ? "ticket" : "tickets"} · ${pctDone}% complete`}
          />
          <div className="h-3 rounded-md overflow-hidden flex" style={{ backgroundColor: "var(--theme-bg-surface-hover)" }}>
            {BUCKETS.map((b) =>
              stats.byKind[b.kind] ? (
                <div
                  key={b.kind}
                  title={`${b.label}: ${stats.byKind[b.kind]}`}
                  style={{ width: `${pct(stats.byKind[b.kind])}%`, backgroundColor: b.color }}
                />
              ) : null,
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {BUCKETS.map((b) => (
              <div key={b.kind} className="rounded-[10px] p-3 flex flex-col gap-1 min-w-0" style={{ backgroundColor: "var(--theme-bg-surface)" }}>
                <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--theme-text)" }}>
                  <BucketIcon kind={b.kind} />
                  {b.label}
                </span>
                <span className="flex items-end gap-1.5">
                  <span className="text-[22px] font-bold leading-none" style={{ color: "var(--theme-text)" }}>
                    {stats.byKind[b.kind]}
                  </span>
                  <span className="text-xs font-medium" style={{ color: "var(--theme-text-muted)" }}>
                    {pct(stats.byKind[b.kind])}%
                  </span>
                </span>
              </div>
            ))}
          </div>
          {(stats.dueThisWeek > 0 || stats.overdue > 0) && (
            <div
              className="rounded-[10px] p-3 flex items-center gap-2 text-[13px]"
              style={{ backgroundColor: tint(WARNING, 10), color: `color-mix(in srgb, ${WARNING} 55%, var(--theme-text))` }}
            >
              <Clock size={16} />
              <span className="flex-1">
                {stats.dueThisWeek} {stats.dueThisWeek === 1 ? "ticket is" : "tickets are"} due this week.
                {stats.overdue > 0 && ` ${stats.overdue} ${stats.overdue === 1 ? "is" : "are"} already overdue.`}
              </span>
            </div>
          )}
        </section>

        {/* Tasks completed */}
        <section className="lg:w-[440px] shrink-0 rounded-[14px] border p-5 flex flex-col gap-4" style={cardStyle}>
          <CardTitle title="Tasks completed" subtitle={`Last 7 days · ${weekTotal} total`} />
          <div className="h-[104px] flex items-end justify-between">
            {stats.days.map((d, i) => (
              <div key={i} className="flex flex-col items-center justify-end gap-1.5">
                <span
                  className="text-xs font-semibold"
                  style={{ color: d.isToday ? "var(--theme-primary-hover)" : "var(--theme-text-muted)" }}
                >
                  {d.count}
                </span>
                <span
                  className="w-[30px] rounded-md"
                  style={{
                    height: d.count ? Math.max(8, Math.round((d.count / maxDay) * 70)) : 4,
                    backgroundColor: d.count
                      ? d.isToday
                        ? "var(--theme-primary-hover)"
                        : "var(--theme-primary)"
                      : "var(--theme-border)",
                  }}
                />
                <span className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start">
        {/* Recent activity */}
        <section className="flex-1 min-w-0 rounded-[14px] border p-5 flex flex-col gap-4" style={cardStyle}>
          <div className="flex items-center justify-between">
            <CardTitle title="Recent activity" subtitle="What changed on this project" />
            {stats.activity.length > 5 && (
              <button
                onClick={() => setShowAllActivity((v) => !v)}
                className="text-[13px] font-semibold hover:underline"
                style={{ color: "var(--theme-primary-hover)" }}
              >
                {showAllActivity ? "Show less" : "View all"}
              </button>
            )}
          </div>
          <div className="flex flex-col">
            {stats.activity.length === 0 && (
              <p className="text-[13px] py-2" style={{ color: "var(--theme-text-muted)" }}>
                No activity in the last {rangeDays} days.
              </p>
            )}
            {stats.activity.slice(0, showAllActivity ? 30 : 5).map(({ ticket, event, at }, i, arr) => {
              const target = statusTarget(event);
              const completed = event.type === "status_change" && !!target && stats.doneNames.has(target.toLowerCase());
              const who = isMe(event.user) ? "You" : event.user || "Someone";
              const verb =
                event.type === "created"
                  ? "created"
                  : completed
                    ? "completed"
                    : event.type === "status_change"
                      ? "moved"
                      : (event.action || "updated").toLowerCase();
              const person = memberByName(event.user);
              return (
                <div
                  key={`${ticket.id}-${at}-${i}`}
                  className={`min-h-9 py-1 flex items-center gap-2.5 ${i < arr.length - 1 ? "border-b" : ""}`}
                  style={{ borderColor: "var(--theme-border)" }}
                >
                  <Avatar name={event.user || "?"} src={person?.avatarUrl} size={28} />
                  <div className="flex-1 min-w-0 flex items-center gap-[5px] flex-wrap text-[13px]">
                    <span className="font-bold" style={{ color: "var(--theme-text)" }}>
                      {who}
                    </span>
                    <span style={{ color: "var(--theme-text-muted)" }}>{verb}</span>
                    <button
                      onClick={() => onOpenTicket(ticket)}
                      className="h-[22px] px-2 rounded-md text-xs font-semibold truncate max-w-[260px] hover:brightness-95"
                      style={{ backgroundColor: "var(--theme-bg-surface)", color: "var(--theme-primary-hover)" }}
                      title={ticket.title}
                    >
                      {ticketKey(ticket)} {ticket.title}
                    </button>
                    {verb === "moved" && target && <span style={{ color: "var(--theme-text-muted)" }}>to {target}</span>}
                  </div>
                  <span className="text-xs shrink-0" style={{ color: "var(--theme-text-muted)" }}>
                    {relativeTime(new Date(at).toISOString(), now)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Active projects */}
        <section className="lg:w-[440px] shrink-0 rounded-[14px] border p-5 flex flex-col gap-4" style={cardStyle}>
          <CardTitle title="Active projects" subtitle={`${activeProjects.length} in progress`} />
          {activeProjects.map((p) => {
            const isCurrent = p.id === project.id;
            const count = isCurrent ? stats.total : p._count?.tickets ?? 0;
            return (
              <button
                key={p.id}
                onClick={() => openProject(p)}
                className="rounded-xl border px-3.5 py-3 flex flex-col gap-2 text-left transition hover:brightness-[0.98]"
                style={{
                  backgroundColor: "var(--theme-bg-surface)",
                  borderColor: isCurrent
                    ? "color-mix(in srgb, var(--theme-primary) 40%, transparent)"
                    : "var(--theme-border)",
                  cursor: isCurrent ? "default" : "pointer",
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "var(--theme-bg-app)", color: "var(--theme-text-muted)" }}
                    >
                      <Board size={16} />
                    </span>
                    <span className="text-sm font-bold truncate" style={{ color: "var(--theme-text)" }}>
                      {p.name}
                    </span>
                  </span>
                  {isCurrent && (
                    <span className="text-sm font-bold" style={{ color: "var(--theme-primary-hover)" }}>
                      {pctDone}%
                    </span>
                  )}
                </span>
                {isCurrent && (
                  <span className="h-2 rounded overflow-hidden" style={{ backgroundColor: "var(--theme-bg-app)" }}>
                    <span className="block h-full" style={{ width: `${pctDone}%`, backgroundColor: "var(--theme-primary)" }} />
                  </span>
                )}
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center">
                    {isCurrent &&
                      projectTeam.slice(0, 4).map((u, i) => (
                        <Avatar
                          key={u.id}
                          name={u.displayName}
                          src={u.avatarUrl}
                          size={24}
                          ring="var(--theme-bg-surface)"
                          className={i ? "-ml-1.5" : ""}
                        />
                      ))}
                  </span>
                  <span className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
                    {count} {count === 1 ? "ticket" : "tickets"}
                  </span>
                </span>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
};

const CardTitle: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="flex flex-col gap-0.5">
    <h3 className="text-[15px] font-bold" style={{ color: "var(--theme-text)" }}>
      {title}
    </h3>
    <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
      {subtitle}
    </p>
  </div>
);

const StatCard: React.FC<{
  title: string;
  value: number;
  note: string;
  noteColor?: string;
  Icon: React.ElementType;
  iconColor: string;
  iconBg?: string;
}> = ({ title, value, note, noteColor, Icon, iconColor, iconBg }) => (
  <div className="rounded-[14px] border px-4 py-3.5 flex flex-col gap-1 min-w-0" style={cardStyle}>
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-medium" style={{ color: "var(--theme-text-muted)" }}>
        {title}
      </span>
      <span
        className="w-8 h-8 rounded-[10px] flex items-center justify-center"
        style={{ backgroundColor: iconBg ?? tint(iconColor, 14), color: iconColor }}
      >
        <Icon size={18} />
      </span>
    </div>
    <span className="text-[30px] font-bold leading-9" style={{ color: "var(--theme-text)" }}>
      {value}
    </span>
    <span className="text-xs font-medium truncate" style={{ color: noteColor ?? "var(--theme-text-muted)" }}>
      {note}
    </span>
  </div>
);
