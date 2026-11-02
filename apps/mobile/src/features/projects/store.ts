import { create } from 'zustand';
import { getErrorMessage } from '@/lib/api';
import { getProject, getProjects } from './services/projectApi';
import type { Project, ProjectColumn, StatusFilter, Ticket } from './types';
import { moveTicketInColumns } from './utils';

interface ProjectState {
  projects: Project[];
  current: Project | null;
  isLoading: boolean;
  error: string;
  loadProjects: (workspaceId: string, status?: StatusFilter) => Promise<void>;
  openProject: (projectId: string) => Promise<void>;
  closeProject: () => void;

  // Realtime + optimistic mutators (all no-ops when the data isn't loaded).
  upsertProject: (p: Project) => void;
  removeProject: (projectId: string) => void;
  addColumn: (c: ProjectColumn) => void;
  updateColumn: (c: ProjectColumn) => void;
  removeColumn: (columnId: string) => void;
  setColumnOrder: (projectId: string, ids: string[]) => void;
  addTicket: (t: Ticket) => void;
  updateTicket: (t: Ticket) => void;
  removeTicket: (ticketId: string) => void;
  moveTicket: (t: Ticket, toColumnId: string, index: number) => void;
  reset: () => void;
}

const initial = { projects: [], current: null, isLoading: false, error: '' };

// Guards against out-of-order responses when the user switches project/filter quickly.
let listSeq = 0;
let openSeq = 0;

const withColumns = (s: ProjectState, fn: (cols: ProjectColumn[]) => ProjectColumn[]) =>
  s.current?.columns ? { current: { ...s.current, columns: fn(s.current.columns) } } : s;

export const useProjectStore = create<ProjectState>((set, get) => ({
  ...initial,

  loadProjects: async (workspaceId, status = 'all') => {
    const req = ++listSeq;
    set({ isLoading: true, error: '' });
    try {
      const projects = await getProjects(workspaceId, status);
      if (req === listSeq) set({ projects, isLoading: false });
    } catch (err) {
      if (req === listSeq) set({ isLoading: false, error: getErrorMessage(err, 'Failed to load projects') });
    }
  },

  openProject: async projectId => {
    const req = ++openSeq;
    if (get().current?.id !== projectId) set({ current: null });
    set({ isLoading: true, error: '' });
    try {
      const current = await getProject(projectId);
      if (req === openSeq) set({ current, isLoading: false });
    } catch (err) {
      if (req === openSeq) set({ isLoading: false, error: getErrorMessage(err, 'Failed to load project') });
    }
  },

  closeProject: () => {
    openSeq++;
    set({ current: null, error: '' });
  },

  upsertProject: p =>
    set(s => ({
      projects: s.projects.some(x => x.id === p.id)
        ? s.projects.map(x => (x.id === p.id ? { ...x, ...p } : x))
        : [p, ...s.projects],
      current: s.current?.id === p.id ? { ...s.current, ...p, columns: s.current.columns } : s.current,
    })),

  removeProject: projectId =>
    set(s => ({
      projects: s.projects.filter(p => p.id !== projectId),
      current: s.current?.id === projectId ? null : s.current,
    })),

  addColumn: c =>
    set(s =>
      s.current?.id !== c.projectId || s.current.columns?.some(x => x.id === c.id)
        ? s
        : withColumns(s, cols => [...cols, { ...c, tickets: [] }]),
    ),

  updateColumn: c => set(s => withColumns(s, cols => cols.map(x => (x.id === c.id ? { ...x, ...c, tickets: x.tickets } : x)))),

  removeColumn: columnId => set(s => withColumns(s, cols => cols.filter(x => x.id !== columnId))),

  setColumnOrder: (projectId, ids) =>
    set(s => {
      if (s.current?.id !== projectId) return s;
      return withColumns(s, cols => {
        const byId = new Map(cols.map(c => [c.id, c]));
        const ordered = ids.map(id => byId.get(id)).filter((c): c is ProjectColumn => !!c);
        // Keep any column the event didn't mention rather than silently dropping it.
        return [...ordered, ...cols.filter(c => !ids.includes(c.id))].map((c, orderIndex) => ({ ...c, orderIndex }));
      });
    }),

  addTicket: t =>
    set(s =>
      s.current?.id !== t.projectId
        ? s
        : withColumns(s, cols =>
            cols.map(c =>
              c.id !== t.columnId || c.tickets?.some(x => x.id === t.id) ? c : { ...c, tickets: [...(c.tickets ?? []), t] },
            ),
          ),
    ),

  // A column change inside an update (e.g. edit sheet) relocates the ticket.
  updateTicket: t =>
    set(s => {
      if (s.current?.id !== t.projectId) return s;
      return withColumns(s, cols => {
        const old = cols.find(c => c.tickets?.some(x => x.id === t.id));
        if (old && old.id !== t.columnId) return moveTicketInColumns(cols, t, t.columnId, Infinity);
        return cols.map(c => ({ ...c, tickets: c.tickets?.map(x => (x.id === t.id ? { ...x, ...t } : x)) }));
      });
    }),

  removeTicket: ticketId =>
    set(s => withColumns(s, cols => cols.map(c => ({ ...c, tickets: c.tickets?.filter(x => x.id !== ticketId) })))),

  moveTicket: (t, toColumnId, index) => set(s => withColumns(s, cols => moveTicketInColumns(cols, t, toColumnId, index))),

  reset: () => {
    listSeq++;
    openSeq++;
    set(initial);
  },
}));
