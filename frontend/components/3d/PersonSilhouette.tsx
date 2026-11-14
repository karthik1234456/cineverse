'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { METERS_TO_SCENE } from '@/lib/theatreTypeRegistry';

interface PersonSilhouetteProps {
  position?: [number, number, number];
  visible?: boolean;
}

/**
 * 1.75m Human Silhouette for Scale Verification
 * Real-world height: 1.75 metres
 * Scene units height: 1.75 * METERS_TO_SCENE = 3.50 scene units
 * Documented scale: 1 metre = 2 scene units (METERS_TO_SCENE = 2.0, SCENE_TO_METERS = 0.50)
 */
export function PersonSilhouette({
  position = [0.0, 0.22, -10.0],
  visible = true,
}: PersonSilhouetteProps) {
  const silhouetteMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: new THREE.Color('#0284c7'),
        emissiveIntensity: 0.8,
        roughness: 0.3,
        metalness: 0.2,
        transparent: true,
        opacity: 0.85,
      }),
    []
  );

  if (!visible) return null;

  return (
    <group position={position} name="PersonScaleSilhouette">
      {/* Head: diameter ~0.24m (0.48 units), top at exactly 3.50 units (1.75m) */}
      <mesh position={[0, 3.26, 0]} material={silhouetteMaterial}>
        <sphereGeometry args={[0.24, 16, 16]} />
      </mesh>

      {/* Torso & Shoulders: height ~0.70m (1.40 units), width ~0.45m (0.90 units) */}
      <mesh position={[0, 2.22, 0]} material={silhouetteMaterial}>
        <cylinderGeometry args={[0.38, 0.32, 1.40, 16]} />
      </mesh>

      {/* Legs: height ~0.85m (1.70 units), base touches floor at Y = 0 */}
      <mesh position={[-0.18, 0.85, 0]} material={silhouetteMaterial}>
        <cylinderGeometry args={[0.13, 0.10, 1.70, 12]} />
      </mesh>
      <mesh position={[0.18, 0.85, 0]} material={silhouetteMaterial}>
        <cylinderGeometry args={[0.13, 0.10, 1.70, 12]} />
      </mesh>

      {/* Scale Callout Marker */}
      <Html position={[0, 3.75, 0]} center distanceFactor={15}>
        <div className="flex flex-col items-center pointer-events-none select-none">
          <span className="px-2 py-0.5 rounded bg-sky-950/90 text-sky-300 border border-sky-400 text-[10px] font-mono font-bold whitespace-nowrap shadow-lg">
            1.75 m (3.50 scene units · scale 1m = 2u)
          </span>
          <div className="w-0.5 h-3 bg-sky-400" />
        </div>
      </Html>
    </group>
  );
}
