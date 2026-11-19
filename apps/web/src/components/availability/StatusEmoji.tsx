'use client';

import React from 'react';
import { Presence } from './useTeamPresence';
import { parseBreakReason } from './breakStatus';

interface StatusEmojiProps {
  presence: Presence;
  breakReason?: string;
}

/** Slack-style break emoji next to a name; the reason shows on hover. Renders only while on break. */
export const StatusEmoji = React.memo(function StatusEmoji({ presence, breakReason }: StatusEmojiProps) {
  if (presence !== 'break') return null;

  const { emoji, text } = parseBreakReason(breakReason);
  const label = `On break · ${text}`;

  return (
    <span role="img" aria-label={label} title={label} className="ml-1.5 align-middle text-[13px] leading-none cursor-default select-none">
      {emoji}
    </span>
  );
});
