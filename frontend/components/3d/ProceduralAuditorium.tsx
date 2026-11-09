'use client';

import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import { getActiveLook } from '@/lib/theatreLooks';
import type { ProceduralGeometryData } from '@/lib/proceduralAuditorium';
import type { SeatRecord } from '@/lib/types';
import { AudienceSimulation } from './AudienceSimulation';

const PREMIUM_SEAT_PATH = '/models/seat_premium.glb';

interface ProceduralAuditoriumProps {
  geometry: ProceduralGeometryData;
  seats: SeatRecord[];
  onSeatClick?: (seatId: string) => void;
  onSeatDoubleClick?: (seatId: string) => void;
}

export function ProceduralAuditorium({
  geometry,
  seats,
  onSeatClick,
  onSeatDoubleClick,
}: ProceduralAuditoriumProps) {
  const theatreLook = useCinemaStore((s) => s.theatreLook);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const setHoveredSeat = useCinemaStore((s) => s.setHoveredSeat);
  const toggleSeat = useCinemaStore((s) => s.toggleSeat);

  const look = useMemo(() => getActiveLook(theatreLook), [theatreLook]);

  // Premium seat GLB
  const premiumGltf = useGLTF(PREMIUM_SEAT_PATH);
  const premiumGeometry = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null;
    premiumGltf.scene.traverse((o) => {
      if (!geo && o instanceof THREE.Mesh) {
        geo = o.geometry;
      }
    });
    return geo || new THREE.BoxGeometry(0.7, 0.85, 0.65);
  }, [premiumGltf.scene]);

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

  const premiumMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.68,
        metalness: 0.04,
      }),
    []
  );

  // Instanced Meshes for ultra-low draw calls
  const shadowMeshRef = useRef<THREE.InstancedMesh>(null);
  const premiumSeatsMeshRef = useRef<THREE.InstancedMesh>(null);
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
        color: new THREE.Color(look.floorColor),
        roughness: 0.85,
        metalness: 0.02,
      }),
    [look.floorColor]
  );

  const tierMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(look.tierColor),
        roughness: 0.85,
        metalness: 0.02,
      }),
    [look.tierColor]
  );

  const treadMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(look.treadColor),
        roughness: 0.70,
        metalness: 0.08,
      }),
    [look.treadColor]
  );

  const wallMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(look.wallColor),
        roughness: 0.90,
        metalness: 0.02,
        side: THREE.DoubleSide,
      }),
    [look.wallColor]
  );

  const acousticPanelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(look.acousticPanelColor),
        roughness: 0.82,
        metalness: 0.04,
        side: THREE.DoubleSide,
      }),
    [look.acousticPanelColor]
  );

  const panelTrimMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(look.panelTrimColor),
        roughness: 0.35,
        metalness: 0.80,
      }),
    [look.panelTrimColor]
  );

  const ceilingMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(look.ceilingColor),
        roughness: 0.95,
        metalness: 0.00,
        side: THREE.DoubleSide,
      }),
    [look.ceilingColor]
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
        emissiveIntensity: 1.4,
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
        color: '#fffbf0',
        emissive: '#fff0d0',
        emissiveIntensity: 1.8,
        roughness: 0.2,
      }),
    []
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
        color: '#ffe6b3',
        emissive: '#ffe6b3',
        emissiveIntensity: 2.2,
        roughness: 0.1,
      }),
    []
  );

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
    if (shadowMeshRef.current && premiumSeatsMeshRef.current) {
      const shadowMesh = shadowMeshRef.current;
      const seatMesh = premiumSeatsMeshRef.current;

      seats.forEach((seat, idx) => {
        const { min, max } = seat.bounds_gltf_y_up;
        const posX = (min[0] + max[0]) / 2;
        const posY = min[1];
        const posZ = (min[2] + max[2]) / 2;

        dummy.position.set(posX, posY, posZ);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        seatMesh.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(posX, posY + 0.005, posZ);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        shadowMesh.setMatrixAt(idx, dummy.matrix);
      });

      seatMesh.instanceMatrix.needsUpdate = true;
      shadowMesh.instanceMatrix.needsUpdate = true;
      seatStateCache.current.clear();
    }

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

  // Per-frame color & state updates for instanced seats
  useFrame(() => {
    const seatMesh = premiumSeatsMeshRef.current;
    if (!seatMesh) return;

    const activeStatuses = useCinemaStore.getState().seatStatuses;
    const activeSelected = useCinemaStore.getState().selectedSeats;
    const currentHovered = useCinemaStore.getState().hoveredSeatId;
    const isShow = useCinemaStore.getState().houseLights === 'show';
    const currentLook = getActiveLook(useCinemaStore.getState().theatreLook);
    const camMode = useCinemaStore.getState().cameraMode;
    const actSeatId = useCinemaStore.getState().activeSeatId;

    const time = performance.now() * 0.003;
    const pulse = 0.85 + Math.sin(time) * 0.15;

    let colorsNeedUpdate = false;
    let matricesNeedUpdate = false;
    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();

    const is4dxActive = useCinemaStore.getState().experience4dxActive;
    const intensity4dx = useCinemaStore.getState().experience4dxIntensity;

    for (let idx = 0; idx < seats.length; idx++) {
      const seat = seats[idx];
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

      const stateKey = `${isSelected ? 1 : 0}-${isHeld ? pulse.toFixed(1) : 0}-${isBooked ? 1 : 0}-${isHovered ? 1 : 0}-${isShow ? 1 : 0}-${currentLook.id}-${isHiddenInPov ? 1 : 0}`;
      const isSeatShaking = is4dxActive && !!seat.in_motion_zone;

      if (seatStateCache.current.get(seat.seat_id) !== stateKey || isSeatShaking) {
        if (!isSeatShaking) {
          seatStateCache.current.set(seat.seat_id, stateKey);
        }
        seatMesh.setColorAt(idx, tempColor);
        colorsNeedUpdate = true;

        const { min, max } = seat.bounds_gltf_y_up;
        const posX = (min[0] + max[0]) / 2;
        let posY = min[1];
        let posZ = (min[2] + max[2]) / 2;
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
        dummy.rotation.set(pitch, 0, roll);
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

  // Direct interaction handlers on InstancedMesh (Zero extra draw calls)
  const handleInstanceClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && seats[e.instanceId]) {
        const seatId = seats[e.instanceId].seat_id;
        if (onSeatClick) {
          onSeatClick(seatId);
        } else {
          toggleSeat(seatId);
        }
      }
    },
    [seats, onSeatClick, toggleSeat]
  );

  const handleInstanceDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && seats[e.instanceId]) {
        const seatId = seats[e.instanceId].seat_id;
        if (onSeatDoubleClick) {
          onSeatDoubleClick(seatId);
        }
      }
    },
    [seats, onSeatDoubleClick]
  );

  const lastHoverIdx = useRef<number | null>(null);
  const handleInstancePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && seats[e.instanceId]) {
        if (lastHoverIdx.current === e.instanceId) return;
        lastHoverIdx.current = e.instanceId;
        setHoveredSeat(seats[e.instanceId].seat_id);
      }
    },
    [seats, setHoveredSeat]
  );

  const handleInstancePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      lastHoverIdx.current = null;
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

      {/* 5. Ceiling */}
      <mesh
        name="ceiling"
        position={ceilingBox.center}
        material={ceilingMaterial}
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

      {/* 6b. Subtle Proscenium Arch & Crimson Side Curtains */}
      {geometry.proscenium && (
        <mesh
          name="proscenium_arch"
          position={boxHelper(geometry.proscenium).center}
          material={prosceniumMaterial}
        >
          <boxGeometry args={boxHelper(geometry.proscenium).size} />
        </mesh>
      )}

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

      {geometry.ceilingDownlights && geometry.ceilingDownlights.length > 0 && (
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

      {/* 8b. Illuminated EXIT signs & Carpet Runners */}
      {geometry.exitSigns && (
        <group name="ExitSigns">
          {geometry.exitSigns.map((es) => (
            <mesh key={es.id} position={es.position} material={exitSignMaterial}>
              <boxGeometry args={[0.65, 0.3, 0.08]} />
            </mesh>
          ))}
        </group>
      )}

      {geometry.carpetRunners && (
        <group name="CarpetRunners">
          {geometry.carpetRunners.map((cr) => {
            const { size, center } = boxHelper(cr.bounds);
            return (
              <mesh key={cr.name} position={center} material={carpetRunnerMaterial}>
                <boxGeometry args={size} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* 9. Instanced Premium Seats & Contact Shadows with Built-in Raycast Interactivity */}
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
          onClick={handleInstanceClick}
          onDoubleClick={handleInstanceDoubleClick}
          onPointerMove={handleInstancePointerMove}
          onPointerOut={handleInstancePointerOut}
        />
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

useGLTF.preload(PREMIUM_SEAT_PATH);
