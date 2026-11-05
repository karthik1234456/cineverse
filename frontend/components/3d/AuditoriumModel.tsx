'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import { assertSceneCoordinates } from '@/lib/assertCoordinates';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile } from '@/lib/types';
import { getActiveLook } from '@/lib/theatreLooks';

const WEB_MODEL_PATH = '/models/cineverse_auditorium_v2.web.glb';
const HQ_MODEL_PATH = '/models/cineverse_auditorium_v2.glb';
const PREMIUM_SEAT_PATH = '/models/seat_premium.glb';

export function AuditoriumModel() {
  const useHqModel = useCinemaStore((s) => s.useHqModel);
  const theatreLook = useCinemaStore((s) => s.theatreLook);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);

  const modelUrl = useHqModel ? HQ_MODEL_PATH : WEB_MODEL_PATH;
  const { scene } = useGLTF(modelUrl);
  const premiumGltf = useGLTF(PREMIUM_SEAT_PATH);

  // Check ?seats=original URL param
  const [useOriginalSeats, setUseOriginalSeats] = React.useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setUseOriginalSeats(params.get('seats') === 'original');
    }
  }, []);

  const seats = (layoutData as unknown as SeatLayoutFile).seats;
  const seatNodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seats) {
      map.set(s.seat_id, s.node_name);
    }
    return map;
  }, [seats]);

  const seatMaterials = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
  const seatStateCache = useRef<Map<string, string>>(new Map());

  // Extract geometry from premium seat model
  const premiumGeometry = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null;
    premiumGltf.scene.traverse((o) => {
      if (!geo && o instanceof THREE.Mesh) {
        geo = o.geometry;
      }
    });
    return geo;
  }, [premiumGltf.scene]);

  // Shared instanced materials & geometry for ultra-efficient batching (Part D Compliance)
  const shadowGeometry = useMemo(() => new THREE.PlaneGeometry(1.22, 0.92), []);
  const shadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#030406',
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    []
  );

  const premiumMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.68,
        metalness: 0.04,
      }),
    []
  );

  const shadowMeshRef = useRef<THREE.InstancedMesh>(null);
  const premiumSeatsMeshRef = useRef<THREE.InstancedMesh>(null);

  // Initialize instanced seat & shadow matrices
  useEffect(() => {
    if (!shadowMeshRef.current || !premiumSeatsMeshRef.current) return;
    const shadowMesh = shadowMeshRef.current;
    const seatMesh = premiumSeatsMeshRef.current;
    const dummy = new THREE.Object3D();

    seats.forEach((seat, idx) => {
      const { min, max } = seat.bounds_gltf_y_up;
      const posX = (min[0] + max[0]) / 2;
      const posY = min[1];
      const posZ = (min[2] + max[2]) / 2;

      // Seat matrix
      dummy.position.set(posX, posY, posZ);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      seatMesh.setMatrixAt(idx, dummy.matrix);

      // Shadow matrix
      dummy.position.set(posX, posY + 0.005, posZ);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      shadowMesh.setMatrixAt(idx, dummy.matrix);
    });

    seatMesh.instanceMatrix.needsUpdate = true;
    shadowMesh.instanceMatrix.needsUpdate = true;
    seatStateCache.current.clear();
  }, [seats]);

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
      side: THREE.DoubleSide,
    });
    const acousticPanelMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.acousticPanelColor),
      roughness: 0.82,
      metalness: 0.04,
      side: THREE.DoubleSide,
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

  // Dynamically update seat states without React re-rendering using InstancedMesh (Part D batching)
  useFrame(({ clock }) => {
    const seatMesh = premiumSeatsMeshRef.current;
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

    // 2. If using ultra-fast InstancedMesh for premium seats
    if (!seatMesh) return;

    let colorsNeedUpdate = false;
    let matricesNeedUpdate = false;
    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();

    for (let idx = 0; idx < seats.length; idx++) {
      const seat = seats[idx];
      const isSelected = activeSelected.includes(seat.seat_id);
      const rawStatus = activeStatuses[seat.seat_id] || 'available';
      const isHeld = rawStatus === 'held';
      const isBooked = rawStatus === 'booked';
      const isHovered = currentHovered === seat.seat_id;
      const isHiddenInPov = camMode === 'pov' && actSeatId === seat.seat_id;

      // Determine target color
      let hexColor: string;
      if (isSelected) {
        hexColor = currentLook.seats.selected;
      } else if (isHeld) {
        hexColor = currentLook.seats.held;
      } else if (isBooked) {
        hexColor = currentLook.seats.booked;
      } else if (isHovered) {
        hexColor = '#ffd700'; // Vibrant gold/amber for instant hover feedback
      } else {
        const cat = (seat.category || 'prime').toLowerCase();
        hexColor =
          cat === 'premier'
            ? currentLook.seats.premier
            : cat === 'front'
            ? currentLook.seats.front
            : currentLook.seats.prime;
      }

      tempColor.set(hexColor);
      if (isShow && !isSelected && !isHovered && !isHeld) {
        tempColor.multiplyScalar(0.75);
      }
      if (isHeld) {
        tempColor.multiplyScalar(pulse);
      }

      // Check cache key before updating
      const stateKey = `${isSelected ? 1 : 0}-${isHeld ? pulse.toFixed(1) : 0}-${isBooked ? 1 : 0}-${isHovered ? 1 : 0}-${isShow ? 1 : 0}-${currentLook.id}-${isHiddenInPov ? 1 : 0}`;
      if (seatStateCache.current.get(seat.seat_id) !== stateKey) {
        seatStateCache.current.set(seat.seat_id, stateKey);
        seatMesh.setColorAt(idx, tempColor);
        colorsNeedUpdate = true;

        // Update visibility/scale in POV
        const { min, max } = seat.bounds_gltf_y_up;
        const posX = (min[0] + max[0]) / 2;
        const posY = min[1];
        const posZ = (min[2] + max[2]) / 2;
        dummy.position.set(posX, posY, posZ);
        dummy.scale.set(isHiddenInPov ? 0 : 1, isHiddenInPov ? 0 : 1, isHiddenInPov ? 0 : 1);
        dummy.updateMatrix();
        seatMesh.setMatrixAt(idx, dummy.matrix);
        matricesNeedUpdate = true;
      }
    }

    if (colorsNeedUpdate && seatMesh.instanceColor) {
      seatMesh.instanceColor.needsUpdate = true;
    }
    if (matricesNeedUpdate) {
      seatMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="AuditoriumRootGroup">
      <primitive object={scene} name="AuditoriumBaseModel" />

      {/* Instanced Premium Seats with Ambient Occlusion Contact Shadows (§ Part D Optimization) */}
      {!useOriginalSeats && premiumGeometry && (
        <group name="PremiumSeatsContainer">
          <instancedMesh
            ref={shadowMeshRef}
            args={[shadowGeometry, shadowMaterial, seats.length]}
            name="InstancedContactShadows"
          />
          <instancedMesh
            ref={premiumSeatsMeshRef}
            args={[premiumGeometry, premiumMaterial, seats.length]}
            name="InstancedPremiumSeats"
          />
        </group>
      )}
    </group>
  );
}

// Preload models for immediate fast rendering
useGLTF.preload(WEB_MODEL_PATH);
useGLTF.preload(HQ_MODEL_PATH);
useGLTF.preload(PREMIUM_SEAT_PATH);
