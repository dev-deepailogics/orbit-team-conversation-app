/**
 * Design Tokens for Orbit Marketing Platform
 * Centralized definition of colors, typography, spacing grid, and motion tokens.
 */

export const DESIGN_TOKENS = {
  colors: {
    brand: {
      primary: '#6366F1', // Electric Indigo
      primaryHover: '#4F46E5',
      primaryMuted: 'rgba(99, 102, 241, 0.15)',
      accent: '#06B6D4', // Neon Cyan
      accentHover: '#0891B2',
      accentGlow: 'rgba(6, 182, 212, 0.25)',
      violet: '#8B5CF6',
      emerald: '#10B981',
      rose: '#F43F5E',
      amber: '#F59E0B',
    },
    dark: {
      canvas: '#090D16',
      surface: '#0E131F',
      card: '#141A28',
      cardHover: '#1A2133',
      border: 'rgba(255, 255, 255, 0.08)',
      borderHover: 'rgba(99, 102, 241, 0.4)',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
    },
    light: {
      canvas: '#FAFAFC',
      surface: '#FFFFFF',
      card: '#F1F5F9',
      cardHover: '#E2E8F0',
      border: 'rgba(15, 23, 42, 0.08)',
      borderHover: 'rgba(99, 102, 241, 0.5)',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      textMuted: '#64748B',
    },
  },
  typography: {
    fonts: {
      display: '"Bricolage Grotesque", "Space Grotesk", "Trap", -apple-system, sans-serif',
      body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    sizes: {
      hero: 'clamp(3rem, 7vw, 5.5rem)',
      h1: 'clamp(2.5rem, 5vw, 4rem)',
      h2: 'clamp(2rem, 3.5vw, 2.75rem)',
      h3: 'clamp(1.5rem, 2.5vw, 2rem)',
      h4: 'clamp(1.25rem, 2vw, 1.5rem)',
      bodyLg: '1.125rem', // 18px
      body: '1rem', // 16px
      bodySm: '0.875rem', // 14px
      caption: '0.75rem', // 12px
    },
    lineHeights: {
      tight: 1.08,
      heading: 1.15,
      body: 1.6,
      relaxed: 1.75,
    },
  },
  spacing: {
    // 8px base grid
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
    '4xl': '96px',
    '5xl': '128px',
  },
  motion: {
    durations: {
      fast: 0.15, // 150ms
      base: 0.3, // 300ms
      slow: 0.6, // 600ms
      ambient: 24.0, // 24s background loop
    },
    easings: {
      entrance: [0.22, 1, 0.36, 1], // snappy responsive overshoot
      ui: [0.4, 0, 0.2, 1], // standard smooth easeInOut
      gentle: [0.16, 1, 0.3, 1],
      bounce: [0.34, 1.56, 0.64, 1],
    },
    stagger: {
      fast: 0.05,
      normal: 0.08,
      slow: 0.12,
    },
    maxTravel: 24, // px translateY
  },
  radii: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },
} as const;

export type DesignTokens = typeof DESIGN_TOKENS;

