import { create } from 'zustand';
import { Project, ProjectColumn, Ticket } from '@orbit/types';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  activeView: 'channel' | 'project';
  isLoadingProject: boolean;

  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  setCurrentProject: (project: Project | null) => void;
  setActiveView: (view: 'channel' | 'project') => void;
  setIsLoadingProject: (loading: boolean) => void;

  // Real-time Column mutations on currentProject
  addColumn: (column: ProjectColumn) => void;
  updateColumn: (column: ProjectColumn) => void;
  removeColumn: (columnId: string) => void;

  // Real-time Ticket mutations on currentProject
  addTicket: (ticket: Ticket) => void;
  updateTicket: (ticket: Ticket) => void;
  removeTicket: (ticketId: string) => void;
  moveTicket: (ticket: Ticket, fromColumnId: string, toColumnId: string, newOrderIndex: number) => void;

  reset: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  activeView: 'channel',
  isLoadingProject: false,

  reset: () =>
    set({
      projects: [],
      currentProject: null,
      activeView: 'channel',
      isLoadingProject: false,
    }),

  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((state) => ({
      projects: [project, ...state.projects.filter((p) => p.id !== project.id)],
    })),

  updateProject: (project) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === project.id ? { ...p, ...project } : p)),
      currentProject:
        state.currentProject?.id === project.id
          ? { ...state.currentProject, ...project }
          : state.currentProject,
    })),

  removeProject: (projectId) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
      currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
      activeView: state.currentProject?.id === projectId ? 'channel' : state.activeView,
    })),

  setCurrentProject: (project) =>
    set({
      currentProject: project,
      activeView: project ? 'project' : 'channel',
    }),

  setActiveView: (view) => set({ activeView: view }),

  setIsLoadingProject: (loading) => set({ isLoadingProject: loading }),

  addColumn: (column) =>
    set((state) => {
      if (!state.currentProject) return state;
      const currentCols = state.currentProject.columns || [];
      if (currentCols.some((c) => c.id === column.id)) return state;
      return {
        currentProject: {
          ...state.currentProject,
          columns: [...currentCols, { ...column, tickets: [] }],
        },
      };
    }),

  updateColumn: (column) =>
    set((state) => {
      if (!state.currentProject) return state;
      return {
        currentProject: {
          ...state.currentProject,
          columns: (state.currentProject.columns || []).map((col) =>
            col.id === column.id ? { ...col, ...column } : col
          ),
        },
      };
    }),

  removeColumn: (columnId) =>
    set((state) => {
      if (!state.currentProject) return state;
      return {
        currentProject: {
          ...state.currentProject,
          columns: (state.currentProject.columns || []).filter((col) => col.id !== columnId),
        },
      };
    }),

  addTicket: (ticket) =>
    set((state) => {
      if (!state.currentProject || !state.currentProject.columns) return state;
      return {
        currentProject: {
          ...state.currentProject,
          columns: state.currentProject.columns.map((col) => {
            if (col.id === ticket.columnId) {
              const existing = col.tickets || [];
              if (existing.some((t) => t.id === ticket.id)) return col;
              return {
                ...col,
                tickets: [...existing, ticket],
              };
            }
            return col;
          }),
        },
      };
    }),

  updateTicket: (ticket) =>
    set((state) => {
      if (!state.currentProject || !state.currentProject.columns) return state;
      return {
        currentProject: {
          ...state.currentProject,
          columns: state.currentProject.columns.map((col) => {
            if (col.id === ticket.columnId) {
              return {
                ...col,
                tickets: (col.tickets || []).map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t)),
              };
            } else {
              // If ticket changed column
              return {
                ...col,
                tickets: (col.tickets || []).filter((t) => t.id !== ticket.id),
              };
            }
          }),
        },
      };
    }),

  removeTicket: (ticketId) =>
    set((state) => {
      if (!state.currentProject || !state.currentProject.columns) return state;
      return {
        currentProject: {
          ...state.currentProject,
          columns: state.currentProject.columns.map((col) => ({
            ...col,
            tickets: (col.tickets || []).filter((t) => t.id !== ticketId),
          })),
        },
      };
    }),

  moveTicket: (ticket, fromColumnId, toColumnId, newOrderIndex) =>
    set((state) => {
      if (!state.currentProject || !state.currentProject.columns) return state;

      const newCols = state.currentProject.columns.map((col) => {
        if (col.id === fromColumnId && fromColumnId === toColumnId) {
          // Reorder within same column
          const filtered = (col.tickets || []).filter((t) => t.id !== ticket.id);
          filtered.splice(newOrderIndex, 0, ticket);
          return { ...col, tickets: filtered };
        } else if (col.id === fromColumnId) {
          // Remove from old column
          return {
            ...col,
            tickets: (col.tickets || []).filter((t) => t.id !== ticket.id),
          };
        } else if (col.id === toColumnId) {
          // Insert into new column
          const filtered = (col.tickets || []).filter((t) => t.id !== ticket.id);
          filtered.splice(newOrderIndex, 0, { ...ticket, columnId: toColumnId });
          return {
            ...col,
            tickets: filtered,
          };
        }
        return col;
      });

      return {
        currentProject: {
          ...state.currentProject,
          columns: newCols,
        },
      };
    }),
}));
