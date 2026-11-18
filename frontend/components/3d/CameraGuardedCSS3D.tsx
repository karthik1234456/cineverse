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
  const outerDivRef = useRef<HTMLDivElement | null>(null);
  const innerDivRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<ReactDOM.Root | null>(null);

  const lastCameraMatrixRef = useRef<THREE.Matrix4>(new THREE.Matrix4());
  const lastObjectMatrixRef = useRef<THREE.Matrix4>(new THREE.Matrix4());
  const needsInitialUpdateRef = useRef<boolean>(true);

  // Initialize DOM nodes and ReactDOM Root
  useLayoutEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;

    const outer = document.createElement('div');
    outer.className = 'cineverse-css3d-outer';
    outer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
      transform-style: preserve-3d;
      z-index: ${zIndex};
    `;

    const inner = document.createElement('div');
    inner.className = `cineverse-css3d-inner ${className}`;
    inner.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${width}px;
      height: ${height}px;
      transform-origin: 50% 50%;
      pointer-events: ${pointerEvents};
    `;

    outer.appendChild(inner);
    parent.appendChild(outer);

    outerDivRef.current = outer;
    innerDivRef.current = inner;

    const reactRoot = ReactDOM.createRoot(inner);
    rootRef.current = reactRoot;
    reactRoot.render(children);

    needsInitialUpdateRef.current = true;

    return () => {
      try {
        reactRoot.unmount();
      } catch {}
      if (outer.parentNode) {
        outer.parentNode.removeChild(outer);
      }
      outerDivRef.current = null;
      innerDivRef.current = null;
      rootRef.current = null;
    };
  }, [gl, zIndex, width, height, pointerEvents, className]);

  // Update children when props change
  useEffect(() => {
    if (rootRef.current) {
      rootRef.current.render(children);
    }
  }, [children]);

  // Frame update with camera delta threshold check
  useFrame(() => {
    const outer = outerDivRef.current;
    const inner = innerDivRef.current;
    const group = groupRef.current;
    if (!outer || !inner || !group) return;

    const cam = camera as THREE.PerspectiveCamera;
    const camMat = cam.matrixWorld;
    const objMat = group.matrixWorld;

    // Check camera delta
    let camDiff = 0;
    const lastCam = lastCameraMatrixRef.current.elements;
    const curCam = camMat.elements;
    for (let i = 0; i < 16; i++) {
      camDiff += Math.abs(curCam[i] - lastCam[i]);
    }

    // Check object delta
    let objDiff = 0;
    const lastObj = lastObjectMatrixRef.current.elements;
    const curObj = objMat.elements;
    for (let i = 0; i < 16; i++) {
      objDiff += Math.abs(curObj[i] - lastObj[i]);
    }

    // Skip update if neither camera nor object moved and not initial update
    if (!needsInitialUpdateRef.current && camDiff < 0.0001 && objDiff < 0.0001) {
      return;
    }

    needsInitialUpdateRef.current = false;
    lastCameraMatrixRef.current.copy(camMat);
    lastObjectMatrixRef.current.copy(objMat);

    // Apply transform directly to DOM elements (never through React state)
    const fov = cam.projectionMatrix.elements[5] * (size.height / 2);
    const widthHalf = size.width / 2;
    const heightHalf = size.height / 2;

    const cameraCSSMatrix = `scale(${fov}) translateZ(${fov}px) ${getCameraCSSMatrix(cam.matrixWorldInverse)}`;
    outer.style.transform = `${cameraCSSMatrix} translate(${widthHalf}px,${heightHalf}px)`;
    inner.style.transform = getObjectCSSMatrix(objMat, 1 / (distanceFactor / 400));
  });

  // Return a Three.js group element to the R3F scene tree
  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
    />
  );
}

export default CameraGuardedCSS3D;
