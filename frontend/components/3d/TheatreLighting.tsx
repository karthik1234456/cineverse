'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import { getActiveLook } from '@/lib/theatreLooks';
import { getTheatreTypeDefinition } from '@/lib/theatreTypeRegistry';

export function TheatreLighting() {
  const houseLights = useCinemaStore((s) => s.houseLights);
  const lightLevel = useCinemaStore((s) => s.lightLevel || 'normal');
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
  const frontZ = -7.0;
  const rearZ = zBack + 4.0;
  const hasBalcony = Boolean(theatreDef.features?.has_balcony);

  const look = useMemo(() => getActiveLook(theatreLook), [theatreLook]);

  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const screenSpillRef = useRef<THREE.SpotLight>(null);
  const seatRimLightRef = useRef<THREE.DirectionalLight>(null);

  // Ceiling downlight grid (Front, Mid, Rear x Left, Right)
  const ceilingFrontLRef = useRef<THREE.PointLight>(null);
  const ceilingFrontRRef = useRef<THREE.PointLight>(null);
  const ceilingMidLRef = useRef<THREE.PointLight>(null);
  const ceilingMidRRef = useRef<THREE.PointLight>(null);
  const ceilingRearLRef = useRef<THREE.PointLight>(null);
  const ceilingRearRRef = useRef<THREE.PointLight>(null);
  const aisleCenterRef = useRef<THREE.PointLight>(null);
  const underBalconyRef = useRef<THREE.PointLight>(null);

  // Wall washers & accent guides
  const wallWasherLeftRef = useRef<THREE.PointLight>(null);
  const wallWasherRightRef = useRef<THREE.PointLight>(null);
  const rearFillRef = useRef<THREE.PointLight>(null);
  const stepLightLRef = useRef<THREE.PointLight>(null);
  const stepLightRRef = useRef<THREE.PointLight>(null);

  // Smooth animated transition between lighting modes (Lights Up vs Show)
  useFrame(({ invalidate }, delta) => {
    const isShow = houseLights === 'show';
    const isDim = houseLights === 'dim';

    // Calibrated level multipliers: Dim = 0.75, Normal = 1.0, Bright = 1.25
    const levelFactor = lightLevel === 'bright' ? 1.25 : lightLevel === 'dim' ? 0.75 : 1.0;
    const intensityMultiplier = (lightIntensity === 'brighter' ? 1.15 : 1.0) * levelFactor;

    // Measured target: Lights on mean luminance 0.22 to 0.35 across all halls
    // Show mode target: 0.04 to 0.09 with glowing screen
    const targetAmbient = isShow ? 0.05 : isDim ? 0.65 : 1.25 * intensityMultiplier;
    const targetHemi = isShow ? 0.06 : isDim ? 0.75 : 1.45 * intensityMultiplier;
    const targetScreenSpill = isShow ? 3.20 : isDim ? 1.40 : 0.40;
    const targetSeatRim = isShow ? 0.02 : isDim ? 0.35 : 0.70 * intensityMultiplier;
    const targetCeiling = isShow ? 0.02 : isDim ? 0.85 : 2.20 * intensityMultiplier;
    const targetWallWash = isShow ? 0.03 : isDim ? 0.70 : 1.80 * intensityMultiplier;
    const targetRearFill = isShow ? 0.03 : isDim ? 0.65 : 1.50 * intensityMultiplier;
    const targetStepLight = isShow ? 0.35 : isDim ? 1.40 : 2.60 * intensityMultiplier;

    const curAmbient = ambientRef.current?.intensity ?? targetAmbient;
    const needsTransition = Math.abs(curAmbient - targetAmbient) > 0.005;

    if (!needsTransition) return;

    invalidate();
    const lerpSpeed = Math.min(delta * 4, 1);

    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, targetAmbient, lerpSpeed);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = THREE.MathUtils.lerp(hemiRef.current.intensity, targetHemi, lerpSpeed);
    }
    if (screenSpillRef.current) {
      screenSpillRef.current.intensity = THREE.MathUtils.lerp(screenSpillRef.current.intensity, targetScreenSpill, lerpSpeed);
    }
    if (seatRimLightRef.current) {
      seatRimLightRef.current.intensity = THREE.MathUtils.lerp(seatRimLightRef.current.intensity, targetSeatRim, lerpSpeed);
    }
    if (ceilingFrontLRef.current) {
      ceilingFrontLRef.current.intensity = THREE.MathUtils.lerp(ceilingFrontLRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (ceilingFrontRRef.current) {
      ceilingFrontRRef.current.intensity = THREE.MathUtils.lerp(ceilingFrontRRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (ceilingMidLRef.current) {
      ceilingMidLRef.current.intensity = THREE.MathUtils.lerp(ceilingMidLRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (ceilingMidRRef.current) {
      ceilingMidRRef.current.intensity = THREE.MathUtils.lerp(ceilingMidRRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (ceilingRearLRef.current) {
      ceilingRearLRef.current.intensity = THREE.MathUtils.lerp(ceilingRearLRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (ceilingRearRRef.current) {
      ceilingRearRRef.current.intensity = THREE.MathUtils.lerp(ceilingRearRRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (aisleCenterRef.current) {
      aisleCenterRef.current.intensity = THREE.MathUtils.lerp(aisleCenterRef.current.intensity, targetCeiling * 0.85, lerpSpeed);
    }
    if (underBalconyRef.current) {
      underBalconyRef.current.intensity = THREE.MathUtils.lerp(underBalconyRef.current.intensity, targetCeiling * 0.90, lerpSpeed);
    }
    if (wallWasherLeftRef.current) {
      wallWasherLeftRef.current.intensity = THREE.MathUtils.lerp(wallWasherLeftRef.current.intensity, targetWallWash, lerpSpeed);
    }
    if (wallWasherRightRef.current) {
      wallWasherRightRef.current.intensity = THREE.MathUtils.lerp(wallWasherRightRef.current.intensity, targetWallWash, lerpSpeed);
    }
    if (rearFillRef.current) {
      rearFillRef.current.intensity = THREE.MathUtils.lerp(rearFillRef.current.intensity, targetRearFill, lerpSpeed);
    }
    if (stepLightLRef.current) {
      stepLightLRef.current.intensity = THREE.MathUtils.lerp(stepLightLRef.current.intensity, targetStepLight, lerpSpeed);
    }
    if (stepLightRRef.current) {
      stepLightRRef.current.intensity = THREE.MathUtils.lerp(stepLightRRef.current.intensity, targetStepLight, lerpSpeed);
    }
  });

  return (
    <group name="TheatreLightingRig">
      {/* 1. Atmospheric Ambient Fill (warm white 2800K) */}
      <ambientLight ref={ambientRef} color="#fff6ec" intensity={houseLights === 'show' ? 0.05 : 1.25} />

      {/* 2. Hemisphere Ambient: warm ceiling bounce, soft espresso carpet bounce */}
      <hemisphereLight
        ref={hemiRef}
        color="#fff1e0"
        groundColor="#221c1a"
        intensity={houseLights === 'show' ? 0.06 : 1.45}
      />

      {/* 3. Dedicated Seat Tops & Shoulders Rim Light */}
      {/* Positioned at proscenium header, angled downward across audience to give seats clear contrast against floor */}
      <directionalLight
        ref={seatRimLightRef}
        position={[0, topY * 0.75, -2.0]}
        target-position={[0, 2.0, midZ]}
        color="#fff5eb"
        intensity={houseLights === 'show' ? 0.02 : 0.44}
        castShadow={false}
      />

      {/* 4. Screen Spill Spotlight (projecting onto room during show mode) */}
      <spotLight
        ref={screenSpillRef}
        position={[0, 5.5, -1.0]}
        target-position={[0, 2.0, -14.0]}
        color="#8ab4f8"
        intensity={houseLights === 'show' ? 3.20 : 0.40}
        angle={Math.PI / 2.3}
        penumbra={0.85}
        distance={50}
        decay={1.3}
      />

      {/* 5. Real Downlight Grid Light Sources (Front, Mid, Rear) */}
      {/* Front Section Downlights */}
      <pointLight
        ref={ceilingFrontLRef}
        position={[-halfWidth * 0.45, topY - 1.2, frontZ]}
        color="#fff1e0"
        intensity={1.35}
        distance={24}
        decay={1.2}
      />
      <pointLight
        ref={ceilingFrontRRef}
        position={[halfWidth * 0.45, topY - 1.2, frontZ]}
        color="#fff1e0"
        intensity={1.35}
        distance={24}
        decay={1.2}
      />

      {/* Mid Section Downlights */}
      <pointLight
        ref={ceilingMidLRef}
        position={[-halfWidth * 0.45, topY - 1.2, ceilingZ]}
        color="#fff1e0"
        intensity={1.40}
        distance={26}
        decay={1.2}
        castShadow={qualityMode === 'beautiful'}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <pointLight
        ref={ceilingMidRRef}
        position={[halfWidth * 0.45, topY - 1.2, ceilingZ]}
        color="#fff1e0"
        intensity={1.40}
        distance={26}
        decay={1.2}
        castShadow={qualityMode === 'beautiful'}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />

      {/* Rear Section Downlights */}
      <pointLight
        ref={ceilingRearLRef}
        position={[-halfWidth * 0.45, topY - 1.2, rearZ]}
        color="#fff1e0"
        intensity={1.35}
        distance={24}
        decay={1.2}
      />
      <pointLight
        ref={ceilingRearRRef}
        position={[halfWidth * 0.45, topY - 1.2, rearZ]}
        color="#fff1e0"
        intensity={1.35}
        distance={24}
        decay={1.2}
      />

      {/* Central Aisle Pool of Light */}
      <pointLight
        ref={aisleCenterRef}
        position={[0, topY - 1.4, midZ]}
        color="#fff4e6"
        intensity={1.20}
        distance={22}
        decay={1.2}
      />

      {/* Under-Balcony Fill (active in balcony halls to prevent deep shadows under stalls) */}
      {hasBalcony && (
        <pointLight
          ref={underBalconyRef}
          position={[0, 4.5, zBack + 6.0]}
          color="#ffeedb"
          intensity={1.30}
          distance={18}
          decay={1.2}
        />
      )}

      {/* 6. Rear Audience & Projection Booth Fill */}
      <pointLight
        ref={rearFillRef}
        position={[0, topY - 2.0, zBack + 2.0]}
        color="#fef3c7"
        intensity={houseLights === 'show' ? 0.03 : 0.95}
        distance={20}
        decay={1.2}
      />

      {/* 7. Soft Architectural Wall Washers */}
      <pointLight
        ref={wallWasherLeftRef}
        position={[-halfWidth + 1.2, 5.0, midZ]}
        color={theatreDef.palette?.coveColor || look.sconceGlowColor}
        intensity={houseLights === 'show' ? 0.03 : 1.20}
        distance={20}
        decay={1.2}
      />
      <pointLight
        ref={wallWasherRightRef}
        position={[halfWidth - 1.2, 5.0, midZ]}
        color={theatreDef.palette?.coveColor || look.sconceGlowColor}
        intensity={houseLights === 'show' ? 0.03 : 1.20}
        distance={20}
        decay={1.2}
      />

      {/* 8. Floor Step & Aisle Path Lights (Amber #FF9E2C) */}
      <pointLight
        ref={stepLightLRef}
        position={[-4.2, 0.45, -9.0]}
        color={theatreDef.palette?.skirtingColor || look.stepLightColor}
        intensity={houseLights === 'show' ? 0.35 : 2.10}
        distance={16}
        decay={1.2}
      />
      <pointLight
        ref={stepLightRRef}
        position={[4.2, 0.45, -9.0]}
        color={theatreDef.palette?.skirtingColor || look.stepLightColor}
        intensity={houseLights === 'show' ? 0.35 : 2.10}
        distance={16}
        decay={1.2}
      />
    </group>
  );
}
