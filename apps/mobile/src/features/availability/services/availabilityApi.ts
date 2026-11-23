import type { UserAvailabilityRecord } from '@orbit/types';
import { api } from '@/lib/api';

// apps/server/src/routes/availability.ts
export interface AvailabilityResponse {
  availability: UserAvailabilityRecord | null;
  serverTime: string;
}

const get = (path: string) => api.get<AvailabilityResponse>(`/api/availability${path}`).then(r => r.data);
const post = (path: string, body?: object) =>
  api.post<AvailabilityResponse>(`/api/availability${path}`, body).then(r => r.data);

export const getCurrent = () => get('/current');
// Members without viewTeamAvailability get presence-only records for others; enough for the dots.
export const getTeam = (workspaceId: string) =>
  api
    .get<{ team: { user: { id: string }; availability: UserAvailabilityRecord | null }[] }>(`/api/availability/team/${workspaceId}`)
    .then(r => r.data.team ?? []);
export const checkIn = () => post('/checkin');
export const startBreak = (reason: string) => post('/break/start', { reason });
export const resumeWork = () => post('/break/resume');
export const checkOut = () => post('/checkout');
