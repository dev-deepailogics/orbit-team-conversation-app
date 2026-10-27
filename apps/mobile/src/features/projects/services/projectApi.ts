import { api } from '@/lib/api';
import type { Project, ProjectColumn, ProjectInput, StatusFilter, Ticket, TicketComment, TicketInput } from '../types';

const base = '/api/projects';

export async function getProjects(workspaceId: string, status: StatusFilter = 'all'): Promise<Project[]> {
  const res = await api.get<Project[]>(`${base}/workspaces/${workspaceId}/projects`, {
    params: status === 'all' ? undefined : { status },
  });
  return res.data;
}

// Includes columns with their tickets, ordered.
export async function getProject(projectId: string): Promise<Project> {
  const res = await api.get<Project>(`${base}/${projectId}`);
  return res.data;
}

export async function createProject(workspaceId: string, input: ProjectInput): Promise<Project> {
  const res = await api.post<Project>(`${base}/workspaces/${workspaceId}/projects`, input);
  return res.data;
}

export async function updateProject(projectId: string, input: Partial<ProjectInput>): Promise<Project> {
  const res = await api.put<Project>(`${base}/${projectId}`, input);
  return res.data;
}

export async function deleteProject(projectId: string): Promise<void> {
  await api.delete(`${base}/${projectId}`);
}

export async function createColumn(projectId: string, name: string, color?: string): Promise<ProjectColumn> {
  const res = await api.post<ProjectColumn>(`${base}/${projectId}/columns`, { name, color });
  return res.data;
}

export async function updateColumn(
  projectId: string,
  columnId: string,
  input: { name?: string; color?: string },
): Promise<ProjectColumn> {
  const res = await api.put<ProjectColumn>(`${base}/${projectId}/columns/${columnId}`, input);
  return res.data;
}

export async function deleteColumn(projectId: string, columnId: string): Promise<void> {
  await api.delete(`${base}/${projectId}/columns/${columnId}`);
}

export async function reorderColumns(projectId: string, ids: string[]): Promise<void> {
  await api.patch(`${base}/${projectId}/columns/reorder`, {
    columnOrders: ids.map((id, orderIndex) => ({ id, orderIndex })),
  });
}

export async function createTicket(projectId: string, input: TicketInput & { columnId: string; title: string }) {
  const res = await api.post<Ticket>(`${base}/${projectId}/tickets`, input);
  return res.data;
}

export async function updateTicket(projectId: string, ticketId: string, input: TicketInput): Promise<Ticket> {
  const res = await api.put<Ticket>(`${base}/${projectId}/tickets/${ticketId}`, input);
  return res.data;
}

export async function moveTicket(projectId: string, ticketId: string, columnId: string, orderIndex: number) {
  const res = await api.patch<Ticket>(`${base}/${projectId}/tickets/${ticketId}/move`, { columnId, orderIndex });
  return res.data;
}

export async function deleteTicket(projectId: string, ticketId: string): Promise<void> {
  await api.delete(`${base}/${projectId}/tickets/${ticketId}`);
}

export async function getComments(projectId: string, ticketId: string): Promise<TicketComment[]> {
  const res = await api.get<TicketComment[]>(`${base}/${projectId}/tickets/${ticketId}/comments`);
  return res.data;
}

export async function addComment(projectId: string, ticketId: string, text: string): Promise<TicketComment> {
  const res = await api.post<TicketComment>(`${base}/${projectId}/tickets/${ticketId}/comments`, { text });
  return res.data;
}

export async function toggleWatch(projectId: string, ticketId: string): Promise<{ isWatching: boolean; watchers: string[] }> {
  const res = await api.post(`${base}/${projectId}/tickets/${ticketId}/watch`);
  return res.data;
}
