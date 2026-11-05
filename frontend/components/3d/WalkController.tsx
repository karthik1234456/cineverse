'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import {
  stepPlayer,
  smoothEyeHeight,
  type WalkableSurface,
  type Collider,
} from '@/lib/walkCollision';
import walkNavData from '@/public/models/walk_nav_v2.json';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';

const walkables = walkNavData.walkable as unknown as WalkableSurface[];
const colliders = walkNavData.colliders as unknown as Collider[];
const playerCfg = walkNavData.player;

export function WalkController() {
  const { camera, gl } = useThree();

  const mode = useCinemaStore((s) => s.mode);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const isWalkMode = mode === 'walk' || cameraMode === 'walk';

  const walkPlayer = useCinemaStore((s) => s.walkPlayer);
  const walkSettings = useCinemaStore((s) => s.walkSettings);
  const updateWalkPose = useCinemaStore((s) => s.updateWalkPose);
  const sitAt = useCinemaStore((s) => s.sitAt);
  const setMode = useCinemaStore((s) => s.setMode);
  const autoWalkTarget = useCinemaStore((s) => s.autoWalkTarget);
  const setHoveredSeat = useCinemaStore((s) => s.setHoveredSeat);

  const seats = (layoutData as unknown as SeatLayoutFile).seats;
  const seatMap = useMemo(() => {
    const map = new Map<string, SeatRecord>();
    for (const s of seats) map.set(s.seat_id, s);
    return map;
  }, [seats]);

  // Keys active set
  const keysDown = useRef<Set<string>>(new Set());

  // Player position and orientation refs (synced with store, updated per frame)
  const posRef = useRef<THREE.Vector3>(new THREE.Vector3(...walkPlayer.position));
  const eyeHeightRef = useRef<number>(walkPlayer.eyeHeight);
  const yawRef = useRef<number>(walkPlayer.yaw);
  const pitchRef = useRef<number>(walkPlayer.pitch);

  // Velocity smoothing
  const velRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Mouse look state
  const isPointerLocked = useRef<boolean>(false);
  const isDraggingMouse = useRef<boolean>(false);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Raycaster for crosshair seat aiming
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const centerScreen = useMemo(() => new THREE.Vector2(0, 0), []);

  // Sync ref when store position changes abruptly (e.g. teleport or stand up)
  const storeX = walkPlayer.position[0];
  const storeY = walkPlayer.position[1];
  const storeZ = walkPlayer.position[2];
  useEffect(() => {
    if (isWalkMode) {
      posRef.current.set(storeX, storeY, storeZ);
      eyeHeightRef.current = walkPlayer.eyeHeight;
      yawRef.current = walkPlayer.yaw;
      pitchRef.current = walkPlayer.pitch;
    }
  }, [isWalkMode, storeX, storeY, storeZ, walkPlayer.eyeHeight, walkPlayer.yaw, walkPlayer.pitch]);

  // Keyboard listeners: auto-repeat safe, ignores when typing in inputs, releases on blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isWalkMode) return;
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      keysDown.current.add(e.code);

      // Stand up / Exit to overview
      if (e.code === 'KeyO') {
        e.preventDefault();
        setMode('overview');
      }

      // Quick interact (Sit in aimed seat)
      if (e.code === 'KeyE' || e.code === 'Enter') {
        const hovered = useCinemaStore.getState().hoveredSeatId;
        if (hovered) {
          e.preventDefault();
          sitAt(hovered);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.current.delete(e.code);
    };

    const handleBlur = () => {
      keysDown.current.clear();
      isDraggingMouse.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleBlur);
    };
  }, [isWalkMode, sitAt, setMode]);

  // Mouse Pointer Lock & Look listeners
  useEffect(() => {
    if (!isWalkMode) return;
    const canvas = gl.domElement;

    const onPointerLockChange = () => {
      isPointerLocked.current = document.pointerLockElement === canvas;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isWalkMode) return;

      if (isPointerLocked.current) {
        const factor = walkSettings.sensitivity;
        const invert = walkSettings.invertY ? -1 : 1;
        yawRef.current -= e.movementX * factor;
        pitchRef.current -= e.movementY * factor * invert;
        pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -1.3, 1.3); // ±75°
      } else if (isDraggingMouse.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };

        const factor = walkSettings.sensitivity * 1.5;
        const invert = walkSettings.invertY ? -1 : 1;
        yawRef.current -= dx * factor;
        pitchRef.current -= dy * factor * invert;
        pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -1.3, 1.3);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!isWalkMode) return;
      if (e.button === 0) {
        // Request pointer lock on click if not locked
        if (!isPointerLocked.current && canvas.requestPointerLock) {
          canvas.requestPointerLock();
        }
        isDraggingMouse.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };

        // Also check if clicking to sit in aimed seat
        const hovered = useCinemaStore.getState().hoveredSeatId;
        if (hovered) {
          sitAt(hovered);
        }
      }
    };

    const onMouseUp = () => {
      isDraggingMouse.current = false;
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isWalkMode, gl, walkSettings, sitAt]);

  // Frame update loop
  useFrame(({ scene }, delta) => {
    if (!isWalkMode) return;

    const clampedDelta = Math.min(delta, 0.1);
    const keys = keysDown.current;

    // 1. Scripted Auto-walk to Seat
    if (autoWalkTarget) {
      const targetSeat = seatMap.get(autoWalkTarget);
      if (targetSeat) {
        const targetEye = new THREE.Vector3(...targetSeat.eye_position_gltf_y_up);
        const dist = posRef.current.distanceTo(targetEye);
        if (dist < 0.8) {
          sitAt(autoWalkTarget);
          return;
        } else {
          // Walk towards seat
          const dir = new THREE.Vector3().subVectors(targetEye, posRef.current).normalize();
          const moveStep = 3.5 * clampedDelta;
          posRef.current.addScaledVector(dir, moveStep);
          camera.position.set(posRef.current.x, posRef.current.y + eyeHeightRef.current, posRef.current.z);
          camera.lookAt(targetEye);
          return;
        }
      }
    }

    // 2. Input movement vector
    let forward = 0;
    let strafe = 0;
    let turn = 0;

    // W / S / Up / Down
    if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;

    // A / D (strafe)
    if (keys.has('KeyA')) strafe -= 1;
    if (keys.has('KeyD')) strafe += 1;

    // Left / Right turn (yaw with arrow keys)
    if (keys.has('ArrowLeft')) turn += 1;
    if (keys.has('ArrowRight')) turn -= 1;

    if (turn !== 0) {
      yawRef.current += turn * 2.2 * clampedDelta;
    }

    const isRunning = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = isRunning ? playerCfg.run_speed : playerCfg.walk_speed;

    // Normalize diagonal movement
    const inputLen = Math.hypot(strafe, forward);
    if (inputLen > 1e-4) {
      strafe /= inputLen;
      forward /= inputLen;
    }

    // Smooth acceleration / deceleration
    const targetVx = strafe * speed;
    const targetVz = forward * speed;
    const accelFactor = 1.0 - Math.exp(-12.0 * clampedDelta);
    velRef.current.x += (targetVx - velRef.current.x) * accelFactor;
    velRef.current.y += (targetVz - velRef.current.y) * accelFactor;

    // World displacement relative to player yaw
    const yaw = yawRef.current;
    // Facing vector: (sin(yaw), 0, cos(yaw))
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);

    // Forward moves in direction of yaw, strafe moves perpendicular (right = (cosY, 0, -sinY))
    const dx = (velRef.current.x * cosY + velRef.current.y * sinY) * clampedDelta;
    const dz = (-velRef.current.x * sinY + velRef.current.y * cosY) * clampedDelta;

    // 3. Step physics with collision & ground following
    if (Math.hypot(dx, dz) > 1e-6) {
      const stepRes = stepPlayer(
        { x: posRef.current.x, y: posRef.current.y, z: posRef.current.z },
        { dx, dz },
        walkables,
        colliders,
        {
          radius: playerCfg.radius,
          maxStepUp: playerCfg.max_step_up,
          maxStepDown: playerCfg.max_step_down,
        }
      );
      posRef.current.set(stepRes.newPos.x, stepRes.newPos.y, stepRes.newPos.z);
    }

    // Boundary clamp with margin for walk player + edge notice
    const walkBounds = {
      minX: -9.2,
      maxX: 9.2,
      minZ: -24.2,
      maxZ: -2.2,
    };
    if (
      posRef.current.x < walkBounds.minX ||
      posRef.current.x > walkBounds.maxX ||
      posRef.current.z < walkBounds.minZ ||
      posRef.current.z > walkBounds.maxZ
    ) {
      useCinemaStore.getState().triggerBoundaryNotice();
      posRef.current.x = THREE.MathUtils.clamp(posRef.current.x, walkBounds.minX, walkBounds.maxX);
      posRef.current.z = THREE.MathUtils.clamp(posRef.current.z, walkBounds.minZ, walkBounds.maxZ);
    }

    // 4. Smooth eye height over tiers
    const targetEyeY = posRef.current.y + playerCfg.standing_eye_height;
    eyeHeightRef.current = smoothEyeHeight(eyeHeightRef.current, targetEyeY, clampedDelta, 14.0);

    // 5. Update Three.js camera pose
    const pitch = pitchRef.current;
    const camX = posRef.current.x;
    const camY = eyeHeightRef.current;
    const camZ = posRef.current.z;

    camera.position.set(camX, camY, camZ);

    // Camera look direction from yaw and pitch
    const lookTarget = new THREE.Vector3(
      camX + Math.sin(yaw) * Math.cos(pitch),
      camY + Math.sin(pitch),
      camZ + Math.cos(yaw) * Math.cos(pitch)
    );
    camera.lookAt(lookTarget);

    // 6. Crosshair seat detection raycast
    raycaster.setFromCamera(centerScreen, camera);
    const seatProxies = scene.getObjectByName('SeatInteractionProxies');
    if (seatProxies) {
      const intersects = raycaster.intersectObjects(seatProxies.children, false);
      const hit = intersects.find((i) => i.distance <= 4.2);
      if (hit && hit.object.userData?.seatId) {
        setHoveredSeat(hit.object.userData.seatId);
      } else {
        setHoveredSeat(null);
      }
    }

    // Update store pose for telemetry/dev bridge
    updateWalkPose([camX, posRef.current.y, camZ], eyeHeightRef.current, yaw, pitch);
  });

  return null;
}
