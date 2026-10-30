// Slack-style theme: Lato, 15/22 body text, hairline borders, navy + blue accents, light and dark.
// Colors are CSS variables set from src/lib/theme.ts (the only place hex values live), so every token follows the scheme.
const v = name => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  // 'class' lets the in-app setting override the system scheme (nativewind colorScheme.set).
  darkMode: 'class',
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lato'],
      },
      // Slack mobile's type scale: [size, line height].
      fontSize: {
        '2xs': ['11px', '14px'],
        xs: ['12px', '16px'],
        sm: ['13px', '18px'],
        base: ['15px', '22px'],
        lg: ['17px', '24px'],
        xl: ['20px', '26px'],
        '2xl': ['24px', '30px'],
        '3xl': ['28px', '34px'],
      },
      // Lato ships 400/700/900 only; map the in-between weights to bold so iOS and Android render the same face.
      fontWeight: {
        medium: '700',
        semibold: '700',
        extrabold: '900',
      },
      colors: {
        background: v('background'),
        foreground: v('foreground'),
        border: v('border'),
        input: v('input'),
        ring: v('primary'),
        subtle: v('subtle'),
        overlay: v('overlay'),
        link: v('link'),
        brand: {
          DEFAULT: v('brand'),
          foreground: v('brand-foreground'),
        },
        primary: {
          DEFAULT: v('primary'),
          foreground: v('primary-foreground'),
        },
        secondary: {
          DEFAULT: v('muted'),
          foreground: v('foreground'),
        },
        destructive: {
          DEFAULT: v('destructive'),
          foreground: v('destructive-foreground'),
        },
        muted: {
          DEFAULT: v('muted'),
          foreground: v('muted-foreground'),
        },
        accent: {
          DEFAULT: v('accent'),
          foreground: v('accent-foreground'),
        },
        card: {
          DEFAULT: v('background'),
          foreground: v('foreground'),
        },
      },
    },
  },
  plugins: [],
};
