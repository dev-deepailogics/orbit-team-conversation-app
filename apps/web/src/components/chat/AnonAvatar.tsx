'use client';

import React from 'react';
import { initialsOf } from '../project/projectViewUtils';

// Saturated character colours for anonymous avatars (Figma: amber, cyan, pink + extras).
const ANON_AVATAR_COLORS = ['#D97706', '#0EA5C6', '#E0568D', '#7C4DDB', '#1F9D63', '#2563EB'];

/** Stable per-persona colour, so the same anonymous name always gets the same avatar. */
export const anonColor = (seed: string) =>
  ANON_AVATAR_COLORS[seed.split('').reduce((h, c) => h + c.charCodeAt(0), 0) % ANON_AVATAR_COLORS.length];

interface AnonAvatarProps {
  /** The anonymous persona name (never the real user). */
  name?: string | null;
  size?: number;
  /** The persona's assigned emoji; shown as the avatar. Falls back to initials when absent. */
  emoji?: string | null;
  rounded?: 'full' | 'square';
  className?: string;
}

/** Avatar for anonymous posts: the persona's emoji on a tint of its colour; the name shows on hover. */
export const AnonAvatar: React.FC<AnonAvatarProps> = ({ name, size = 36, emoji, rounded = 'square', className = '' }) => {
  const persona = name?.trim() || 'Anonymous';
  const color = anonColor(persona);
  const glyph = emoji?.trim();
  return (
    <span
      role="img"
      aria-label={persona}
      title={glyph ? `${glyph} ${persona}` : persona}
      className={`inline-flex items-center justify-center shrink-0 select-none leading-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: rounded === 'full' ? '9999px' : Math.round(size * 0.28),
        ...(glyph
          ? {
              fontSize: Math.max(11, Math.round(size * 0.55)),
              backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`,
            }
          : {
              fontSize: Math.max(9, Math.round(size * 0.38)),
              fontWeight: 600,
              backgroundColor: color,
              color: '#FFFFFF',
            }),
      }}
    >
      {glyph || initialsOf(persona)}
    </span>
  );
};
