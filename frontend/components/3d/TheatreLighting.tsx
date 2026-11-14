'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import { getActiveLook } from '@/lib/theatreLooks';
import { getTheatreTypeDefinition } from '@/lib/theatreTypeRegistry';

export function TheatreLighting() {
  const houseLights = useCinemaStore((s) => s.houseLights);
  const lightIntensity = useCinemaStore((s) => s.lightIntensity);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const theatreLook = useCinemaStore((s) => s.theatreLook);
  const auditoriumLayout = useCinemaStore((s) => s.auditoriumLayout);
  const dimensions = useCinemaStore((s) => s.proceduralResult?.geometry.dimensions);

  const theatreDef = useMemo(
    () => getTheatreTypeDefinition(auditoriumLayout?.theatre_type || ''),
    [auditoriumLayout?.theatre_type]
  );

  const halfWidth = dimensions ? dimensions.halfWidth : 11.11;
  const zBack = dimensions ? dimensions.zBack : -26.0;
  const topY = dimensions ? dimensions.height : 11.2;
  const midZ = (zBack - 8.0) / 2;
  const ceilingZ = (zBack - 8.0) / 2;

  const look = useMemo(() => getActiveLook(theatreLook), [theatreLook]);

  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const screenSpillRef = useRef<THREE.SpotLight>(null);
  const ceilingL1Ref = useRef<THREE.PointLight>(null);
  const ceilingR1Ref = useRef<THREE.PointLight>(null);
  const wallWasherLeftRef = useRef<THREE.PointLight>(null);
  const wallWasherRightRef = useRef<THREE.PointLight>(null);
  const rearFillRef = useRef<THREE.PointLight>(null);
  const stepLightLRef = useRef<THREE.PointLight>(null);
  const stepLightRRef = useRef<THREE.PointLight>(null);

  // Smooth animated transition between lighting modes (Lights Up vs Show)
  useFrame(({ invalidate }, delta) => {
    const isShow = houseLights === 'show';
    const isDim = houseLights === 'dim';
    const isBrighter = lightIntensity === 'brighter';

    // Calibrated per-type Lights On targets:
    // standard: 0.35 - 0.50
    // balcony: 0.30 - 0.45
    // luxury_recliner: 0.22 - 0.35 (dark lounge with amber accents)
    // motion_seat: 0.18 - 0.30 (dark room with LED bars & base strips)
    const tid = theatreDef.id;
    const isMotionHall = tid === 'motion_seat' || tid === 'dolby_atmos_4dx';
    const isLuxuryRecliner = tid === 'luxury_recliner';
    const isBalcony = tid === 'balcony';

    const typeFactor = isMotionHall ? 0.75 : isLuxuryRecliner ? 0.85 : isBalcony ? 0.95 : 1.0;
    const intensityMultiplier = isBrighter ? 1.20 : 1.0;

    const targetAmbient = isShow ? 0.10 : isDim ? 0.30 : 0.65 * typeFactor * intensityMultiplier;
    const targetHemi = isShow ? 0.14 : isDim ? 0.35 : 0.75 * typeFactor * intensityMultiplier;
    const targetScreenSpill = isShow ? 2.80 : isDim ? 1.40 : 0.40;
    const targetCeiling = isShow ? 0.02 : isDim ? 0.50 : 1.80 * typeFactor * intensityMultiplier;
    const targetWallWash = isShow ? 0.04 : isDim ? 0.40 : 1.40 * typeFactor * intensityMultiplier;
    const targetRearFill = isShow ? 0.05 : isDim ? 0.35 : 1.20 * typeFactor * intensityMultiplier;
    const targetStepLight = isShow ? 0.40 : isDim ? 1.00 : 2.20 * (isMotionHall || isLuxuryRecliner ? 0.90 : 1.0) * intensityMultiplier;

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

    if (rearFillRef.current) {
      rearFillRef.current.intensity = THREE.MathUtils.lerp(
        rearFillRef.current.intensity,
        targetRearFill,
        lerpSpeed
      );
    }

    if (stepLightLRef.current) {
      stepLightLRef.current.intensity = THREE.MathUtils.lerp(
        stepLightLRef.current.intensity,
        targetStepLight,
        lerpSpeed
      );
    }

    if (stepLightRRef.current) {
      stepLightRRef.current.intensity = THREE.MathUtils.lerp(
        stepLightRRef.current.intensity,
        targetStepLight,
        lerpSpeed
      );
    }
  });

  return (
    <group name="TheatreLightingRig">
      {/* Soft atmospheric ambient fill */}
      <ambientLight ref={ambientRef} color="#fff8ee" intensity={lightIntensity === 'brighter' ? 0.34 : 0.28} />

      {/* Natural hemisphere ambient fill: warm ceiling bounce, rich floor reflection */}
      <hemisphereLight
        ref={hemiRef}
        color="#ffedd5"
        groundColor={theatreDef.palette?.carpetColor || look.floorColor}
        intensity={lightIntensity === 'brighter' ? 0.42 : 0.35}
      />

      {/* Overhead warm house key wash across tiers */}
      <directionalLight
        position={[0, topY + 8.0, midZ]}
        color="#fff6ed"
        intensity={houseLights === 'show' ? 0.01 : lightIntensity === 'brighter' ? 0.30 : 0.22}
        castShadow={false}
      />

      {/* Screen illumination spill projecting back onto audience */}
      <spotLight
        ref={screenSpillRef}
        position={[0, 5.55, -1.0]}
        target-position={[0, 2.0, -14.0]}
        color="#8ab4f8"
        intensity={houseLights === 'show' ? 2.50 : 0.35}
        angle={Math.PI / 2.4}
        penumbra={0.85}
        distance={45}
        decay={1.4}
      />

      {/* Warm downlights over audience rows (2800K warm house lighting) - at most two shadow-casting lights */}
      <pointLight
        ref={ceilingL1Ref}
        position={[-halfWidth * 0.42, topY - 1.4, ceilingZ]}
        color="#ffecd1"
        intensity={lightIntensity === 'brighter' ? 1.15 : 0.95}
        distance={0}
        decay={1.2}
        castShadow={qualityMode === 'beautiful'}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <pointLight
        ref={ceilingR1Ref}
        position={[halfWidth * 0.42, topY - 1.4, ceilingZ]}
        color="#ffecd1"
        intensity={lightIntensity === 'brighter' ? 1.15 : 0.95}
        distance={0}
        decay={1.2}
        castShadow={qualityMode === 'beautiful'}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />

      {/* Rear audience fill to ensure back rows and projection booth are clearly lit */}
      <pointLight
        ref={rearFillRef}
        position={[0, topY - 2.5, zBack + 3.0]}
        color="#fef3c7"
        intensity={houseLights === 'show' ? 0.03 : lightIntensity === 'brighter' ? 0.70 : 0.55}
        distance={0}
        decay={1.2}
      />

      {/* Architectural Wall Washers creating rich side gradients */}
      <pointLight
        ref={wallWasherLeftRef}
        position={[-halfWidth + 1.2, 5.0, midZ]}
        color={theatreDef.palette?.coveColor || look.sconceGlowColor}
        intensity={houseLights === 'show' ? 0.02 : lightIntensity === 'brighter' ? 0.90 : 0.75}
        distance={0}
        decay={1.2}
      />
      <pointLight
        ref={wallWasherRightRef}
        position={[halfWidth - 1.2, 5.0, midZ]}
        color={theatreDef.palette?.coveColor || look.sconceGlowColor}
        intensity={houseLights === 'show' ? 0.02 : lightIntensity === 'brighter' ? 0.90 : 0.75}
        distance={0}
        decay={1.2}
      />

      {/* Floor aisle step path guides matching active aesthetic look */}
      <pointLight
        ref={stepLightLRef}
        position={[-4.2, 0.4, -9.0]}
        color={theatreDef.palette?.skirtingColor || look.stepLightColor}
        intensity={houseLights === 'show' ? 0.35 : lightIntensity === 'brighter' ? 2.30 : 1.90}
        distance={15}
        decay={1.2}
      />
      <pointLight
        ref={stepLightRRef}
        position={[4.2, 0.4, -9.0]}
        color={theatreDef.palette?.skirtingColor || look.stepLightColor}
        intensity={houseLights === 'show' ? 0.35 : lightIntensity === 'brighter' ? 2.30 : 1.90}
        distance={15}
        decay={1.2}
      />
    </group>
  );
}
