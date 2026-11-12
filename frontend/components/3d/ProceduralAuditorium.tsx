'use client';

import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import { getActiveLook } from '@/lib/theatreLooks';
import type { ProceduralGeometryData } from '@/lib/proceduralAuditorium';
import type { SeatRecord } from '@/lib/types';
import { getSeatFamilyForSeat } from '@/lib/seatRegistry';
import { getTheatreTypeDefinition } from '@/lib/theatreTypeRegistry';
import { SeatStateMarkers } from './SeatStateMarkers';
import { AudienceSimulation } from './AudienceSimulation';

const SCREEN_Z = -1.255;

// Seat Family Model Paths
const STD_LOD0_PATH = '/models/seats/standard_lod0.glb';
const STD_LOD1_PATH = '/models/seats/standard_lod1.glb';
const STD_LOD2_PATH = '/models/seats/standard_lod2.glb';

const REC_LOD0_PATH = '/models/seats/recliner_single_lod0.glb';
const REC_LOD1_PATH = '/models/seats/recliner_single_lod1.glb';
const REC_LOD2_PATH = '/models/seats/recliner_single_lod2.glb';

const SOFA_LOD0_PATH = '/models/seats/sofa_lod0.glb';
const SOFA_LOD1_PATH = '/models/seats/sofa_lod1.glb';
const SOFA_LOD2_PATH = '/models/seats/sofa_lod2.glb';

function extractFirstGeometry(scene: THREE.Group): THREE.BufferGeometry | null {
  let geo: THREE.BufferGeometry | null = null;
  scene.traverse((o) => {
    if (!geo && o instanceof THREE.Mesh) {
      geo = o.geometry;
    }
  });
  return geo;
}

interface ProceduralAuditoriumProps {
  geometry: ProceduralGeometryData;
  seats: SeatRecord[];
  screenType?: string;
  onSeatClick?: (seatId: string) => void;
  onSeatDoubleClick?: (seatId: string) => void;
}

export function ProceduralAuditorium({
  geometry,
  seats,
  screenType,
  onSeatClick,
  onSeatDoubleClick,
}: ProceduralAuditoriumProps) {
  const theatreLook = useCinemaStore((s) => s.theatreLook);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const mode = useCinemaStore((s) => s.mode);
  const isOverview = mode === 'overview';
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const setHoveredSeat = useCinemaStore((s) => s.setHoveredSeat);
  const toggleSeat = useCinemaStore((s) => s.toggleSeat);
  const auditoriumLayout = useCinemaStore((s) => s.auditoriumLayout);
  const houseLights = useCinemaStore((s) => s.houseLights);
  const lightIntensity = useCinemaStore((s) => s.lightIntensity);

  const theatreDef = useMemo(
    () => getTheatreTypeDefinition(auditoriumLayout?.theatre_type || screenType, seats.length),
    [auditoriumLayout?.theatre_type, screenType, seats.length]
  );

  // Check URL params (?lod=0|1|2)
  const [urlLod, setUrlLod] = React.useState<number | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const lodP = params.get('lod');
      if (lodP === '0' || lodP === '1' || lodP === '2') {
        setUrlLod(parseInt(lodP, 10));
      }
    }
  }, []);

  const activeLod = urlLod !== null ? urlLod : (qualityMode === 'smooth' ? 1 : 0);

  const look = useMemo(() => getActiveLook(theatreLook), [theatreLook]);

  // Load seat models across all 3 LODs
  const stdLod0 = useGLTF(STD_LOD0_PATH);
  const stdLod1 = useGLTF(STD_LOD1_PATH);
  const stdLod2 = useGLTF(STD_LOD2_PATH);

  const recLod0 = useGLTF(REC_LOD0_PATH);
  const recLod1 = useGLTF(REC_LOD1_PATH);
  const recLod2 = useGLTF(REC_LOD2_PATH);

  const sofaLod0 = useGLTF(SOFA_LOD0_PATH);
  const sofaLod1 = useGLTF(SOFA_LOD1_PATH);
  const sofaLod2 = useGLTF(SOFA_LOD2_PATH);

  // Extract geometries based on active LOD
  const standardGeometry = useMemo(() => {
    if (activeLod === 2) return extractFirstGeometry(stdLod2.scene);
    if (activeLod === 1) return extractFirstGeometry(stdLod1.scene);
    return extractFirstGeometry(stdLod0.scene);
  }, [activeLod, stdLod0.scene, stdLod1.scene, stdLod2.scene]);

  const reclinerGeometry = useMemo(() => {
    if (activeLod === 2) return extractFirstGeometry(recLod2.scene);
    if (activeLod === 1) return extractFirstGeometry(recLod1.scene);
    return extractFirstGeometry(recLod0.scene);
  }, [activeLod, recLod0.scene, recLod1.scene, recLod2.scene]);

  const sofaGeometry = useMemo(() => {
    if (activeLod === 2) return extractFirstGeometry(sofaLod2.scene);
    if (activeLod === 1) return extractFirstGeometry(sofaLod1.scene);
    return extractFirstGeometry(sofaLod0.scene);
  }, [activeLod, sofaLod0.scene, sofaLod1.scene, sofaLod2.scene]);

  const effectiveScreenType = screenType || (geometry.screenMesh.curved ? 'IMAX 3D' : 'Standard');

  // Partition seats into 3 families
  const { standardSeats, reclinerSeats, sofaSeats } = useMemo(() => {
    const std: { seat: SeatRecord; index: number }[] = [];
    const rec: { seat: SeatRecord; index: number }[] = [];
    const sofa: { seat: SeatRecord; index: number }[] = [];

    seats.forEach((seat, index) => {
      const family = getSeatFamilyForSeat(seat.category, seat.seat_type, effectiveScreenType);
      if (family === 'sofa') {
        sofa.push({ seat, index });
      } else if (family === 'recliner') {
        rec.push({ seat, index });
      } else {
        std.push({ seat, index });
      }
    });

    return { standardSeats: std, reclinerSeats: rec, sofaSeats: sofa };
  }, [seats, effectiveScreenType]);

  const shadowGeometry = useMemo(() => new THREE.PlaneGeometry(1.22, 0.92), []);
  const shadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#030406',
        transparent: true,
        opacity: qualityMode === 'smooth' ? 0.22 : 0.45,
        depthWrite: false,
      }),
    [qualityMode]
  );

  // Shared texture loaders for seat families
  const seatTextures = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const loader = new THREE.TextureLoader();

    const stdDiff = loader.load('/models/seats/textures/atlas_standard_diffuse.png', () => {
      if (typeof window !== 'undefined') (window as any).__cineverse_std_diff_loaded = true;
    });
    stdDiff.colorSpace = THREE.SRGBColorSpace;
    stdDiff.wrapS = THREE.RepeatWrapping;
    stdDiff.wrapT = THREE.RepeatWrapping;

    const stdNorm = loader.load('/models/seats/textures/atlas_standard_normal.png', () => {
      if (typeof window !== 'undefined') (window as any).__cineverse_std_norm_loaded = true;
    });
    stdNorm.wrapS = THREE.RepeatWrapping;
    stdNorm.wrapT = THREE.RepeatWrapping;

    const recDiff = loader.load('/models/seats/textures/atlas_recliner_diffuse.png', () => {
      if (typeof window !== 'undefined') (window as any).__cineverse_rec_diff_loaded = true;
    });
    recDiff.colorSpace = THREE.SRGBColorSpace;
    recDiff.wrapS = THREE.RepeatWrapping;
    recDiff.wrapT = THREE.RepeatWrapping;

    const recNorm = loader.load('/models/seats/textures/atlas_recliner_normal.png', () => {
      if (typeof window !== 'undefined') (window as any).__cineverse_rec_norm_loaded = true;
    });
    recNorm.wrapS = THREE.RepeatWrapping;
    recNorm.wrapT = THREE.RepeatWrapping;

    const sofaDiff = loader.load('/models/seats/textures/atlas_sofa_diffuse.png');
    sofaDiff.colorSpace = THREE.SRGBColorSpace;
    sofaDiff.wrapS = THREE.RepeatWrapping;
    sofaDiff.wrapT = THREE.RepeatWrapping;

    const sofaNorm = loader.load('/models/seats/textures/atlas_sofa_normal.png');
    sofaNorm.wrapS = THREE.RepeatWrapping;
    sofaNorm.wrapT = THREE.RepeatWrapping;

    return { stdDiff, stdNorm, recDiff, recNorm, sofaDiff, sofaNorm };
  }, []);

  const standardMaterial = useMemo(
    () => {
      const mat = new THREE.MeshStandardMaterial({
        roughness: 0.85,
        metalness: 0.02,
        vertexColors: true,
        map: seatTextures?.stdDiff || null,
        normalMap: seatTextures?.stdNorm || null,
      });
      if (seatTextures?.stdNorm) {
        mat.normalScale.set(1.2, 1.2);
      }
      return mat;
    },
    [seatTextures]
  );

  const reclinerMaterial = useMemo(
    () => {
      const mat = new THREE.MeshStandardMaterial({
        roughness: 0.45,
        metalness: 0.08,
        vertexColors: true,
        map: seatTextures?.recDiff || null,
        normalMap: seatTextures?.recNorm || null,
      });
      if (seatTextures?.recNorm) {
        mat.normalScale.set(1.4, 1.4);
      }
      return mat;
    },
    [seatTextures]
  );

  const sofaMaterial = useMemo(
    () => {
      const mat = new THREE.MeshStandardMaterial({
        roughness: 0.82,
        metalness: 0.05,
        vertexColors: true,
        map: seatTextures?.sofaDiff || null,
        normalMap: seatTextures?.sofaNorm || null,
      });
      if (seatTextures?.sofaNorm) {
        mat.normalScale.set(1.0, 1.0);
      }
      return mat;
    },
    [seatTextures]
  );

  // Instanced Meshes for ultra-low draw calls
  const shadowMeshRef = useRef<THREE.InstancedMesh>(null);
  const standardMeshRef = useRef<THREE.InstancedMesh>(null);
  const reclinerMeshRef = useRef<THREE.InstancedMesh>(null);
  const sofaMeshRef = useRef<THREE.InstancedMesh>(null);
  const panelsMeshRef = useRef<THREE.InstancedMesh>(null);
  const trimMeshRef = useRef<THREE.InstancedMesh>(null);
  const sconcesMeshRef = useRef<THREE.InstancedMesh>(null);
  const stepLightsMeshRef = useRef<THREE.InstancedMesh>(null);
  const slatsMeshRef = useRef<THREE.InstancedMesh>(null);
  const downlightsMeshRef = useRef<THREE.InstancedMesh>(null);
  const atmosSpeakersMeshRef = useRef<THREE.InstancedMesh>(null);
  const seatStateCache = useRef<Map<string, string>>(new Map());

  // Architectural materials matching art direction
  const floorMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(theatreDef.palette?.carpetColor || look.floorColor),
        roughness: qualityMode === 'smooth' ? 0.88 : 0.65,
        metalness: qualityMode === 'smooth' ? 0.02 : 0.08,
      }),
    [theatreDef.palette, look.floorColor, qualityMode]
  );

  const tierMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(theatreDef.palette?.wallColor ? '#25272e' : look.tierColor),
        roughness: 0.85,
        metalness: 0.02,
      }),
    [theatreDef.palette, look.tierColor]
  );

  const treadMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(theatreDef.palette?.runnerColor || look.treadColor),
        roughness: 0.70,
        metalness: 0.08,
      }),
    [theatreDef.palette, look.treadColor]
  );

  const wallMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(theatreDef.palette?.wallColor || look.wallColor),
        roughness: 0.90,
        metalness: 0.02,
        transparent: true,
        opacity: 1.0,
        side: isOverview ? THREE.BackSide : THREE.DoubleSide,
      }),
    [theatreDef.palette, look.wallColor, isOverview]
  );

  const acousticPanelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(theatreDef.palette?.panelColor || look.acousticPanelColor),
        roughness: 0.82,
        metalness: 0.04,
        transparent: true,
        opacity: 1.0,
        side: isOverview ? THREE.BackSide : THREE.DoubleSide,
      }),
    [theatreDef.palette, look.acousticPanelColor, isOverview]
  );

  const panelTrimMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(look.panelTrimColor),
        roughness: 0.35,
        metalness: 0.80,
        transparent: true,
        opacity: 1.0,
      }),
    [look.panelTrimColor]
  );

  const ceilingMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(look.ceilingColor),
        roughness: 0.95,
        metalness: 0.00,
        transparent: true,
        opacity: 1.0,
        side: isOverview ? THREE.BackSide : THREE.DoubleSide,
      }),
    [look.ceilingColor, isOverview]
  );

  const screenFrameMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(look.screenFrameColor),
        roughness: 0.88,
        metalness: 0.15,
      }),
    [look.screenFrameColor]
  );

  const stageLipMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(look.stageLipColor),
        roughness: 0.80,
        metalness: 0.10,
      }),
    [look.stageLipColor]
  );

  const sconceGlowMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(look.sconceGlowColor),
        emissive: new THREE.Color(look.sconceGlowColor),
        emissiveIntensity: 1.6,
        roughness: 0.20,
        metalness: 0.00,
      }),
    [look.sconceGlowColor]
  );

  const stepLightMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(look.stepLightColor),
        emissive: new THREE.Color(look.stepLightColor),
        emissiveIntensity: 0.8,
        roughness: 0.30,
        metalness: 0.00,
      }),
    [look.stepLightColor]
  );

  const woodSlatMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2e1c14',
        roughness: 0.65,
        metalness: 0.05,
      }),
    []
  );

  const curtainMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#5b101c',
        roughness: 0.95,
        metalness: 0.02,
      }),
    []
  );

  const prosceniumMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#13151b',
        roughness: 0.85,
        metalness: 0.1,
      }),
    []
  );

  const downlightMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: new THREE.Color('#fff4e0'),
        emissiveIntensity: lightIntensity === 'brighter' ? 4.2 : 3.2,
        roughness: 0.15,
        metalness: 0.1,
      }),
    [lightIntensity]
  );

  const speakerMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#181b22',
        roughness: 0.45,
        metalness: 0.15,
      }),
    []
  );

  const exitSignMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#10b981',
      }),
    []
  );

  const carpetRunnerMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#4a111a',
        roughness: 0.92,
        metalness: 0.02,
      }),
    []
  );

  const coveLightMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(theatreDef.palette?.coveColor || look.sconceGlowColor),
        emissive: new THREE.Color(theatreDef.palette?.coveColor || look.sconceGlowColor),
        emissiveIntensity: lightIntensity === 'brighter' ? 3.60 : 2.80,
        roughness: 0.1,
        metalness: 0.0,
      }),
    [theatreDef.palette, look.sconceGlowColor, lightIntensity]
  );

  const skirtingLightMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(theatreDef.palette?.skirtingColor || look.stepLightColor),
        emissive: new THREE.Color(theatreDef.palette?.skirtingColor || look.stepLightColor),
        emissiveIntensity: lightIntensity === 'brighter' ? 2.40 : 1.80,
        roughness: 0.1,
        metalness: 0.0,
      }),
    [theatreDef.palette, look.stepLightColor, lightIntensity]
  );

  const roofTrussMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#111418',
        roughness: 0.85,
        metalness: 0.25,
      }),
    []
  );

  const ceilingCloudMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(theatreDef.palette?.ceilingColor || look.ceilingColor),
        roughness: 0.90,
        metalness: 0.02,
      }),
    [theatreDef.palette, look.ceilingColor]
  );

  const ventilationDuctMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#334155',
        roughness: 0.45,
        metalness: 0.65,
      }),
    []
  );

  const doorFrameMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1e293b',
        roughness: 0.60,
        metalness: 0.30,
      }),
    []
  );

  const doorPanelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#334155',
        roughness: 0.75,
        metalness: 0.15,
      }),
    []
  );

  const boothHousingMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(theatreDef.palette?.boothColor || '#181b22'),
        roughness: 0.88,
        metalness: 0.10,
      }),
    [theatreDef.palette]
  );

  const boothWindowMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0f172a',
        roughness: 0.15,
        metalness: 0.90,
        transparent: true,
        opacity: 0.85,
        emissive: new THREE.Color('#38bdf8'),
        emissiveIntensity: 0.25,
      }),
    []
  );

  const projectorBeamRef = useRef<THREE.Mesh>(null);
  const projectorBeamMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#bfdbfe',
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  const effectRigMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#181a1f',
        roughness: 0.60,
        metalness: 0.50,
      }),
    []
  );

  const podBaseMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#111318',
        roughness: 0.55,
        metalness: 0.65,
      }),
    []
  );

  const podPistonMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#94a3b8',
        roughness: 0.25,
        metalness: 0.90,
      }),
    []
  );

  const podGrilleMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1e293b',
        roughness: 0.85,
        metalness: 0.40,
      }),
    []
  );

  const effectPropMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1e222b',
        roughness: 0.50,
        metalness: 0.60,
      }),
    []
  );

  const effectPropLedMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: houseLights === 'show' ? '#06b6d4' : '#0891b2',
        emissive: new THREE.Color('#06b6d4'),
        emissiveIntensity: houseLights === 'show' ? 1.8 : 0.45,
        roughness: 0.3,
        metalness: 0.2,
      }),
    [houseLights]
  );

  const floorTrimMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#06b6d4',
        emissive: new THREE.Color('#06b6d4'),
        emissiveIntensity: houseLights === 'show' ? 1.2 : 0.6,
        roughness: 0.4,
        metalness: 0.3,
      }),
    [houseLights]
  );

  const acousticBaffleMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1e293b',
        roughness: 0.92,
        metalness: 0.02,
      }),
    []
  );

  // Volumetric Projector Light Beam Geometry connecting booth to screen
  const projectorBeamGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const booth = geometry.projectionBooth;
    const apex = booth ? booth.projectorAperture : [0, 8.0, geometry.dimensions.zBack + 0.85];
    const sWidth = geometry.screenMesh.width;
    const sHeight = geometry.screenMesh.height;
    const sCenterY = geometry.screenMesh.center[1];
    const sZ = SCREEN_Z;

    const tl = [-sWidth / 2, sCenterY + sHeight / 2, sZ];
    const tr = [sWidth / 2, sCenterY + sHeight / 2, sZ];
    const br = [sWidth / 2, sCenterY - sHeight / 2, sZ];
    const bl = [-sWidth / 2, sCenterY - sHeight / 2, sZ];

    const vertices = new Float32Array([
      // Top face
      apex[0], apex[1], apex[2],
      tl[0], tl[1], tl[2],
      tr[0], tr[1], tr[2],
      // Right face
      apex[0], apex[1], apex[2],
      tr[0], tr[1], tr[2],
      br[0], br[1], br[2],
      // Bottom face
      apex[0], apex[1], apex[2],
      br[0], br[1], br[2],
      bl[0], bl[1], bl[2],
      // Left face
      apex[0], apex[1], apex[2],
      bl[0], bl[1], bl[2],
      tl[0], tl[1], tl[2],
    ]);

    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    return geo;
  }, [geometry]);

  const balconyRailingMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1e2430',
        roughness: 0.3,
        metalness: 0.8,
        transparent: true,
        opacity: 0.6,
      }),
    []
  );

  // Reusable geoms for instanced decor
  const panelGeom = useMemo(() => new THREE.BoxGeometry(0.12, 4.5, 1.8), []);
  const trimGeom = useMemo(() => new THREE.BoxGeometry(0.14, 4.54, 1.84), []);
  const sconceGeom = useMemo(() => new THREE.BoxGeometry(0.08, 0.35, 0.14), []);
  const stepLightGeom = useMemo(() => new THREE.BoxGeometry(0.04, 0.02, 0.12), []);
  const slatGeom = useMemo(() => new THREE.BoxGeometry(0.06, 6.2, 0.12), []);
  const downlightGeom = useMemo(() => new THREE.CylinderGeometry(0.12, 0.12, 0.06, 8), []);
  const speakerGeom = useMemo(() => new THREE.BoxGeometry(0.35, 0.22, 0.28), []);
  const exitSignGeom = useMemo(() => new THREE.BoxGeometry(0.65, 0.3, 0.08), []);

  // Initialize InstancedMesh positions
  useEffect(() => {
    const dummy = new THREE.Object3D();

    // 1. Seats & contact shadows
    if (shadowMeshRef.current) {
      const shadowMesh = shadowMeshRef.current;
      seats.forEach((seat, idx) => {
        const { min, max } = seat.bounds_gltf_y_up;
        const posX = (min[0] + max[0]) / 2;
        const posY = min[1];
        const posZ = (min[2] + max[2]) / 2;

        dummy.position.set(posX, posY + 0.005, posZ);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        shadowMesh.setMatrixAt(idx, dummy.matrix);
      });
      shadowMesh.instanceMatrix.needsUpdate = true;
    }

    const initSeatMesh = (mesh: THREE.InstancedMesh | null, items: { seat: SeatRecord; index: number }[]) => {
      if (!mesh) return;
      items.forEach((item, idx) => {
        const { min, max } = item.seat.bounds_gltf_y_up;
        const posX = (min[0] + max[0]) / 2;
        const posY = min[1];
        const posZ = (min[2] + max[2]) / 2;
        const angleY = Math.atan2(-posX, SCREEN_Z - posZ);

        dummy.position.set(posX, posY, posZ);
        dummy.rotation.set(0, angleY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };

    initSeatMesh(standardMeshRef.current, standardSeats);
    initSeatMesh(reclinerMeshRef.current, reclinerSeats);
    initSeatMesh(sofaMeshRef.current, sofaSeats);
    seatStateCache.current.clear();

    // 2. Acoustic panels & trims
    if (panelsMeshRef.current && trimMeshRef.current && geometry.acousticPanels.length > 0) {
      geometry.acousticPanels.forEach((p, idx) => {
        dummy.position.set(...p.position);
        dummy.rotation.set(0, p.rotationY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        panelsMeshRef.current!.setMatrixAt(idx, dummy.matrix);
        trimMeshRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      panelsMeshRef.current.instanceMatrix.needsUpdate = true;
      trimMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // 3. Sconces
    if (sconcesMeshRef.current && geometry.sconces.length > 0) {
      geometry.sconces.forEach((sc, idx) => {
        dummy.position.set(...sc.position);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        sconcesMeshRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      sconcesMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // 4. Step lights
    if (stepLightsMeshRef.current && geometry.stepLights.length > 0) {
      geometry.stepLights.forEach((sl, idx) => {
        dummy.position.set(...sl.position);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        stepLightsMeshRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      stepLightsMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // 5. Wooden slats
    if (slatsMeshRef.current && geometry.woodenSlats && geometry.woodenSlats.length > 0) {
      geometry.woodenSlats.forEach((sl, idx) => {
        dummy.position.set(...sl.position);
        dummy.rotation.set(0, sl.rotationY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        slatsMeshRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      slatsMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // 6. Ceiling downlights
    if (downlightsMeshRef.current && geometry.ceilingDownlights && geometry.ceilingDownlights.length > 0) {
      geometry.ceilingDownlights.forEach((dl, idx) => {
        dummy.position.set(...dl.position);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        downlightsMeshRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      downlightsMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // 7. Atmos speakers
    if (atmosSpeakersMeshRef.current && geometry.atmosSpeakers && geometry.atmosSpeakers.length > 0) {
      geometry.atmosSpeakers.forEach((spk, idx) => {
        dummy.position.set(...spk.position);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        atmosSpeakersMeshRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      atmosSpeakersMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [seats, geometry]);

  // Per-frame color & state updates for instanced seats and dynamic surface fading
  useFrame(({ camera }) => {
    // Dynamic near-camera surface fading: surfaces within ~1.5m fade out smoothly so view stays clear
    if (geometry.dimensions) {
      const camY = camera.position.y;
      const camZ = camera.position.z;
      const camX = camera.position.x;

      const ceilDist = Math.abs(camY - geometry.dimensions.height);
      if (ceilDist < 1.8) {
        ceilingMaterial.opacity = THREE.MathUtils.clamp((ceilDist - 0.25) / 1.5, 0.0, 1.0);
      } else {
        ceilingMaterial.opacity = 1.0;
      }

      const backWallDist = Math.abs(camZ - geometry.dimensions.zBack);
      const sideWallDist = Math.abs(Math.abs(camX) - geometry.dimensions.halfWidth);
      const wallDist = Math.min(backWallDist, sideWallDist);
      if (wallDist < 1.8) {
        const wallFade = THREE.MathUtils.clamp((wallDist - 0.25) / 1.5, 0.0, 1.0);
        wallMaterial.opacity = wallFade;
        acousticPanelMaterial.opacity = wallFade;
        panelTrimMaterial.opacity = wallFade;
      } else {
        wallMaterial.opacity = 1.0;
        acousticPanelMaterial.opacity = 1.0;
        panelTrimMaterial.opacity = 1.0;
      }
    }

    const activeStatuses = useCinemaStore.getState().seatStatuses;
    const activeSelected = useCinemaStore.getState().selectedSeats;
    const currentHovered = useCinemaStore.getState().hoveredSeatId;
    const isShow = useCinemaStore.getState().houseLights === 'show';
    const currentLook = getActiveLook(useCinemaStore.getState().theatreLook);
    const camMode = useCinemaStore.getState().cameraMode;
    const actSeatId = useCinemaStore.getState().activeSeatId;

    const time = performance.now() * 0.003;
    const pulse = 0.85 + Math.sin(time) * 0.15;

    const is4dxActive = useCinemaStore.getState().experience4dxActive;
    const intensity4dx = useCinemaStore.getState().experience4dxIntensity;

    const updateSeatMeshGroup = (
      mesh: THREE.InstancedMesh | null,
      items: { seat: SeatRecord; index: number }[],
      familyType: 'standard' | 'recliner' | 'sofa'
    ) => {
      if (!mesh) return;

      let colorsNeedUpdate = false;
      let matricesNeedUpdate = false;
      const dummy = new THREE.Object3D();
      const tempColor = new THREE.Color();

      for (let idx = 0; idx < items.length; idx++) {
        const seat = items[idx].seat;
        const isSelected = activeSelected.includes(seat.seat_id);
        const rawStatus = activeStatuses[seat.seat_id] || 'available';
        const isHeld = rawStatus === 'held';
        const isBooked = rawStatus === 'booked';
        const isHovered = currentHovered === seat.seat_id;
        const isHiddenInPov = camMode === 'pov' && actSeatId === seat.seat_id;

        let hexColor: string;
        if (isSelected) {
          hexColor = currentLook.seats.selected;
        } else if (isHeld) {
          hexColor = currentLook.seats.held;
        } else if (isBooked) {
          hexColor = currentLook.seats.booked;
        } else if (isHovered) {
          hexColor = '#ffd700';
        } else {
          if (familyType === 'sofa') {
            hexColor = '#2e4858'; // Slate Teal Velvet
          } else if (familyType === 'recliner') {
            hexColor = '#38241b'; // Espresso Brown Leather
          } else if (theatreDef.features.motion_seats || theatreDef.features.is_4dx || auditoriumLayout?.layout_signature === 'motion_pods') {
            // Motion hall seats are charcoal/graphite with technical accents
            hexColor = seat.category === 'premier' ? '#252932' : seat.category === 'front' ? '#1a1c22' : '#1f2229';
          } else {
            const cat = (seat.category || 'prime').toLowerCase();
            hexColor =
              cat === 'premier'
                ? (theatreDef.palette?.fabricSecondary || currentLook.seats.premier)
                : cat === 'front'
                ? currentLook.seats.front
                : (theatreDef.palette?.fabricPrimary || currentLook.seats.prime);
          }
        }

        tempColor.set(hexColor);
        if (isShow && !isSelected && !isHovered && !isHeld) {
          tempColor.multiplyScalar(0.75);
        }
        if (isHeld) {
          tempColor.multiplyScalar(pulse);
        }

        const stateKey = `${isSelected ? 1 : 0}-${isHeld ? pulse.toFixed(1) : 0}-${isBooked ? 1 : 0}-${isHovered ? 1 : 0}-${isShow ? 1 : 0}-${currentLook.id}-${isHiddenInPov ? 1 : 0}`;
        const isSeatShaking = is4dxActive && !!seat.in_motion_zone;

        if (seatStateCache.current.get(seat.seat_id) !== stateKey || isSeatShaking) {
          if (!isSeatShaking) {
            seatStateCache.current.set(seat.seat_id, stateKey);
          }
          mesh.setColorAt(idx, tempColor);
          colorsNeedUpdate = true;

          const { min, max } = seat.bounds_gltf_y_up;
          const posX = (min[0] + max[0]) / 2;
          let posY = min[1];
          const posZ = (min[2] + max[2]) / 2;
          const angleY = Math.atan2(-posX, SCREEN_Z - posZ);
          let pitch = 0;
          let roll = 0;

          if (isSeatShaking) {
            const t4 = performance.now() * 0.007;
            const intMult = intensity4dx === 'full' ? 1.0 : (intensity4dx === 'light' ? 0.35 : 0.65);
            const heave = Math.sin(t4 * 7.5 + idx * 0.5) * 0.025 * intMult;
            pitch = Math.sin(t4 * 5.5 + idx) * 0.035 * intMult;
            roll = Math.cos(t4 * 6.5 + idx * 0.4) * 0.02 * intMult;
            posY += heave;
          }

          dummy.position.set(posX, posY, posZ);
          dummy.rotation.set(pitch, angleY, roll);
          dummy.scale.set(isHiddenInPov ? 0 : 1, isHiddenInPov ? 0 : 1, isHiddenInPov ? 0 : 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(idx, dummy.matrix);
          matricesNeedUpdate = true;
        }
      }

      if (colorsNeedUpdate && mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
      if (matricesNeedUpdate) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    };

    updateSeatMeshGroup(standardMeshRef.current, standardSeats, 'standard');
    updateSeatMeshGroup(reclinerMeshRef.current, reclinerSeats, 'recliner');
    updateSeatMeshGroup(sofaMeshRef.current, sofaSeats, 'sofa');

    // Smoothly update volumetric projector beam opacity (Show Mode = 0.12, Dim = 0.05, Lights on = 0.00)
    const targetBeamOpacity = isShow ? 0.12 : useCinemaStore.getState().houseLights === 'dim' ? 0.05 : 0.00;
    if (projectorBeamMaterial) {
      projectorBeamMaterial.opacity = THREE.MathUtils.lerp(
        projectorBeamMaterial.opacity,
        targetBeamOpacity,
        0.10
      );
    }

    // Dynamic emissive intensity on cove & skirting lights based on mode and intensity setting
    const isBrighterMode = useCinemaStore.getState().lightIntensity === 'brighter';
    const targetCove = isShow ? 0.50 : isBrighterMode ? 3.60 : 2.80;
    const targetSkirting = isShow ? 0.35 : isBrighterMode ? 2.40 : 1.80;
    if (coveLightMaterial) {
      coveLightMaterial.emissiveIntensity = THREE.MathUtils.lerp(
        coveLightMaterial.emissiveIntensity,
        targetCove,
        0.10
      );
    }
    if (skirtingLightMaterial) {
      skirtingLightMaterial.emissiveIntensity = THREE.MathUtils.lerp(
        skirtingLightMaterial.emissiveIntensity,
        targetSkirting,
        0.10
      );
    }
  });

  // Direct interaction handlers on InstancedMesh (Zero extra draw calls)
  const createClickHandler = (items: { seat: SeatRecord; index: number }[]) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && items[e.instanceId]) {
      const seatId = items[e.instanceId].seat.seat_id;
      if (onSeatClick) {
        onSeatClick(seatId);
      } else {
        toggleSeat(seatId);
      }
    }
  };

  const createDoubleClickHandler = (items: { seat: SeatRecord; index: number }[]) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && items[e.instanceId]) {
      const seatId = items[e.instanceId].seat.seat_id;
      if (onSeatDoubleClick) onSeatDoubleClick(seatId);
    }
  };

  const lastHoverSeatId = useRef<string | null>(null);
  const createPointerMoveHandler = (items: { seat: SeatRecord; index: number }[]) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && items[e.instanceId]) {
      const seatId = items[e.instanceId].seat.seat_id;
      if (lastHoverSeatId.current === seatId) return;
      lastHoverSeatId.current = seatId;
      setHoveredSeat(seatId);
    }
  };

  const handleInstancePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      lastHoverSeatId.current = null;
      setHoveredSeat(null);
    },
    [setHoveredSeat]
  );

  const boxHelper = (bounds: { min: [number, number, number]; max: [number, number, number] }) => {
    const size: [number, number, number] = [
      Math.max(0.01, bounds.max[0] - bounds.min[0]),
      Math.max(0.01, bounds.max[1] - bounds.min[1]),
      Math.max(0.01, bounds.max[2] - bounds.min[2]),
    ];
    const center: [number, number, number] = [
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    ];
    return { size, center };
  };

  const floorBox = boxHelper(geometry.roomFloor);
  const ceilingBox = boxHelper(geometry.ceiling);
  const stageLipBox = boxHelper(geometry.stageLip);
  const screenFrameBox = boxHelper(geometry.screenFrame);

  // Debug proxy flag
  const [debugProxies, setDebugProxies] = React.useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      const params = new URLSearchParams(window.location.search);
      setDebugProxies(params.get('debug') === 'proxies');
    }
  }, []);

  return (
    <group name="ProceduralAuditoriumRoot">
      {/* 1. Room Floor */}
      <mesh
        name="room_floor"
        position={floorBox.center}
        material={floorMaterial}
        receiveShadow
      >
        <boxGeometry args={floorBox.size} />
      </mesh>

      {/* 2. Tier Platforms */}
      <group name="TierPlatforms">
        {geometry.tiers.map((tier) => {
          const { size, center } = boxHelper(tier.bounds);
          return (
            <mesh
              key={tier.name}
              name={tier.name}
              position={center}
              material={tierMaterial}
              receiveShadow
            >
              <boxGeometry args={size} />
            </mesh>
          );
        })}
      </group>

      {/* 3. Aisle Stair Treads */}
      <group name="AisleSteps">
        {geometry.aisleSteps.map((step) => {
          const { size, center } = boxHelper(step.bounds);
          return (
            <mesh
              key={step.name}
              name={step.name}
              position={center}
              material={treadMaterial}
              receiveShadow
            >
              <boxGeometry args={size} />
            </mesh>
          );
        })}
      </group>

      {/* 4. Enclosing Walls */}
      <group name="AuditoriumWalls">
        {Object.entries(geometry.walls).map(([wallKey, bounds]) => {
          const { size, center } = boxHelper(bounds);
          return (
            <mesh
              key={`${wallKey}_wall`}
              name={`${wallKey}_wall`}
              position={center}
              material={wallMaterial}
            >
              <boxGeometry args={size} />
            </mesh>
          );
        })}
      </group>

      {/* 5. Ceiling (hidden in Look around / dollhouse cutaway mode) */}
      <mesh
        name="ceiling"
        position={ceilingBox.center}
        material={ceilingMaterial}
        visible={!isOverview}
      >
        <boxGeometry args={ceilingBox.size} />
      </mesh>

      {/* 6. Screen Frame & Stage Lip */}
      <mesh
        name="screen_frame"
        position={screenFrameBox.center}
        material={screenFrameMaterial}
      >
        <boxGeometry args={screenFrameBox.size} />
      </mesh>

      <mesh
        name="stage_lip"
        position={stageLipBox.center}
        material={stageLipMaterial}
      >
        <boxGeometry args={stageLipBox.size} />
      </mesh>

      {/* 6b. Proscenium Arch (Open Perimeter Frame: Left Column, Right Column, Top Header) & Side Curtains */}
      {geometry.proscenium && (() => {
        const pBox = geometry.proscenium;
        const beamThickness = 0.45;
        const frameDepth = Math.max(0.12, pBox.max[2] - pBox.min[2]);
        const centerZ = (pBox.min[2] + pBox.max[2]) / 2;

        const leftColWidth = beamThickness;
        const leftColHeight = pBox.max[1] - pBox.min[1];
        const leftColCenter: [number, number, number] = [
          pBox.min[0] + leftColWidth / 2,
          pBox.min[1] + leftColHeight / 2,
          centerZ,
        ];

        const rightColWidth = beamThickness;
        const rightColHeight = pBox.max[1] - pBox.min[1];
        const rightColCenter: [number, number, number] = [
          pBox.max[0] - rightColWidth / 2,
          pBox.min[1] + rightColHeight / 2,
          centerZ,
        ];

        const topHeaderWidth = pBox.max[0] - pBox.min[0];
        const topHeaderHeight = beamThickness;
        const topHeaderCenter: [number, number, number] = [
          (pBox.min[0] + pBox.max[0]) / 2,
          pBox.max[1] - topHeaderHeight / 2,
          centerZ,
        ];

        return (
          <group name="proscenium_arch_frame">
            {/* Left Column */}
            <mesh
              name="proscenium_arch_left"
              position={leftColCenter}
              material={prosceniumMaterial}
            >
              <boxGeometry args={[leftColWidth, leftColHeight, frameDepth]} />
            </mesh>
            {/* Right Column */}
            <mesh
              name="proscenium_arch_right"
              position={rightColCenter}
              material={prosceniumMaterial}
            >
              <boxGeometry args={[rightColWidth, rightColHeight, frameDepth]} />
            </mesh>
            {/* Top Lintel Beam */}
            <mesh
              name="proscenium_arch_header"
              position={topHeaderCenter}
              material={prosceniumMaterial}
            >
              <boxGeometry args={[topHeaderWidth, topHeaderHeight, frameDepth]} />
            </mesh>
          </group>
        );
      })()}

      {geometry.sideCurtains && (
        <group name="SideCurtains">
          <mesh
            name="side_curtain_left"
            position={boxHelper(geometry.sideCurtains.left).center}
            material={curtainMaterial}
          >
            <boxGeometry args={boxHelper(geometry.sideCurtains.left).size} />
          </mesh>
          <mesh
            name="side_curtain_right"
            position={boxHelper(geometry.sideCurtains.right).center}
            material={curtainMaterial}
          >
            <boxGeometry args={boxHelper(geometry.sideCurtains.right).size} />
          </mesh>
        </group>
      )}

      {/* 6c. Balcony Structure & Under-Balcony Warm Cove Light */}
      {geometry.balconyStructure && (
        <group name="BalconyArchitecture">
          <mesh
            name="balcony_platform"
            position={boxHelper(geometry.balconyStructure.platform).center}
            material={tierMaterial}
            receiveShadow
          >
            <boxGeometry args={boxHelper(geometry.balconyStructure.platform).size} />
          </mesh>
          <mesh
            name="balcony_fascia"
            position={boxHelper(geometry.balconyStructure.fascia).center}
            material={wallMaterial}
          >
            <boxGeometry args={boxHelper(geometry.balconyStructure.fascia).size} />
          </mesh>
          <mesh
            name="balcony_railing"
            position={boxHelper(geometry.balconyStructure.railing).center}
            material={balconyRailingMaterial}
          >
            <boxGeometry args={boxHelper(geometry.balconyStructure.railing).size} />
          </mesh>
          <mesh
            name="under_balcony_cove_light"
            position={boxHelper(geometry.balconyStructure.coveLightBounds).center}
            material={coveLightMaterial}
          >
            <boxGeometry args={boxHelper(geometry.balconyStructure.coveLightBounds).size} />
          </mesh>
        </group>
      )}

      {/* 6d. Suspended Acoustic Ceiling Clouds (hidden in Look around / dollhouse cutaway mode) */}
      {!isOverview && geometry.ceilingClouds && geometry.ceilingClouds.length > 0 && (
        <group name="CeilingCloudsContainer">
          {geometry.ceilingClouds.map((cloud) => {
            const { size, center } = boxHelper(cloud.bounds);
            return (
              <mesh
                key={cloud.id}
                name={`ceiling_cloud_${cloud.id}`}
                position={center}
                material={ceilingCloudMaterial}
              >
                <boxGeometry args={size} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* 6e. Roof Trusses / Structural Girders */}
      {geometry.roofTrusses && geometry.roofTrusses.length > 0 && (
        <group name="RoofTrussesContainer">
          {geometry.roofTrusses.map((truss) => {
            const { size, center } = boxHelper(truss.bounds);
            return (
              <mesh
                key={truss.id}
                name={`roof_truss_${truss.id}`}
                position={center}
                material={roofTrussMaterial}
              >
                <boxGeometry args={size} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* 6f. Ventilation Ducts (HVAC) */}
      {geometry.ventilationDucts && geometry.ventilationDucts.length > 0 && (
        <group name="VentilationDuctsContainer">
          {geometry.ventilationDucts.map((duct) => {
            const { size, center } = boxHelper(duct.bounds);
            return (
              <mesh
                key={duct.id}
                name={`vent_duct_${duct.id}`}
                position={center}
                material={ventilationDuctMaterial}
              >
                <boxGeometry args={size} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* 6g. Continuous Perimeter Cove Light Strips */}
      {geometry.coveLightStrips && geometry.coveLightStrips.length > 0 && (
        <group name="CoveLightStripsContainer">
          {geometry.coveLightStrips.map((strip) => {
            const { size, center } = boxHelper(strip.bounds);
            return (
              <mesh
                key={strip.id}
                name={`cove_strip_${strip.id}`}
                position={center}
                material={coveLightMaterial}
              >
                <boxGeometry args={size} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* 6h. Baseboard Skirting Lights */}
      {geometry.skirtingLights && geometry.skirtingLights.length > 0 && (
        <group name="SkirtingLightsContainer">
          {geometry.skirtingLights.map((skirt) => {
            const { size, center } = boxHelper(skirt.bounds);
            return (
              <mesh
                key={skirt.id}
                name={`skirting_light_${skirt.id}`}
                position={center}
                material={skirtingLightMaterial}
              >
                <boxGeometry args={size} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* 6i. Framed Emergency Exit Doors */}
      {geometry.doorFrames && geometry.doorFrames.length > 0 && (
        <group name="ExitDoorPortals">
          {geometry.doorFrames.map((door) => {
            const frame = boxHelper(door.frameBounds);
            const panel = boxHelper(door.doorBounds);
            return (
              <group key={door.id} name={door.id}>
                <mesh position={frame.center} material={doorFrameMaterial}>
                  <boxGeometry args={frame.size} />
                </mesh>
                <mesh position={panel.center} material={doorPanelMaterial}>
                  <boxGeometry args={panel.size} />
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* 6j. Projection Booth & Volumetric Projector Beam */}
      {geometry.projectionBooth && (
        <group name="ProjectionBoothStructure">
          <mesh
            name="projection_booth_housing"
            position={boxHelper(geometry.projectionBooth.housing).center}
            material={boothHousingMaterial}
          >
            <boxGeometry args={boxHelper(geometry.projectionBooth.housing).size} />
          </mesh>
          <mesh
            name="projection_booth_center_window"
            position={boxHelper(geometry.projectionBooth.centerWindow).center}
            material={boothWindowMaterial}
          >
            <boxGeometry args={boxHelper(geometry.projectionBooth.centerWindow).size} />
          </mesh>
          {geometry.projectionBooth.sideWindows.map((sw, idx) => (
            <mesh
              key={`booth_side_window_${idx}`}
              name={`booth_side_window_${idx}`}
              position={boxHelper(sw).center}
              material={boothWindowMaterial}
            >
              <boxGeometry args={boxHelper(sw).size} />
            </mesh>
          ))}
          <mesh
            ref={projectorBeamRef}
            name="volumetric_projector_beam"
            geometry={projectorBeamGeometry}
            material={projectorBeamMaterial}
          />
        </group>
      )}

      {/* 6k. 4DX Effect Rigs */}
      {geometry.effectRigs && geometry.effectRigs.length > 0 && (
        <group name="EffectRigsContainer">
          {geometry.effectRigs.map((rig) => {
            const { size, center } = boxHelper(rig.trussBounds);
            return (
              <group key={rig.id} name={rig.id}>
                <mesh position={center} material={effectRigMaterial}>
                  <boxGeometry args={size} />
                </mesh>
                {rig.fans.map((fanPos, fIdx) => (
                  <mesh key={`fan_${fIdx}`} position={fanPos} material={effectRigMaterial}>
                    <cylinderGeometry args={[0.35, 0.35, 0.2, 12]} />
                  </mesh>
                ))}
                {rig.nozzles.map((nozPos, nIdx) => (
                  <mesh key={`nozzle_${nIdx}`} position={nozPos} material={effectRigMaterial}>
                    <sphereGeometry args={[0.12, 8, 8]} />
                  </mesh>
                ))}
              </group>
            );
          })}
        </group>
      )}

      {/* 6l. Acoustic Baffles */}
      {geometry.acousticBaffles && geometry.acousticBaffles.length > 0 && (
        <group name="AcousticBafflesContainer">
          {geometry.acousticBaffles.map((baffle) => {
            const { size, center } = boxHelper(baffle.bounds);
            return (
              <mesh key={baffle.id} position={center} material={acousticBaffleMaterial}>
                <boxGeometry args={size} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* 6m. Motion Pod Platform Bases & Actuator Pistons */}
      {geometry.motionPodBases && geometry.motionPodBases.length > 0 && (
        <group name="MotionPodBasesContainer">
          {geometry.motionPodBases.map((pod) => (
            <group key={pod.id} name={pod.id}>
              {/* Pod Platform Base */}
              <mesh position={pod.center} material={podBaseMaterial} receiveShadow castShadow>
                <boxGeometry args={pod.size} />
              </mesh>
              {/* 4 Pneumatic Actuator Pistons */}
              {pod.pistons.map((pistPos, pIdx) => (
                <mesh key={`${pod.id}_piston_${pIdx}`} position={pistPos} material={podPistonMaterial}>
                  <cylinderGeometry args={[0.045, 0.055, 0.18, 12]} />
                </mesh>
              ))}
              {/* Under-seat Vent Grilles */}
              {pod.grilles.map((grillePos, gIdx) => (
                <mesh key={`${pod.id}_grille_${gIdx}`} position={grillePos} material={podGrilleMaterial}>
                  <boxGeometry args={[0.42, 0.015, 0.28]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      )}

      {/* 6n. Environmental Effect Props Rig (Wind, Fog, Water, Strobe, Scent, Poke) */}
      {geometry.effectProps && geometry.effectProps.length > 0 && (
        <group name="EffectPropsRigContainer">
          {geometry.effectProps.map((prop) => {
            const isWind = prop.type === 'wind';
            const isFog = prop.type === 'fog';
            const isWater = prop.type === 'water';
            const isStrobe = prop.type === 'strobe';
            const isScent = prop.type === 'scent';
            const isPoke = prop.type === 'poke';

            return (
              <group key={prop.id} name={prop.id} position={prop.position}>
                {/* Wind turbine / fan casing */}
                {isWind && (
                  <group>
                    <mesh material={effectPropMaterial}>
                      <cylinderGeometry args={[0.55, 0.55, 0.25, 16]} />
                    </mesh>
                    <mesh position={[0, -0.13, 0]} material={effectPropLedMaterial}>
                      <cylinderGeometry args={[0.12, 0.12, 0.02, 12]} />
                    </mesh>
                  </group>
                )}
                {/* Fog / smoke machine */}
                {isFog && (
                  <group>
                    <mesh material={effectPropMaterial}>
                      <boxGeometry args={[0.65, 0.55, 0.75]} />
                    </mesh>
                    <mesh position={[0, -0.15, 0.38]} rotation={[Math.PI / 2, 0, 0]} material={effectPropLedMaterial}>
                      <cylinderGeometry args={[0.08, 0.08, 0.04, 12]} />
                    </mesh>
                  </group>
                )}
                {/* Water mist / rain nozzle */}
                {isWater && (
                  <group>
                    <mesh material={effectPropMaterial}>
                      <cylinderGeometry args={[0.09, 0.14, 0.18, 10]} />
                    </mesh>
                    <mesh position={[0, -0.1, 0]} material={effectPropLedMaterial}>
                      <sphereGeometry args={[0.045, 8, 8]} />
                    </mesh>
                  </group>
                )}
                {/* Strobe light bar */}
                {isStrobe && (
                  <group>
                    <mesh material={effectPropMaterial}>
                      <boxGeometry args={[1.6, 0.14, 0.22]} />
                    </mesh>
                    <mesh position={[0, -0.075, 0]} material={effectPropLedMaterial}>
                      <boxGeometry args={[1.4, 0.03, 0.15]} />
                    </mesh>
                  </group>
                )}
                {/* Scent unit dispenser */}
                {isScent && (
                  <group>
                    <mesh material={effectPropMaterial}>
                      <boxGeometry args={[0.45, 0.38, 0.35]} />
                    </mesh>
                    <mesh position={[0, -0.12, 0.18]} material={effectPropLedMaterial}>
                      <boxGeometry args={[0.22, 0.04, 0.02]} />
                    </mesh>
                  </group>
                )}
                {/* Seat pokers / ticklers */}
                {isPoke && (
                  <mesh material={effectPropMaterial} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} />
                  </mesh>
                )}
              </group>
            );
          })}
        </group>
      )}

      {/* 6o. Front Floor Trim Light */}
      {geometry.frontFloorTrim && (
        <group name="FrontFloorTrimContainer">
          <mesh
            position={boxHelper(geometry.frontFloorTrim.bounds).center}
            material={floorTrimMaterial}
          >
            <boxGeometry args={boxHelper(geometry.frontFloorTrim.bounds).size} />
          </mesh>
        </group>
      )}

      {/* 7. Instanced Acoustic Panels, Trims & Sconces (Ultra-low Draw Calls) */}
      {geometry.acousticPanels.length > 0 && (
        <group name="InstancedAcousticPanelsContainer">
          <instancedMesh
            ref={panelsMeshRef}
            args={[panelGeom, acousticPanelMaterial, geometry.acousticPanels.length]}
            name="InstancedAcousticPanels"
          />
          <instancedMesh
            ref={trimMeshRef}
            args={[trimGeom, panelTrimMaterial, geometry.acousticPanels.length]}
            name="InstancedPanelTrims"
          />
        </group>
      )}

      {geometry.woodenSlats && geometry.woodenSlats.length > 0 && (
        <instancedMesh
          ref={slatsMeshRef}
          args={[slatGeom, woodSlatMaterial, geometry.woodenSlats.length]}
          name="InstancedWoodenSlats"
        />
      )}

      {geometry.sconces.length > 0 && (
        <instancedMesh
          ref={sconcesMeshRef}
          args={[sconceGeom, sconceGlowMaterial, geometry.sconces.length]}
          name="InstancedArchitecturalSconces"
        />
      )}

      {/* 8. Instanced Aisle Step Lights, Downlights & Atmos Speakers */}
      {geometry.stepLights.length > 0 && (
        <instancedMesh
          ref={stepLightsMeshRef}
          args={[stepLightGeom, stepLightMaterial, geometry.stepLights.length]}
          name="InstancedAisleStepLights"
        />
      )}

      {!isOverview && geometry.ceilingDownlights && geometry.ceilingDownlights.length > 0 && (
        <instancedMesh
          ref={downlightsMeshRef}
          args={[downlightGeom, downlightMaterial, geometry.ceilingDownlights.length]}
          name="InstancedCeilingDownlights"
        />
      )}

      {geometry.atmosSpeakers && geometry.atmosSpeakers.length > 0 && (
        <instancedMesh
          ref={atmosSpeakersMeshRef}
          args={[speakerGeom, speakerMaterial, geometry.atmosSpeakers.length]}
          name="InstancedDolbyAtmosSpeakers"
        />
      )}

      {/* 8b. Illuminated EXIT signs */}
      {geometry.exitSigns && (
        <group name="ExitSigns">
          {geometry.exitSigns.map((es) => (
            <mesh key={es.id} position={es.position} material={exitSignMaterial}>
              <boxGeometry args={[0.65, 0.3, 0.08]} />
            </mesh>
          ))}
        </group>
      )}

      {/* 9. Instanced Modern Seats & Contact Shadows across 3 Families */}
      <group name="ModernSeatsContainer">
        <instancedMesh
          ref={shadowMeshRef}
          args={[shadowGeometry, shadowMaterial, seats.length]}
          name="InstancedContactShadows"
        />
        {standardGeometry && standardSeats.length > 0 && (
          <instancedMesh
            ref={standardMeshRef}
            args={[standardGeometry, standardMaterial, standardSeats.length]}
            name="InstancedStandardSeats"
            onClick={createClickHandler(standardSeats)}
            onDoubleClick={createDoubleClickHandler(standardSeats)}
            onPointerMove={createPointerMoveHandler(standardSeats)}
            onPointerOut={handleInstancePointerOut}
          />
        )}
        {reclinerGeometry && reclinerSeats.length > 0 && (
          <instancedMesh
            ref={reclinerMeshRef}
            args={[reclinerGeometry, reclinerMaterial, reclinerSeats.length]}
            name="InstancedReclinerSeats"
            onClick={createClickHandler(reclinerSeats)}
            onDoubleClick={createDoubleClickHandler(reclinerSeats)}
            onPointerMove={createPointerMoveHandler(reclinerSeats)}
            onPointerOut={handleInstancePointerOut}
          />
        )}
        {sofaGeometry && sofaSeats.length > 0 && (
          <instancedMesh
            ref={sofaMeshRef}
            args={[sofaGeometry, sofaMaterial, sofaSeats.length]}
            name="InstancedSofaSeats"
            onClick={createClickHandler(sofaSeats)}
            onDoubleClick={createDoubleClickHandler(sofaSeats)}
            onPointerMove={createPointerMoveHandler(sofaSeats)}
            onPointerOut={handleInstancePointerOut}
          />
        )}
        {/* Floating 3D State Markers (✓ for selected, ✕ for booked, gold rim glow on hover) */}
        <SeatStateMarkers seats={seats} />
      </group>

      {/* 9b. Instanced Audience Simulation on Booked Seats Only */}
      <AudienceSimulation seats={seats} />

      {/* 10. Debug Proxies (Only when ?debug=proxies enabled, otherwise 0 draw calls) */}
      {debugProxies && (
        <group name="SeatInteractionLayer">
          {seats.map((seat) => {
            const { size, center } = boxHelper(seat.bounds_gltf_y_up);
            return (
              <mesh key={seat.seat_id} position={center}>
                <boxGeometry args={size} />
                <meshBasicMaterial
                  transparent
                  opacity={0.35}
                  color="#38bdf8"
                  side={THREE.DoubleSide}
                />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}

// Preload seat models across all 3 LODs for zero-stutter rendering
useGLTF.preload(STD_LOD0_PATH);
useGLTF.preload(STD_LOD1_PATH);
useGLTF.preload(STD_LOD2_PATH);
useGLTF.preload(REC_LOD0_PATH);
useGLTF.preload(REC_LOD1_PATH);
useGLTF.preload(REC_LOD2_PATH);
useGLTF.preload(SOFA_LOD0_PATH);
useGLTF.preload(SOFA_LOD1_PATH);
useGLTF.preload(SOFA_LOD2_PATH);
