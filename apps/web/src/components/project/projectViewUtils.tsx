import React from "react";
import { Project, ProjectColumn, Ticket, TicketPriority, UserProfile, WorkspaceMember } from "@orbit/types";
import { PriorityUp, PriorityMedium, PriorityDown, AlertTriangle, ChevronDown, Check } from "@/components/ui/icons";
import { DropdownSearch, NoMatches, matchesSearch } from "@/components/ui/DropdownSearch";

// Statuses are user-defined board columns, so their role is inferred from the column name.
export type ColumnKind = "done" | "review" | "progress" | "todo";

export function columnKind(column: Pick<ProjectColumn, "name">, isLast: boolean): ColumnKind {
  const n = column.name.toLowerCase();
  if (/done|complete|closed|resolved|shipped/.test(n)) return "done";
  if (/review|qa|testing|verify/.test(n)) return "review";
  if (/progress|doing|active|working|develop/.test(n)) return "progress";
  return isLast && !/todo|to do|backlog|open/.test(n) ? "done" : "todo";
}

export function columnKinds(columns: ProjectColumn[]): Record<string, ColumnKind> {
  return Object.fromEntries(columns.map((c, i) => [c.id, columnKind(c, i === columns.length - 1)]));
}

export const columnColor = (column?: Pick<ProjectColumn, "color"> | null) => column?.color || "var(--theme-text-muted)";

export const ticketKey = (t: Ticket) => t.customId || (t.issueNumber ? `#${t.issueNumber}` : t.id.slice(0, 6));

export function ticketLabels(t: Ticket): { name: string; color?: string }[] {
  if (!Array.isArray(t.labels)) return [];
  return t.labels
    .map((l: any) => (typeof l === "string" ? { name: l } : { name: l?.name || l?.label || "", color: l?.color }))
    .filter((l: { name: string }) => l.name);
}

export function ticketAssignees(t: Ticket, members: WorkspaceMember[]): UserProfile[] {
  const byId = new Map(members.filter((m) => m.user).map((m) => [m.userId, m.user!]));
  const out: UserProfile[] = [];
  const add = (u?: UserProfile | null) => {
    if (u && !out.some((x) => x.id === u.id)) out.push(u);
  };
  add(t.assignee ?? (t.assigneeId ? byId.get(t.assigneeId) : null));
  if (Array.isArray(t.assignees)) t.assignees.forEach((a: any) => add(byId.get(a?.uid || a?.id || a?.userId)));
  return out;
}

type ProjectRoster = Pick<Project, "assignedEmployees" | "selectedManagers" | "createdById">;

/**
 * Workspace members who belong to a project: its assigned employees and managers (matched by uid,
 * or by display name for Firebase-imported entries), plus the creator and the current viewer.
 * A project with no roster at all is open to everyone. `alwaysInclude` keeps specific users
 * (e.g. a ticket's existing assignee) selectable even if they are no longer on the project.
 */
export function getProjectMembers(
  project: ProjectRoster | null | undefined,
  members: WorkspaceMember[],
  options: { currentUserId?: string; alwaysInclude?: (string | null | undefined)[] } = {},
): WorkspaceMember[] {
  if (!project) return members;
  const roster = [
    ...(Array.isArray(project.assignedEmployees) ? (project.assignedEmployees as any[]) : []),
    ...(Array.isArray(project.selectedManagers) ? (project.selectedManagers as any[]) : []),
  ];
  if (roster.length === 0) return members;

  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const m of members) {
    if (!m.user) continue;
    byId.set(m.user.id, m.user.id);
    if (m.user.displayName) byName.set(m.user.displayName.toLowerCase(), m.user.id);
  }

  const allowed = new Set<string>();
  for (const entry of roster) {
    if (!entry) continue;
    const uid = typeof entry === "string" ? undefined : entry.uid;
    const name = (typeof entry === "string" ? entry : entry.name || "").toLowerCase();
    const id = (uid && byId.get(uid)) || (name && byName.get(name));
    if (id) allowed.add(id);
  }
  for (const id of [project.createdById, options.currentUserId, ...(options.alwaysInclude ?? [])]) {
    if (id) allowed.add(id);
  }

  return members.filter((m) => m.user && allowed.has(m.user.id));
}

export const isOverdue = (t: Ticket, done: boolean, now = Date.now()) =>
  !done && !!t.dueDate && new Date(t.dueDate).getTime() < startOfDay(now);

export const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function projectTickets(project: Project): Ticket[] {
  return (project.columns || []).flatMap((c) => c.tickets || []);
}

// Fixed identity palette (avatars and labels) taken from the Figma screens; readable on light and dark surfaces.
const IDENTITY = [
  { bg: "#99F6E4", fg: "#0F766E" },
  { bg: "#FFE6D1", fg: "#8A3B00" },
  { bg: "#E1F3EA", fg: "#0F6B42" },
  { bg: "#FEF3C7", fg: "#B45309" },
  { bg: "#FFE0EA", fg: "#9B1C4B" },
  { bg: "#D5E6E2", fg: "#0F766E" },
];

export const identityColor = (seed: string) =>
  IDENTITY[seed.split("").reduce((h, c) => h + c.charCodeAt(0), 0) % IDENTITY.length];

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";

// Generated DiceBear avatars (/api/avatar/...) are placeholders; the design shows initials instead.
export const isUploadedAvatar = (src?: string | null): src is string =>
  !!src && !src.includes("/api/avatar/") && !src.includes("dicebear.com");

export const Avatar: React.FC<{
  name: string;
  src?: string | null;
  size?: number;
  ring?: string;
  className?: string;
}> = ({ name, src, size = 24, ring, className = "" }) => {
  const c = identityColor(name);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
  };
  return isUploadedAvatar(src) ? (
    <img src={src} alt={name} title={name} className={`rounded-full object-cover shrink-0 ${className}`} style={style} />
  ) : (
    <span
      title={name}
      className={`rounded-full shrink-0 flex items-center justify-center font-semibold ${className}`}
      style={{ ...style, backgroundColor: c.bg, color: c.fg, fontSize: Math.max(9, Math.round(size * 0.4)) }}
    >
      {initialsOf(name)}
    </span>
  );
};

// Semantic status colors from the Figma guideline (error / warning); low uses the theme primary.
export const PRIORITY_META: Record<
  TicketPriority,
  { label: string; color: string; bg: string; text: string; Icon: React.ElementType }
> = {
  URGENT: {
    label: "Urgent",
    color: "#DC2626",
    bg: "color-mix(in srgb, #DC2626 18%, transparent)",
    text: "color-mix(in srgb, #DC2626 80%, var(--theme-text))",
    Icon: AlertTriangle,
  },
  HIGH: {
    label: "High",
    color: "#DC2626",
    bg: "color-mix(in srgb, #DC2626 10%, transparent)",
    text: "color-mix(in srgb, #DC2626 80%, var(--theme-text))",
    Icon: PriorityUp,
  },
  MEDIUM: {
    label: "Medium",
    color: "#D97706",
    bg: "color-mix(in srgb, #D97706 14%, transparent)",
    text: "color-mix(in srgb, #D97706 70%, var(--theme-text))",
    Icon: PriorityMedium,
  },
  LOW: {
    label: "Low",
    color: "var(--theme-primary)",
    bg: "var(--theme-bg-surface)",
    text: "var(--theme-primary-hover)",
    Icon: PriorityDown,
  },
};

export const tint = (color: string, pct = 14) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

// Figma uses three pill sizes: board card (sm), list row (md), ticket panel (lg).
const PILL_SIZE = {
  sm: { cls: "h-5 px-[7px] rounded-[10px] text-[11px] gap-1", icon: 11 },
  md: { cls: "h-[22px] px-2 rounded-[11px] text-xs gap-1", icon: 11 },
  lg: { cls: "h-6 px-[9px] rounded-xl text-[11px] gap-[5px]", icon: 12 },
} as const;

export const PriorityPill: React.FC<{ priority: TicketPriority; size?: keyof typeof PILL_SIZE }> = ({
  priority,
  size = "md",
}) => {
  const m = PRIORITY_META[priority] ?? PRIORITY_META.MEDIUM;
  const s = PILL_SIZE[size];
  return (
    <span
      className={`inline-flex items-center font-semibold whitespace-nowrap shrink-0 ${s.cls}`}
      style={{ backgroundColor: m.bg, color: m.text }}
    >
      <m.Icon size={s.icon} />
      {m.label}
    </span>
  );
};

export const StatusBadge: React.FC<{ column?: ProjectColumn | null; height?: 22 | 24 }> = ({ column, height = 24 }) => {
  const color = columnColor(column);
  return (
    <span
      className="inline-flex items-center px-[9px] rounded-full text-[11px] font-semibold whitespace-nowrap max-w-full"
      style={{
        height,
        backgroundColor: tint(color, 16),
        color: `color-mix(in srgb, ${color} 55%, var(--theme-text))`,
      }}
    >
      <span className="truncate">{column?.name || "No status"}</span>
    </span>
  );
};

export const relativeTime = (iso: string, now = Date.now()) => {
  const at = new Date(iso).getTime();
  const diff = now - at;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (at >= startOfDay(now)) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (at >= startOfDay(now) - 86_400_000) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const ToolbarPill: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}> = ({ children, onClick, active, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="h-8 px-3 rounded-2xl border flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap transition hover:bg-[var(--theme-fill-hover)]"
    style={{
      borderColor: active ? "var(--theme-primary)" : "var(--theme-border)",
      backgroundColor: active ? "var(--theme-selected)" : "var(--theme-bg-app)",
      color: "var(--theme-text)",
    }}
  >
    {children}
  </button>
);

export const PrimaryPill: React.FC<{ children: React.ReactNode; onClick?: () => void; disabled?: boolean }> = ({
  children,
  onClick,
  disabled,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="h-8 px-3.5 rounded-2xl flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap transition hover:bg-[var(--theme-primary-hover)] disabled:opacity-50"
    style={{ backgroundColor: "var(--theme-primary)", color: "var(--theme-primary-text)" }}
  >
    {children}
  </button>
);

export const FilterMenu: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  // Always show the selected option without the "filter active" tint (e.g. a date range)
  plain?: boolean;
  // Show a search box at the top of the menu (useful for long lists such as people)
  searchable?: boolean;
  searchPlaceholder?: string;
}> = ({ label, value, options, onChange, icon, plain, searchable, searchPlaceholder }) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const selected = options.find((o) => o.value === value);
  const isSet = value !== "ALL";
  const visibleOptions = options.filter((o) => matchesSearch(o.label, query));
  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  return (
    <div ref={ref} className="relative shrink-0">
      <ToolbarPill onClick={() => setOpen((v) => !v)} active={isSet && !plain}>
        {icon}
        <span className="max-w-[140px] truncate">{isSet || plain ? selected?.label ?? label : label}</span>
        <ChevronDown size={14} style={{ color: "var(--theme-text-muted)" }} />
      </ToolbarPill>
      {open && (
        <div
          className={`absolute right-0 top-full mt-1.5 z-50 ${searchable ? "w-60" : "w-52"} max-h-72 overflow-y-auto rounded-xl border p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100`}
          style={{ backgroundColor: "var(--theme-bg-app)", borderColor: "var(--theme-border)" }}
        >
          {searchable && (
            <DropdownSearch
              value={query}
              onChange={setQuery}
              placeholder={searchPlaceholder || `Search ${label.toLowerCase()}…`}
              onEnter={() => visibleOptions[0] && choose(visibleOptions[0].value)}
              onEscape={() => setOpen(false)}
            />
          )}
          {visibleOptions.length === 0 && <NoMatches />}
          {visibleOptions.map((o) => (
            <button
              type="button"
              key={o.value}
              onClick={() => choose(o.value)}
              className="w-full h-8 px-2.5 rounded-lg flex items-center justify-between gap-2 text-[13px] text-left transition hover:bg-[var(--theme-fill-hover)]"
              style={{ color: "var(--theme-text)" }}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check size={12} style={{ color: "var(--theme-primary)" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export interface TicketFilters {
  query: string;
  assignee: string;
  priority: string;
  label: string;
}

export const EMPTY_FILTERS: TicketFilters = { query: "", assignee: "ALL", priority: "ALL", label: "ALL" };

export function matchesFilters(
  t: Ticket,
  f: TicketFilters,
  members: WorkspaceMember[],
  currentUserId?: string,
): boolean {
  if (f.query.trim()) {
    const q = f.query.toLowerCase();
    if (
      !t.title.toLowerCase().includes(q) &&
      !(t.description || "").toLowerCase().includes(q) &&
      !ticketKey(t).toLowerCase().includes(q)
    )
      return false;
  }
  if (f.priority !== "ALL" && t.priority !== f.priority) return false;
  if (f.label !== "ALL" && !ticketLabels(t).some((l) => l.name === f.label)) return false;
  if (f.assignee !== "ALL") {
    const ids = ticketAssignees(t, members).map((u) => u.id);
    if (f.assignee === "UNASSIGNED") return ids.length === 0;
    return ids.includes(f.assignee === "ME" ? currentUserId ?? "" : f.assignee);
  }
  return true;
}

export const commentCount = (t: Ticket) =>
  (t as any)._count?.comments ?? (Array.isArray((t as any).comments) ? (t as any).comments.length : 0);

export const StatusPill: React.FC<{ column?: ProjectColumn | null }> = ({ column }) => {
  const color = columnColor(column);
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 px-[9px] rounded-xl text-xs font-semibold whitespace-nowrap max-w-full"
      style={{ backgroundColor: tint(color, 16), color: `color-mix(in srgb, ${color} 55%, var(--theme-text))` }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="truncate">{column?.name || "No status"}</span>
    </span>
  );
};

export const LabelChip: React.FC<{ name: string; color?: string; pill?: boolean }> = ({ name, color, pill }) => {
  const c = color ? { bg: tint(color, 18), fg: color } : identityColor(name);
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold whitespace-nowrap shrink-0 ${
        pill ? "h-6 px-[9px] rounded-xl" : "h-5 px-2 rounded-md"
      }`}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {name}
    </span>
  );
};
