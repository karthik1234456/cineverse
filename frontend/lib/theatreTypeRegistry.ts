/**
 * CineVerse Theatre Type Registry & Documented Scale
 * ===================================================
 * Defines architectural templates, real-world dimensions in metres,
 * scale conversion factors to scene units, target capacities, and arrangement patterns.
 * 
 * SCALE RATIO:
 * - 1.0 real-world metre = 2.0 scene units (METERS_TO_SCENE = 2.0)
 * - 1.0 scene unit = 0.50 metres (SCENE_TO_METERS = 0.50)
 * 
 * EXCEPTION:
 * - The supplied 100-seat hall ("cineverse_auditorium_v2.glb") keeps its own historical scale
 *   (~1.28u width ~ 0.55m; ~0.43m per unit) and is formally designated the "Compact hall".
 */

export const METERS_TO_SCENE = 2.0;
export const SCENE_TO_METERS = 0.5;

export type TheatreTypeId =
  | 'compact'
  | 'standard'
  | 'large'
  | 'flagship'
  | 'motion_seat'
  | 'dolby_atmos_4dx'
  | 'luxury_recliner'
  | 'boutique'
  | 'balcony';

export type ArrangementPattern =
  | 'triple_block'      // Left, Center, Right blocks with 2 aisles (e.g. 6-12-6)
  | 'single_aisle'      // 2 blocks with 1 central aisle (e.g. 8-aisle-8)
  | 'continental'       // Wall-to-wall continuous seating, no center aisles, wide row spacing
  | 'curved_flagship'   // Curved stadium rows with sweet-spot block and wide screen arc
  | 'luxury_pairs'      // Loveseat pairs with center cocktail tables
  | 'boutique_salon'    // Plush velvet sofas with wide social spacing
  | 'balcony_two_tier'  // Stalls level + elevated Balcony tier
  | 'motion_pods';      // Motion-seat pods of 2 or 4 on actuator platform bases

export type ScreenGeometryType =
  | 'standard_flat'
  | 'large_curved'
  | 'premium_direct_view'
  | 'boutique_small_flat'
  | 'panoramic_wrap';

export interface ScreenTypeDefinition {
  type: ScreenGeometryType;
  name: string;
  brandName?: string;
  aspectRatio: number;
  isCurved: boolean;
  curveRadiusM?: number;
  hasProjectorBeam: boolean;
  finish: 'matte_white' | 'glossy_led';
  bezel: {
    width: number;
    color: string;
    hasFrame: boolean;
    thinBlack?: boolean;
    clearFrame?: boolean;
  };
  wrapPanels?: {
    sideAngleDeg: number;
    sideWidthRatio: number;
    sideHeightRatio: number;
  };
}

export interface CeilingDesign {
  structure: 'coffered_grid' | 'steel_trusses' | 'industrial_rig' | 'coffered_walnut' | 'floating_clouds' | 'deep_coffers_balcony';
  cloudsCount: number;
  trussesCount: number;
  hasDucts: boolean;
  hasBaffles: boolean;
  hasEffectRigs: boolean;
}

export interface TheatrePalette {
  fabricPrimary: string;
  fabricSecondary: string;
  wallColor: string;
  panelColor: string;
  slatColor: string;
  ceilingColor: string;
  coveColor: string;
  skirtingColor: string;
  carpetColor: string;
  runnerColor: string;
  trimColor: string;
  boothColor: string;
}

export interface TheatreTypeDefinition {
  id: TheatreTypeId;
  name: string;
  label: string;
  licensedName?: string;
  licensedLabel?: string;
  targetSeats: [number, number]; // [min, max]
  typicalSeats: number;
  arrangementPattern: ArrangementPattern;
  ceilingDesign: CeilingDesign;
  palette: TheatrePalette;
  screenType: ScreenTypeDefinition;
  realWorldDimensions: {
    seatWidthM: number;
    rowPitchM: number;
    rakeStepM: number;
    aisleWidthM: number;
    ceilingHeightM: number;
    screenWidthM: number;
    screenHeightM: number;
  };
  sceneDimensions: {
    seatPitch: number;      // in scene units
    rowPitch: number;       // in scene units
    tierRise: number;       // in scene units
    aisleGap: number;       // in scene units
    ceilingHeight: number;  // in scene units
    screenWidth: number;    // in scene units
    screenHeight: number;   // in scene units
  };
  features: {
    is_4dx?: boolean;
    dolby_atmos?: boolean;
    motion_seats?: boolean;
    panoramic_wrap?: boolean;
    has_balcony?: boolean;
    curved_screen?: boolean;
    sweet_spot?: boolean;
    recliner_pairs?: boolean;
    sofas?: boolean;
  };
  description: string;
}

export const THEATRE_TYPE_REGISTRY: Record<TheatreTypeId, TheatreTypeDefinition> = {
  compact: {
    id: 'compact',
    name: 'Compact Hall',
    label: 'Compact 3D Hall (Reference)',
    targetSeats: [100, 100],
    typicalSeats: 100,
    arrangementPattern: 'single_aisle',
    ceilingDesign: {
      structure: 'coffered_grid',
      cloudsCount: 6,
      trussesCount: 4,
      hasDucts: true,
      hasBaffles: false,
      hasEffectRigs: false,
    },
    palette: {
      fabricPrimary: '#881337',
      fabricSecondary: '#9f1239',
      wallColor: '#1c1d22',
      panelColor: '#25272e',
      slatColor: '#1e2025',
      ceilingColor: '#121316',
      coveColor: '#fff4e0',
      skirtingColor: '#fbbf24',
      carpetColor: '#18191d',
      runnerColor: '#25272e',
      trimColor: '#d4af37',
      boothColor: '#121316',
    },
    screenType: {
      type: 'standard_flat',
      name: 'Standard flat screen',
      aspectRatio: 2.15,
      isCurved: false,
      hasProjectorBeam: true,
      finish: 'matte_white',
      bezel: { width: 0.25, color: '#111115', hasFrame: true },
    },
    realWorldDimensions: {
      seatWidthM: 0.55,
      rowPitchM: 1.05,
      rakeStepM: 0.18,
      aisleWidthM: 1.20,
      ceilingHeightM: 8.5,
      screenWidthM: 15.6 * 0.43, // historical bespoke scale
      screenHeightM: 7.25 * 0.43,
    },
    sceneDimensions: {
      seatPitch: 1.20,
      rowPitch: 1.50,
      tierRise: 0.22,
      aisleGap: 1.20,
      ceilingHeight: 11.2,
      screenWidth: 15.6,
      screenHeight: 7.25,
    },
    features: {
      curved_screen: false,
    },
    description: 'Original 100-seat demonstration hall with bespoke GLB geometry and 10 rows.',
  },

  standard: {
    id: 'standard',
    name: 'Standard Multiplex Hall',
    label: 'Standard Stadium Hall',
    targetSeats: [160, 260],
    typicalSeats: 240,
    arrangementPattern: 'triple_block',
    ceilingDesign: {
      structure: 'coffered_grid',
      cloudsCount: 6,
      trussesCount: 4,
      hasDucts: true,
      hasBaffles: false,
      hasEffectRigs: false,
    },
    palette: {
      fabricPrimary: '#881337',
      fabricSecondary: '#9f1239',
      wallColor: '#1c1d22',
      panelColor: '#25272e',
      slatColor: '#1e2025',
      ceilingColor: '#121316',
      coveColor: '#fff4e0',
      skirtingColor: '#fbbf24',
      carpetColor: '#18191d',
      runnerColor: '#25272e',
      trimColor: '#334155',
      boothColor: '#121316',
    },
    screenType: {
      type: 'standard_flat',
      name: 'Standard flat screen',
      aspectRatio: 2.15,
      isCurved: false,
      hasProjectorBeam: true,
      finish: 'matte_white',
      bezel: { width: 0.25, color: '#111115', hasFrame: true },
    },
    realWorldDimensions: {
      seatWidthM: 0.52,
      rowPitchM: 1.00,
      rakeStepM: 0.17,
      aisleWidthM: 1.20,
      ceilingHeightM: 10.0,
      screenWidthM: 14.0,
      screenHeightM: 6.5,
    },
    sceneDimensions: {
      seatPitch: 1.20,  // 0.52m + 0.08m gap = 0.60m * 2.0
      rowPitch: 2.00,   // 1.00m * 2.0
      tierRise: 0.34,   // 0.17m * 2.0
      aisleGap: 2.40,   // 1.20m * 2.0
      ceilingHeight: 10.0 * METERS_TO_SCENE,
      screenWidth: 14.0 * METERS_TO_SCENE,
      screenHeight: 6.5 * METERS_TO_SCENE,
    },
    features: {
      curved_screen: false,
    },
    description: 'Wide straight-row layout with a centre block and two narrower side blocks, navy coffered ceiling, blue wall-wash lighting, dark charcoal carpet, and deep red fabric seats.',
  },

  large: {
    id: 'large',
    name: 'Large Format Cinema',
    label: 'Large Format Auditorium',
    targetSeats: [300, 420],
    typicalSeats: 420,
    arrangementPattern: 'triple_block',
    ceilingDesign: {
      structure: 'steel_trusses',
      cloudsCount: 12,
      trussesCount: 5,
      hasDucts: true,
      hasBaffles: true,
      hasEffectRigs: false,
    },
    palette: {
      fabricPrimary: '#881337',
      fabricSecondary: '#9f1239',
      wallColor: '#1c1d22',
      panelColor: '#25272e',
      slatColor: '#1e2025',
      ceilingColor: '#121316',
      coveColor: '#fff4e0',
      skirtingColor: '#fbbf24',
      carpetColor: '#18191d',
      runnerColor: '#25272e',
      trimColor: '#d4af37',
      boothColor: '#121316',
    },
    screenType: {
      type: 'large_curved',
      name: 'Large curved screen',
      aspectRatio: 2.15,
      isCurved: true,
      curveRadiusM: 32.0,
      hasProjectorBeam: true,
      finish: 'matte_white',
      bezel: { width: 0.20, color: '#090a0f', hasFrame: true },
    },
    realWorldDimensions: {
      seatWidthM: 0.56,
      rowPitchM: 1.05,
      rakeStepM: 0.19,
      aisleWidthM: 1.25,
      ceilingHeightM: 12.0,
      screenWidthM: 20.0,
      screenHeightM: 9.3,
    },
    sceneDimensions: {
      seatPitch: 0.56 * METERS_TO_SCENE,  // 1.12
      rowPitch: 1.05 * METERS_TO_SCENE,   // 2.10
      tierRise: 0.19 * METERS_TO_SCENE,   // 0.38
      aisleGap: 1.25 * METERS_TO_SCENE,   // 2.50
      ceilingHeight: 12.0 * METERS_TO_SCENE,
      screenWidth: 20.0 * METERS_TO_SCENE,
      screenHeight: 9.3 * METERS_TO_SCENE,
    },
    features: {
      curved_screen: true,
    },
    description: 'High-capacity 18-24 row auditorium with triple blocks (6-9-6) and steep rake.',
  },

  flagship: {
    id: 'flagship',
    name: 'Flagship Large Format',
    label: 'Flagship Large Format Auditorium',
    targetSeats: [420, 560],
    typicalSeats: 560,
    arrangementPattern: 'curved_flagship',
    ceilingDesign: {
      structure: 'steel_trusses',
      cloudsCount: 14,
      trussesCount: 6,
      hasDucts: true,
      hasBaffles: true,
      hasEffectRigs: false,
    },
    palette: {
      fabricPrimary: '#881337',
      fabricSecondary: '#9f1239',
      wallColor: '#1c1d22',
      panelColor: '#25272e',
      slatColor: '#1e2025',
      ceilingColor: '#121316',
      coveColor: '#fff4e0',
      skirtingColor: '#fbbf24',
      carpetColor: '#18191d',
      runnerColor: '#25272e',
      trimColor: '#d4af37',
      boothColor: '#121316',
    },
    screenType: {
      type: 'large_curved',
      name: 'Large curved screen',
      brandName: 'Large Format',
      aspectRatio: 1.85,
      isCurved: true,
      curveRadiusM: 28.0,
      hasProjectorBeam: true,
      finish: 'matte_white',
      bezel: { width: 0.15, color: '#05070a', hasFrame: true },
    },
    realWorldDimensions: {
      seatWidthM: 0.58,
      rowPitchM: 1.10,
      rakeStepM: 0.20,
      aisleWidthM: 1.30,
      ceilingHeightM: 14.0,
      screenWidthM: 22.0,
      screenHeightM: 11.9,
    },
    sceneDimensions: {
      seatPitch: 0.58 * METERS_TO_SCENE,  // 1.16
      rowPitch: 1.10 * METERS_TO_SCENE,   // 2.20
      tierRise: 0.20 * METERS_TO_SCENE,   // 0.40
      aisleGap: 1.30 * METERS_TO_SCENE,   // 2.60
      ceilingHeight: 14.0 * METERS_TO_SCENE,
      screenWidth: 22.0 * METERS_TO_SCENE,
      screenHeight: 11.9 * METERS_TO_SCENE,
    },
    features: {
      curved_screen: true,
      sweet_spot: true,
    },
    description: 'Colossal 20-row flagship hall with 25m curved screen, curved seating arc, and sweet spot.',
  },

  motion_seat: {
    id: 'motion_seat',
    name: 'Motion-seat Hall',
    label: 'Motion-seat Hall',
    licensedName: 'Motion-seat Hall',
    licensedLabel: 'Motion-seat Hall',
    targetSeats: [160, 280],
    typicalSeats: 240,
    arrangementPattern: 'motion_pods',
    ceilingDesign: {
      structure: 'industrial_rig',
      cloudsCount: 8,
      trussesCount: 5,
      hasDucts: true,
      hasBaffles: true,
      hasEffectRigs: true,
    },
    palette: {
      fabricPrimary: '#881337',
      fabricSecondary: '#9f1239',
      wallColor: '#1c1d22',
      panelColor: '#25272e',
      slatColor: '#1e2025',
      ceilingColor: '#121316',
      coveColor: '#fff4e0',
      skirtingColor: '#fbbf24',
      carpetColor: '#18191d',
      runnerColor: '#25272e',
      trimColor: '#38bdf8',
      boothColor: '#121316',
    },
    screenType: {
      type: 'panoramic_wrap',
      name: 'Panoramic wrap screen',
      aspectRatio: 2.12,
      isCurved: false,
      hasProjectorBeam: true,
      finish: 'matte_white',
      bezel: { width: 0.25, color: '#0a0d14', hasFrame: true, clearFrame: true },
      wrapPanels: {
        sideAngleDeg: 25.0,
        sideWidthRatio: 0.42,
        sideHeightRatio: 0.82,
      },
    },
    realWorldDimensions: {
      seatWidthM: 0.56,
      rowPitchM: 1.25,
      rakeStepM: 0.24,
      aisleWidthM: 1.25,
      ceilingHeightM: 11.5,
      screenWidthM: 16.0,
      screenHeightM: 7.5,
    },
    sceneDimensions: {
      seatPitch: 1.28, // 0.56m + 0.08m gap = 0.64m * 2.0
      rowPitch: 2.50,  // 1.25m * 2.0
      tierRise: 0.48,  // 0.24m * 2.0
      aisleGap: 2.50,  // 1.25m * 2.0
      ceilingHeight: 11.5 * METERS_TO_SCENE,
      screenWidth: 16.0 * METERS_TO_SCENE,
      screenHeight: 7.5 * METERS_TO_SCENE,
    },
    features: {
      motion_seats: true,
      panoramic_wrap: true,
    },
    description: 'Black walls and ceiling with radiating blue, red and white LED bars, black seats in pods of four on visible platform bases with red LED edges, and wrap screen.',
  },

  // Alias for backward compatibility
  get dolby_atmos_4dx() {
    return this.motion_seat;
  },

  luxury_recliner: {
    id: 'luxury_recliner',
    name: 'Luxury Recliner Hall',
    label: 'VIP Luxury Recliner Lounge',
    targetSeats: [80, 160],
    typicalSeats: 128,
    arrangementPattern: 'luxury_pairs',
    ceilingDesign: {
      structure: 'coffered_walnut',
      cloudsCount: 6,
      trussesCount: 4,
      hasDucts: false,
      hasBaffles: false,
      hasEffectRigs: false,
    },
    palette: {
      fabricPrimary: '#562c18',
      fabricSecondary: '#6d381e',
      wallColor: '#1c1d22',
      panelColor: '#25272e',
      slatColor: '#1e2025',
      ceilingColor: '#121316',
      coveColor: '#fff4e0',
      skirtingColor: '#fbbf24',
      carpetColor: '#18191d',
      runnerColor: '#25272e',
      trimColor: '#b48a60',
      boothColor: '#121316',
    },
    screenType: {
      type: 'premium_direct_view',
      name: 'Premium direct-view screen',
      aspectRatio: 2.08,
      isCurved: false,
      hasProjectorBeam: false,
      finish: 'glossy_led',
      bezel: { width: 0.08, color: '#050505', thinBlack: true, hasFrame: true },
    },
    realWorldDimensions: {
      seatWidthM: 0.92,
      rowPitchM: 1.42,  // 1.4 to 1.6 m row pitch
      rakeStepM: 0.22,
      aisleWidthM: 1.40,
      ceilingHeightM: 9.0,
      screenWidthM: 13.0,
      screenHeightM: 6.0,
    },
    sceneDimensions: {
      seatPitch: 2.16,  // 0.92m + 0.16m table = 1.08m * 2.0
      rowPitch: 2.84,   // 1.42m * 2.0
      tierRise: 0.44,   // 0.22m * 2.0
      aisleGap: 2.80,   // 1.40m * 2.0
      ceilingHeight: 9.0 * METERS_TO_SCENE,
      screenWidth: 13.0 * METERS_TO_SCENE,
      screenHeight: 6.0 * METERS_TO_SCENE,
    },
    features: {
      recliner_pairs: true,
      curved_screen: false,
    },
    description: 'Black walls with vertical amber LED outline panels, amber ceiling edge strip, quilted caramel leather recliners with wooden swivel tables, and dark wood trim.',
  },

  boutique: {
    id: 'boutique',
    name: 'Boutique Plush Velvet Salon',
    label: 'Boutique Velvet Salon',
    targetSeats: [30, 60],
    typicalSeats: 48,
    arrangementPattern: 'boutique_salon',
    ceilingDesign: {
      structure: 'floating_clouds',
      cloudsCount: 6,
      trussesCount: 3,
      hasDucts: false,
      hasBaffles: false,
      hasEffectRigs: false,
    },
    palette: {
      fabricPrimary: '#562c18',
      fabricSecondary: '#6d381e',
      wallColor: '#1c1d22',
      panelColor: '#25272e',
      slatColor: '#1e2025',
      ceilingColor: '#121316',
      coveColor: '#fff4e0',
      skirtingColor: '#fbbf24',
      carpetColor: '#18191d',
      runnerColor: '#25272e',
      trimColor: '#fbbf24',
      boothColor: '#121316',
    },
    screenType: {
      type: 'boutique_small_flat',
      name: 'Boutique small flat screen',
      aspectRatio: 2.14,
      isCurved: false,
      hasProjectorBeam: true,
      finish: 'matte_white',
      bezel: { width: 0.35, color: '#2a1a12', hasFrame: true },
    },
    realWorldDimensions: {
      seatWidthM: 0.90,
      rowPitchM: 1.35,
      rakeStepM: 0.16,
      aisleWidthM: 1.20,
      ceilingHeightM: 8.0,
      screenWidthM: 12.0,
      screenHeightM: 5.6,
    },
    sceneDimensions: {
      seatPitch: 0.90 * METERS_TO_SCENE,  // 1.80
      rowPitch: 1.35 * METERS_TO_SCENE,   // 2.70
      tierRise: 0.16 * METERS_TO_SCENE,   // 0.32
      aisleGap: 1.20 * METERS_TO_SCENE,   // 2.40
      ceilingHeight: 8.0 * METERS_TO_SCENE,
      screenWidth: 12.0 * METERS_TO_SCENE,
      screenHeight: 5.6 * METERS_TO_SCENE,
    },
    features: {
      sofas: true,
      curved_screen: false,
    },
    description: 'Intimate boutique lounge featuring fluted velvet sofas and club ambiance.',
  },

  balcony: {
    id: 'balcony',
    name: 'Grand Curved Hall with Balcony',
    label: 'Grand Balcony Auditorium',
    targetSeats: [420, 560],
    typicalSeats: 520,
    arrangementPattern: 'balcony_two_tier',
    ceilingDesign: {
      structure: 'deep_coffers_balcony',
      cloudsCount: 12,
      trussesCount: 6,
      hasDucts: true,
      hasBaffles: false,
      hasEffectRigs: false,
    },
    palette: {
      fabricPrimary: '#881337',
      fabricSecondary: '#9f1239',
      wallColor: '#1c1d22',
      panelColor: '#25272e',
      slatColor: '#1e2025',
      ceilingColor: '#121316',
      coveColor: '#fff4e0',
      skirtingColor: '#fbbf24',
      carpetColor: '#18191d',
      runnerColor: '#25272e',
      trimColor: '#d4af37',
      boothColor: '#121316',
    },
    screenType: {
      type: 'large_curved',
      name: 'Large curved screen',
      aspectRatio: 2.24,
      isCurved: true,
      curveRadiusM: 32.0,
      hasProjectorBeam: true,
      finish: 'matte_white',
      bezel: { width: 0.25, color: '#15101a', hasFrame: true },
    },
    realWorldDimensions: {
      seatWidthM: 0.54,
      rowPitchM: 1.05,
      rakeStepM: 0.20,
      aisleWidthM: 1.30,
      ceilingHeightM: 14.0, // 14 m ceiling in large balcony halls
      screenWidthM: 22.0,
      screenHeightM: 9.8,
    },
    sceneDimensions: {
      seatPitch: 1.24,  // 0.54m + 0.08m gap = 0.62m * 2.0
      rowPitch: 2.10,   // 1.05m * 2.0
      tierRise: 0.40,   // 0.20m * 2.0
      aisleGap: 2.60,   // 1.30m * 2.0
      ceilingHeight: 14.0 * METERS_TO_SCENE,
      screenWidth: 22.0 * METERS_TO_SCENE,
      screenHeight: 9.8 * METERS_TO_SCENE,
    },
    features: {
      has_balcony: true,
      curved_screen: true,
    },
    description: 'Curved stadium seating with real balcony level, deep burgundy-brown wall panels, dark ceiling with lighting trusses, black stage apron, and curved screen.',
  },
};

/**
 * Returns the theatre type definition matching the hall's parameters or screen type.
 */
export function getTheatreTypeDefinition(
  typeOrScreen?: string,
  totalSeats?: number
): TheatreTypeDefinition {
  const norm = (typeOrScreen || '').toLowerCase();

  if (norm === 'compact' || totalSeats === 100 || norm.includes('interactive')) {
    return THEATRE_TYPE_REGISTRY.compact;
  }
  if (norm === 'dolby_atmos_4dx' || norm === 'motion_seat' || norm.includes('motion')) {
    return THEATRE_TYPE_REGISTRY.motion_seat;
  }
  if (norm in THEATRE_TYPE_REGISTRY) {
    return THEATRE_TYPE_REGISTRY[norm as TheatreTypeId];
  }
  if (norm.includes('balcony') || (totalSeats && totalSeats >= 600)) {
    return THEATRE_TYPE_REGISTRY.balcony;
  }
  if (norm.includes('flagship') || (norm.includes('imax') && totalSeats && totalSeats >= 420)) {
    return THEATRE_TYPE_REGISTRY.flagship;
  }
  if (norm.includes('recliner') || norm.includes('gold') || norm.includes('luxe')) {
    return THEATRE_TYPE_REGISTRY.luxury_recliner;
  }
  if (norm.includes('boutique') || norm.includes('salon') || norm.includes('lounge')) {
    return THEATRE_TYPE_REGISTRY.boutique;
  }
  if (norm.includes('large') || (totalSeats && totalSeats >= 300)) {
    return THEATRE_TYPE_REGISTRY.large;
  }
  return THEATRE_TYPE_REGISTRY.standard;
}
