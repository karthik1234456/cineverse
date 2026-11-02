'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';

export function CinemaScreen() {
  const meshRef = useRef<THREE.Mesh>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const houseLights = useCinemaStore((s) => s.houseLights);
  const qualityTier = useCinemaStore((s) => s.qualityTier);

  // Generate dynamic cinematic film canvas
  const canvas = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 476; // Aspect 2.15
    return c;
  }, []);

  const texture = useMemo(() => {
    if (!canvas) return null;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = tex;
    return tex;
  }, [canvas]);

  // Animate dynamic trailer graphic onto canvas
  useFrame(({ clock }) => {
    if (!canvas || !textureRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const t = clock.getElapsedTime();
    const w = canvas.width;
    const h = canvas.height;

    // Cinematic backdrop gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    const pulse1 = Math.sin(t * 0.8) * 0.2 + 0.8;
    const pulse2 = Math.cos(t * 0.6) * 0.2 + 0.8;

    grad.addColorStop(0, `rgba(${Math.floor(10 * pulse1)}, ${Math.floor(22 * pulse2)}, ${Math.floor(55 * pulse1)}, 1)`);
    grad.addColorStop(0.4, `rgba(${Math.floor(110 * pulse1)}, ${Math.floor(25 * pulse2)}, ${Math.floor(40 * pulse1)}, 1)`);
    grad.addColorStop(0.7, `rgba(${Math.floor(180 * pulse2)}, ${Math.floor(65 * pulse1)}, ${Math.floor(20 * pulse2)}, 1)`);
    grad.addColorStop(1, `rgba(${Math.floor(20 * pulse1)}, ${Math.floor(10 * pulse2)}, ${Math.floor(35 * pulse1)}, 1)`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Film anamorphic flare streak
    const flareY = h * 0.48 + Math.sin(t * 1.2) * 20;
    const flareGrad = ctx.createLinearGradient(0, flareY - 15, 0, flareY + 15);
    flareGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    flareGrad.addColorStop(0.5, 'rgba(224, 242, 254, 0.4)');
    flareGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = flareGrad;
    ctx.fillRect(0, flareY - 15, w, 30);

    // Vignette
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.55);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Cinematic Movie Title Graphic
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 44px "Cinzel", "Times New Roman", serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 200, 100, 0.8)';
    ctx.shadowBlur = 18;
    ctx.fillText('INTERSTELLAR ODYSSEY', w / 2, h * 0.44);

    ctx.font = '600 18px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.shadowBlur = 6;
    ctx.fillText('C I N E V E R S E   I M A X   3 D', w / 2, h * 0.56);

    ctx.font = 'italic 14px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.shadowBlur = 0;
    ctx.fillText('4K Laser Projection • Dolby Atmos Sound', w / 2, h * 0.65);

    ctx.restore();

    textureRef.current.needsUpdate = true;
  });

  // Emissive brightness based on house lights
  const screenBrightness = houseLights === 'show' ? 1.4 : houseLights === 'dim' ? 1.1 : 0.85;

  return (
    <group name="ScreenContainer">
      {/* Dynamic cinema screen mesh positioned 0.005u in front of cinema_screen_surface */}
      {/* Screen dimensions: width 15.6, height 7.25, center [0, 5.55, -1.255] */}
      <mesh
        ref={meshRef}
        position={[0, 5.55, -1.25]}
        rotation={[0, 0, 0]}
      >
        <planeGeometry args={[15.6, 7.25]} />
        {texture ? (
          <meshBasicMaterial
            map={texture}
            toneMapped={false}
            color={new THREE.Color(screenBrightness, screenBrightness, screenBrightness)}
          />
        ) : (
          <meshBasicMaterial color="#1a202c" />
        )}
      </mesh>

      {/* Volumetric projector beam from back wall to screen */}
      {qualityTier !== 'low' && (
        <ProjectorBeam />
      )}
    </group>
  );
}

function ProjectorBeam() {
  const coneRef = useRef<THREE.Mesh>(null);
  const houseLights = useCinemaStore((s) => s.houseLights);

  // Position between projector port [0, 8.5, -25.5] and screen [0, 5.55, -1.25]
  const start = useMemo(() => new THREE.Vector3(0, 8.8, -25.5), []);
  const end = useMemo(() => new THREE.Vector3(0, 5.55, -1.25), []);
  const mid = useMemo(() => start.clone().add(end).multiplyScalar(0.5), [start, end]);
  const length = useMemo(() => start.distanceTo(end), [start, end]);

  // Cylinder/Cone rotation
  const orientation = useMemo(() => {
    const dir = end.clone().sub(start).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
    return quat;
  }, [start, end]);

  const opacity = houseLights === 'show' ? 0.09 : houseLights === 'dim' ? 0.05 : 0.02;

  return (
    <mesh
      ref={coneRef}
      position={mid}
      quaternion={orientation}
    >
      {/* Top radius (near projector) = 0.15, bottom radius (near screen) = 7.5 */}
      <cylinderGeometry args={[7.6, 0.2, length, 32, 1, true]} />
      <meshBasicMaterial
        color="#a5b4fc"
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
