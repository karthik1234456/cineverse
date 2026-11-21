'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import type { SeatRecord } from '@/lib/types';

interface SeatStateMarkersProps {
  seats: SeatRecord[];
}

/**
 * Creates high-contrast billboard textures for seat state badges:
 * - Selected: Emerald disc (#22C55E) with white checkmark (✓)
 * - Booked: Slate disc (#3F424A) with white cross (✕)
 * - Held: Amber disc (#F59E0B) with white clock symbol (🕒)
 * - Floor Ring: Soft radial gradient glow for selected seats
 */
function createBadgeTexture(type: 'tick' | 'cross' | 'clock'): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, 128, 128);

  const cx = 64;
  const cy = 64;
  const radius = 54;

  // Outer subtle dark drop shadow & stroke ring
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  if (type === 'tick') {
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Bold white checkmark
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(38, 64);
    ctx.lineTo(54, 82);
    ctx.lineTo(92, 44);
    ctx.stroke();
  } else if (type === 'cross') {
    ctx.fillStyle = '#3F424A';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Crisp white/light-grey cross (✕)
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(42, 42);
    ctx.lineTo(86, 86);
    ctx.moveTo(86, 42);
    ctx.lineTo(42, 86);
    ctx.stroke();
  } else if (type === 'clock') {
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // White clock circle rim & hands (🕒)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.stroke();

    // Center pivot dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();

    // Hour and minute hands
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, 44); // 12 o'clock
    ctx.moveTo(cx, cy);
    ctx.lineTo(84, cy); // 3 o'clock
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFloorRingTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, 256, 256);
  const cx = 128;
  const cy = 128;
  const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, 120);
  grad.addColorStop(0, 'rgba(34, 197, 94, 0.0)');
  grad.addColorStop(0.4, 'rgba(34, 197, 94, 0.85)');
  grad.addColorStop(0.7, 'rgba(34, 197, 94, 0.45)');
  grad.addColorStop(1, 'rgba(34, 197, 94, 0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 120, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function SeatStateMarkers({ seats }: SeatStateMarkersProps) {
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const showSeatMarkers = useCinemaStore((s) => s.showSeatMarkers ?? true);

  // Billboard Textures
  const tickTexture = useMemo(() => createBadgeTexture('tick'), []);
  const crossTexture = useMemo(() => createBadgeTexture('cross'), []);
  const clockTexture = useMemo(() => createBadgeTexture('clock'), []);
  const ringTexture = useMemo(() => createFloorRingTexture(), []);

  // Shared Billboard Plane Geometry (faces camera)
  const badgeGeometry = useMemo(() => new THREE.PlaneGeometry(0.42, 0.42), []);

  // Floor Ring Geometry (horizontal plane)
  const ringGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1.2, 1.2);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  // Materials
  const tickMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: tickTexture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [tickTexture]
  );

  const crossMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: crossTexture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [crossTexture]
  );

  const clockMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: clockTexture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [clockTexture]
  );

  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: ringTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [ringTexture]
  );

  // Refs for Instanced Meshes
  const tickMeshRef = useRef<THREE.InstancedMesh>(null);
  const crossMeshRef = useRef<THREE.InstancedMesh>(null);
  const clockMeshRef = useRef<THREE.InstancedMesh>(null);
  const ringMeshRef = useRef<THREE.InstancedMesh>(null);

  // Pre-index seat positions by ID
  const seatPositions = useMemo(() => {
    const map = new Map<string, { headrest: [number, number, number]; base: [number, number, number] }>();
    for (const seat of seats) {
      const { min, max } = seat.bounds_gltf_y_up;
      const posX = (min[0] + max[0]) / 2;
      const posZ = (min[2] + max[2]) / 2;
      map.set(seat.seat_id, {
        headrest: [posX, max[1], posZ],
        base: [posX, min[1] + 0.02, posZ],
      });
    }
    return map;
  }, [seats]);

  // Update Billboard transforms every frame
  useFrame(({ camera, clock }) => {
    const tickMesh = tickMeshRef.current;
    const crossMesh = crossMeshRef.current;
    const clockMesh = clockMeshRef.current;
    const ringMesh = ringMeshRef.current;
    if (!tickMesh || !crossMesh || !clockMesh || !ringMesh) return;

    if (!showSeatMarkers) {
      tickMesh.count = 0;
      crossMesh.count = 0;
      clockMesh.count = 0;
      ringMesh.count = 0;
      return;
    }

    const state = useCinemaStore.getState();
    const activeSelected = state.selectedSeats;
    const activeStatuses = state.seatStatuses;
    const camMode = state.cameraMode;
    const actSeatId = state.activeSeatId;
    const isPov = camMode === 'pov';
    const time = clock.getElapsedTime();
    const bob = Math.sin(time * 3.5) * 0.025;
    const dummy = new THREE.Object3D();
    const camPos = camera.position;

    let tickCount = 0;
    let ringCount = 0;
    let crossCount = 0;
    let clockCount = 0;

    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i];
      const p = seatPositions.get(seat.seat_id);
      if (!p) continue;

      const dx = p.headrest[0] - camPos.x;
      const dy = p.headrest[1] - camPos.y;
      const dz = p.headrest[2] - camPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Fade/hide badges only at extreme ranges (> 180m)
      if (dist > 180) continue;

      // Minimum on-screen size safeguard (~24px minimum on screen at distance)
      const scale = Math.max(0.42, dist * 0.025);

      const status = activeStatuses[seat.seat_id] || 'available';
      const isSelected = activeSelected.includes(seat.seat_id);
      const isCurrentPovSeat = isPov && actSeatId === seat.seat_id;

      // Project 3D badge position to screen NDC to prevent drawing over toolbar/HUD (§ Part D)
      const badgeY = p.headrest[1] + 0.32 + scale * 0.3;
      const projPos = new THREE.Vector3(p.headrest[0], badgeY, p.headrest[2]).project(camera);
      const isUnderToolbar = projPos.y > 0.60 && Math.abs(projPos.x) < 0.65;
      const isUnderLeftHUD = !isPov && projPos.x < -0.60 && projPos.y > -0.90 && projPos.y < 0.85;
      const isClippedByHUD = isUnderToolbar || isUnderLeftHUD;

      if (isSelected) {
        // 1. Soft emerald floor ring (render on floor for all selected seats, including current POV seat)
        dummy.position.set(p.base[0], p.base[1], p.base[2]);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1.0, 1.0, 1.0);
        dummy.updateMatrix();
        ringMesh.setMatrixAt(ringCount, dummy.matrix);
        ringCount++;

        // 2. Emerald Tick Badge (✓) floating above seat (clipped under toolbar & HUD)
        if (!isCurrentPovSeat && !isClippedByHUD) {
          dummy.position.set(p.headrest[0], p.headrest[1] + 0.35 + scale * 0.3 + bob, p.headrest[2]);
          dummy.quaternion.copy(camera.quaternion);
          dummy.scale.set(scale * 1.15, scale * 1.15, 1);
          dummy.updateMatrix();
          tickMesh.setMatrixAt(tickCount, dummy.matrix);
          tickCount++;
        }
      } else if (status === 'booked') {
        // 3. Muted Grey Cross Badge (✕) (§ Part C, D: clipped under toolbar & HUD)
        if (!isClippedByHUD) {
          dummy.position.set(p.headrest[0], p.headrest[1] + 0.30 + scale * 0.3, p.headrest[2]);
          dummy.quaternion.copy(camera.quaternion);
          dummy.scale.set(scale, scale, 1);
          dummy.updateMatrix();
          crossMesh.setMatrixAt(crossCount, dummy.matrix);
          crossCount++;
        }
      } else if (status === 'held') {
        if (!isCurrentPovSeat && !isClippedByHUD) {
          // 4. Amber Clock Badge (🕒) (clipped under toolbar & HUD)
          dummy.position.set(p.headrest[0], p.headrest[1] + 0.32 + scale * 0.3 + bob * 0.5, p.headrest[2]);
          dummy.quaternion.copy(camera.quaternion);
          dummy.scale.set(scale, scale, 1);
          dummy.updateMatrix();
          clockMesh.setMatrixAt(clockCount, dummy.matrix);
          clockCount++;
        }
      }
    }

    if (typeof window !== 'undefined') {
      (window as any).__seatMarkerCounts = {
        tick: tickCount,
        cross: crossCount,
        clock: clockCount,
        ring: ringCount,
      };
    }

    // Hide extra instances and flag update
    for (let i = tickCount; i < seats.length; i++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      tickMesh.setMatrixAt(i, dummy.matrix);
    }
    tickMesh.count = tickCount;
    tickMesh.instanceMatrix.needsUpdate = true;

    for (let i = ringCount; i < seats.length; i++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      ringMesh.setMatrixAt(i, dummy.matrix);
    }
    ringMesh.count = ringCount;
    ringMesh.instanceMatrix.needsUpdate = true;

    for (let i = crossCount; i < seats.length; i++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      crossMesh.setMatrixAt(i, dummy.matrix);
    }
    crossMesh.count = crossCount;
    crossMesh.instanceMatrix.needsUpdate = true;

    for (let i = clockCount; i < seats.length; i++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      clockMesh.setMatrixAt(i, dummy.matrix);
    }
    clockMesh.count = clockCount;
    clockMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group name="SeatStateMarkersContainer">
      <instancedMesh
        ref={tickMeshRef}
        args={[badgeGeometry, tickMaterial, seats.length]}
        name="SelectedSeatCheckmarks"
        raycast={() => null}
      />
      <instancedMesh
        ref={ringMeshRef}
        args={[ringGeometry, ringMaterial, seats.length]}
        name="SelectedSeatFloorRings"
        raycast={() => null}
      />
      <instancedMesh
        ref={crossMeshRef}
        args={[badgeGeometry, crossMaterial, seats.length]}
        name="TakenSeatCrossMarkers"
        raycast={() => null}
      />
      <instancedMesh
        ref={clockMeshRef}
        args={[badgeGeometry, clockMaterial, seats.length]}
        name="HeldSeatClockMarkers"
        raycast={() => null}
      />
    </group>
  );
}
