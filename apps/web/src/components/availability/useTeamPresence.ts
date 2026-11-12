'use client';

import { useEffect, useState } from 'react';
import { SOCKET_EVENTS, UserAvailabilityRecord } from '@orbit/types';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';

// Presence is driven by check-in, not socket connection: checked in = working, on break = break, else offline.
export type Presence = 'working' | 'break' | 'offline';

type AvailabilityLike = Pick<UserAvailabilityRecord, 'isAvailable' | 'isOnBreak'> | null | undefined;

export const presenceOf = (a: AvailabilityLike): Presence =>
  !a?.isAvailable ? 'offline' : a.isOnBreak ? 'break' : 'working';

export const PRESENCE_STYLE: Record<Presence, { dot: string; label: string }> = {
  working: { dot: 'bg-emerald-500', label: 'Working' },
  break: { dot: 'bg-amber-400', label: 'On break' },
  offline: { dot: 'bg-black', label: 'Offline' },
};

/** userId -> Presence for every member of the workspace, kept live via socket. */
export function useTeamPresence(workspaceId?: string) {
  const [presence, setPresence] = useState<Record<string, Presence>>({});

  useEffect(() => {
    if (!workspaceId) return;
    let alive = true;

    api
      .get(`/api/availability/team/${workspaceId}`)
      .then((res) => {
        if (!alive) return;
        const team: { user: { id: string }; availability: AvailabilityLike }[] = res.data.team || [];
        setPresence(Object.fromEntries(team.map((t) => [t.user.id, presenceOf(t.availability)])));
      })
      .catch((err) => console.error('Failed to load team presence:', err));

    const socket = getSocket();
    const onUpdate = ({ userId, availability }: { userId: string; availability: AvailabilityLike }) =>
      setPresence((prev) => ({ ...prev, [userId]: presenceOf(availability) }));
    socket.on(SOCKET_EVENTS.AVAILABILITY_UPDATE, onUpdate);

    return () => {
      alive = false;
      socket.off(SOCKET_EVENTS.AVAILABILITY_UPDATE, onUpdate);
    };
  }, [workspaceId]);

  return presence;
}
