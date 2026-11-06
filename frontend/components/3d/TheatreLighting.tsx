'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import { getActiveLook } from '@/lib/theatreLooks';

export function TheatreLighting() {
  const houseLights = useCinemaStore((s) => s.houseLights);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const theatreLook = useCinemaStore((s) => s.theatreLook);

  const look = useMemo(() => getActiveLook(theatreLook), [theatreLook]);

  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const screenSpillRef = useRef<THREE.SpotLight>(null);
  const ceilingL1Ref = useRef<THREE.PointLight>(null);
  const ceilingR1Ref = useRef<THREE.PointLight>(null);
  const wallWasherLeftRef = useRef<THREE.PointLight>(null);
  const wallWasherRightRef = useRef<THREE.PointLight>(null);

  // Smooth animated transition between lighting modes (Lights Up vs Show)
  useFrame(({ invalidate }, delta) => {
    const isShow = houseLights === 'show';
    const isDim = houseLights === 'dim';

    // Target intensities tuned to eliminate black void (Finding F4 fixed)
    const targetAmbient = isShow ? 0.18 : isDim ? 0.38 : 0.70;
    const targetHemi = isShow ? 0.32 : isDim ? 0.55 : 0.90;
    const targetScreenSpill = isShow ? 2.6 : isDim ? 1.6 : 0.8;
    const targetCeiling = isShow ? 0.08 : isDim ? 0.35 : 1.10;
    const targetWallWash = isShow ? 0.14 : isDim ? 0.40 : 0.85;

    const curAmbient = ambientRef.current?.intensity ?? targetAmbient;
    const needsTransition = Math.abs(curAmbient - targetAmbient) > 0.005;

    if (!needsTransition) return; // Settled, let demand loop rest!

    invalidate(); // Drive frames during active lighting transition
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

    if (wallWasherLeftRef.current) {
      wallWasherLeftRef.current.intensity = THREE.MathUtils.lerp(
        wallWasherLeftRef.current.intensity,
        targetWallWash,
        lerpSpeed
      );
    }

    if (wallWasherRightRef.current) {
      wallWasherRightRef.current.intensity = THREE.MathUtils.lerp(
        wallWasherRightRef.current.intensity,
        targetWallWash,
        lerpSpeed
      );
    }
  });

  return (
    <group name="TheatreLightingRig">
      {/* Soft atmospheric ambient fill */}
      <ambientLight ref={ambientRef} color="#fff6ed" intensity={0.70} />

      {/* Natural hemisphere ambient fill: warm ceiling bounce, rich floor reflection */}
      <hemisphereLight
        ref={hemiRef}
        color="#ffedd5"
        groundColor={look.floorColor}
        intensity={0.90}
      />

      {/* Screen illumination spill projecting back onto audience */}
      <spotLight
        ref={screenSpillRef}
        position={[0, 5.55, -1.0]}
        target-position={[0, 2.0, -14.0]}
        color="#8ab4f8"
        intensity={0.8}
        angle={Math.PI / 2.4}
        penumbra={0.85}
        distance={32}
        decay={1.6}
      />

      {/* Warm downlights over audience rows (2800K warm house lighting) */}
      <pointLight
        ref={ceilingL1Ref}
        position={[-4.5, 9.8, -12.0]}
        color="#ffecd1"
        intensity={1.10}
        distance={24}
        decay={1.8}
        castShadow={qualityMode === 'beautiful'}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <pointLight
        ref={ceilingR1Ref}
        position={[4.5, 9.8, -12.0]}
        color="#ffecd1"
        intensity={1.10}
        distance={24}
        decay={1.8}
        castShadow={qualityMode === 'beautiful'}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />

      {/* Rear audience fill to ensure back rows (H, I, J) are clearly lit */}
      <pointLight
        position={[0, 8.5, -23.0]}
        color="#fef3c7"
        intensity={houseLights === 'show' ? 0.12 : 0.60}
        distance={20}
        decay={1.8}
      />

      {/* Architectural Wall Washers creating rich side gradients */}
      <pointLight
        ref={wallWasherLeftRef}
        position={[-9.8, 5.0, -13.0]}
        color={look.sconceGlowColor}
        intensity={0.85}
        distance={14}
        decay={1.8}
      />
      <pointLight
        ref={wallWasherRightRef}
        position={[9.8, 5.0, -13.0]}
        color={look.sconceGlowColor}
        intensity={0.85}
        distance={14}
        decay={1.8}
      />

      {/* Floor aisle step path guides matching active aesthetic look */}
      <pointLight
        position={[-4.2, 0.4, -9.0]}
        color={look.stepLightColor}
        intensity={0.45}
        distance={8}
      />
      <pointLight
        position={[4.2, 0.4, -9.0]}
        color={look.stepLightColor}
        intensity={0.45}
        distance={8}
      />
    </group>
  );
}
