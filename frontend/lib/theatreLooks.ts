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
  // Look A: Royal Burgundy and Gold (Default)
  a: {
    id: 'a',
    name: 'Royal Burgundy & Gold',
    subtitle: 'Velvet burgundy seats, warm cream walls & gold trim',
    floorColor: '#25151c',
    tierColor: '#2b1b22',
    treadColor: '#34212a',
    wallColor: '#5c2230',
    acousticPanelColor: '#7a1f33',
    panelTrimColor: '#d4af37',
    ceilingColor: '#1d1419',
    screenFrameColor: '#120d10',
    stageLipColor: '#2e1823',
    railColor: '#d4af37', // Satin Brass
    sconceGlowColor: '#fef08a', // Warm Gold 2800K
    stepLightColor: '#fbbf24', // Amber/gold aisle
    seats: {
      premier: '#9f1239', // Ruby Burgundy
      prime: '#881337', // Deep Rose
      front: '#7c2d12', // Warm Cognac Amber
      selected: '#dc2626', // Vivid Crimson Highlight
      held: '#b45309', // Warm Amber
      booked: '#374151', // Neutral Slate
      selectedEmissive: '#ef4444',
    },
  },

  // Look B: Warm Walnut and Cream
  b: {
    id: 'b',
    name: 'Warm Walnut & Cream',
    subtitle: 'Walnut panelling, cream fabric panels & rust-red seats',
    floorColor: '#2c1e19',
    tierColor: '#36251e',
    treadColor: '#422e25',
    wallColor: '#4d3326',
    acousticPanelColor: '#d6c8b4', // Cream fabric
    panelTrimColor: '#8c5e3c', // Warm Walnut
    ceilingColor: '#1f1612',
    screenFrameColor: '#140f0c',
    stageLipColor: '#38251e',
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

  // Look C: Midnight Indigo and Teal
  c: {
    id: 'c',
    name: 'Midnight Indigo & Teal',
    subtitle: 'Indigo walls, vibrant teal accents & deep blue seats',
    floorColor: '#151b28',
    tierColor: '#1b2234',
    treadColor: '#222b40',
    wallColor: '#1e293b',
    acousticPanelColor: '#0f766e', // Vibrant Teal
    panelTrimColor: '#94a3b8', // Silver Trim
    ceilingColor: '#0f172a',
    screenFrameColor: '#0b1120',
    stageLipColor: '#1e293b',
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

