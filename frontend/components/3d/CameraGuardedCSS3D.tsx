'use client';

import React, { useRef, useLayoutEffect, useEffect } from 'react';
import * as ReactDOM from 'react-dom/client';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function epsilon(value: number) {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

function getCSSMatrix(matrix: THREE.Matrix4, multipliers: number[], prepend = '') {
  let matrix3d = 'matrix3d(';
  for (let i = 0; i !== 16; i++) {
    matrix3d += epsilon(multipliers[i] * matrix.elements[i]) + (i !== 15 ? ',' : ')');
  }
  return prepend + matrix3d;
}

const cameraMultipliers = [1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1];
function getCameraCSSMatrix(matrix: THREE.Matrix4) {
  return getCSSMatrix(matrix, cameraMultipliers);
}

const scaleMultipliers = (f: number) => [
  1 / f, 1 / f, 1 / f, 1,
  -1 / f, -1 / f, -1 / f, -1,
  1 / f, 1 / f, 1 / f, 1,
  1, 1, 1, 1
];
function getObjectCSSMatrix(matrix: THREE.Matrix4, factor: number) {
  return getCSSMatrix(matrix, scaleMultipliers(factor), 'translate(-50%,-50%)');
}

export interface CameraGuardedCSS3DProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  distanceFactor?: number;
  width?: number;
  height?: number;
  pointerEvents?: 'auto' | 'none';
  zIndex?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * CameraGuardedCSS3D: High-performance 3D HTML container.
 * - Returns a Three.js <group> to R3F reconciler (eliminating "Div is not part of THREE namespace" error).
 * - Mounts a separate ReactDOM.createRoot container in the DOM.
 * - Uses exact CSS3D projection with perspective: ${fov}px and translateZ(${fov}px).
 * - Hides container when behind camera (deltaCamObj.angleTo(camDir) > PI/2) preventing Chrome GPU compositor freeze.
 * - Updates DOM transforms ONLY when the camera or object moves (delta > 0.0001), avoiding
 *   per-frame style recalculations, layout reflows, and React state updates.
 */
export function CameraGuardedCSS3D({
  position = [0, 0, 0],
  rotation = [0, Math.PI, 0],
  distanceFactor = 400,
  width = 1280,
  height = 720,
  pointerEvents = 'auto',
  zIndex = 1,
  className = '',
  children,
}: CameraGuardedCSS3DProps) {
  const { gl, camera, size } = useThree();

  const groupRef = useRef<THREE.Group>(null);
  const rootDivRef = useRef<HTMLDivElement | null>(null);
  const outerDivRef = useRef<HTMLDivElement | null>(null);
  const innerDivRef = useRef<HTMLDivElement | null>(null);
  const reactRootRef = useRef<ReactDOM.Root | null>(null);

  const lastCameraMatrixRef = useRef<THREE.Matrix4>(new THREE.Matrix4());
  const lastObjectMatrixRef = useRef<THREE.Matrix4>(new THREE.Matrix4());
  const lastFovRef = useRef<number>(0);
  const wasVisibleRef = useRef<boolean>(true);
  const needsInitialUpdateRef = useRef<boolean>(true);
  const lastUpdateTimeRef = useRef<number>(0);

  // Initialize DOM nodes matching Drei structure
  useLayoutEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;

    // Root container with perspective (matching Drei's el)
    // Placed strictly behind the 3D canvas (z-index: 0 vs canvas z-index: 1)
    const rootEl = document.createElement('div');
    rootEl.className = 'cineverse-css3d-root';
    rootEl.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${size.width}px;
      height: ${size.height}px;
      pointer-events: none;
      z-index: ${zIndex};
    `;

    // Outer 3D stage with preserve-3d and camera matrix
    const outerEl = document.createElement('div');
    outerEl.className = 'cineverse-css3d-outer';
    outerEl.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${size.width}px;
      height: ${size.height}px;
      transform-style: preserve-3d;
      pointer-events: none;
      will-change: transform;
      backface-visibility: hidden;
    `;

    // Inner element with object matrix and content size
    const innerEl = document.createElement('div');
    innerEl.className = `cineverse-css3d-inner ${className}`;
    innerEl.style.cssText = `
      position: absolute;
      width: ${width}px;
      height: ${height}px;
      transform-origin: 50% 50%;
      pointer-events: ${pointerEvents};
      will-change: transform;
      backface-visibility: hidden;
    `;

    outerEl.appendChild(innerEl);
    rootEl.appendChild(outerEl);

    // Ensure gl canvas is positioned above rootEl
    if (gl.domElement) {
      gl.domElement.style.position = 'absolute';
      gl.domElement.style.top = '0';
      gl.domElement.style.left = '0';
      gl.domElement.style.zIndex = '1';
      parent.insertBefore(rootEl, gl.domElement);
    } else {
      parent.appendChild(rootEl);
    }

    rootDivRef.current = rootEl;
    outerDivRef.current = outerEl;
    innerDivRef.current = innerEl;

    const reactRoot = ReactDOM.createRoot(innerEl);
    reactRootRef.current = reactRoot;
    reactRoot.render(children);

    needsInitialUpdateRef.current = true;

    return () => {
      try {
        reactRoot.unmount();
      } catch {}
      if (rootEl.parentNode) {
        rootEl.parentNode.removeChild(rootEl);
      }
      rootDivRef.current = null;
      outerDivRef.current = null;
      innerDivRef.current = null;
      reactRootRef.current = null;
    };
  }, [gl, zIndex, width, height, pointerEvents, className, size.width, size.height]);

  // Update children when props change
  useEffect(() => {
    if (reactRootRef.current) {
      reactRootRef.current.render(children);
    }
  }, [children]);

  const vCamPos = useRef(new THREE.Vector3());
  const vObjPos = useRef(new THREE.Vector3());
  const vCamDir = useRef(new THREE.Vector3());

  useFrame(() => {
    const root = rootDivRef.current;
    const outer = outerDivRef.current;
    const inner = innerDivRef.current;
    const group = groupRef.current;
    if (!root || !outer || !inner || !group) return;

    const cam = camera as THREE.PerspectiveCamera;
    const camMat = cam.matrixWorld;
    const objMat = group.matrixWorld;

    // Behind-camera culling check (CRITICAL for eliminating compositor freeze during motion)
    vObjPos.current.setFromMatrixPosition(objMat);
    vCamPos.current.setFromMatrixPosition(camMat);
    const deltaCamObj = vObjPos.current.sub(vCamPos.current);
    cam.getWorldDirection(vCamDir.current);
    const isBehindCamera = deltaCamObj.angleTo(vCamDir.current) > (Math.PI / 2);

    if (isBehindCamera) {
      if (wasVisibleRef.current) {
        root.style.display = 'none';
        wasVisibleRef.current = false;
      }
      return;
    } else {
      if (!wasVisibleRef.current) {
        root.style.display = 'block';
        wasVisibleRef.current = true;
        needsInitialUpdateRef.current = true;
      }
    }

    // 30 Hz throttle check: update at most 30 times a second (~33.3ms) (§ Part B.1)
    const now = performance.now();
    if (!needsInitialUpdateRef.current && (now - lastUpdateTimeRef.current < 33.33)) {
      return;
    }

    // Delta threshold check to avoid unnecessary style writes
    let camDiff = 0;
    const lastCam = lastCameraMatrixRef.current.elements;
    const curCam = camMat.elements;
    for (let i = 0; i < 16; i++) {
      camDiff += Math.abs(curCam[i] - lastCam[i]);
    }

    let objDiff = 0;
    const lastObj = lastObjectMatrixRef.current.elements;
    const curObj = objMat.elements;
    for (let i = 0; i < 16; i++) {
      objDiff += Math.abs(curObj[i] - lastObj[i]);
    }

    if (!needsInitialUpdateRef.current && camDiff < 0.0001 && objDiff < 0.0001) {
      return;
    }

    lastUpdateTimeRef.current = now;
    needsInitialUpdateRef.current = false;
    lastCameraMatrixRef.current.copy(camMat);
    lastObjectMatrixRef.current.copy(objMat);

    // Exact Drei mathematical projection
    const widthHalf = size.width / 2;
    const heightHalf = size.height / 2;
    const fov = cam.projectionMatrix.elements[5] * heightHalf;

    if (Math.abs(fov - lastFovRef.current) > 0.01) {
      lastFovRef.current = fov;
      root.style.perspective = `${fov}px`;
    }

    const cameraCSSMatrix = getCameraCSSMatrix(cam.matrixWorldInverse);
    const cameraTransform = `translateZ(${fov}px)`;
    outer.style.transform = `${cameraTransform}${cameraCSSMatrix}translate(${widthHalf}px,${heightHalf}px)`;
    inner.style.transform = getObjectCSSMatrix(objMat, 1 / ((distanceFactor || 10) / 400));
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
    />
  );
}

export default CameraGuardedCSS3D;
