'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import type { SeatRecord } from '@/lib/types';

interface SeatStateMarkersProps {
  seats: SeatRecord[];
}

/**
 * Procedural 3D State Indicators for CineVerse Cinema Seats:
 * - Floating emerald checkmark (✓) above selected seats
 * - Subtle slate cross marker (✕) above taken/booked seats
 * - Zero bounding boxes; pure geometric markers rendered via InstancedMesh
 */
export function SeatStateMarkers({ seats }: SeatStateMarkersProps) {
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const cameraMode = useCinemaStore((s) => s.cameraMode);

  // 1. Checkmark (Tick) Geometry for Selected Seats
  const tickGeometry = useMemo(() => {
    const group = new THREE.Group();
    // Short left arm of checkmark
    const leftArmGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8);
    leftArmGeom.rotateZ(Math.PI / 4);
    leftArmGeom.translate(-0.045, -0.015, 0);

    // Long right arm of checkmark
    const rightArmGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.28, 8);
    rightArmGeom.rotateZ(-Math.PI / 4);
    rightArmGeom.translate(0.045, 0.035, 0);

    // Merge arms into single buffer geometry
    const meshL = new THREE.Mesh(leftArmGeom);
    const meshR = new THREE.Mesh(rightArmGeom);
    group.add(meshL);
    group.add(meshR);

    // Combine via manual merge
    const merged = new THREE.BufferGeometry();
    const posL = leftArmGeom.attributes.position.array;
    const posR = rightArmGeom.attributes.position.array;
    const combinedPos = new Float32Array(posL.length + posR.length);
    combinedPos.set(posL, 0);
    combinedPos.set(posR, posL.length);
    merged.setAttribute('position', new THREE.BufferAttribute(combinedPos, 3));
    merged.computeVertexNormals();
    return merged;
  }, []);

  const tickMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#10b981', // Vivid Emerald Green
        emissive: '#059669',
        emissiveIntensity: 1.4,
        roughness: 0.2,
        metalness: 0.1,
        side: THREE.DoubleSide,
      }),
    []
  );

  // 2. Cross (✕) Geometry for Taken/Booked Seats
  const crossGeometry = useMemo(() => {
    const arm1 = new THREE.CylinderGeometry(0.016, 0.016, 0.22, 8);
    arm1.rotateZ(Math.PI / 4);

    const arm2 = new THREE.CylinderGeometry(0.016, 0.016, 0.22, 8);
    arm2.rotateZ(-Math.PI / 4);

    const pos1 = arm1.attributes.position.array;
    const pos2 = arm2.attributes.position.array;
    const combinedPos = new Float32Array(pos1.length + pos2.length);
    combinedPos.set(pos1, 0);
    combinedPos.set(pos2, pos1.length);

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(combinedPos, 3));
    merged.computeVertexNormals();
    return merged;
  }, []);

  const crossMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#6b7280', // Slate Grey Desaturated
        emissive: '#374151',
        emissiveIntensity: 0.4,
        roughness: 0.6,
        metalness: 0.2,
        side: THREE.DoubleSide,
      }),
    []
  );

  // 3. Hover Rim Glow Geometry & Material
  const hoverRimGeometry = useMemo(() => {
    // Elegant toroidal rim hugging the seat footprint
    const geom = new THREE.TorusGeometry(0.60, 0.022, 8, 36);
    geom.rotateX(Math.PI / 2);
    return geom;
  }, []);

  const hoverRimMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#facc15', // Vibrant amber gold
        emissive: '#eab308',
        emissiveIntensity: 2.2,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      }),
    []
  );

  const tickMeshRef = useRef<THREE.InstancedMesh>(null);
  const crossMeshRef = useRef<THREE.InstancedMesh>(null);
  const hoverRimMeshRef = useRef<THREE.Mesh>(null);

  // Pre-index seat positions and floor bounds by ID
  const seatPositions = useMemo(() => {
    const map = new Map<string, { headrest: [number, number, number]; base: [number, number, number] }>();
    for (const seat of seats) {
      const { min, max } = seat.bounds_gltf_y_up;
      const posX = (min[0] + max[0]) / 2;
      const posZ = (min[2] + max[2]) / 2;
      map.set(seat.seat_id, {
        headrest: [posX, max[1], posZ],
        base: [posX, min[1] + 0.03, posZ],
      });
    }
    return map;
  }, [seats]);

  const hoveredSeatId = useCinemaStore((s) => s.hoveredSeatId);

  // Update checkmarks and cross markers each frame
  useFrame(({ clock }) => {
    const tickMesh = tickMeshRef.current;
    const crossMesh = crossMeshRef.current;
    if (!tickMesh || !crossMesh) return;

    const time = clock.getElapsedTime();
    const bob = Math.sin(time * 3.5) * 0.035;
    const dummy = new THREE.Object3D();

    // 1. Update Selected Seat Ticks (Emerald ✓)
    // Only show if not in seated POV
    const isPov = cameraMode === 'pov';
    let tickCount = 0;

    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i];
      const isSelected = selectedSeats.includes(seat.seat_id) && !isPov;

      if (isSelected) {
        const p = seatPositions.get(seat.seat_id);
        const pos = p ? p.headrest : [0, 0, 0];
        dummy.position.set(pos[0], pos[1] + 0.32 + bob, pos[2]);
        dummy.scale.set(1.4, 1.4, 1.4);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        tickMesh.setMatrixAt(tickCount, dummy.matrix);
        tickCount++;
      }
    }

    // Hide remaining instances
    for (let i = tickCount; i < seats.length; i++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      tickMesh.setMatrixAt(i, dummy.matrix);
    }
    tickMesh.count = tickCount;
    tickMesh.instanceMatrix.needsUpdate = true;

    // 2. Update Taken/Booked Seat Crosses (Muted ✕)
    let crossCount = 0;
    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i];
      const status = seatStatuses[seat.seat_id];
      const isBooked = status === 'booked' && !isPov;

      if (isBooked) {
        const p = seatPositions.get(seat.seat_id);
        const pos = p ? p.headrest : [0, 0, 0];
        dummy.position.set(pos[0], pos[1] + 0.28, pos[2]);
        dummy.scale.set(1.0, 1.0, 1.0);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        crossMesh.setMatrixAt(crossCount, dummy.matrix);
        crossCount++;
      }
    }

    for (let i = crossCount; i < seats.length; i++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      crossMesh.setMatrixAt(i, dummy.matrix);
    }
    crossMesh.count = crossCount;
    crossMesh.instanceMatrix.needsUpdate = true;

    // 3. Update Hover Rim Glow on hovered seat
    const hoverRim = hoverRimMeshRef.current;
    if (hoverRim) {
      if (hoveredSeatId && !isPov) {
        const p = seatPositions.get(hoveredSeatId);
        if (p) {
          const rimScale = 1.0 + Math.sin(time * 6.0) * 0.05;
          hoverRim.position.set(p.base[0], p.base[1], p.base[2]);
          hoverRim.scale.set(rimScale, 1.0, rimScale);
          hoverRim.visible = true;
        } else {
          hoverRim.visible = false;
        }
      } else {
        hoverRim.visible = false;
      }
    }
  });

  return (
    <group name="SeatStateMarkersContainer">
      <instancedMesh
        ref={tickMeshRef}
        args={[tickGeometry, tickMaterial, seats.length]}
        name="SelectedSeatCheckmarks"
      />
      <instancedMesh
        ref={crossMeshRef}
        args={[crossGeometry, crossMaterial, seats.length]}
        name="TakenSeatCrossMarkers"
      />
      <mesh
        ref={hoverRimMeshRef}
        geometry={hoverRimGeometry}
        material={hoverRimMaterial}
        name="HoverRimGlow"
        visible={false}
      />
    </group>
  );
}
