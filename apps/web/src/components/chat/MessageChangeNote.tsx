import React from 'react';
import { getMessageChange, type TimeFormat } from '../../lib/timeFormat';

interface MessageChangeNoteProps {
  message: { createdAt: string; updatedAt?: string; isEdited?: boolean; isDeleted?: boolean };
  timeFormat: TimeFormat;
  className?: string;
}

/**
 * "(edited 10:45 AM)" / "(deleted 10:45 AM)" next to a message's sent time. The time only shows when updatedAt differs
 * from createdAt; an edited message without one still reads "(edited)", and a deleted one shows nothing (its body says so).
 */
export const MessageChangeNote: React.FC<MessageChangeNoteProps> = ({ message, timeFormat, className = '' }) => {
  const change = getMessageChange(message, timeFormat);
  if (!change && (!message.isEdited || message.isDeleted)) return null;
  return (
    <span
      className={`italic select-none font-medium ${className}`}
      style={{ color: 'var(--theme-text-muted)' }}
      title={change?.title ?? 'Edited'}
    >
      ({change ? `${change.label} ${change.text}` : 'edited'})
    </span>
  );
};
