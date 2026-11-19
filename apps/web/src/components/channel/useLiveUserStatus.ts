"use client";

import { useEffect, useState } from "react";
import { SOCKET_EVENTS, UserStatus, WorkspaceMember } from "@orbit/types";
import { getSocket } from "../../lib/socket";

export const isLiveOnline = (status: UserStatus | undefined) =>
  status === "ONLINE" || status === "IN_HUDDLE";

export function useLiveUserStatus(members: WorkspaceMember[]) {
  const [status, setStatus] = useState<Record<string, UserStatus>>({});

  useEffect(() => {
    setStatus((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const m of members) {
        if (m.user && !(m.user.id in next)) {
          next[m.user.id] = m.user.status;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [members]);

  useEffect(() => {
    const socket = getSocket();
    const onChange = ({
      userId,
      status: next,
    }: {
      userId: string;
      status: UserStatus;
    }) => {
      if (!userId || !next) return; // ignore partial payloads
      setStatus((prev) => (prev[userId] === next ? prev : { ...prev, [userId]: next }));
    };
    socket.on(SOCKET_EVENTS.USER_STATUS_CHANGE, onChange);
    return () => {
      socket.off(SOCKET_EVENTS.USER_STATUS_CHANGE, onChange);
    };
  }, []);

  return status;
}
