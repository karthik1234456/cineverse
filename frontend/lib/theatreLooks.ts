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
    subtitle: 'Classic velvet red seats (#8D1C24), oxblood acoustic panels (#3B1318) & dark espresso carpet (#222026)',
    floorColor: '#222026', // Dark espresso carpet (+40% lightness lift)
    tierColor: '#25242b',
    treadColor: '#2c2a32', // Contrasting aisle runner
    wallColor: '#272B34', // Side acoustic walls
    acousticPanelColor: '#4A181F', // Oxblood accent panels
    panelTrimColor: '#1F2024', // Gunmetal trim
    ceilingColor: '#121318', // Screen wall & ceiling
    screenFrameColor: '#121318',
    stageLipColor: '#222026',
    railColor: '#1F2024', // Gunmetal railings
    sconceGlowColor: '#FF9E2C', // Warm amber
    stepLightColor: '#FF9E2C', // Warm amber step LEDs
    seats: {
      premier: '#8D1C24', // Classic velvet red (+30% lightness)
      prime: '#8D1C24',
      front: '#75171e',
      selected: '#22C55E', // Selected emerald green
      held: '#F59E0B', // Held amber
      booked: '#4C505A', // Booked desaturated grey
      selectedEmissive: '#22C55E',
    },
  },

  // Look B: Midnight Navy & Cognac Leather (Premium / Recliner Lounges)
  b: {
    id: 'b',
    name: 'Midnight Navy & Cognac Leather',
    subtitle: 'Midnight navy acoustic panels (#141D2B), cognac leather seats (#663822) & dark espresso carpet (#222026)',
    floorColor: '#222026', // Dark espresso carpet
    tierColor: '#25242b',
    treadColor: '#2c2a32', // Aisle runner
    wallColor: '#272B34', // Matte fabric side walls
    acousticPanelColor: '#1B263B', // Midnight navy accent panels
    panelTrimColor: '#1F2024', // Gunmetal trim
    ceilingColor: '#121318',
    screenFrameColor: '#121318',
    stageLipColor: '#222026',
    railColor: '#1F2024',
    sconceGlowColor: '#FF9E2C', // Warm amber
    stepLightColor: '#FF9E2C',
    seats: {
      premier: '#663822', // Cognac leather (+35% lightness)
      prime: '#663822',
      front: '#542d1b',
      selected: '#22C55E', // Selected emerald green
      held: '#F59E0B', // Held amber
      booked: '#4C505A', // Booked desaturated grey
      selectedEmissive: '#22C55E',
    },
  },

  // Look C: Midnight Navy & Deep Slate (Dolby Cinema / 4DX / Technical Halls)
  c: {
    id: 'c',
    name: 'Midnight Navy & Deep Slate',
    subtitle: 'Midnight navy panels (#141D2B), deep slate leather seats (#3A3F4A) & soft blue LEDs (#388BFF)',
    floorColor: '#222026', // Dark espresso carpet
    tierColor: '#25242b',
    treadColor: '#2c2a32',
    wallColor: '#272B34',
    acousticPanelColor: '#1B263B', // Midnight navy
    panelTrimColor: '#1F2024',
    ceilingColor: '#121318',
    screenFrameColor: '#121318',
    stageLipColor: '#222026',
    railColor: '#1F2024',
    sconceGlowColor: '#388BFF', // Soft blue LEDs
    stepLightColor: '#388BFF',
    seats: {
      premier: '#3A3F4A', // Deep slate leather (+40% lightness)
      prime: '#3A3F4A',
      front: '#2f343d',
      selected: '#22C55E', // Selected emerald green
      held: '#F59E0B', // Held amber
      booked: '#4C505A', // Booked desaturated grey
      selectedEmissive: '#22C55E',
    },
  },
};

export function getActiveLook(lookParam?: string | null): TheatreLookPalette {
  if (lookParam === 'b') return THEATRE_LOOKS.b;
  if (lookParam === 'c') return THEATRE_LOOKS.c;
  return THEATRE_LOOKS.a;
}
