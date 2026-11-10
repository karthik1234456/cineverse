/**
 * CineVerse 3D Seat Registry
 * 
 * Formal registry defining original seat model families, levels of detail (LOD),
 * footprint measurements in real-world metres and scene units, eye-height offsets,
 * armrest sharing rules, and material specifications.
 */

export type SeatFamilyId = 'standard' | 'recliner' | 'sofa';

export interface SeatModelLOD {
  file: string;
  triangles: number;
  vertices: number;
  size_kb: number;
}

export interface SeatFamilyDefinition {
  id: SeatFamilyId;
  name: string;
  description: string;
  footprintSceneUnits: [number, number, number]; // [width, depth, height]
  realWorldMeters: { width: number; depth: number; height: number };
  eyeHeightOffset: number; // Y offset above floor for audience eye level
  armrestSharingRule: 'shared_in_block' | 'individual_rolled' | 'center_console_table' | 'bolster_ends';
  materialType: 'fabric' | 'leather' | 'velvet';
  defaultColor: string;
  roughness: number;
  metalness: number;
  lods: {
    lod0: string; // Near (~4k-8k tris)
    lod1: string; // Mid (~1.5k tris)
    lod2: string; // Far (~300 tris)
  };
  pairVariant?: {
    footprintSceneUnits: [number, number, number];
    realWorldMeters: { width: number; depth: number; height: number };
    lods: {
      lod0: string;
      lod1: string;
      lod2: string;
    };
  };
  tippedVariant?: string;
}

export const SEAT_REGISTRY: Record<SeatFamilyId, SeatFamilyDefinition> = {
  standard: {
    id: 'standard',
    name: 'Standard Cinema Seat',
    description: 'High-back push-back chair with separate padded headrest, stitch seams, curved cushion, armrest cup holders, stanchion feet',
    footprintSceneUnits: [1.24, 0.96, 1.98],
    realWorldMeters: { width: 0.62, depth: 0.72, height: 0.99 },
    eyeHeightOffset: 1.32,
    armrestSharingRule: 'shared_in_block',
    materialType: 'fabric',
    defaultColor: '#9f1239',
    roughness: 0.85,
    metalness: 0.02,
    lods: {
      lod0: '/models/seats/standard_lod0.glb',
      lod1: '/models/seats/standard_lod1.glb',
      lod2: '/models/seats/standard_lod2.glb',
    },
    tippedVariant: '/models/seats/standard_tipped.glb',
  },

  recliner: {
    id: 'recliner',
    name: 'Recliner & Loveseat Premium',
    description: 'Overstuffed leather armchair with rolled padded arms, high back quilted seams, recline controls, tucked footrest, recessed metal base',
    footprintSceneUnits: [1.04, 0.98, 2.08],
    realWorldMeters: { width: 0.88, depth: 0.96, height: 1.08 },
    eyeHeightOffset: 1.36,
    armrestSharingRule: 'individual_rolled',
    materialType: 'leather',
    defaultColor: '#38241b',
    roughness: 0.50,
    metalness: 0.04,
    lods: {
      lod0: '/models/seats/recliner_single_lod0.glb',
      lod1: '/models/seats/recliner_single_lod1.glb',
      lod2: '/models/seats/recliner_single_lod2.glb',
    },
    pairVariant: {
      footprintSceneUnits: [1.84, 0.98, 2.08],
      realWorldMeters: { width: 1.68, depth: 0.96, height: 1.08 },
      lods: {
        lod0: '/models/seats/recliner_pair_lod0.glb',
        lod1: '/models/seats/recliner_pair_lod1.glb',
        lod2: '/models/seats/recliner_pair_lod2.glb',
      },
    },
  },

  sofa: {
    id: 'sofa',
    name: 'Boutique Sofa',
    description: 'Plush boutique sofa with vertical channel fluted backrest, deep bench cushion, bolster arms, brass-capped spindle legs',
    footprintSceneUnits: [1.24, 0.96, 1.78],
    realWorldMeters: { width: 1.28, depth: 0.88, height: 0.89 },
    eyeHeightOffset: 1.28,
    armrestSharingRule: 'bolster_ends',
    materialType: 'velvet',
    defaultColor: '#2e4858',
    roughness: 0.82,
    metalness: 0.05,
    lods: {
      lod0: '/models/seats/sofa_lod0.glb',
      lod1: '/models/seats/sofa_lod1.glb',
      lod2: '/models/seats/sofa_lod2.glb',
    },
  },
};

/**
 * Returns the appropriate seat family for a given category and seat type.
 */
export function getSeatFamilyForSeat(
  category: string = 'prime',
  seatType: string = 'standard',
  screenType: string = 'Standard'
): SeatFamilyId {
  const normCat = (category || '').toLowerCase();
  const normType = (seatType || '').toLowerCase();
  const normScreen = (screenType || '').toLowerCase();

  // Boutique VIP screen or boutique sofa seat type
  if (normScreen.includes('boutique') || normScreen.includes('vip') || normType === 'sofa') {
    return 'sofa';
  }

  // Recliner pairs or premier category recliners
  if (normType === 'recliner_pair' || normCat === 'premier') {
    return 'recliner';
  }

  // Standard push-back seats for front & prime categories
  return 'standard';
}

