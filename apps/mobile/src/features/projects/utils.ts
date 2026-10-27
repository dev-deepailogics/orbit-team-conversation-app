import type { WorkspaceMember } from '@orbit/types';
import type { ChecklistItem, PersonRef, Project, ProjectColumn, StatusFilter, Ticket, TicketEvent, TicketPriority } from './types';

export const PRIORITIES: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: '#6B7280' },
  { value: 'MEDIUM', label: 'Medium', color: '#3B82F6' },
  { value: 'HIGH', label: 'High', color: '#F59E0B' },
  { value: 'URGENT', label: 'Urgent', color: '#EF4444' },
];

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'delivered', label: 'Delivered' },
];

export const COLUMN_COLORS = ['#6B7280', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const priorityMeta = (p: TicketPriority) => PRIORITIES.find(x => x.value === p) ?? PRIORITIES[1];

// Ticket JSON fields are `any` on the server (imported from Firebase); guard every read.
export function getChecklist(t: Pick<Ticket, 'checklist'>): ChecklistItem[] {
  return Array.isArray(t.checklist) ? t.checklist.filter((i: ChecklistItem) => i && typeof i.text === 'string') : [];
}

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter(i => i.completed).length, total: items.length };
}

// Labels arrive as strings or {name|text|label} objects.
export function getLabels(t: Pick<Ticket, 'labels'>): string[] {
  if (!Array.isArray(t.labels)) return [];
  return t.labels
    .map((l: unknown) => (typeof l === 'string' ? l : ((l as any)?.name ?? (l as any)?.text ?? (l as any)?.label)))
    .filter((l): l is string => typeof l === 'string' && l.trim().length > 0);
}

export function getEvents(t: Pick<Ticket, 'events'>): TicketEvent[] {
  return Array.isArray(t.events) ? [...t.events].reverse() : [];
}

export function getWatchers(t: Pick<Ticket, 'watchers'>): string[] {
  return Array.isArray(t.watchers) ? t.watchers : [];
}

// '2026-03-01' → ISO date the server stores; '' → null (clears). Returns undefined when invalid.
export function parseDueInput(input: string): string | null | undefined {
  const v = input.trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? undefined : d.toISOString();
}

export const dueToInput = (due: string | null | undefined) => (due ? due.slice(0, 10) : '');

export function isOverdue(due: string | null | undefined, now = new Date()): boolean {
  if (!due) return false;
  return due.slice(0, 10) < now.toISOString().slice(0, 10);
}

export function formatDue(due: string): string {
  const d = new Date(due);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function ticketRef(t: Ticket): string {
  return t.customId || (t.issueNumber ? `#${t.issueNumber}` : '');
}

export function filterTickets(tickets: Ticket[], query: string): Ticket[] {
  const q = query.trim().toLowerCase();
  if (!q) return tickets;
  return tickets.filter(
    t =>
      t.title.toLowerCase().includes(q) ||
      ticketRef(t).toLowerCase().includes(q) ||
      (t.assignee?.displayName ?? '').toLowerCase().includes(q),
  );
}

export function findTicket(project: Project | null, ticketId: string): Ticket | undefined {
  for (const c of project?.columns ?? []) {
    const t = c.tickets?.find(x => x.id === ticketId);
    if (t) return t;
  }
}

// Same semantics as the web store: remove from source, insert at the clamped index of the target.
export function moveTicketInColumns(
  columns: ProjectColumn[],
  ticket: Ticket,
  toColumnId: string,
  index: number,
): ProjectColumn[] {
  return columns.map(col => {
    const rest = (col.tickets ?? []).filter(t => t.id !== ticket.id);
    if (col.id !== toColumnId) return { ...col, tickets: rest };
    rest.splice(Math.max(0, Math.min(index, rest.length)), 0, { ...ticket, columnId: toColumnId });
    return { ...col, tickets: rest };
  });
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export const memberName = (m: WorkspaceMember) => m.nickname || m.user?.displayName || m.user?.username || 'Member';

// Project.assignedEmployees comes from the web form ({ name, uid }) or the Firebase import (name only);
// resolve each to a real workspace member so we only ever offer people who can be assigned.
export function projectMembers(project: Pick<Project, 'assignedEmployees'> | null, members: WorkspaceMember[]): PersonRef[] {
  const list: any[] = Array.isArray(project?.assignedEmployees) ? project!.assignedEmployees : [];
  const seen = new Set<string>();
  const out: PersonRef[] = [];
  for (const e of list) {
    const m = members.find(x => x.userId === e?.uid) ?? members.find(x => memberName(x) === e?.name);
    if (m && !seen.has(m.userId)) {
      seen.add(m.userId);
      out.push({ uid: m.userId, name: memberName(m) });
    }
  }
  return out;
}

// Multi-assign lives in Ticket.assignees; older tickets only have the single assignee relation.
export function getAssignees(t: Pick<Ticket, 'assignees' | 'assignee'>): PersonRef[] {
  if (Array.isArray(t.assignees) && t.assignees.length) {
    return t.assignees.filter((a: PersonRef) => a && typeof a.uid === 'string').map((a: PersonRef) => ({ uid: a.uid, name: a.name || 'Member' }));
  }
  return t.assignee ? [{ uid: t.assignee.id, name: t.assignee.displayName }] : [];
}
