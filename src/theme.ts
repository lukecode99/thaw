// Design tokens — the single source of truth for every visual constant.
// Screens and components must never hard-code a colour, size, or radius;
// a jest guard (design-guard.test.ts) enforces this.

export const colors = {
  // Calm/warm neutrals
  bg: '#FAF6F1',
  surface: '#FFFFFF',
  surfaceSoft: '#F3ECE4',
  border: '#E7DED3',

  // Warm ink instead of pure black
  ink: '#3D3733',
  inkSoft: '#7A716A',
  inkFaint: '#A99F96',

  // One warm accent (terracotta), never clinical blue
  accent: '#D97757',
  accentSoft: '#F6E3D9',
  onAccent: '#FFFFFF',

  // Muted sage for "ready" moments
  ready: '#7A9E7E',
  readySoft: '#E8F0E8',

  danger: '#C0564B',
} as const;

export const font = {
  size: {
    xs: 13,
    sm: 15,
    md: 17,
    lg: 22,
    xl: 28,
    title: 34,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
  },
} as const;

// Generous whitespace is part of the product's tone.
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
