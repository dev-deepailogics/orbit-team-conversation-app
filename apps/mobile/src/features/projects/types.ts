import type { Project, ProjectColumn, Ticket, TicketPriority, UserProfile } from '@orbit/types';

export type ProjectStatus = 'active' | 'inactive' | 'delivered';
export type StatusFilter = ProjectStatus | 'all';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

// Activity log entry the server appends to Ticket.events on create/move/update.
export interface TicketEvent {
  id: string;
  type?: string;
  action: string;
  user?: string;
  date: string;
  color?: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  userId: string;
  username: string;
  text: string;
  type: string;
  audioUrl: string | null;
  createdAt: string;
  user?: UserProfile;
}

// Person reference stored in JSON columns (Project.assignedEmployees, Ticket.assignees).
export interface PersonRef {
  uid: string;
  name: string;
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  icon?: string;
  color?: string;
  status?: ProjectStatus;
  assignedEmployees?: PersonRef[];
}

export interface TicketInput {
  columnId?: string;
  title?: string;
  description?: string | null;
  priority?: TicketPriority;
  dueDate?: string | null;
  assignees?: PersonRef[];
  gitbranch?: string | null;
  checklist?: ChecklistItem[] | null;
  labels?: unknown[] | null;
  storyPoints?: number | null;
  notes?: string | null;
  testPlan?: string | null;
}

export type { Project, ProjectColumn, Ticket, TicketPriority };
