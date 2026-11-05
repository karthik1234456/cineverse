'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import { assertSceneCoordinates } from '@/lib/assertCoordinates';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile } from '@/lib/types';

const WEB_MODEL_PATH = '/models/cineverse_auditorium_v2.web.glb';
const HQ_MODEL_PATH = '/models/cineverse_auditorium_v2.glb';
const PREMIUM_SEAT_PATH = '/models/seat_premium.glb';

export function AuditoriumModel() {
  const useHqModel = useCinemaStore((s) => s.useHqModel);
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

  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const hoveredSeatId = useCinemaStore((s) => s.hoveredSeatId);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const houseLights = useCinemaStore((s) => s.houseLights);

  const seats = (layoutData as unknown as SeatLayoutFile).seats;
  const seatNodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seats) {
      map.set(s.seat_id, s.node_name);
    }
    return map;
  }, [seats]);

  const seatMaterials = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());

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

  // Assign rich physically-based materials across all node groups on load
  useEffect(() => {
    if (!scene) return;
    seatMaterials.current.clear();

    // Reusable shared materials by group
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#131418'),
      roughness: 0.88,
      metalness: 0.02,
    });
    const tierMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#15161b'),
      roughness: 0.88,
      metalness: 0.02,
    });
    const treadMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1c1e24'),
      roughness: 0.70,
      metalness: 0.10,
    });
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#171920'),
      roughness: 0.92,
      metalness: 0.02,
    });
    const acousticPanelMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1c1e26'),
      roughness: 0.85,
      metalness: 0.04,
    });
    const panelTrimMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2d323e'),
      roughness: 0.35,
      metalness: 0.80,
    });
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0c0d11'),
      roughness: 0.95,
      metalness: 0.00,
    });
    const screenFrameMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#08090b'),
      roughness: 0.85,
      metalness: 0.20,
    });
    const stageLipMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#14161c'),
      roughness: 0.80,
      metalness: 0.15,
    });
    const speakerMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#181a20'),
      roughness: 0.45,
      metalness: 0.70,
    });
    const railMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#475569'),
      roughness: 0.30,
      metalness: 0.85,
    });
    const stepLightMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#38bdf8'),
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 1.20,
      roughness: 0.30,
      metalness: 0.00,
    });
    const architecturalLightMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef3c7'),
      emissive: new THREE.Color('#fef3c7'),
      emissiveIntensity: 1.50,
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
      color: new THREE.Color('#16181f'),
      roughness: 0.80,
      metalness: 0.10,
    });

    // Initialize materials for each seat
    for (const seat of seats) {
      let mat = seatMaterials.current.get(seat.seat_id);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          roughness: 0.72,
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
  }, [scene, seatNodeMap]);

  // Assert coordinates on load in dev
  useEffect(() => {
    if (scene) {
      assertSceneCoordinates(scene, layoutData as unknown as SeatLayoutFile);
    }
  }, [scene]);

  // Handle hiding the active seat in POV mode so it doesn't clip the lens
  useEffect(() => {
    if (!scene) return;

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
  }, [scene, cameraMode, activeSeatId, seatNodeMap]);

  // Dynamically update seat states (colors, emissive rim, pulse) on seat materials
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const pulse = 0.45 + Math.sin(time * 3.5) * 0.25;
    const isShow = houseLights === 'show';

    for (const seat of seats) {
      const mat = seatMaterials.current.get(seat.seat_id);
      if (!mat) continue;

      const isSelected = selectedSeats.includes(seat.seat_id);
      const rawStatus = seatStatuses[seat.seat_id] || 'available';
      const isHeld = rawStatus === 'held';
      const isBooked = rawStatus === 'booked';
      const isHovered = hoveredSeatId === seat.seat_id;

      if (isSelected) {
        // Selected: CineVerse crimson velvet + high emissive glow
        mat.color.set('#C8102E');
        mat.emissive.set('#FF2233');
        mat.emissiveIntensity = 0.90;
        mat.roughness = 0.65;
      } else if (isHeld) {
        // Held by someone else: amber accent with gentle pulse
        mat.color.set('#B45309');
        mat.emissive.set('#F59E0B');
        mat.emissiveIntensity = pulse;
        mat.roughness = 0.75;
      } else if (isBooked) {
        // Booked: desaturated/darkened seat
        mat.color.set('#202227');
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
        mat.roughness = 0.95;
      } else if (isHovered) {
        // Hover: soft highlight rim
        mat.color.set('#B91C1C');
        mat.emissive.set('#FFFFFF');
        mat.emissiveIntensity = 0.60;
        mat.roughness = 0.70;
      } else {
        // Available: rich velvet seat with category colour (§ Task 3)
        const cat = (seat.category || 'prime').toLowerCase();
        if (cat === 'premier') {
          mat.color.set(isShow ? '#7A0F2E' : '#9F1239'); // ruby
          mat.emissive.set('#9F1239');
          mat.emissiveIntensity = isShow ? 0.04 : 0.08;
        } else if (cat === 'front') {
          mat.color.set(isShow ? '#6B441D' : '#8D5B28'); // warm amber-brown
          mat.emissive.set('#8D5B28');
          mat.emissiveIntensity = isShow ? 0.04 : 0.08;
        } else {
          // prime
          mat.color.set(isShow ? '#172554' : '#1E40AF'); // royal blue
          mat.emissive.set('#1E40AF');
          mat.emissiveIntensity = isShow ? 0.04 : 0.08;
        }
        mat.roughness = 0.72;
        mat.metalness = 0.04;
      }
    }
  });

  return (
    <group name="AuditoriumRootGroup">
      <primitive object={scene} name="AuditoriumBaseModel" />

      {/* Instanced Premium Seats with Ambient Occlusion Contact Shadows (§ Task 3) */}
      {!useOriginalSeats && premiumGeometry && (
        <group name="PremiumSeatsContainer">
          {seats.map((seat) => {
            const { min, max } = seat.bounds_gltf_y_up;
            const posX = (min[0] + max[0]) / 2;
            const posY = min[1];
            const posZ = (min[2] + max[2]) / 2;
            const isHiddenInPov = cameraMode === 'pov' && activeSeatId === seat.seat_id;
            const mat = seatMaterials.current.get(seat.seat_id);

            return (
              <group
                key={seat.seat_id}
                name={`premium_${seat.seat_id}`}
                position={[posX, posY, posZ]}
                visible={!isHiddenInPov}
              >
                {/* Ambient Occlusion Contact Shadow */}
                <mesh
                  position={[0, 0.005, 0]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  name={`ao_shadow_${seat.seat_id}`}
                >
                  <planeGeometry args={[1.22, 0.92]} />
                  <meshBasicMaterial
                    color="#030406"
                    transparent
                    opacity={0.50}
                    depthWrite={false}
                  />
                </mesh>

                {/* Premium Cinema Seat Mesh */}
                {mat && (
                  <mesh
                    geometry={premiumGeometry}
                    material={mat}
                    name={`mesh_${seat.seat_id}`}
                  />
                )}
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
}

// Preload models for immediate fast rendering
useGLTF.preload(WEB_MODEL_PATH);
useGLTF.preload(HQ_MODEL_PATH);
useGLTF.preload(PREMIUM_SEAT_PATH);
