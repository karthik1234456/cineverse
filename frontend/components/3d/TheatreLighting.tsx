'use client';

import React, { useRef, useMemo, useEffect } from 'react';
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
  const topTierY = dimensions ? dimensions.topTierY : 4.0;
  const hasBalcony = Boolean(theatreDef.features?.has_balcony);

  // Dynamic scale-adaptive Z stations covering entire room depth from front to rear
  const seatZStart = Math.min(-6.0, zBack * 0.28);
  const seatZEnd = zBack + 2.5;
  const zFrontStation = seatZStart * 0.45;
  const zMidFrontStation = seatZStart + (seatZEnd - seatZStart) * 0.30;
  const zMidRearStation = seatZStart + (seatZEnd - seatZStart) * 0.65;
  const zRearStation = seatZStart + (seatZEnd - seatZStart) * 0.92;

  // Scale-adaptive light range ensuring ceiling lights reach audience tiers & floor
  const lightRange = Math.max(45, topY * 2.2 + halfWidth * 1.5);

  const look = useMemo(() => getActiveLook(theatreLook), [theatreLook]);

  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const screenSpillRef = useRef<THREE.SpotLight>(null);
  const seatRimLightRef = useRef<THREE.DirectionalLight>(null);
  const targetObjRef = useRef<THREE.Object3D>(null);

  // Ceiling downlight grid (Front, Mid-Front, Mid-Rear, Rear x Left, Right)
  const ceilingFrontLRef = useRef<THREE.PointLight>(null);
  const ceilingFrontRRef = useRef<THREE.PointLight>(null);
  const ceilingMidFrontLRef = useRef<THREE.PointLight>(null);
  const ceilingMidFrontRRef = useRef<THREE.PointLight>(null);
  const ceilingMidRearLRef = useRef<THREE.PointLight>(null);
  const ceilingMidRearRRef = useRef<THREE.PointLight>(null);
  const ceilingRearLRef = useRef<THREE.PointLight>(null);
  const ceilingRearRRef = useRef<THREE.PointLight>(null);

  // Aisle illumination pools
  const aisleCenterFrontRef = useRef<THREE.PointLight>(null);
  const aisleCenterMidRef = useRef<THREE.PointLight>(null);
  const aisleCenterRearRef = useRef<THREE.PointLight>(null);
  const underBalconyRef = useRef<THREE.PointLight>(null);

  // Wall washers & accent guides
  const wallWasherLeftRef = useRef<THREE.PointLight>(null);
  const wallWasherRightRef = useRef<THREE.PointLight>(null);
  const rearFillRef = useRef<THREE.PointLight>(null);
  const prosceniumWashRef = useRef<THREE.PointLight>(null);
  const prosceniumCoveLRef = useRef<THREE.PointLight>(null);
  const prosceniumCoveRRef = useRef<THREE.PointLight>(null);
  const stepLightLRef = useRef<THREE.PointLight>(null);
  const stepLightRRef = useRef<THREE.PointLight>(null);

  // Connect directional rim light target
  useEffect(() => {
    if (seatRimLightRef.current && targetObjRef.current) {
      seatRimLightRef.current.target = targetObjRef.current;
    }
  }, []);

  // Smooth animated transition between lighting modes (Lights Up vs Show, Dim, Normal, Bright)
  useFrame(({ invalidate }, delta) => {
    const isShow = houseLights === 'show';
    const isDim = houseLights === 'dim';

    // Calibrated level multipliers: Dim = 0.75, Normal = 1.0, Bright = 1.25 (+25%)
    const levelFactor = lightLevel === 'bright' ? 1.25 : lightLevel === 'dim' ? 0.75 : 1.0;
    const intensityMultiplier = (lightIntensity === 'brighter' ? 1.15 : 1.0) * levelFactor;

    // Measured targets:
    // Lights on Normal mean luminance: 0.22 to 0.35, >=60% pixels > 0.08, <=8% pixels < 0.02
    // Bright level: +25% luminance (~0.27 to 0.44)
    // Show mode target: 0.04 to 0.09 with glowing screen
    const targetAmbient = isShow ? 0.05 : isDim ? 1.60 : 3.20 * intensityMultiplier;
    const targetHemi = isShow ? 0.06 : isDim ? 1.80 : 3.60 * intensityMultiplier;
    const targetScreenSpill = isShow ? 3.50 : isDim ? 1.40 : 0.40;
    const targetSeatRim = isShow ? 0.02 : isDim ? 0.65 : 1.35 * intensityMultiplier;
    const targetCeiling = isShow ? 0.02 : isDim ? 2.20 : 4.60 * intensityMultiplier;
    const targetProscenium = isShow ? 0.02 : isDim ? 1.80 : 3.80 * intensityMultiplier;
    const targetWallWash = isShow ? 0.03 : isDim ? 1.60 : 3.40 * intensityMultiplier;
    const targetRearFill = isShow ? 0.03 : isDim ? 1.40 : 2.80 * intensityMultiplier;
    const targetStepLight = isShow ? 0.35 : isDim ? 1.80 : 3.20 * intensityMultiplier;

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
    if (prosceniumWashRef.current) {
      prosceniumWashRef.current.intensity = THREE.MathUtils.lerp(prosceniumWashRef.current.intensity, targetProscenium, lerpSpeed);
    }
    if (prosceniumCoveLRef.current) {
      prosceniumCoveLRef.current.intensity = THREE.MathUtils.lerp(prosceniumCoveLRef.current.intensity, targetProscenium * 0.9, lerpSpeed);
    }
    if (prosceniumCoveRRef.current) {
      prosceniumCoveRRef.current.intensity = THREE.MathUtils.lerp(prosceniumCoveRRef.current.intensity, targetProscenium * 0.9, lerpSpeed);
    }
    if (ceilingFrontLRef.current) {
      ceilingFrontLRef.current.intensity = THREE.MathUtils.lerp(ceilingFrontLRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (ceilingFrontRRef.current) {
      ceilingFrontRRef.current.intensity = THREE.MathUtils.lerp(ceilingFrontRRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (ceilingMidFrontLRef.current) {
      ceilingMidFrontLRef.current.intensity = THREE.MathUtils.lerp(ceilingMidFrontLRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (ceilingMidFrontRRef.current) {
      ceilingMidFrontRRef.current.intensity = THREE.MathUtils.lerp(ceilingMidFrontRRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (ceilingMidRearLRef.current) {
      ceilingMidRearLRef.current.intensity = THREE.MathUtils.lerp(ceilingMidRearLRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (ceilingMidRearRRef.current) {
      ceilingMidRearRRef.current.intensity = THREE.MathUtils.lerp(ceilingMidRearRRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (ceilingRearLRef.current) {
      ceilingRearLRef.current.intensity = THREE.MathUtils.lerp(ceilingRearLRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (ceilingRearRRef.current) {
      ceilingRearRRef.current.intensity = THREE.MathUtils.lerp(ceilingRearRRef.current.intensity, targetCeiling, lerpSpeed);
    }
    if (aisleCenterFrontRef.current) {
      aisleCenterFrontRef.current.intensity = THREE.MathUtils.lerp(aisleCenterFrontRef.current.intensity, targetCeiling * 0.90, lerpSpeed);
    }
    if (aisleCenterMidRef.current) {
      aisleCenterMidRef.current.intensity = THREE.MathUtils.lerp(aisleCenterMidRef.current.intensity, targetCeiling * 0.90, lerpSpeed);
    }
    if (aisleCenterRearRef.current) {
      aisleCenterRearRef.current.intensity = THREE.MathUtils.lerp(aisleCenterRearRef.current.intensity, targetCeiling * 0.90, lerpSpeed);
    }
    if (underBalconyRef.current) {
      underBalconyRef.current.intensity = THREE.MathUtils.lerp(underBalconyRef.current.intensity, targetCeiling * 0.95, lerpSpeed);
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
      <ambientLight ref={ambientRef} color="#fff6ec" intensity={houseLights === 'show' ? 0.05 : 3.20} />

      {/* 2. Hemisphere Ambient: warm ceiling bounce, soft espresso carpet bounce */}
      <hemisphereLight
        ref={hemiRef}
        color="#fff1e0"
        groundColor="#2a2220"
        intensity={houseLights === 'show' ? 0.06 : 3.60}
      />

      {/* 3. Dedicated Seat Tops & Shoulders Rim Light with Target pointing down audience rake */}
      <directionalLight
        ref={seatRimLightRef}
        position={[0, topY * 0.85, 2.0]}
        color="#fff5eb"
        intensity={houseLights === 'show' ? 0.02 : 1.35}
        castShadow={false}
      />
      <object3D
        ref={targetObjRef}
        position={[0, topTierY * 0.45, (seatZStart + seatZEnd) * 0.55]}
      />

      {/* 4. Screen Spill Spotlight (projecting onto room during show mode) */}
      <spotLight
        ref={screenSpillRef}
        position={[0, 5.5, -1.0]}
        target-position={[0, 2.0, -14.0]}
        color="#8ab4f8"
        intensity={houseLights === 'show' ? 3.50 : 0.40}
        angle={Math.PI / 2.3}
        penumbra={0.85}
        distance={lightRange * 1.2}
        decay={1.2}
      />

      {/* 4b. Proscenium Screen Wall Wash & Screen Cove Lights */}
      <pointLight
        ref={prosceniumWashRef}
        position={[0, 3.5, -0.5]}
        color="#fff4e6"
        intensity={houseLights === 'show' ? 0.02 : 3.80}
        distance={lightRange * 0.8}
        decay={1.0}
      />
      <pointLight
        ref={prosceniumCoveLRef}
        position={[-halfWidth * 0.45, topY - 2.0, -1.0]}
        color="#fff1e0"
        intensity={houseLights === 'show' ? 0.02 : 3.40}
        distance={lightRange * 0.75}
        decay={1.0}
      />
      <pointLight
        ref={prosceniumCoveRRef}
        position={[halfWidth * 0.45, topY - 2.0, -1.0]}
        color="#fff1e0"
        intensity={houseLights === 'show' ? 0.02 : 3.40}
        distance={lightRange * 0.75}
        decay={1.0}
      />

      {/* 5. Scale-Adaptive Ceiling Downlight Grid across 4 depth stations */}
      {/* Station 1: Front Section Downlights */}
      <pointLight
        ref={ceilingFrontLRef}
        position={[-halfWidth * 0.48, topY - 1.2, zFrontStation]}
        color="#fff1e0"
        intensity={houseLights === 'show' ? 0.02 : 2.30}
        distance={lightRange}
        decay={1.0}
      />
      <pointLight
        ref={ceilingFrontRRef}
        position={[halfWidth * 0.48, topY - 1.2, zFrontStation]}
        color="#fff1e0"
        intensity={houseLights === 'show' ? 0.02 : 2.30}
        distance={lightRange}
        decay={1.0}
      />

      {/* Station 2: Mid-Front Section Downlights */}
      <pointLight
        ref={ceilingMidFrontLRef}
        position={[-halfWidth * 0.48, topY - 1.2, zMidFrontStation]}
        color="#fff1e0"
        intensity={houseLights === 'show' ? 0.02 : 2.30}
        distance={lightRange}
        decay={1.0}
        castShadow={qualityMode === 'beautiful'}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <pointLight
        ref={ceilingMidFrontRRef}
        position={[halfWidth * 0.48, topY - 1.2, zMidFrontStation]}
        color="#fff1e0"
        intensity={houseLights === 'show' ? 0.02 : 2.30}
        distance={lightRange}
        decay={1.0}
        castShadow={qualityMode === 'beautiful'}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />

      {/* Station 3: Mid-Rear Section Downlights */}
      <pointLight
        ref={ceilingMidRearLRef}
        position={[-halfWidth * 0.48, topY - 1.2, zMidRearStation]}
        color="#fff1e0"
        intensity={houseLights === 'show' ? 0.02 : 2.30}
        distance={lightRange}
        decay={1.0}
        castShadow={qualityMode === 'beautiful'}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <pointLight
        ref={ceilingMidRearRRef}
        position={[halfWidth * 0.48, topY - 1.2, zMidRearStation]}
        color="#fff1e0"
        intensity={houseLights === 'show' ? 0.02 : 2.30}
        distance={lightRange}
        decay={1.0}
        castShadow={qualityMode === 'beautiful'}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />

      {/* Station 4: Rear Section Downlights */}
      <pointLight
        ref={ceilingRearLRef}
        position={[-halfWidth * 0.48, topY - 1.2, zRearStation]}
        color="#fff1e0"
        intensity={houseLights === 'show' ? 0.02 : 2.30}
        distance={lightRange}
        decay={1.0}
      />
      <pointLight
        ref={ceilingRearRRef}
        position={[halfWidth * 0.48, topY - 1.2, zRearStation]}
        color="#fff1e0"
        intensity={houseLights === 'show' ? 0.02 : 2.30}
        distance={lightRange}
        decay={1.0}
      />

      {/* Central Aisle Pools of Light along room length */}
      <pointLight
        ref={aisleCenterFrontRef}
        position={[0, topY - 1.4, zFrontStation]}
        color="#fff4e6"
        intensity={houseLights === 'show' ? 0.02 : 2.05}
        distance={lightRange}
        decay={1.0}
      />
      <pointLight
        ref={aisleCenterMidRef}
        position={[0, topY - 1.4, (zMidFrontStation + zMidRearStation) / 2]}
        color="#fff4e6"
        intensity={houseLights === 'show' ? 0.02 : 2.05}
        distance={lightRange}
        decay={1.0}
      />
      <pointLight
        ref={aisleCenterRearRef}
        position={[0, topY - 1.4, zRearStation]}
        color="#fff4e6"
        intensity={houseLights === 'show' ? 0.02 : 2.05}
        distance={lightRange}
        decay={1.0}
      />

      {/* Under-Balcony Fill (active in balcony halls to illuminate under stalls) */}
      {hasBalcony && (
        <pointLight
          ref={underBalconyRef}
          position={[0, 4.5, zBack + 6.0]}
          color="#ffeedb"
          intensity={houseLights === 'show' ? 0.02 : 2.15}
          distance={lightRange * 0.6}
          decay={1.0}
        />
      )}

      {/* 6. Rear Audience & Projection Booth Fill */}
      <pointLight
        ref={rearFillRef}
        position={[0, topY - 2.0, zBack + 2.0]}
        color="#fef3c7"
        intensity={houseLights === 'show' ? 0.03 : 1.60}
        distance={lightRange * 0.7}
        decay={1.0}
      />

      {/* 7. Soft Architectural Wall Washers */}
      <pointLight
        ref={wallWasherLeftRef}
        position={[-halfWidth + 1.2, topTierY + 2.5, (seatZStart + seatZEnd) / 2]}
        color={theatreDef.palette?.coveColor || look.sconceGlowColor}
        intensity={houseLights === 'show' ? 0.03 : 1.85}
        distance={lightRange * 0.75}
        decay={1.0}
      />
      <pointLight
        ref={wallWasherRightRef}
        position={[halfWidth - 1.2, topTierY + 2.5, (seatZStart + seatZEnd) / 2]}
        color={theatreDef.palette?.coveColor || look.sconceGlowColor}
        intensity={houseLights === 'show' ? 0.03 : 1.85}
        distance={lightRange * 0.75}
        decay={1.0}
      />

      {/* 8. Floor Step & Aisle Path Lights (Amber #FF9E2C) */}
      <pointLight
        ref={stepLightLRef}
        position={[-Math.max(2.5, halfWidth * 0.25), 0.45, seatZStart + 1.0]}
        color={theatreDef.palette?.skirtingColor || look.stepLightColor}
        intensity={houseLights === 'show' ? 0.35 : 2.60}
        distance={lightRange * 0.5}
        decay={1.0}
      />
      <pointLight
        ref={stepLightRRef}
        position={[Math.max(2.5, halfWidth * 0.25), 0.45, seatZStart + 1.0]}
        color={theatreDef.palette?.skirtingColor || look.stepLightColor}
        intensity={houseLights === 'show' ? 0.35 : 2.60}
        distance={lightRange * 0.5}
        decay={1.0}
      />
    </group>
  );
}
