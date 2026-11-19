import React from 'react';
import { getTicketType } from '../../lib/ticketTypes';

/** Small coloured badge for a ticket's type (task, bug, story, epic), like Jira's issue-type icon. */
export const TicketTypeIcon: React.FC<{ type?: string | null; size?: number; showLabel?: boolean }> = ({
  type,
  size = 14,
  showLabel = false,
}) => {
  const meta = getTicketType(type);
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0" title={meta.label}>
      <span
        className="inline-flex items-center justify-center rounded-[5px] text-white"
        style={{ backgroundColor: meta.color, width: size + 6, height: size + 6 }}
        role="img"
        aria-label={`Type: ${meta.label}`}
      >
        <Icon size={size - 2} strokeWidth={2.5} />
      </span>
      {showLabel && <span className="text-xs font-semibold">{meta.label}</span>}
    </span>
  );
};
