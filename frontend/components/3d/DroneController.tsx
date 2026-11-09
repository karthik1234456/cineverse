'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore, DEFAULT_CAMERA_POS, DEFAULT_CAMERA_TARGET } from '@/store/useCinemaStore';

// Static scratch objects to guarantee ZERO per-frame object allocations
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _targetVel = new THREE.Vector3();
const _deltaPos = new THREE.Vector3();
const _lookTgt = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _lookDir = new THREE.Vector3();

// Pitch limits: -80 deg to +30 deg (-1.396 to +0.523 rad)
const MIN_PITCH = -1.396;
const MAX_PITCH = 0.523;

export function DroneController() {
  const { camera, gl } = useThree();
  const persCam = camera as THREE.PerspectiveCamera;

  const cameraBounds = useCinemaStore((s) => s.cameraBounds);
  const triggerBoundaryNotice = useCinemaStore((s) => s.triggerBoundaryNotice);
  const setContinuousRendering = useCinemaStore((s) => s.setContinuousRendering);

  // Drone State
  const stateRef = useRef({
    pos: new THREE.Vector3().copy(persCam.position),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: -0.2, // slightly tilted down toward screen
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    keys: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false,
      turnLeft: false,
      turnRight: false,
      boost: false,
      slow: false,
    },
    // Gliding state for quick jumps & reset view
    isGliding: false,
    glideStartPos: new THREE.Vector3(),
    glideEndPos: new THREE.Vector3(),
    glideStartRot: { yaw: 0, pitch: 0 },
    glideEndRot: { yaw: 0, pitch: 0 },
    glideProgress: 0,
    glideDuration: 0.8,
  });

  // Initialize camera position from store or default
  useEffect(() => {
    const s = stateRef.current;
    if (persCam.position.lengthSq() < 0.1) {
      persCam.position.set(...DEFAULT_CAMERA_POS);
    }
    s.pos.copy(persCam.position);
    // Face toward default target
    _lookDir.set(...DEFAULT_CAMERA_TARGET).sub(s.pos).normalize();
    s.yaw = Math.atan2(-_lookDir.x, -_lookDir.z);
    s.pitch = Math.asin(THREE.MathUtils.clamp(_lookDir.y, -1, 1));
  }, [persCam]);

  // Pointer drag look
  useEffect(() => {
    const canvas = gl.domElement;
    const s = stateRef.current;

    const onPointerDown = (e: PointerEvent) => {
      // Primary button drag
      if (e.button === 0 || e.pointerType === 'touch') {
        s.isDragging = true;
        s.lastMouseX = e.clientX;
        s.lastMouseY = e.clientY;
        setContinuousRendering(true);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!s.isDragging) return;
      const dx = e.clientX - s.lastMouseX;
      const dy = e.clientY - s.lastMouseY;
      s.lastMouseX = e.clientX;
      s.lastMouseY = e.clientY;

      const sens = 0.003;
      s.yaw -= dx * sens;
      s.pitch = THREE.MathUtils.clamp(s.pitch - dy * sens, MIN_PITCH, MAX_PITCH);
    };

    const onPointerUp = () => {
      s.isDragging = false;
      setTimeout(() => setContinuousRendering(false), 300);
    };

    // Wheel zoom/forward flight along look vector
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.008;
      persCam.getWorldDirection(_lookDir);
      s.vel.addScaledVector(_lookDir, -e.deltaY * zoomSpeed);
      setContinuousRendering(true);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [gl, persCam, setContinuousRendering]);

  // Keyboard controls: WASD / Arrows, Space (up), C (down), Q/E (yaw), Shift/Ctrl
  useEffect(() => {
    const s = stateRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const k = e.key.toLowerCase();

      let handled = true;
      if (k === 'w' || e.key === 'ArrowUp') s.keys.forward = true;
      else if (k === 's' || e.key === 'ArrowDown') s.keys.backward = true;
      else if (k === 'a' || e.key === 'ArrowLeft') s.keys.left = true;
      else if (k === 'd' || e.key === 'ArrowRight') s.keys.right = true;
      else if (e.code === 'Space') s.keys.up = true;
      else if (k === 'c') s.keys.down = true;
      else if (k === 'q') s.keys.turnLeft = true;
      else if (k === 'e') s.keys.turnRight = true;
      else if (e.key === 'Shift') s.keys.boost = true;
      else if (e.key === 'Control' || e.key === 'Alt') s.keys.slow = true;
      else handled = false;

      if (handled) setContinuousRendering(true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') s.keys.forward = false;
      else if (k === 's' || e.key === 'ArrowDown') s.keys.backward = false;
      else if (k === 'a' || e.key === 'ArrowLeft') s.keys.left = false;
      else if (k === 'd' || e.key === 'ArrowRight') s.keys.right = false;
      else if (e.code === 'Space') s.keys.up = false;
      else if (k === 'c') s.keys.down = false;
      else if (k === 'q') s.keys.turnLeft = false;
      else if (k === 'e') s.keys.turnRight = false;
      else if (e.key === 'Shift') s.keys.boost = false;
      else if (e.key === 'Control' || e.key === 'Alt') s.keys.slow = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setContinuousRendering]);

  // Expose jump methods on window or custom event for Quick Jumps and Reset View
  useEffect(() => {
    const handleDroneJump = (e: CustomEvent<{ pos: [number, number, number]; target?: [number, number, number] }>) => {
      const s = stateRef.current;
      const { pos, target } = e.detail;

      s.isGliding = true;
      s.glideProgress = 0;
      s.glideStartPos.copy(s.pos);
      s.glideEndPos.set(...pos);

      s.glideStartRot.yaw = s.yaw;
      s.glideStartRot.pitch = s.pitch;

      const tgt = target ? new THREE.Vector3(...target) : new THREE.Vector3(...DEFAULT_CAMERA_TARGET);
      _lookDir.copy(tgt).sub(s.glideEndPos).normalize();
      s.glideEndRot.yaw = Math.atan2(-_lookDir.x, -_lookDir.z);
      s.glideEndRot.pitch = Math.asin(THREE.MathUtils.clamp(_lookDir.y, -1, 1));

      setContinuousRendering(true);
    };

    window.addEventListener('drone-quick-jump' as any, handleDroneJump as EventListener);
    return () => {
      window.removeEventListener('drone-quick-jump' as any, handleDroneJump as EventListener);
    };
  }, [setContinuousRendering]);

  // Frame update loop with smooth acceleration, collision sliding, and zero allocation
  useFrame((_, delta) => {
    const s = stateRef.current;
    const dt = Math.min(delta, 0.1);

    // 1. Handle Glide Animation if active
    if (s.isGliding) {
      s.glideProgress += dt / s.glideDuration;
      if (s.glideProgress >= 1.0) {
        s.glideProgress = 1.0;
        s.isGliding = false;
        s.pos.copy(s.glideEndPos);
        s.yaw = s.glideEndRot.yaw;
        s.pitch = s.glideEndRot.pitch;
        s.vel.set(0, 0, 0);
        setTimeout(() => setContinuousRendering(false), 200);
      } else {
        const t = THREE.MathUtils.smoothstep(s.glideProgress, 0, 1);
        s.pos.lerpVectors(s.glideStartPos, s.glideEndPos, t);
        s.yaw = THREE.MathUtils.lerp(s.glideStartRot.yaw, s.glideEndRot.yaw, t);
        s.pitch = THREE.MathUtils.lerp(s.glideStartRot.pitch, s.glideEndRot.pitch, t);
      }
    } else {
      // 2. Handle Continuous Keyboard Turning
      const turnSpeed = 1.8 * dt;
      if (s.keys.turnLeft) s.yaw += turnSpeed;
      if (s.keys.turnRight) s.yaw -= turnSpeed;

      // 3. Compute Movement Vectors
      let speed = 9.0;
      if (s.keys.boost) speed *= 2.2;
      if (s.keys.slow) speed *= 0.4;

      _fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw)).normalize();
      _right.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw)).normalize();

      _targetVel.set(0, 0, 0);
      if (s.keys.forward) _targetVel.add(_fwd);
      if (s.keys.backward) _targetVel.sub(_fwd);
      if (s.keys.right) _targetVel.add(_right);
      if (s.keys.left) _targetVel.sub(_right);
      if (s.keys.up) _targetVel.y += 1.0;
      if (s.keys.down) _targetVel.y -= 1.0;

      if (_targetVel.lengthSq() > 0) {
        _targetVel.normalize().multiplyScalar(speed);
      }

      // Smooth acceleration & braking damping
      s.vel.lerp(_targetVel, dt * 10.0);
      _deltaPos.copy(s.vel).multiplyScalar(dt);
      s.pos.add(_deltaPos);

      // 4. Collision Sliding & Boundary Clamping
      const bounds = cameraBounds || {
        minX: -9.2,
        maxX: 9.2,
        minY: 1.5,
        maxY: 9.6,
        minZ: -24.2,
        maxZ: -2.2,
      };

      // Safety margins to prevent camera clipping through floor/seat tops/walls
      const margin = 0.5;
      const bMinX = bounds.minX + margin;
      const bMaxX = bounds.maxX - margin;
      const bMinY = bounds.minY + margin; // above seat tops
      const bMaxY = bounds.maxY - margin; // below ceiling
      const bMinZ = bounds.minZ + margin;
      const bMaxZ = bounds.maxZ - margin;

      let hitBoundary = false;

      if (s.pos.x < bMinX) {
        s.pos.x = bMinX;
        s.vel.x = 0;
        hitBoundary = true;
      } else if (s.pos.x > bMaxX) {
        s.pos.x = bMaxX;
        s.vel.x = 0;
        hitBoundary = true;
      }

      if (s.pos.y < bMinY) {
        s.pos.y = bMinY;
        s.vel.y = 0;
        hitBoundary = true;
      } else if (s.pos.y > bMaxY) {
        s.pos.y = bMaxY;
        s.vel.y = 0;
        hitBoundary = true;
      }

      if (s.pos.z < bMinZ) {
        s.pos.z = bMinZ;
        s.vel.z = 0;
        hitBoundary = true;
      } else if (s.pos.z > bMaxZ) {
        s.pos.z = bMaxZ;
        s.vel.z = 0;
        hitBoundary = true;
      }

      if (hitBoundary) {
        triggerBoundaryNotice();
      }
    }

    // 5. Update Camera Transform (Zero Allocation, No Roll)
    persCam.position.copy(s.pos);
    _euler.set(s.pitch, s.yaw, 0, 'YXZ');
    persCam.quaternion.setFromEuler(_euler);
    persCam.updateMatrix();
  });

  return null;
}

