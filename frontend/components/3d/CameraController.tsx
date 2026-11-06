'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useCinemaStore, DEFAULT_CAMERA_TARGET, DEFAULT_CAMERA_POS } from '@/store/useCinemaStore';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';
import { WalkController } from './WalkController';

// Safe boundary box inside auditorium interior to prevent clipping through geometry
export const AUDITORIUM_BOUNDS = {
  minX: -9.2,
  maxX: 9.2,
  minY: 1.1,
  maxY: 9.6,
  minZ: -24.2,
  maxZ: -2.2,
};

export const TARGET_BOUNDS = {
  minX: -6.0,
  maxX: 6.0,
  minY: 1.5,
  maxY: 6.5,
  minZ: -19.0,
  maxZ: -3.0,
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

  const mode = useCinemaStore((s) => s.mode);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const isOverview = mode === 'overview' || cameraMode === 'orbit';
  const isSeated = mode === 'seated' || cameraMode === 'pov';
  const isWalk = mode === 'walk' || cameraMode === 'walk';

  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const cameraPosition = useCinemaStore((s) => s.cameraPosition);
  const cameraTarget = useCinemaStore((s) => s.cameraTarget);
  const storeFov = useCinemaStore((s) => s.fov);
  const setMode = useCinemaStore((s) => s.setMode);
  const standUp = useCinemaStore((s) => s.standUp);
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

  // Seated head-look offsets: yaw ±80° (±1.396 rad), pitch ±35° (±0.611 rad)
  const povLook = useRef({
    yaw: 0,
    pitch: 0,
    targetYaw: 0,
    targetPitch: 0,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  // Target pose computation
  const targetPose = useMemo(() => {
    if (isSeated && activeSeatId) {
      const seat = seatMap.get(activeSeatId);
      if (seat) {
        const eye = new THREE.Vector3(...seat.eye_position_gltf_y_up);
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

    if (isOverview) {
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
    }

    return null;
  }, [isSeated, isOverview, activeSeatId, cameraPosition, cameraTarget, storeFov, seatMap, screenCenter]);

  // Initiate transition whenever target pose changes
  useEffect(() => {
    if (!targetPose || isWalk) return;
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

    t.startPos.copy(persCam.position);
    t.startQuat.copy(persCam.quaternion);
    t.startFov = persCam.fov;

    t.endPos.copy(targetPose.position);
    t.endQuat.copy(targetPose.quaternion);
    t.endFov = targetPose.fov;

    // Bezier arc control point: rise above seats, capped below ceiling
    const mid = t.startPos.clone().add(t.endPos).multiplyScalar(0.5);
    const arcY = Math.min(AUDITORIUM_BOUNDS.maxY - 0.4, Math.max(t.startPos.y, t.endPos.y, 6.8) + 0.5);
    t.arcControl.set(mid.x, arcY, mid.z);

    t.startTime = performance.now();
    t.duration = isSeated ? 1.05 : 0.95;
    t.active = true;
    useCinemaStore.getState().setContinuousRendering(true);

    // Reset POV look offsets on seat transition
    povLook.current.yaw = 0;
    povLook.current.pitch = 0;
    povLook.current.targetYaw = 0;
    povLook.current.targetPitch = 0;
  }, [targetPose, camera, isSeated, isWalk, prefersReducedMotion]);

  // Pointer drag listeners for Seated POV look-around
  useEffect(() => {
    if (!isSeated) return;
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        povLook.current.isDragging = true;
        povLook.current.lastX = e.clientX;
        povLook.current.lastY = e.clientY;
        useCinemaStore.getState().setContinuousRendering(true);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!povLook.current.isDragging) return;
      const dx = e.clientX - povLook.current.lastX;
      const dy = e.clientY - povLook.current.lastY;
      povLook.current.lastX = e.clientX;
      povLook.current.lastY = e.clientY;

      const speed = 0.0035;
      povLook.current.targetYaw -= dx * speed;
      povLook.current.targetPitch -= dy * speed;

      // Yaw limit ±80° (1.396 rad), Pitch limit ±35° (0.611 rad)
      povLook.current.targetYaw = THREE.MathUtils.clamp(povLook.current.targetYaw, -1.396, 1.396);
      povLook.current.targetPitch = THREE.MathUtils.clamp(povLook.current.targetPitch, -0.611, 0.611);
    };

    const onPointerUp = () => {
      povLook.current.isDragging = false;
      setTimeout(() => {
        useCinemaStore.getState().setContinuousRendering(false);
      }, 350);
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isSeated, gl]);

  // Keyboard navigation for Seated & Overview modes (§5b)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      // Global Compare Toggle (C)
      if (e.code === 'KeyC') {
        toggleCompare();
        return;
      }

      if (isSeated) {
        // Look keys (arrows in Seated mode)
        if (e.key === 'ArrowLeft') {
          povLook.current.targetYaw = THREE.MathUtils.clamp(povLook.current.targetYaw + 0.1, -1.396, 1.396);
        } else if (e.key === 'ArrowRight') {
          povLook.current.targetYaw = THREE.MathUtils.clamp(povLook.current.targetYaw - 0.1, -1.396, 1.396);
        } else if (e.key === 'ArrowUp') {
          povLook.current.targetPitch = THREE.MathUtils.clamp(povLook.current.targetPitch + 0.08, -0.611, 0.611);
        } else if (e.key === 'ArrowDown') {
          povLook.current.targetPitch = THREE.MathUtils.clamp(povLook.current.targetPitch - 0.08, -0.611, 0.611);
        }
        // Prev/next seat in row (Q / E)
        else if (e.code === 'KeyQ') {
          navigatePOV('prev');
        } else if (e.code === 'KeyE') {
          navigatePOV('next');
        }
        // Row ahead / row behind (Z / X)
        else if (e.code === 'KeyZ') {
          navigatePOV('prevRow');
        } else if (e.code === 'KeyX') {
          navigatePOV('nextRow');
        }
        // Select / deselect (Enter / Space)
        else if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          if (activeSeatId) toggleSeat(activeSeatId);
        }
        // Compare (C)
        else if (e.code === 'KeyC') {
          toggleCompare();
        }
        // Recentre (R)
        else if (e.code === 'KeyR') {
          povLook.current.targetYaw = 0;
          povLook.current.targetPitch = 0;
          povLook.current.yaw = 0;
          povLook.current.pitch = 0;
        }
        // Stand up (Esc / Backspace / F) -> returns to Walk mode at aisle
        else if (e.key === 'Escape' || e.code === 'Backspace' || e.code === 'KeyF') {
          e.preventDefault();
          standUp();
        }
        // Switch to Overview (O)
        else if (e.code === 'KeyO') {
          setMode('overview');
        }
      } else if (isOverview) {
        // Overview mode controls
        if (e.code === 'KeyW' || e.code === 'KeyS') {
          // Switch to Walk mode
          setMode('walk');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSeated, isOverview, activeSeatId, standUp, setMode, navigatePOV, toggleCompare, toggleSeat]);

  // Frame tick: transitions, head-look, boundary clamps
  useFrame(({ invalidate }, delta) => {
    if (isWalk) return; // WalkController handles camera in Walk mode

    const persCam = camera as THREE.PerspectiveCamera;
    const t = transitionRef.current;

    if (t.active && targetPose) {
      invalidate();
      const elapsed = (performance.now() - t.startTime) / 1000;
      const progress = Math.min(1, elapsed / t.duration);
      const eased = easeInOutCubic(progress);

      const oneMinus = 1 - eased;
      const pos = new THREE.Vector3()
        .copy(t.startPos)
        .multiplyScalar(oneMinus * oneMinus)
        .addScaledVector(t.arcControl, 2 * oneMinus * eased)
        .addScaledVector(t.endPos, eased * eased);

      clampToAuditorium(pos);
      persCam.position.copy(pos);
      persCam.quaternion.slerpQuaternions(t.startQuat, t.endQuat, eased);

      persCam.fov = THREE.MathUtils.lerp(t.startFov, t.endFov, eased);
      persCam.updateProjectionMatrix();

      if (progress >= 1) {
        t.active = false;
        useCinemaStore.getState().setContinuousRendering(false);
        persCam.position.copy(targetPose.position);
        persCam.quaternion.copy(targetPose.quaternion);
        persCam.fov = targetPose.fov;
        persCam.updateProjectionMatrix();
        if (controlsRef.current) {
          controlsRef.current.target.copy(targetPose.target);
          controlsRef.current.update();
        }
      }
    } else if (isSeated && targetPose) {
      // Damped head-look in Seated mode
      const look = povLook.current;
      if (look.isDragging || Math.abs(look.yaw - look.targetYaw) > 0.001 || Math.abs(look.pitch - look.targetPitch) > 0.001) {
        invalidate();
      }
      const dampSpeed = Math.min(delta * 12, 1);
      look.yaw = THREE.MathUtils.lerp(look.yaw, look.targetYaw, dampSpeed);
      look.pitch = THREE.MathUtils.lerp(look.pitch, look.targetPitch, dampSpeed);

      persCam.position.copy(targetPose.position);
      persCam.quaternion.copy(targetPose.quaternion);

      // Apply yaw (around world Y) and pitch (around camera local X)
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), look.yaw);
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), look.pitch);

      persCam.quaternion.premultiply(yawQuat);
      persCam.quaternion.multiply(pitchQuat);
    } else if (isOverview) {
      if (controlsRef.current) {
        // Clamp orbit target to interior
        const tgt = controlsRef.current.target;
        tgt.x = THREE.MathUtils.clamp(tgt.x, TARGET_BOUNDS.minX, TARGET_BOUNDS.maxX);
        tgt.y = THREE.MathUtils.clamp(tgt.y, TARGET_BOUNDS.minY, TARGET_BOUNDS.maxY);
        tgt.z = THREE.MathUtils.clamp(tgt.z, TARGET_BOUNDS.minZ, TARGET_BOUNDS.maxZ);
      }

      const pos = persCam.position;
      let hitEdge = false;

      // Soft spring & wall gliding when pushing past bounds
      if (pos.x < AUDITORIUM_BOUNDS.minX) {
        pos.x = THREE.MathUtils.lerp(pos.x, AUDITORIUM_BOUNDS.minX, 0.35);
        hitEdge = true;
      } else if (pos.x > AUDITORIUM_BOUNDS.maxX) {
        pos.x = THREE.MathUtils.lerp(pos.x, AUDITORIUM_BOUNDS.maxX, 0.35);
        hitEdge = true;
      }

      if (pos.y < AUDITORIUM_BOUNDS.minY) {
        pos.y = THREE.MathUtils.lerp(pos.y, AUDITORIUM_BOUNDS.minY, 0.35);
        hitEdge = true;
      } else if (pos.y > AUDITORIUM_BOUNDS.maxY) {
        pos.y = THREE.MathUtils.lerp(pos.y, AUDITORIUM_BOUNDS.maxY, 0.35);
        hitEdge = true;
      }

      if (pos.z < AUDITORIUM_BOUNDS.minZ) {
        pos.z = THREE.MathUtils.lerp(pos.z, AUDITORIUM_BOUNDS.minZ, 0.35);
        hitEdge = true;
      } else if (pos.z > AUDITORIUM_BOUNDS.maxZ) {
        pos.z = THREE.MathUtils.lerp(pos.z, AUDITORIUM_BOUNDS.maxZ, 0.35);
        hitEdge = true;
      }

      // Hard clamp as invariant backstop
      clampToAuditorium(pos);

      if (hitEdge) {
        useCinemaStore.getState().triggerBoundaryNotice();
      }
    }
  });

  return (
    <>
      {isWalk && <WalkController />}
      {isOverview && (
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          minDistance={2.5}
          maxDistance={20.0}
          maxPolarAngle={1.42}
          minPolarAngle={0.35}
          target={DEFAULT_CAMERA_TARGET}
          onStart={() => useCinemaStore.getState().setContinuousRendering(true)}
          onEnd={() => {
            setTimeout(() => {
              useCinemaStore.getState().setContinuousRendering(false);
            }, 450);
          }}
        />
      )}
    </>
  );
}
