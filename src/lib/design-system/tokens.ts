// TypeScript mirror of tokens.css — for inline style props or runtime computation.

export const palette = {
  bg0: '#08090c',
  bg1: '#0c0e13',
  bg2: '#11141b',
  bg3: '#161a23',
  bgElev: '#1a1f2b',
  line: '#1d222d',
  line2: '#262c39',
  line3: '#323a4a',
  fg: '#e8ecf3',
  fg2: '#b6bdcc',
  fg3: '#7d8597',
  fg4: '#525a6c',
  aurora1: '#7c5cff',
  aurora2: '#5b8cff',
  aurora3: '#4ad8c7',
  aurora4: '#9d6bff',
  ok: '#4ad8c7',
  warn: '#ffb454',
  err: '#ff6b8a',
  info: '#5b8cff',
} as const;

export const radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const type = {
  sectionLabel: { size: 10.5, weight: 600, tracking: 0.7, transform: 'uppercase' as const },
  meta: { size: 11, weight: 500 },
  uiBody: { size: 12, weight: 500 },
  sessionTitle: { size: 12.5, weight: 500 },
  chatBody: { size: 13.5, weight: 400 },
  composer: { size: 14, weight: 400 },
  modalH2: { size: 16, weight: 600 },
  empty: { size: 24, weight: 600, tracking: -0.5 },
} as const;

export const motion = {
  hover: 120,
  toggle: 150,
  modal: 200,
  pulse: 1800,
  blink: 1000,
} as const;

export const spacing = [4, 6, 8, 10, 14, 18, 22, 28, 48] as const;

export type Token = keyof typeof palette;
