'use client';

import { useEffect, useMemo, useState } from 'react';
import { SOCKET_EVENTS, UserAvailabilityRecord } from '@orbit/types';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';

// Presence is driven by check-in, not socket connection: checked in = working, on break = break, else offline.
export type Presence = 'working' | 'break' | 'offline';

type AvailabilityLike = Pick<UserAvailabilityRecord, 'isAvailable' | 'isOnBreak' | 'breaks'> | null | undefined;

interface TeamStatus {
  presence: Presence;
  /** Reason of the currently open break; only set while presence === 'break'. */
  breakReason?: string;
}

export const presenceOf = (a: AvailabilityLike): Presence =>
  !a?.isAvailable ? 'offline' : a.isOnBreak ? 'break' : 'working';

// The open break is the one without an end time; fall back to the latest if the server omitted it.
const openBreakReason = (a: AvailabilityLike) => {
  const breaks = a?.breaks ?? [];
  return (breaks.find((b) => !b.availableAfterBreak) ?? breaks[breaks.length - 1])?.breakReason;
};

const statusOf = (a: AvailabilityLike): TeamStatus => {
  const presence = presenceOf(a);
  return presence === 'break' ? { presence, breakReason: openBreakReason(a) } : { presence };
};

export const PRESENCE_STYLE: Record<Presence, { dot: string; label: string }> = {
  working: { dot: 'bg-emerald-500', label: 'Working' },
  break: { dot: 'bg-amber-400', label: 'On break' },
  offline: { dot: 'bg-black', label: 'Offline' },
};

/**
 * Check-in status for every member of the workspace, kept live via socket.
 * `presence` is userId -> Presence; `breakReasons` is userId -> reason for members currently on break.
 */
export function useTeamPresence(workspaceId?: string) {
  const [status, setStatus] = useState<Record<string, TeamStatus>>({});

  useEffect(() => {
    if (!workspaceId) return;
    let alive = true;

    api
      .get(`/api/availability/team/${workspaceId}`)
      .then((res) => {
        if (!alive) return;
        const team: { user: { id: string }; availability: AvailabilityLike }[] = res.data.team || [];
        setStatus(Object.fromEntries(team.map((t) => [t.user.id, statusOf(t.availability)])));
      })
      .catch((err) => console.error('Failed to load team presence:', err));

    const socket = getSocket();
    const onUpdate = ({ userId, availability }: { userId: string; availability: AvailabilityLike }) =>
      setStatus((prev) => ({ ...prev, [userId]: statusOf(availability) }));
    socket.on(SOCKET_EVENTS.AVAILABILITY_UPDATE, onUpdate);

    return () => {
      alive = false;
      socket.off(SOCKET_EVENTS.AVAILABILITY_UPDATE, onUpdate);
    };
  }, [workspaceId]);

  return useMemo(() => {
    const presence: Record<string, Presence> = {};
    const breakReasons: Record<string, string> = {};
    for (const [id, s] of Object.entries(status)) {
      presence[id] = s.presence;
      if (s.breakReason) breakReasons[id] = s.breakReason;
    }
    return { presence, breakReasons };
  }, [status]);
}
