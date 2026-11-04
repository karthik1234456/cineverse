'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';

export function TheatreLighting() {
  const houseLights = useCinemaStore((s) => s.houseLights);
  const qualityTier = useCinemaStore((s) => s.qualityTier);

  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const screenSpillRef = useRef<THREE.SpotLight>(null);
  const ceilingL1Ref = useRef<THREE.PointLight>(null);
  const ceilingR1Ref = useRef<THREE.PointLight>(null);

  // Smooth animated transition between lighting modes
  useFrame((_, delta) => {
    const isShow = houseLights === 'show';
    const isDim = houseLights === 'dim';

    // Target intensities
    const targetAmbient = isShow ? 0.10 : isDim ? 0.28 : 0.55;
    const targetHemi = isShow ? 0.25 : isDim ? 0.45 : 0.75;
    const targetScreenSpill = isShow ? 2.4 : isDim ? 1.5 : 0.7;
    const targetCeiling = isShow ? 0.05 : isDim ? 0.25 : 0.85;

    const lerpSpeed = Math.min(delta * 4, 1);

    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(
        ambientRef.current.intensity,
        targetAmbient,
        lerpSpeed
      );
    }

    if (hemiRef.current) {
      hemiRef.current.intensity = THREE.MathUtils.lerp(
        hemiRef.current.intensity,
        targetHemi,
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
      <ambientLight ref={ambientRef} color="#f0f4ff" intensity={0.55} />

      {/* Natural hemisphere ambient fill: cool sky (ceiling), warm floor bounce */}
      <hemisphereLight
        ref={hemiRef}
        color="#38455e"
        groundColor="#181a20"
        intensity={0.75}
      />

      {/* Screen illumination spill projecting back onto audience */}
      <spotLight
        ref={screenSpillRef}
        position={[0, 5.55, -1.0]}
        target-position={[0, 2.0, -14.0]}
        color="#8ab4f8"
        intensity={0.7}
        angle={Math.PI / 2.5}
        penumbra={0.85}
        distance={30}
        decay={1.6}
      />

      {/* Warm downlights over audience rows (shadow-casting limited to <= 2) */}
      <pointLight
        ref={ceilingL1Ref}
        position={[-4.5, 9.8, -12.0]}
        color="#ffe8cc"
        intensity={0.85}
        distance={22}
        decay={2}
        castShadow={qualityTier === 'high'}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <pointLight
        ref={ceilingR1Ref}
        position={[4.5, 9.8, -12.0]}
        color="#ffe8cc"
        intensity={0.85}
        distance={22}
        decay={2}
        castShadow={qualityTier === 'high'}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />

      {/* Rear fill to prevent dark clipping at back rows */}
      <pointLight
        position={[0, 8.5, -24.0]}
        color="#e2e8f0"
        intensity={houseLights === 'show' ? 0.08 : 0.40}
        distance={18}
        decay={2}
      />

      {/* Warm wall sconces and aisle lights on mid/high quality */}
      {qualityTier !== 'low' && (
        <>
          {/* Left wall sconces */}
          <pointLight
            position={[-10.2, 4.2, -11.0]}
            color="#fde68a"
            intensity={houseLights === 'show' ? 0.12 : 0.50}
            distance={8}
            decay={2}
          />
          <pointLight
            position={[-10.2, 5.5, -18.0]}
            color="#fde68a"
            intensity={houseLights === 'show' ? 0.12 : 0.50}
            distance={8}
            decay={2}
          />
          {/* Right wall sconces */}
          <pointLight
            position={[10.2, 4.2, -11.0]}
            color="#fde68a"
            intensity={houseLights === 'show' ? 0.12 : 0.50}
            distance={8}
            decay={2}
          />
          <pointLight
            position={[10.2, 5.5, -18.0]}
            color="#fde68a"
            intensity={houseLights === 'show' ? 0.12 : 0.50}
            distance={8}
            decay={2}
          />

          {/* Floor aisle path guides */}
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
