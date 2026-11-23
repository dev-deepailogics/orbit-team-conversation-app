import { useColorScheme, vars } from 'nativewind';

// The only place colors are defined. Tailwind classes read these through CSS variables
// (set on the app root via `cssVars`); JS props (icons, spinners, editor/markdown styles) use useTheme().
// Every text/background pair is WCAG AA (≥ 4.5:1); icons on background/accent (primary checks) are ≥ 3:1.
// Hues from web's Mint Teal (apps/web/src/lib/theme.ts), darkened where web's own values miss AA.
const light = {
  background: '#FFFFFF',
  foreground: '#10201D', // web textColor
  muted: '#F6FAF9', // web surfaceColor
  mutedForeground: '#466059', // web textMutedColor
  subtle: '#587670',
  border: '#DBE7E4', // web borderColor
  input: '#C0D2CE', // slate/300
  // Mobile's header stays dark in both schemes (white text), so it takes the brand scale, not web's light sidebar.
  brand: '#134E4A', // brand/900
  brandForeground: '#FFFFFF',
  // brand/700: web's #0D9488 under white text is only 3.7:1.
  primary: '#0F766E',
  primaryForeground: '#FFFFFF',
  link: '#0F766E',
  accent: '#D5E6E2', // web selectedColor
  accentForeground: '#115E59', // brand/800
  destructive: '#E01E5A',
  destructiveForeground: '#FFFFFF',
  success: '#007A5A',
  successForeground: '#FFFFFF',
  warning: '#E8912D',
  codeBg: '#F6FAF9',
  overlay: '#000000',
};

export type Palette = typeof light;
export type Scheme = 'light' | 'dark';

// Near-black with a faint teal cast under a deep-teal header (Slack's dark aubergine pattern).
const dark: Palette = {
  background: '#080B0B',
  foreground: '#D3DAD8',
  muted: '#111615',
  mutedForeground: '#A6B1AE',
  subtle: '#8C9895',
  border: '#1D2523',
  input: '#4A5654',
  // Slack keeps its aubergine in the dark header; same idea with a deep, muted teal (white text 12.5:1).
  brand: '#0F3A36',
  brandForeground: '#FFFFFF',
  // Web's bright teal; white on it is 2.5:1, so it carries dark text (like `destructive` below).
  primary: '#14B8A6',
  primaryForeground: '#0D1312',
  link: '#2DD4BF',
  accent: '#173B37',
  accentForeground: '#7EE0D0',
  destructive: '#E5507A',
  destructiveForeground: '#080B0B',
  success: '#007A5A',
  successForeground: '#FFFFFF',
  warning: '#E8912D',
  codeBg: '#111615',
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

// One family per weight: RN's Android can only pick custom fonts by file name (regular/bold/italic), so
// each static Rubik face is addressed by its own name on both platforms. Use these (or font-* classes), never fontWeight.
export const FONTS = {
  regular: 'Rubik-Regular',
  medium: 'Rubik-Medium',
  semibold: 'Rubik-SemiBold',
  bold: 'Rubik-Bold',
  italic: 'Rubik-Italic',
} as const;
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
