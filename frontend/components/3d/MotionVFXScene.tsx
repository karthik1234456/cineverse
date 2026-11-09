'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';

export function MotionVFXScene() {
  const is4dxActive = useCinemaStore((s) => s.experience4dxActive);
  const intensity = useCinemaStore((s) => s.experience4dxIntensity);

  const mistPointsRef = useRef<THREE.Points>(null);
  const strobeLightRef = useRef<THREE.PointLight>(null);
  const heatGlowRef = useRef<THREE.PointLight>(null);

  // 1. Water mist particles
  const [mistGeo, mistMat] = useMemo(() => {
    const count = 120;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 8.0;
      positions[i * 3 + 1] = 2.0 + Math.random() * 3.5;
      positions[i * 3 + 2] = -4.0 - Math.random() * 8.0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#a5f3fc',
      size: 0.15,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    return [geo, mat];
  }, []);

  // Animate mist and strobe effects in frame loop
  useFrame(() => {
    if (!is4dxActive || intensity === 'off') return;

    const time = performance.now() * 0.001;
    const mult = intensity === 'full' ? 1.0 : intensity === 'light' ? 0.35 : 0.65;

    // Drifting mist
    if (mistPointsRef.current) {
      const pos = mistPointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 2] -= 0.03 * mult;
        if (pos[i * 3 + 2] < -18.0) {
          pos[i * 3 + 2] = -3.0;
        }
      }
      mistPointsRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Gentle lightning strobe (safe: <= 1 flash every 3 seconds)
    if (strobeLightRef.current) {
      const isFlash = Math.sin(time * 0.8) > 0.96;
      strobeLightRef.current.intensity = isFlash ? 2.5 * mult : 0.0;
    }

    // Heat glow
    if (heatGlowRef.current) {
      const isWarm = Math.sin(time * 0.35) > 0.7;
      heatGlowRef.current.intensity = isWarm ? 1.8 * mult : 0.0;
    }
  });

  if (!is4dxActive || intensity === 'off') {
    return null;
  }

  return (
    <group name="MotionVFXContainer">
      {/* Drifting water mist */}
      <points ref={mistPointsRef} geometry={mistGeo} material={mistMat} />

      {/* Lightning strobe pointlight overhead */}
      <pointLight
        ref={strobeLightRef}
        position={[0, 8.5, -10]}
        color="#e0f2fe"
        intensity={0}
        distance={25}
      />

      {/* Warm explosion / heat glow light */}
      <pointLight
        ref={heatGlowRef}
        position={[0, 4.0, -5]}
        color="#f97316"
        intensity={0}
        distance={22}
      />
    </group>
  );
}

