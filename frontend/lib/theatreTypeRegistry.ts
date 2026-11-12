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
      fabricPrimary: '#6b1828',
      fabricSecondary: '#7a1b2e',
      wallColor: '#2a2c33',
      panelColor: '#363942',
      slatColor: '#25272e',
      ceilingColor: '#141518',
      coveColor: '#ffe4a0',
      skirtingColor: '#ffb74d',
      carpetColor: '#1e2025',
      runnerColor: '#2b2e36',
      trimColor: '#d4af37',
      boothColor: '#181a1f',
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
    name: 'Standard Cinema Hall',
    label: 'Standard Stadium Hall',
    targetSeats: [180, 260],
    typicalSeats: 224,
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
      fabricPrimary: '#6b1828',
      fabricSecondary: '#7a1b2e',
      wallColor: '#2a2c33',
      panelColor: '#363942',
      slatColor: '#25272e',
      ceilingColor: '#141518',
      coveColor: '#ffe4a0',
      skirtingColor: '#ffb74d',
      carpetColor: '#1e2025',
      runnerColor: '#2b2e36',
      trimColor: '#d4af37',
      boothColor: '#181a1f',
    },
    screenType: {
      type: 'standard_flat',
      name: 'Standard flat screen',
      aspectRatio: 2.16,
      isCurved: false,
      hasProjectorBeam: true,
      finish: 'matte_white',
      bezel: { width: 0.30, color: '#111115', hasFrame: true },
    },
    realWorldDimensions: {
      seatWidthM: 0.55,
      rowPitchM: 1.00,
      rakeStepM: 0.18,
      aisleWidthM: 1.20,
      ceilingHeightM: 10.0,
      screenWidthM: 16.0,
      screenHeightM: 7.4,
    },
    sceneDimensions: {
      seatPitch: 0.55 * METERS_TO_SCENE,  // 1.10
      rowPitch: 1.00 * METERS_TO_SCENE,   // 2.00
      tierRise: 0.18 * METERS_TO_SCENE,   // 0.36
      aisleGap: 1.20 * METERS_TO_SCENE,   // 2.40
      ceilingHeight: 10.0 * METERS_TO_SCENE,
      screenWidth: 16.0 * METERS_TO_SCENE,
      screenHeight: 7.4 * METERS_TO_SCENE,
    },
    features: {
      curved_screen: false,
    },
    description: 'Mainstream 14-18 row cinema with a central aisle and clear sightlines.',
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
      fabricPrimary: '#1e1b4b',
      fabricSecondary: '#312e81',
      wallColor: '#181824',
      panelColor: '#252438',
      slatColor: '#2b2738',
      ceilingColor: '#0f0f17',
      coveColor: '#818cf8',
      skirtingColor: '#6366f1',
      carpetColor: '#181628',
      runnerColor: '#3730a3',
      trimColor: '#a5b4fc',
      boothColor: '#13121f',
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
      dolby_atmos: true,
    },
    description: 'High-capacity 18-24 row auditorium with triple blocks (6-9-6) and steep rake.',
  },

  flagship: {
    id: 'flagship',
    name: 'IMAX-Style Flagship',
    label: 'IMAX Laser Flagship',
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
      fabricPrimary: '#0f223d',
      fabricSecondary: '#1d3d63',
      wallColor: '#0b1626',
      panelColor: '#112239',
      slatColor: '#1e293b',
      ceilingColor: '#090d14',
      coveColor: '#38bdf8',
      skirtingColor: '#0284c7',
      carpetColor: '#0c192c',
      runnerColor: '#0f3b60',
      trimColor: '#94a3b8',
      boothColor: '#0f172a',
    },
    screenType: {
      type: 'large_curved',
      name: 'Large curved screen',
      brandName: 'IMAX',
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
      screenWidthM: 25.0, // 20-26m IMAX specification
      screenHeightM: 13.5, // 1.90 / 1.43 aspect ratio
    },
    sceneDimensions: {
      seatPitch: 0.58 * METERS_TO_SCENE,  // 1.16
      rowPitch: 1.10 * METERS_TO_SCENE,   // 2.20
      tierRise: 0.20 * METERS_TO_SCENE,   // 0.40
      aisleGap: 1.30 * METERS_TO_SCENE,   // 2.60
      ceilingHeight: 14.0 * METERS_TO_SCENE,
      screenWidth: 25.0 * METERS_TO_SCENE,
      screenHeight: 13.5 * METERS_TO_SCENE,
    },
    features: {
      curved_screen: true,
      sweet_spot: true,
      dolby_atmos: true,
    },
    description: 'Colossal 20-row flagship hall with 25m curved screen, curved seating arc, and sweet spot.',
  },

  dolby_atmos_4dx: {
    id: 'dolby_atmos_4dx',
    name: 'Motion-seat Hall',
    label: 'Motion-seat Experience',
    licensedName: 'Dolby Atmos & 4DX Experience',
    licensedLabel: '4DX Motion Theatre',
    targetSeats: [160, 300],
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
      fabricPrimary: '#121417',
      fabricSecondary: '#1c2127',
      wallColor: '#181a1f',
      panelColor: '#22262c',
      slatColor: '#282e36',
      ceilingColor: '#0e1013',
      coveColor: '#06b6d4',
      skirtingColor: '#0284c7',
      carpetColor: '#15171b',
      runnerColor: '#083344',
      trimColor: '#38bdf8',
      boothColor: '#12151a',
    },
    screenType: {
      type: 'panoramic_wrap',
      name: 'Panoramic wrap screen',
      brandName: 'ScreenX',
      aspectRatio: 1.90,
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
      screenWidthM: 18.0,
      screenHeightM: 9.5,
    },
    sceneDimensions: {
      seatPitch: 0.56 * METERS_TO_SCENE, // 1.12
      rowPitch: 1.25 * METERS_TO_SCENE,  // 2.50
      tierRise: 0.24 * METERS_TO_SCENE,  // 0.48
      aisleGap: 1.25 * METERS_TO_SCENE,  // 2.50
      ceilingHeight: 11.5 * METERS_TO_SCENE,
      screenWidth: 18.0 * METERS_TO_SCENE,
      screenHeight: 9.5 * METERS_TO_SCENE,
    },
    features: {
      is_4dx: true,
      dolby_atmos: true,
      motion_seats: true,
      panoramic_wrap: true,
    },
    description: 'Sensory motion-seat theatre with synchronized motion pods, panoramic wrap screen, and atmospheric effect rig.',
  },

  luxury_recliner: {
    id: 'luxury_recliner',
    name: 'Luxe Recliner & Gold Lounge',
    label: 'VIP Recliner Lounge',
    targetSeats: [60, 120],
    typicalSeats: 84,
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
      fabricPrimary: '#38241b',
      fabricSecondary: '#523628',
      wallColor: '#3d281e',
      panelColor: '#5a3c2d',
      slatColor: '#3b2216',
      ceilingColor: '#1c130e',
      coveColor: '#ffedd5',
      skirtingColor: '#f59e0b',
      carpetColor: '#281b15',
      runnerColor: '#451a03',
      trimColor: '#d97706',
      boothColor: '#261812',
    },
    screenType: {
      type: 'premium_direct_view',
      name: 'Premium direct-view screen',
      aspectRatio: 2.15,
      isCurved: false,
      hasProjectorBeam: false,
      finish: 'glossy_led',
      bezel: { width: 0.08, color: '#050505', thinBlack: true, hasFrame: true },
    },
    realWorldDimensions: {
      seatWidthM: 0.95, // 0.9 to 1.0 m wide seats
      rowPitchM: 1.50,  // 1.4 to 1.6 m row pitch
      rakeStepM: 0.22,
      aisleWidthM: 1.30,
      ceilingHeightM: 8.5,
      screenWidthM: 14.0,
      screenHeightM: 6.5,
    },
    sceneDimensions: {
      seatPitch: 0.95 * METERS_TO_SCENE,  // 1.90
      rowPitch: 1.50 * METERS_TO_SCENE,   // 3.00
      tierRise: 0.22 * METERS_TO_SCENE,   // 0.44
      aisleGap: 1.30 * METERS_TO_SCENE,   // 2.60
      ceilingHeight: 8.5 * METERS_TO_SCENE,
      screenWidth: 14.0 * METERS_TO_SCENE,
      screenHeight: 6.5 * METERS_TO_SCENE,
    },
    features: {
      recliner_pairs: true,
      curved_screen: false,
    },
    description: 'Ultra-exclusive luxury hall with leather recliner pairs and generous legroom.',
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
      fabricPrimary: '#2e4858',
      fabricSecondary: '#83475e',
      wallColor: '#42393b',
      panelColor: '#615357',
      slatColor: '#4a3f3b',
      ceilingColor: '#1b1617',
      coveColor: '#fef3c7',
      skirtingColor: '#fbbf24',
      carpetColor: '#292123',
      runnerColor: '#4c1d30',
      trimColor: '#fbbf24',
      boothColor: '#262021',
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
    name: 'Grand Balcony Auditorium',
    label: 'Grand Balcony Hall',
    targetSeats: [500, 700],
    typicalSeats: 700,
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
      fabricPrimary: '#7f1d1d',
      fabricSecondary: '#991b1b',
      wallColor: '#3b1820',
      panelColor: '#4c1d24',
      slatColor: '#2c1218',
      ceilingColor: '#190a0e',
      coveColor: '#fef08a',
      skirtingColor: '#f59e0b',
      carpetColor: '#260f15',
      runnerColor: '#5c1322',
      trimColor: '#eab308',
      boothColor: '#240c12',
    },
    screenType: {
      type: 'large_curved',
      name: 'Large curved screen',
      aspectRatio: 2.14,
      isCurved: true,
      curveRadiusM: 36.0,
      hasProjectorBeam: true,
      finish: 'matte_white',
      bezel: { width: 0.25, color: '#15101a', hasFrame: true },
    },
    realWorldDimensions: {
      seatWidthM: 0.55,
      rowPitchM: 1.05,
      rakeStepM: 0.20,
      aisleWidthM: 1.30,
      ceilingHeightM: 14.0, // 14 m ceiling in large balcony halls
      screenWidthM: 24.0,
      screenHeightM: 11.2,
    },
    sceneDimensions: {
      seatPitch: 0.55 * METERS_TO_SCENE,  // 1.10
      rowPitch: 1.05 * METERS_TO_SCENE,   // 2.10
      tierRise: 0.20 * METERS_TO_SCENE,   // 0.40
      aisleGap: 1.30 * METERS_TO_SCENE,   // 2.60
      ceilingHeight: 14.0 * METERS_TO_SCENE,
      screenWidth: 24.0 * METERS_TO_SCENE,
      screenHeight: 11.2 * METERS_TO_SCENE,
    },
    features: {
      has_balcony: true,
      curved_screen: true,
      dolby_atmos: true,
    },
    description: 'Monumental two-tier auditorium with ground-floor Stalls (460 seats) and upper Balcony (240 seats).',
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
  if (norm in THEATRE_TYPE_REGISTRY) {
    return THEATRE_TYPE_REGISTRY[norm as TheatreTypeId];
  }
  if (norm.includes('balcony') || (totalSeats && totalSeats >= 600)) {
    return THEATRE_TYPE_REGISTRY.balcony;
  }
  if (norm.includes('flagship') || (norm.includes('imax') && totalSeats && totalSeats >= 420)) {
    return THEATRE_TYPE_REGISTRY.flagship;
  }
  if (norm.includes('4dx') || norm.includes('atmos') || norm.includes('motion')) {
    return THEATRE_TYPE_REGISTRY.dolby_atmos_4dx;
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
