import { ThemeConfig } from '@orbit/types';

export const DEFAULT_THEME: ThemeConfig = {
  id: 'orbit-dark',
  name: 'Orbit Dark',
  sidebarColor: '#1F2326',
  workspaceColor: '#19171D',
  backgroundColor: '#1A1D21',
  surfaceColor: '#222529',
  surfaceHoverColor: '#2C3136',
  textColor: '#FFFFFF',
  textMutedColor: '#9CA3AF',
  primaryColor: '#007A5A',
  primaryHoverColor: '#00664B',
  primaryTextColor: '#FFFFFF',
  secondaryColor: '#1164A3',
  borderColor: '#383F45',
};

export const THEME_PRESETS: ThemeConfig[] = [
  DEFAULT_THEME,
  {
    id: 'aubergine-classic',
    name: 'Aubergine Classic',
    sidebarColor: '#3F0E40',
    workspaceColor: '#350D36',
    backgroundColor: '#1A1D21',
    surfaceColor: '#28172B',
    surfaceHoverColor: '#38223C',
    textColor: '#FFFFFF',
    textMutedColor: '#D3C4D6',
    primaryColor: '#ECB22E',
    primaryHoverColor: '#D99F20',
    primaryTextColor: '#1A1D21',
    secondaryColor: '#1164A3',
    borderColor: '#4D1D4F',
  },
  {
    id: 'midnight-navy',
    name: 'Midnight Navy',
    sidebarColor: '#0F172A',
    workspaceColor: '#0B1120',
    backgroundColor: '#090D16',
    surfaceColor: '#1E293B',
    surfaceHoverColor: '#334155',
    textColor: '#F8FAFC',
    textMutedColor: '#94A3B8',
    primaryColor: '#38BDF8',
    primaryHoverColor: '#0284C7',
    primaryTextColor: '#0F172A',
    secondaryColor: '#818CF8',
    borderColor: '#1E293B',
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Forest',
    sidebarColor: '#064E3B',
    workspaceColor: '#022C22',
    backgroundColor: '#041C15',
    surfaceColor: '#0B3B2F',
    surfaceHoverColor: '#134E3F',
    textColor: '#ECFDF5',
    textMutedColor: '#6EE7B7',
    primaryColor: '#10B981',
    primaryHoverColor: '#059669',
    primaryTextColor: '#FFFFFF',
    secondaryColor: '#34D399',
    borderColor: '#047857',
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    sidebarColor: '#180D2B',
    workspaceColor: '#0E051D',
    backgroundColor: '#120722',
    surfaceColor: '#261245',
    surfaceHoverColor: '#3B1E68',
    textColor: '#FDF2F8',
    textMutedColor: '#F472B6',
    primaryColor: '#EC4899',
    primaryHoverColor: '#DB2777',
    primaryTextColor: '#FFFFFF',
    secondaryColor: '#8B5CF6',
    borderColor: '#4C1D95',
  },
  {
    id: 'dracula',
    name: 'Dracula',
    sidebarColor: '#282A36',
    workspaceColor: '#21222C',
    backgroundColor: '#1E1F29',
    surfaceColor: '#44475A',
    surfaceHoverColor: '#6272A4',
    textColor: '#F8F8F2',
    textMutedColor: '#BF93F9',
    primaryColor: '#FF79C6',
    primaryHoverColor: '#FF64B9',
    primaryTextColor: '#1E1F29',
    secondaryColor: '#8BE9FD',
    borderColor: '#6272A4',
  },
  {
    id: 'sunset-warm',
    name: 'Sunset Warm',
    sidebarColor: '#431407',
    workspaceColor: '#2C0D05',
    backgroundColor: '#1C0A05',
    surfaceColor: '#33160D',
    surfaceHoverColor: '#4A2216',
    textColor: '#FFF7ED',
    textMutedColor: '#FDBA74',
    primaryColor: '#F97316',
    primaryHoverColor: '#EA580C',
    primaryTextColor: '#FFFFFF',
    secondaryColor: '#FB923C',
    borderColor: '#542111',
  },
  {
    id: 'clean-slate-light',
    name: 'Clean Slate (Light)',
    sidebarColor: '#F8FAFC',
    workspaceColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    surfaceColor: '#F1F5F9',
    surfaceHoverColor: '#E2E8F0',
    textColor: '#090D16',
    textMutedColor: '#334155',
    primaryColor: '#0284C7',
    primaryHoverColor: '#0369A1',
    primaryTextColor: '#FFFFFF',
    secondaryColor: '#4F46E5',
    borderColor: '#CBD5E1',
  },
];

export function isLightColor(hex?: string): boolean {
  if (!hex || !hex.startsWith('#')) return false;
  const c = hex.replace('#', '');
  if (c.length !== 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Perceived luminance formula (YIQ)
  return (r * 299 + g * 587 + b * 114) / 1000 >= 160;
}

export function applyTheme(theme: ThemeConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // 1. Set CSS Custom Properties
  root.style.setProperty('--theme-bg-sidebar', theme.sidebarColor);
  root.style.setProperty('--theme-bg-workspace', theme.workspaceColor);
  root.style.setProperty('--theme-bg-app', theme.backgroundColor);
  root.style.setProperty('--theme-bg-surface', theme.surfaceColor);
  root.style.setProperty('--theme-bg-surface-hover', theme.surfaceHoverColor || theme.surfaceColor);
  root.style.setProperty('--theme-text-primary', theme.textColor);
  root.style.setProperty('--theme-text', theme.textColor);
  root.style.setProperty('--theme-text-muted', theme.textMutedColor);
  root.style.setProperty('--theme-primary', theme.primaryColor);
  root.style.setProperty('--theme-primary-hover', theme.primaryHoverColor || theme.primaryColor);
  root.style.setProperty('--theme-primary-text', theme.primaryTextColor || '#FFFFFF');
  root.style.setProperty('--theme-secondary', theme.secondaryColor);
  root.style.setProperty('--theme-border', theme.borderColor);

  // 2. Synchronize Light / Dark theme class on document element
  const isLight = isLightColor(theme.backgroundColor) || isLightColor(theme.sidebarColor);
  if (isLight) {
    root.classList.remove('dark');
    root.classList.add('light');
    root.dataset.themeMode = 'light';
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
    root.dataset.themeMode = 'dark';
  }
}

export function saveThemeLocally(theme: ThemeConfig, workspaceId?: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('orbit_theme_active', JSON.stringify(theme));
    if (workspaceId) {
      localStorage.setItem(`orbit_theme_${workspaceId}`, JSON.stringify(theme));
    }
  } catch (err) {
    console.error('Failed to save theme in localStorage', err);
  }
}

export function getSavedTheme(workspaceId?: string): ThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    if (workspaceId) {
      const wsSaved = localStorage.getItem(`orbit_theme_${workspaceId}`);
      if (wsSaved) return JSON.parse(wsSaved);
    }
    const generalSaved = localStorage.getItem('orbit_theme_active');
    if (generalSaved) return JSON.parse(generalSaved);
  } catch (err) {
    console.error('Failed to load theme from localStorage', err);
  }
  return DEFAULT_THEME;
}
