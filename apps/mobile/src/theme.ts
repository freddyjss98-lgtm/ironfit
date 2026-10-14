// Identidad visual de Iron Fit, tomada de apps/web/app/globals.css (@theme).
// La app es solo oscura, igual que el portal web.

export const colors = {
  bg: '#0a0a0a',
  bg2: '#121212',
  surface: '#161616',
  line: '#242424',
  line2: '#2e2e2e',
  fg: '#f4f1ea',
  fgDim: '#9a9a92',
  fgMute: '#5a5a55',
  accent: '#e84b1f',
  accentDeep: '#b3360e',
  danger: '#f87171',
  dangerBg: 'rgba(239, 68, 68, 0.10)',
  ok: '#4ade80',
  okBg: 'rgba(16, 185, 129, 0.10)',
} as const;

// Nombres que registra useFonts en app/_layout.tsx.
export const fonts = {
  display: 'Anton_400Regular',
  cond: 'BarlowCondensed_700Bold',
  condSemi: 'BarlowCondensed_600SemiBold',
  body: 'SpaceGrotesk_400Regular',
  bodyMedium: 'SpaceGrotesk_500Medium',
  bodySemi: 'SpaceGrotesk_600SemiBold',
  mono: 'SpaceMono_400Regular',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16 } as const;
