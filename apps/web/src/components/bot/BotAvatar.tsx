'use client';

import React from 'react';
import { BrandPinwheel } from '../brand/BrandMark';
import { isUploadedAvatar } from '../project/projectViewUtils';

interface BotAvatarProps {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}

/**
 * A bot's picture: its uploaded image, otherwise the Orbit logo. Older bots stored a generated
 * robot (/api/avatar/...) placeholder; that is treated as "no image" too, so every bot without
 * a real upload shows the logo.
 */
export const BotAvatar: React.FC<BotAvatarProps> = ({ name, src, size = 36, className = '' }) => {
  const radius = Math.round(size * 0.28);
  if (isUploadedAvatar(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || 'Bot'}
        className={`shrink-0 object-cover ${className}`}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name || 'Bot'}
      title={name || undefined}
      className={`inline-flex items-center justify-center shrink-0 border ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: 'var(--theme-bg-app)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <BrandPinwheel size={Math.round(size * 0.62)} />
    </span>
  );
};
