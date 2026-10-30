import { useColorScheme, vars } from 'nativewind';

// The only place colors are defined. Tailwind classes read these through CSS variables
// (set on the app root via `cssVars`); JS props (icons, spinners, editor/markdown styles) use useTheme().
// Text/background pairs are WCAG AA (≥ 4.5:1); `brand` only carries large text and icons.
const light = {
  background: '#FFFFFF',
  foreground: '#1D1C1D',
  muted: '#F8F8F8',
  mutedForeground: '#616061',
  subtle: '#868686',
  border: '#E2E2E2',
  input: '#C9C9C9',
  brand: '#0F2C59',
  brandForeground: '#FFFFFF',
  primary: '#1D6FE0',
  primaryForeground: '#FFFFFF',
  link: '#1D6FE0',
  accent: '#E8F1FD',
  accentForeground: '#1A5DC2',
  destructive: '#E01E5A',
  destructiveForeground: '#FFFFFF',
  codeBg: '#F8F8F8',
  overlay: '#000000',
};

export type Palette = typeof light;
export type Scheme = 'light' | 'dark';

const dark: Palette = {
  background: '#1A1D21',
  foreground: '#D1D2D3',
  muted: '#222529',
  mutedForeground: '#ABABAD',
  subtle: '#8C8D8F',
  border: '#2E3136',
  input: '#4A4D52',
  brand: '#13294A',
  brandForeground: '#FFFFFF',
  primary: '#1D6FE0',
  primaryForeground: '#FFFFFF',
  link: '#6FAEEB',
  accent: '#1D3047',
  accentForeground: '#8DC0F2',
  destructive: '#E5507A',
  destructiveForeground: '#1A1D21',
  codeBg: '#222529',
  overlay: '#000000',
};

export const palettes: Record<Scheme, Palette> = { light, dark };

// Builds a style object once per scheme, so components index it by `scheme` instead of rebuilding it every render.
export const perScheme = <T>(make: (c: Palette, scheme: Scheme) => T): Record<Scheme, T> => ({
  light: make(light, 'light'),
  dark: make(dark, 'dark'),
});

// Scheme-independent colors: avatar backgrounds (white initials), ticket priorities, and the
// project/column color picker (picked values are stored on the server, so keep existing ones).
export const avatarTones = ['#0F2C59', '#1D6FE0', '#0B6E79', '#3B4CCA', '#BC1F4E', '#7C5300', '#1F7A5A'];
// Text and icons drawn on avatarTones, priority pills and swatches (all dark enough for it).
export const onSwatch = '#FFFFFF';
export const priorityColors = { LOW: '#868686', MEDIUM: '#1D6FE0', HIGH: '#E8912D', URGENT: '#E01E5A' };
export const swatches = ['#6B7280', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const FONT = 'Lato';
export const MONO = 'Menlo';

const kebab = (key: string) => key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

// '#1D6FE0' → '29 111 224', the form tailwind.config.js reads with rgb(var(--x) / <alpha-value>).
export function hexToChannels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${Math.floor(n / 65536) % 256} ${Math.floor(n / 256) % 256} ${n % 256}`;
}

export function toCssVars(p: Palette): Record<string, string> {
  return Object.fromEntries(Object.entries(p).map(([k, hex]) => [`--${kebab(k)}`, hexToChannels(hex)]));
}

const cssVars = { light: vars(toCssVars(light)), dark: vars(toCssVars(dark)) };

export function useTheme() {
  const scheme: Scheme = useColorScheme().colorScheme === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palettes[scheme], cssVars: cssVars[scheme] };
}
