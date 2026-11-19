import { Bug, BookOpen, CheckSquare, Zap, type LucideIcon } from 'lucide-react';
import type { TicketType } from '@orbit/types';

export interface TicketTypeMeta {
  value: TicketType;
  label: string;
  /** Jira-style badge colour */
  color: string;
  icon: LucideIcon;
  description: string;
}

// Order is the order shown in pickers and filters. TASK is the default for new tickets.
export const TICKET_TYPES: TicketTypeMeta[] = [
  { value: 'TASK', label: 'Task', color: '#4BADE8', icon: CheckSquare, description: 'A piece of work to do' },
  { value: 'BUG', label: 'Bug', color: '#E5493A', icon: Bug, description: 'Something that is broken' },
  { value: 'STORY', label: 'Story', color: '#63BA3C', icon: BookOpen, description: 'A feature from the user’s point of view' },
  { value: 'EPIC', label: 'Epic', color: '#904EE2', icon: Zap, description: 'A large body of work spanning many tickets' },
];

const BY_VALUE = new Map(TICKET_TYPES.map((t) => [t.value, t]));

/** Metadata for a ticket type; unknown or missing values (older tickets, other clients) read as a Task. */
export function getTicketType(type?: string | null): TicketTypeMeta {
  return BY_VALUE.get((type || 'TASK').toUpperCase() as TicketType) ?? TICKET_TYPES[0];
}
