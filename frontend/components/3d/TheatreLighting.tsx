'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';

export function TheatreLighting() {
  const houseLights = useCinemaStore((s) => s.houseLights);
  const qualityTier = useCinemaStore((s) => s.qualityTier);

  const ambientRef = useRef<THREE.AmbientLight>(null);
  const screenSpillRef = useRef<THREE.SpotLight>(null);
  const ceilingL1Ref = useRef<THREE.PointLight>(null);
  const ceilingR1Ref = useRef<THREE.PointLight>(null);

  // Smooth animated transition between lighting modes
  useFrame((_, delta) => {
    const isShow = houseLights === 'show';
    const isDim = houseLights === 'dim';

    // Target intensities
    const targetAmbient = isShow ? 0.12 : isDim ? 0.35 : 0.65;
    const targetScreenSpill = isShow ? 2.8 : isDim ? 1.6 : 0.8;
    const targetCeiling = isShow ? 0.05 : isDim ? 0.3 : 0.9;

    const lerpSpeed = Math.min(delta * 4, 1);

    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(
        ambientRef.current.intensity,
        targetAmbient,
        lerpSpeed
      );
    }

    if (screenSpillRef.current) {
      screenSpillRef.current.intensity = THREE.MathUtils.lerp(
        screenSpillRef.current.intensity,
        targetScreenSpill,
        lerpSpeed
      );
    }

    if (ceilingL1Ref.current) {
      ceilingL1Ref.current.intensity = THREE.MathUtils.lerp(
        ceilingL1Ref.current.intensity,
        targetCeiling,
        lerpSpeed
      );
    }

    if (ceilingR1Ref.current) {
      ceilingR1Ref.current.intensity = THREE.MathUtils.lerp(
        ceilingR1Ref.current.intensity,
        targetCeiling,
        lerpSpeed
      );
    }
  });

  return (
    <group name="TheatreLightingRig">
      {/* Soft atmospheric ambient light */}
      <ambientLight ref={ambientRef} color="#f0f4ff" intensity={0.65} />

      {/* Screen illumination spill projecting back onto audience */}
      <spotLight
        ref={screenSpillRef}
        position={[0, 5.55, -1.0]}
        target-position={[0, 2.0, -14.0]}
        color="#8ab4f8"
        intensity={0.8}
        angle={Math.PI / 2.5}
        penumbra={0.85}
        distance={30}
        decay={1.6}
      />

      {/* Warm downlights over audience rows */}
      <pointLight
        ref={ceilingL1Ref}
        position={[-4.5, 9.8, -12.0]}
        color="#ffe8cc"
        intensity={0.9}
        distance={22}
        decay={2}
      />
      <pointLight
        ref={ceilingR1Ref}
        position={[4.5, 9.8, -12.0]}
        color="#ffe8cc"
        intensity={0.9}
        distance={22}
        decay={2}
      />

      {/* Rear fill to prevent dark clipping at back rows */}
      <pointLight
        position={[0, 8.5, -24.0]}
        color="#e2e8f0"
        intensity={houseLights === 'show' ? 0.08 : 0.45}
        distance={18}
        decay={2}
      />

      {/* Subtle floor aisle blue/amber path guides */}
      {qualityTier !== 'low' && (
        <>
          <pointLight
            position={[-4.2, 0.4, -9.0]}
            color="#38bdf8"
            intensity={0.35}
            distance={6}
          />
          <pointLight
            position={[4.2, 0.4, -9.0]}
            color="#38bdf8"
            intensity={0.35}
            distance={6}
          />
        </>
      )}
    </group>
  );
}
