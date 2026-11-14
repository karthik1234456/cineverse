export type TheatreLookId = 'a' | 'b' | 'c';

export interface TheatreLookPalette {
  id: TheatreLookId;
  name: string;
  subtitle: string;
  floorColor: string;
  tierColor: string;
  treadColor: string;
  wallColor: string;
  acousticPanelColor: string;
  panelTrimColor: string;
  ceilingColor: string;
  screenFrameColor: string;
  stageLipColor: string;
  railColor: string;
  sconceGlowColor: string;
  stepLightColor: string;
  seats: {
    premier: string;
    prime: string;
    front: string;
    selected: string;
    held: string;
    booked: string;
    selectedEmissive: string;
  };
}

export const THEATRE_LOOKS: Record<TheatreLookId, TheatreLookPalette> = {
  // Look A: Classic Cinema Red (Default)
  a: {
    id: 'a',
    name: 'Classic Cinema Red',
    subtitle: 'Deep red fabric seats, dark neutral room & warm brass trim',
    floorColor: '#18191d',
    tierColor: '#1f2025',
    treadColor: '#26272e',
    wallColor: '#1c1d22',
    acousticPanelColor: '#25272e',
    panelTrimColor: '#b48a60',
    ceilingColor: '#121316',
    screenFrameColor: '#0a0b0d',
    stageLipColor: '#1f2025',
    railColor: '#94a3b8',
    sconceGlowColor: '#fff4e0',
    stepLightColor: '#fbbf24',
    seats: {
      premier: '#9f1239',
      prime: '#881337',
      front: '#7c2d12',
      selected: '#dc2626',
      held: '#b45309',
      booked: '#374151',
      selectedEmissive: '#ef4444',
    },
  },

  // Look B: Warm Grey, Walnut & Cream (Welcoming natural acoustic look)
  b: {
    id: 'b',
    name: 'Warm Grey & Cream',
    subtitle: 'Warm grey panelling, cream fabric panels & terracotta seats',
    floorColor: '#222326',
    tierColor: '#2b2c30',
    treadColor: '#35363b',
    wallColor: '#3a3836',
    acousticPanelColor: '#e8e2d8', // Cream fabric
    panelTrimColor: '#8c5e3c', // Warm Walnut
    ceilingColor: '#18181a',
    screenFrameColor: '#0e0e10',
    stageLipColor: '#2b2c30',
    railColor: '#b48a60', // Antique Bronze
    sconceGlowColor: '#fed7aa', // Warm Amber
    stepLightColor: '#f97316', // Warm Orange
    seats: {
      premier: '#9a3412', // Rust Red
      prime: '#c2410c', // Terracotta
      front: '#854d0e', // Warm Ochre
      selected: '#ea580c', // Bright Rust
      held: '#b45309', // Warm Amber
      booked: '#3f3f46', // Neutral Zinc
      selectedEmissive: '#f97316',
    },
  },

  // Look C: Midnight Navy & Deep Teal (High-contrast flagship aesthetic)
  c: {
    id: 'c',
    name: 'Midnight Navy & Teal',
    subtitle: 'Deep navy carpet, charcoal walls & deep blue/teal seats',
    floorColor: '#181f2c',
    tierColor: '#1e2638',
    treadColor: '#263045',
    wallColor: '#222733',
    acousticPanelColor: '#0f766e', // Vibrant Teal
    panelTrimColor: '#94a3b8', // Silver Trim
    ceilingColor: '#0f131a',
    screenFrameColor: '#090c10',
    stageLipColor: '#1e2638',
    railColor: '#cbd5e1', // Brushed Steel
    sconceGlowColor: '#bae6fd', // Cool Cyan/Ice
    stepLightColor: '#38bdf8', // Sky Blue
    seats: {
      premier: '#1e40af', // Deep Royal Blue
      prime: '#2563eb', // Sapphire Blue
      front: '#0d9488', // Petrol Teal
      selected: '#06b6d4', // Cyan Glow
      held: '#d97706', // Amber Accent
      booked: '#334155', // Slate Grey
      selectedEmissive: '#22d3ee',
    },
  },
};

export function getActiveLook(lookParam?: string | null): TheatreLookPalette {
  if (lookParam === 'b') return THEATRE_LOOKS.b;
  if (lookParam === 'c') return THEATRE_LOOKS.c;
  return THEATRE_LOOKS.a;
}
