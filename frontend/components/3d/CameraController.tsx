'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useCinemaStore, DEFAULT_CAMERA_TARGET } from '@/store/useCinemaStore';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';

// Safe boundary box inside auditorium interior to prevent clipping through geometry
const AUDITORIUM_BOUNDS = {
  minX: -9.8,
  maxX: 9.8,
  minY: 0.8,
  maxY: 10.2,
  minZ: -25.0,
  maxZ: -0.6,
};

function clampToAuditorium(pos: THREE.Vector3) {
  pos.x = THREE.MathUtils.clamp(pos.x, AUDITORIUM_BOUNDS.minX, AUDITORIUM_BOUNDS.maxX);
  pos.y = THREE.MathUtils.clamp(pos.y, AUDITORIUM_BOUNDS.minY, AUDITORIUM_BOUNDS.maxY);
  pos.z = THREE.MathUtils.clamp(pos.z, AUDITORIUM_BOUNDS.minZ, AUDITORIUM_BOUNDS.maxZ);
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function CameraController() {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const cameraPosition = useCinemaStore((s) => s.cameraPosition);
  const cameraTarget = useCinemaStore((s) => s.cameraTarget);
  const storeFov = useCinemaStore((s) => s.fov);
  const exitPOV = useCinemaStore((s) => s.exitPOV);
  const navigatePOV = useCinemaStore((s) => s.navigatePOV);
  const toggleSeat = useCinemaStore((s) => s.toggleSeat);
  const toggleCompare = useCinemaStore((s) => s.toggleCompare);

  const seats = (layoutData as unknown as SeatLayoutFile).seats;
  const screenCenter = useMemo(
    () => new THREE.Vector3(...(layoutData as unknown as SeatLayoutFile).screen.center_gltf_y_up),
    []
  );

  const seatMap = useMemo(() => {
    const map = new Map<string, SeatRecord>();
    for (const s of seats) map.set(s.seat_id, s);
    return map;
  }, [seats]);

  // Reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(media.matches);
    const listener = () => setPrefersReducedMotion(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  // Transition state
  const transitionRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    startPos: THREE.Vector3;
    arcControl: THREE.Vector3;
    endPos: THREE.Vector3;
    startQuat: THREE.Quaternion;
    endQuat: THREE.Quaternion;
    startFov: number;
    endFov: number;
  }>({
    active: false,
    startTime: 0,
    duration: 1.1,
    startPos: new THREE.Vector3(),
    arcControl: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startQuat: new THREE.Quaternion(),
    endQuat: new THREE.Quaternion(),
    startFov: 60,
    endFov: 60,
  });

  // POV Look-around offsets
  const povLook = useRef({
    yaw: 0, // radians, clamp ±60° (±1.047)
    pitch: 0, // radians, clamp ±25° (±0.436)
    targetYaw: 0,
    targetPitch: 0,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  // Target pose computation
  const targetPose = useMemo(() => {
    if (cameraMode === 'pov' && activeSeatId) {
      const seat = seatMap.get(activeSeatId);
      if (seat) {
        const eye = new THREE.Vector3(...seat.eye_position_gltf_y_up);
        // Orientation looking directly at screen centre
        const dummyCam = new THREE.PerspectiveCamera();
        dummyCam.position.copy(eye);
        dummyCam.lookAt(screenCenter);
        dummyCam.updateMatrix();

        return {
          position: eye,
          quaternion: dummyCam.quaternion.clone(),
          target: screenCenter.clone(),
          fov: storeFov,
        };
      }
    }

    // Orbit mode pose
    const pos = new THREE.Vector3(...cameraPosition);
    clampToAuditorium(pos);
    const tgt = new THREE.Vector3(...cameraTarget);
    const dummyCam = new THREE.PerspectiveCamera();
    dummyCam.position.copy(pos);
    dummyCam.lookAt(tgt);
    dummyCam.updateMatrix();

    return {
      position: pos,
      quaternion: dummyCam.quaternion.clone(),
      target: tgt,
      fov: storeFov,
    };
  }, [cameraMode, activeSeatId, cameraPosition, cameraTarget, storeFov, seatMap, screenCenter]);

  // Initiate transition whenever target pose changes
  useEffect(() => {
    const t = transitionRef.current;
    const persCam = camera as THREE.PerspectiveCamera;

    if (prefersReducedMotion) {
      persCam.position.copy(targetPose.position);
      persCam.quaternion.copy(targetPose.quaternion);
      persCam.fov = targetPose.fov;
      persCam.updateProjectionMatrix();
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetPose.target);
        controlsRef.current.update();
      }
      return;
    }

    // Mid-flight retargeting: start from current camera pose
    t.startPos.copy(persCam.position);
    t.startQuat.copy(persCam.quaternion);
    t.startFov = persCam.fov;

    t.endPos.copy(targetPose.position);
    t.endQuat.copy(targetPose.quaternion);
    t.endFov = targetPose.fov;

    // Bezier arc control point: rise above seats (y ≥ 7.2) to clear obstacles
    const mid = t.startPos.clone().add(t.endPos).multiplyScalar(0.5);
    const arcY = Math.max(t.startPos.y, t.endPos.y, 7.2) + 0.6;
    t.arcControl.set(mid.x, arcY, mid.z);

    t.startTime = performance.now();
    t.duration = cameraMode === 'pov' ? 1.05 : 0.95;
    t.active = true;

    // Reset POV look offsets on transition
    povLook.current.yaw = 0;
    povLook.current.pitch = 0;
    povLook.current.targetYaw = 0;
    povLook.current.targetPitch = 0;
  }, [targetPose, camera, cameraMode, prefersReducedMotion]);

  // Pointer drag listeners for POV look-around
  useEffect(() => {
    if (cameraMode !== 'pov') return;
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        povLook.current.isDragging = true;
        povLook.current.lastX = e.clientX;
        povLook.current.lastY = e.clientY;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!povLook.current.isDragging) return;
      const dx = e.clientX - povLook.current.lastX;
      const dy = e.clientY - povLook.current.lastY;
      povLook.current.lastX = e.clientX;
      povLook.current.lastY = e.clientY;

      // Sensitivity
      const speed = 0.0035;
      povLook.current.targetYaw -= dx * speed;
      povLook.current.targetPitch -= dy * speed;

      // Yaw limit ±60° (1.047 rad), Pitch limit ±25° (0.436 rad)
      povLook.current.targetYaw = THREE.MathUtils.clamp(povLook.current.targetYaw, -1.047, 1.047);
      povLook.current.targetPitch = THREE.MathUtils.clamp(povLook.current.targetPitch, -0.436, 0.436);
    };

    const onPointerUp = () => {
      povLook.current.isDragging = false;
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [cameraMode, gl]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Escape') {
        if (cameraMode === 'pov') {
          exitPOV();
        }
      } else if (e.key === 'ArrowLeft') {
        if (cameraMode === 'pov') navigatePOV('prev');
      } else if (e.key === 'ArrowRight') {
        if (cameraMode === 'pov') navigatePOV('next');
      } else if (e.key === 'ArrowUp') {
        if (cameraMode === 'pov') navigatePOV('prevRow');
      } else if (e.key === 'ArrowDown') {
        if (cameraMode === 'pov') navigatePOV('nextRow');
      } else if (e.key.toLowerCase() === 'c') {
        toggleCompare();
      } else if (e.key === 'Enter') {
        if (activeSeatId) toggleSeat(activeSeatId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraMode, activeSeatId, exitPOV, navigatePOV, toggleCompare, toggleSeat]);

  // Frame tick: animations, slerp, and boundary clamping
  useFrame((_, delta) => {
    const persCam = camera as THREE.PerspectiveCamera;
    const t = transitionRef.current;

    if (t.active) {
      const elapsed = (performance.now() - t.startTime) / 1000;
      const progress = Math.min(1, elapsed / t.duration);
      const eased = easeInOutCubic(progress);

      // Bezier curve interpolation for position (rises above seat rows)
      const oneMinus = 1 - eased;
      const pos = new THREE.Vector3()
        .copy(t.startPos)
        .multiplyScalar(oneMinus * oneMinus)
        .addScaledVector(t.arcControl, 2 * oneMinus * eased)
        .addScaledVector(t.endPos, eased * eased);

      clampToAuditorium(pos);
      persCam.position.copy(pos);

      // Quaternion slerp for orientation (never Euler lerp)
      persCam.quaternion.slerpQuaternions(t.startQuat, t.endQuat, eased);

      // FOV animation
      persCam.fov = THREE.MathUtils.lerp(t.startFov, t.endFov, eased);
      persCam.updateProjectionMatrix();

      if (progress >= 1) {
        t.active = false;
        // Snap precisely to target at completion
        persCam.position.copy(targetPose.position);
        persCam.quaternion.copy(targetPose.quaternion);
        persCam.fov = targetPose.fov;
        persCam.updateProjectionMatrix();
        if (controlsRef.current) {
          controlsRef.current.target.copy(targetPose.target);
          controlsRef.current.update();
        }
      }
    } else if (cameraMode === 'pov') {
      // Damped look-around in POV mode
      const look = povLook.current;
      const dampSpeed = Math.min(delta * 12, 1);
      look.yaw = THREE.MathUtils.lerp(look.yaw, look.targetYaw, dampSpeed);
      look.pitch = THREE.MathUtils.lerp(look.pitch, look.targetPitch, dampSpeed);

      // Base orientation looking at screen
      persCam.position.copy(targetPose.position);
      persCam.quaternion.copy(targetPose.quaternion);

      // Apply yaw (around world Y) and pitch (around camera local X)
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), look.yaw);
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), look.pitch);

      persCam.quaternion.premultiply(yawQuat);
      persCam.quaternion.multiply(pitchQuat);
    } else if (cameraMode === 'orbit') {
      // Clamp OrbitControls position to auditorium boundaries
      clampToAuditorium(persCam.position);
    }
  });

  return (
    <>
      {cameraMode === 'orbit' && (
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          minDistance={2.5}
          maxDistance={32}
          maxPolarAngle={Math.PI / 2 - 0.04} // Prevent clipping under floor
          minPolarAngle={0.08} // Prevent clipping directly above ceiling
          target={DEFAULT_CAMERA_TARGET}
        />
      )}
    </>
  );
}
