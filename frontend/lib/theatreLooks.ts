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
  // Look A: Classic Cinema Red (Default standard auditorium)
  a: {
    id: 'a',
    name: 'Classic Velvet Red',
    subtitle: 'Classic velvet red seats (#6E141A), oxblood acoustic panels (#3B1318) & dark espresso carpet (#141316)',
    floorColor: '#141316', // Dark espresso carpet
    tierColor: '#17181c',
    treadColor: '#1a191d', // Slightly contrasting aisle runner
    wallColor: '#1C1E24', // Side acoustic walls
    acousticPanelColor: '#3B1318', // Oxblood accent panels
    panelTrimColor: '#18191C', // Gunmetal trim
    ceilingColor: '#0E0F12', // Screen wall & ceiling
    screenFrameColor: '#0E0F12',
    stageLipColor: '#141316',
    railColor: '#18191C', // Gunmetal railings
    sconceGlowColor: '#FF9E2C', // Warm amber
    stepLightColor: '#FF9E2C', // Warm amber step LEDs
    seats: {
      premier: '#6E141A', // Classic velvet red
      prime: '#6E141A',
      front: '#5c1116',
      selected: '#22C55E', // Selected emerald green
      held: '#F59E0B', // Held amber
      booked: '#3F424A', // Booked desaturated grey
      selectedEmissive: '#22C55E',
    },
  },

  // Look B: Midnight Navy & Cognac Leather (Premium / Recliner Lounges)
  b: {
    id: 'b',
    name: 'Midnight Navy & Cognac Leather',
    subtitle: 'Midnight navy acoustic panels (#141D2B), cognac leather seats (#4A2818) & dark espresso carpet (#141316)',
    floorColor: '#141316', // Dark espresso carpet
    tierColor: '#17181c',
    treadColor: '#1a191d', // Aisle runner
    wallColor: '#1C1E24', // Matte fabric side walls
    acousticPanelColor: '#141D2B', // Midnight navy accent panels
    panelTrimColor: '#18191C', // Gunmetal trim
    ceilingColor: '#0E0F12',
    screenFrameColor: '#0E0F12',
    stageLipColor: '#141316',
    railColor: '#18191C',
    sconceGlowColor: '#FF9E2C', // Warm amber
    stepLightColor: '#FF9E2C',
    seats: {
      premier: '#4A2818', // Cognac leather
      prime: '#4A2818',
      front: '#3d2013',
      selected: '#22C55E', // Selected emerald green
      held: '#F59E0B', // Held amber
      booked: '#3F424A', // Booked desaturated grey
      selectedEmissive: '#22C55E',
    },
  },

  // Look C: Midnight Navy & Deep Slate (Dolby Cinema / 4DX / Technical Halls)
  c: {
    id: 'c',
    name: 'Midnight Navy & Deep Slate',
    subtitle: 'Midnight navy panels (#141D2B), deep slate leather seats (#262930) & soft blue LEDs (#388BFF)',
    floorColor: '#141316', // Dark espresso carpet
    tierColor: '#17181c',
    treadColor: '#1a191d',
    wallColor: '#1C1E24',
    acousticPanelColor: '#141D2B', // Midnight navy
    panelTrimColor: '#18191C',
    ceilingColor: '#0E0F12',
    screenFrameColor: '#0E0F12',
    stageLipColor: '#141316',
    railColor: '#18191C',
    sconceGlowColor: '#388BFF', // Soft blue LEDs
    stepLightColor: '#388BFF',
    seats: {
      premier: '#262930', // Deep slate leather
      prime: '#262930',
      front: '#1e2026',
      selected: '#22C55E', // Selected emerald green
      held: '#F59E0B', // Held amber
      booked: '#3F424A', // Booked desaturated grey
      selectedEmissive: '#22C55E',
    },
  },
};

export function getActiveLook(lookParam?: string | null): TheatreLookPalette {
  if (lookParam === 'b') return THEATRE_LOOKS.b;
  if (lookParam === 'c') return THEATRE_LOOKS.c;
  return THEATRE_LOOKS.a;
}
