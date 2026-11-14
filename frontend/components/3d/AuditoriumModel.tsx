'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import { assertSceneCoordinates } from '@/lib/assertCoordinates';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';
import { getActiveLook } from '@/lib/theatreLooks';
import { SeatStateMarkers } from './SeatStateMarkers';

const WEB_MODEL_PATH = '/models/cineverse_auditorium_v2.web.glb';
const HQ_MODEL_PATH = '/models/cineverse_auditorium_v2.glb';

// Seat Family Model Paths
const STD_LOD0_PATH = '/models/seats/standard_lod0.glb';
const STD_LOD1_PATH = '/models/seats/standard_lod1.glb';
const STD_LOD2_PATH = '/models/seats/standard_lod2.glb';

const REC_LOD0_PATH = '/models/seats/recliner_single_lod0.glb';
const REC_LOD1_PATH = '/models/seats/recliner_single_lod1.glb';
const REC_LOD2_PATH = '/models/seats/recliner_single_lod2.glb';

function extractFirstGeometry(scene: THREE.Group): THREE.BufferGeometry | null {
  let geo: THREE.BufferGeometry | null = null;
  scene.traverse((o) => {
    if (!geo && o instanceof THREE.Mesh) {
      geo = o.geometry;
    }
  });
  return geo;
}

export function AuditoriumModel() {
  const useHqModel = useCinemaStore((s) => s.useHqModel);
  const theatreLook = useCinemaStore((s) => s.theatreLook);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const mode = useCinemaStore((s) => s.mode);
  const isOverview = mode === 'overview';
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);

  const modelUrl = useHqModel ? HQ_MODEL_PATH : WEB_MODEL_PATH;
  const { scene } = useGLTF(modelUrl);

  // Load all 3 LODs for Standard and Recliner seats
  const stdLod0 = useGLTF(STD_LOD0_PATH);
  const stdLod1 = useGLTF(STD_LOD1_PATH);
  const stdLod2 = useGLTF(STD_LOD2_PATH);

  const recLod0 = useGLTF(REC_LOD0_PATH);
  const recLod1 = useGLTF(REC_LOD1_PATH);
  const recLod2 = useGLTF(REC_LOD2_PATH);

  // Check URL params (?seats=original, ?lod=0|1|2)
  const [useOriginalSeats, setUseOriginalSeats] = React.useState(false);
  const [urlLod, setUrlLod] = React.useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setUseOriginalSeats(params.get('seats') === 'original');
      const lodP = params.get('lod');
      if (lodP === '0' || lodP === '1' || lodP === '2') {
        setUrlLod(parseInt(lodP, 10));
      }
    }
  }, []);

  const seats = (layoutData as unknown as SeatLayoutFile).seats;

  // Partition seats: Row J (10 seats) as luxury Recliners, Rows A-I (90 seats) as Standard push-back
  const { standardSeats, reclinerSeats } = useMemo(() => {
    const std: { seat: SeatRecord; index: number }[] = [];
    const rec: { seat: SeatRecord; index: number }[] = [];

    seats.forEach((seat, idx) => {
      if (seat.row === 'J' || seat.seat_type === 'recliner' || seat.seat_type === 'recliner_pair') {
        rec.push({ seat, index: idx });
      } else {
        std.push({ seat, index: idx });
      }
    });

    return { standardSeats: std, reclinerSeats: rec };
  }, [seats]);

  const seatNodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seats) {
      map.set(s.seat_id, s.node_name);
    }
    return map;
  }, [seats]);

  const seatMaterials = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
  const seatStateCache = useRef<Map<string, string>>(new Map());

  // Determine active LOD based on URL override or qualityMode
  const activeLod = urlLod !== null ? urlLod : (qualityMode === 'smooth' ? 1 : 0);

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

  // Shared instanced materials & geometry for ultra-efficient batching
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

    const stdDiff = loader.load('/models/seats/textures/atlas_standard_diffuse.png');
    stdDiff.colorSpace = THREE.SRGBColorSpace;
    stdDiff.wrapS = THREE.RepeatWrapping;
    stdDiff.wrapT = THREE.RepeatWrapping;

    const stdNorm = loader.load('/models/seats/textures/atlas_standard_normal.png');
    stdNorm.wrapS = THREE.RepeatWrapping;
    stdNorm.wrapT = THREE.RepeatWrapping;

    const recDiff = loader.load('/models/seats/textures/atlas_recliner_diffuse.png');
    recDiff.colorSpace = THREE.SRGBColorSpace;
    recDiff.wrapS = THREE.RepeatWrapping;
    recDiff.wrapT = THREE.RepeatWrapping;

    const recNorm = loader.load('/models/seats/textures/atlas_recliner_normal.png');
    recNorm.wrapS = THREE.RepeatWrapping;
    recNorm.wrapT = THREE.RepeatWrapping;

    return { stdDiff, stdNorm, recDiff, recNorm };
  }, []);

  const standardMaterial = useMemo(
    () => {
      const mat = new THREE.MeshStandardMaterial({
        roughness: 0.85,
        metalness: 0.02,
        vertexColors: true, // Multiplies instanceColor by baked AO vertex colors (COLOR_0)
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
        roughness: 0.50,
        metalness: 0.04,
        vertexColors: true, // Multiplies instanceColor by baked AO vertex colors (COLOR_0)
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

  const shadowMeshRef = useRef<THREE.InstancedMesh>(null);
  const standardMeshRef = useRef<THREE.InstancedMesh>(null);
  const reclinerMeshRef = useRef<THREE.InstancedMesh>(null);

  // Initialize instanced seat & shadow matrices
  useEffect(() => {
    const dummy = new THREE.Object3D();

    // 1. Shadows for all 100 seats
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

    // 2. Standard Seats (90 seats, Rows A-I)
    if (standardMeshRef.current) {
      const stdMesh = standardMeshRef.current;
      standardSeats.forEach((item, idx) => {
        const { min, max } = item.seat.bounds_gltf_y_up;
        const posX = (min[0] + max[0]) / 2;
        const posY = min[1];
        const posZ = (min[2] + max[2]) / 2;

        dummy.position.set(posX, posY, posZ);
        dummy.rotation.set(0, 0, 0); // naturally faces +Z toward screen
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        stdMesh.setMatrixAt(idx, dummy.matrix);
      });
      stdMesh.instanceMatrix.needsUpdate = true;
    }

    // 3. Recliner Seats (10 seats, Row J)
    if (reclinerMeshRef.current) {
      const recMesh = reclinerMeshRef.current;
      reclinerSeats.forEach((item, idx) => {
        const { min, max } = item.seat.bounds_gltf_y_up;
        const posX = (min[0] + max[0]) / 2;
        const posY = min[1];
        const posZ = (min[2] + max[2]) / 2;

        dummy.position.set(posX, posY, posZ);
        dummy.rotation.set(0, 0, 0); // naturally faces +Z toward screen
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        recMesh.setMatrixAt(idx, dummy.matrix);
      });
      recMesh.instanceMatrix.needsUpdate = true;
    }

    seatStateCache.current.clear();
  }, [seats, standardSeats, reclinerSeats]);

  // Active aesthetic look (Look A, B, or C)
  const look = useMemo(() => getActiveLook(theatreLook), [theatreLook]);

  // Assign rich physically-based materials across all node groups on load or when look changes
  useEffect(() => {
    if (!scene) return;
    seatMaterials.current.clear();
    seatStateCache.current.clear();

    // Reusable shared materials by group
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.floorColor),
      roughness: 0.85,
      metalness: 0.02,
    });
    const tierMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.tierColor),
      roughness: 0.85,
      metalness: 0.02,
    });
    const treadMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.treadColor),
      roughness: 0.70,
      metalness: 0.08,
    });
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.wallColor),
      roughness: 0.90,
      metalness: 0.02,
      side: isOverview ? THREE.BackSide : THREE.DoubleSide,
    });
    const acousticPanelMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.acousticPanelColor),
      roughness: 0.82,
      metalness: 0.04,
      side: isOverview ? THREE.BackSide : THREE.DoubleSide,
    });
    const panelTrimMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.panelTrimColor),
      roughness: 0.35,
      metalness: 0.80,
    });
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.ceilingColor),
      roughness: 0.95,
      metalness: 0.00,
      side: THREE.DoubleSide,
    });
    const screenFrameMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.screenFrameColor),
      roughness: 0.88,
      metalness: 0.15,
    });
    const stageLipMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.stageLipColor),
      roughness: 0.80,
      metalness: 0.10,
    });
    const speakerMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1c202a'),
      roughness: 0.45,
      metalness: 0.70,
    });
    const railMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.railColor),
      roughness: 0.30,
      metalness: 0.85,
    });
    const stepLightMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.stepLightColor),
      emissive: new THREE.Color(look.stepLightColor),
      emissiveIntensity: 1.40,
      roughness: 0.30,
      metalness: 0.00,
    });
    const architecturalLightMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.sconceGlowColor),
      emissive: new THREE.Color(look.sconceGlowColor),
      emissiveIntensity: 1.60,
      roughness: 0.20,
      metalness: 0.00,
    });
    const exitMarkerMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#22c55e'),
      emissive: new THREE.Color('#22c55e'),
      emissiveIntensity: 1.50,
      roughness: 0.40,
      metalness: 0.00,
    });
    const exitDoorMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.tierColor),
      roughness: 0.80,
      metalness: 0.10,
    });

    // Initialize materials for each seat
    for (const seat of seats) {
      let mat = seatMaterials.current.get(seat.seat_id);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          roughness: 0.68,
          metalness: 0.04,
        });
        seatMaterials.current.set(seat.seat_id, mat);
      }
    }

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const name = obj.name;

      if (name.startsWith('seat_')) {
        if (useOriginalSeats) {
          obj.visible = true;
          // Map back from node_name to seat_id
          for (const [sId, nName] of seatNodeMap.entries()) {
            if (nName === name) {
              const mat = seatMaterials.current.get(sId);
              if (mat) obj.material = mat;
              break;
            }
          }
        } else {
          // Hide baked original seat meshes when premium seats are enabled
          obj.visible = false;
        }
      } else if (name === 'room_floor') {
        obj.material = floorMaterial;
      } else if (name.startsWith('tier_platform_') || name.startsWith('side_aisle_')) {
        obj.material = tierMaterial;
      } else if (name.startsWith('central_aisle_tread_')) {
        obj.material = treadMaterial;
      } else if (name.endsWith('_wall')) {
        obj.material = wallMaterial;
      } else if (name.startsWith('acoustic_panel_')) {
        obj.material = acousticPanelMaterial;
      } else if (name.startsWith('panel_trim_')) {
        obj.material = panelTrimMaterial;
      } else if (name === 'ceiling') {
        obj.visible = !isOverview;
        obj.material = ceilingMaterial;
      } else if (name === 'screen_outer_frame') {
        obj.material = screenFrameMaterial;
      } else if (name === 'cinema_screen_surface') {
        obj.visible = false;
      } else if (name === 'screen_stage_lip') {
        obj.material = stageLipMaterial;
      } else if (name.startsWith('speaker_')) {
        obj.material = speakerMaterial;
      } else if (name.startsWith('handrail_') || name.startsWith('rail_post_')) {
        obj.material = railMaterial;
      } else if (name.startsWith('aisle_step_light_') || name.startsWith('aisle_edge_light_')) {
        obj.material = stepLightMaterial;
      } else if (name.startsWith('wall_sconce_') || name.startsWith('ceiling_light_')) {
        obj.material = architecturalLightMaterial;
      } else if (name.startsWith('exit_marker_')) {
        obj.material = exitMarkerMaterial;
      } else if (name.startsWith('exit_door_')) {
        obj.material = exitDoorMaterial;
      }
    });
  }, [scene, seatNodeMap, look, useOriginalSeats, seats]);

  // Assert coordinates on load in dev
  useEffect(() => {
    if (scene) {
      assertSceneCoordinates(scene, layoutData as unknown as SeatLayoutFile);
    }
  }, [scene]);

  // Handle hiding the active seat in POV mode so it doesn't clip the lens (only if using original GLB seats)
  useEffect(() => {
    if (!scene || !useOriginalSeats) return;

    // Reset all seats visibility
    seatNodeMap.forEach((nodeName) => {
      const node = scene.getObjectByName(nodeName);
      if (node) {
        node.visible = true;
      }
    });

    // Hide only the current active seat mesh in POV
    if (cameraMode === 'pov' && activeSeatId) {
      const activeNodeName = seatNodeMap.get(activeSeatId);
      if (activeNodeName) {
        const activeNode = scene.getObjectByName(activeNodeName);
        if (activeNode) {
          activeNode.visible = false;
        }
      }
    }
  }, [scene, cameraMode, activeSeatId, seatNodeMap, useOriginalSeats]);

  // Dynamically update seat states without React re-rendering using InstancedMesh
  useFrame(({ clock, invalidate }) => {
    const stdMesh = standardMeshRef.current;
    const recMesh = reclinerMeshRef.current;
    const time = clock.getElapsedTime();
    const pulse = 0.5 + Math.sin(time * 3.5) * 0.3;
    const store = useCinemaStore.getState();
    const isShow = store.houseLights === 'show';
    const activeSelected = store.selectedSeats;
    const activeStatuses = store.seatStatuses;
    const currentHovered = store.hoveredSeatId;
    const currentLook = getActiveLook(store.theatreLook);
    const camMode = store.cameraMode;
    const actSeatId = store.activeSeatId;

    // Invalidate frame continuously only if there are pulsing held seats
    const hasHeldSeats = Object.values(activeStatuses).some((s) => s === 'held');
    if (hasHeldSeats) {
      invalidate();
    }

    // 1. If using original baked seats
    if (useOriginalSeats) {
      for (const seat of seats) {
        const mat = seatMaterials.current.get(seat.seat_id);
        if (!mat) continue;
        const isSelected = activeSelected.includes(seat.seat_id);
        const rawStatus = activeStatuses[seat.seat_id] || 'available';
        const isHeld = rawStatus === 'held';
        const isBooked = rawStatus === 'booked';
        const isHovered = currentHovered === seat.seat_id;

        const stateKey = `${isSelected ? 1 : 0}-${isHeld ? pulse.toFixed(1) : 0}-${isBooked ? 1 : 0}-${isHovered ? 1 : 0}-${isShow ? 1 : 0}-${currentLook.id}`;
        if (seatStateCache.current.get(seat.seat_id) === stateKey) continue;
        seatStateCache.current.set(seat.seat_id, stateKey);

        if (isSelected) {
          mat.color.set(currentLook.seats.selected);
        } else if (isHeld) {
          mat.color.set(currentLook.seats.held);
        } else if (isBooked) {
          mat.color.set(currentLook.seats.booked);
        } else if (isHovered) {
          mat.color.set('#ffd700');
        } else {
          const cat = (seat.category || 'prime').toLowerCase();
          const baseColor =
            cat === 'premier'
              ? currentLook.seats.premier
              : cat === 'front'
              ? currentLook.seats.front
              : currentLook.seats.prime;
          mat.color.set(baseColor);
        }
      }
      return;
    }

    // Helper to update colors and visibility for an instanced mesh group
    const updateMeshGroup = (
      mesh: THREE.InstancedMesh | null,
      items: { seat: SeatRecord; index: number }[],
      isReclinerGroup: boolean
    ) => {
      if (!mesh) return;

      let colorsNeedUpdate = false;
      let matricesNeedUpdate = false;
      const dummy = new THREE.Object3D();
      const tempColor = new THREE.Color();

      for (let i = 0; i < items.length; i++) {
        const seat = items[i].seat;
        const isSelected = activeSelected.includes(seat.seat_id);
        const rawStatus = activeStatuses[seat.seat_id] || 'available';
        const isHeld = rawStatus === 'held';
        const isBooked = rawStatus === 'booked';
        const isHovered = currentHovered === seat.seat_id;
        const isHiddenInPov = camMode === 'pov' && actSeatId === seat.seat_id;

        let hexColor: string;
        if (isSelected) {
          hexColor = currentLook.seats.selected; // Emerald #22C55E
        } else if (isHeld) {
          hexColor = currentLook.seats.held; // Amber #F59E0B
        } else if (isBooked) {
          hexColor = currentLook.seats.booked; // Desaturated grey #3F424A
        } else if (isHovered) {
          hexColor = '#FF9E2C'; // Soft rim amber outline
        } else {
          if (isReclinerGroup) {
            hexColor = '#4A2818'; // Cognac leather for VIP recliners
          } else {
            const cat = (seat.category || 'prime').toLowerCase();
            hexColor =
              cat === 'premier'
                ? currentLook.seats.premier
                : cat === 'front'
                ? currentLook.seats.front
                : currentLook.seats.prime; // Classic velvet red #6E141A
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
        if (seatStateCache.current.get(seat.seat_id) !== stateKey) {
          seatStateCache.current.set(seat.seat_id, stateKey);
          mesh.setColorAt(i, tempColor);
          colorsNeedUpdate = true;

          // Update POV visibility
          const { min, max } = seat.bounds_gltf_y_up;
          const posX = (min[0] + max[0]) / 2;
          const posY = min[1];
          const posZ = (min[2] + max[2]) / 2;
          dummy.position.set(posX, posY, posZ);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(isHiddenInPov ? 0 : 1, isHiddenInPov ? 0 : 1, isHiddenInPov ? 0 : 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
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

    updateMeshGroup(stdMesh, standardSeats, false);
    updateMeshGroup(recMesh, reclinerSeats, true);
  });

  return (
    <group name="AuditoriumRootGroup">
      <primitive object={scene} name="AuditoriumBaseModel" />

      {/* Instanced Modern Seats & Contact Shadows (§ Original Geometry in 3 Families) */}
      {!useOriginalSeats && (
        <group name="ModernSeatsContainer">
          <instancedMesh
            ref={shadowMeshRef}
            args={[shadowGeometry, shadowMaterial, seats.length]}
            name="InstancedContactShadows"
          />
          {standardGeometry && (
            <instancedMesh
              ref={standardMeshRef}
              args={[standardGeometry, standardMaterial, standardSeats.length]}
              name="InstancedStandardSeats"
            />
          )}
          {reclinerGeometry && (
            <instancedMesh
              ref={reclinerMeshRef}
              args={[reclinerGeometry, reclinerMaterial, reclinerSeats.length]}
              name="InstancedReclinerSeats"
            />
          )}
          {/* Floating 3D State Markers (✓ for selected, ✕ for booked, gold rim glow on hover) */}
          <SeatStateMarkers seats={seats} />
        </group>
      )}
    </group>
  );
}

// Preload models for immediate fast rendering
useGLTF.preload(WEB_MODEL_PATH);
useGLTF.preload(HQ_MODEL_PATH);
useGLTF.preload(STD_LOD0_PATH);
useGLTF.preload(STD_LOD1_PATH);
useGLTF.preload(STD_LOD2_PATH);
useGLTF.preload(REC_LOD0_PATH);
useGLTF.preload(REC_LOD1_PATH);
useGLTF.preload(REC_LOD2_PATH);
