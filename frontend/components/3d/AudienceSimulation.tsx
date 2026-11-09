'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import type { SeatRecord } from '@/lib/types';

interface AudienceSimulationProps {
  seats: SeatRecord[];
}

const CLOTHING_COLORS = [
  '#1e293b', // slate/navy
  '#334155', // charcoal
  '#4c1d95', // deep purple
  '#14532d', // forest green
  '#7f1d1d', // dark burgundy
  '#78350f', // warm amber
  '#0f766e', // dark teal
];

export function AudienceSimulation({ seats }: AudienceSimulationProps) {
  const showPeople = useCinemaStore((s) => s.showPeople);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);

  // Find seats that are already booked (strictly NEVER available or held or selected)
  const bookedSeats = useMemo(() => {
    return seats.filter((s) => {
      const status = seatStatuses[s.seat_id] || 'available';
      return status === 'booked';
    });
  }, [seats, seatStatuses]);

  // Combined stylized seated human mesh (torso box + head sphere)
  const personGeometry = useMemo(() => {
    const groupGeo = new THREE.BufferGeometry();
    const torso = new THREE.BoxGeometry(0.42, 0.52, 0.28);
    torso.translate(0, 0.26, 0);

    const head = new THREE.SphereGeometry(0.12, 8, 8);
    head.translate(0, 0.62, 0);

    // Merge torso and head geometries
    const geometries = [torso, head];
    let posCount = 0;
    for (const g of geometries) posCount += g.attributes.position.count;

    const mergedPositions = new Float32Array(posCount * 3);
    const mergedNormals = new Float32Array(posCount * 3);

    let offset = 0;
    for (const g of geometries) {
      const pos = g.attributes.position.array as Float32Array;
      const norm = g.attributes.normal.array as Float32Array;
      mergedPositions.set(pos, offset * 3);
      mergedNormals.set(norm, offset * 3);
      offset += g.attributes.position.count;
    }

    groupGeo.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    groupGeo.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));
    return groupGeo;
  }, []);

  const personMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.8,
        metalness: 0.05,
      }),
    []
  );

  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize instance positions and diverse clothing colors
  useEffect(() => {
    const mesh = instancedRef.current;
    if (!mesh || bookedSeats.length === 0) return;

    const tempColor = new THREE.Color();
    bookedSeats.forEach((seat, i) => {
      const { min, max } = seat.bounds_gltf_y_up;
      const posX = (min[0] + max[0]) / 2;
      const posY = min[1] + 0.38;
      const posZ = (min[2] + max[2]) / 2 + 0.08;

      dummy.position.set(posX, posY, posZ);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(showPeople ? 1 : 0, showPeople ? 1 : 0, showPeople ? 1 : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      tempColor.set(CLOTHING_COLORS[i % CLOTHING_COLORS.length]);
      mesh.setColorAt(i, tempColor);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [bookedSeats, showPeople, dummy]);

  // Subtle breathing and head bobbing on GPU-style instance updates
  useFrame(() => {
    const mesh = instancedRef.current;
    if (!mesh || !showPeople || bookedSeats.length === 0) return;

    const time = performance.now() * 0.002;
    let needsUpdate = false;

    // Throttle updates for smooth performance
    for (let i = 0; i < bookedSeats.length; i++) {
      const seat = bookedSeats[i];
      const { min, max } = seat.bounds_gltf_y_up;
      const posX = (min[0] + max[0]) / 2;
      const posY = min[1] + 0.38;
      const posZ = (min[2] + max[2]) / 2 + 0.08;

      const breath = Math.sin(time * 2.2 + i * 1.5) * 0.006;
      const subtleTurn = Math.sin(time * 0.9 + i * 2.1) * 0.04;

      dummy.position.set(posX, posY + breath, posZ);
      dummy.rotation.set(0, subtleTurn, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      needsUpdate = true;
    }

    if (needsUpdate) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  if (!showPeople || bookedSeats.length === 0) {
    return null;
  }

  return (
    <group name="AudienceSimulationContainer">
      <instancedMesh
        ref={instancedRef}
        args={[personGeometry, personMaterial, bookedSeats.length]}
        name="InstancedAudienceSimulation"
        castShadow
        receiveShadow
      />
    </group>
  );
}

