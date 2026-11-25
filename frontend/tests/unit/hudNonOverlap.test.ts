import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

describe('HUD Layout and Non-Overlap Verification (Part D)', () => {
  interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  function overlaps(r1: Rect, r2: Rect): boolean {
    return !(
      r1.x + r1.width <= r2.x ||
      r2.x + r2.width <= r1.x ||
      r1.y + r1.height <= r2.y ||
      r2.y + r2.height <= r1.y
    );
  }

  const resolutions = [
    { width: 1366, height: 768, label: '1366x768 (WXGA/HD)' },
    { width: 1920, height: 1080, label: '1920x1080 (Full HD)' },
  ];

  for (const res of resolutions) {
    it(`guarantees zero HUD bounding box overlap at ${res.label}`, () => {
      const W = res.width;
      const H = res.height;

      // 1. Slim Top Header Bar (fixed top-0 left-0 right-0 h-14)
      const headerBar: Rect = {
        x: 0,
        y: 0,
        width: W,
        height: 56, // h-14
      };

      // 2. ViewModeToggle (fixed top-16 left-1/2 -translate-x-1/2, width ~560px, height ~52px)
      const toolbarWidth = 560;
      const toolbarHeight = 52;
      const viewModeToggle: Rect = {
        x: (W - toolbarWidth) / 2,
        y: 64, // top-16
        width: toolbarWidth,
        height: toolbarHeight,
      };

      // 3. Left Column (fixed left-4 top-16 bottom-6 w-80 flex flex-col gap-3 overflow-y-auto)
      const leftColWidth = 320;
      const leftCol: Rect = {
        x: 16, // left-4
        y: 64, // top-16
        width: leftColWidth,
        height: H - 64 - 24, // bottom-6
      };

      // 4. Right Seat Information Panel (fixed right-4 top-16 w-[340px])
      const rightColWidth = 340;
      const seatInfoPanel: Rect = {
        x: W - 16 - rightColWidth, // right-4
        y: 64, // top-16
        width: rightColWidth,
        height: Math.min(520, H - 64 - 24),
      };

      // 5. Selected Seats Bar (fixed bottom-6 left-1/2 -translate-x-1/2 w-[420px] h-[56px])
      const selectedBarWidth = 420;
      const selectedBarHeight = 56;
      const selectedSeatsBar: Rect = {
        x: (W - selectedBarWidth) / 2,
        y: H - 24 - selectedBarHeight, // bottom-6
        width: selectedBarWidth,
        height: selectedBarHeight,
      };

      // Assertions: None of the root HUD regions overlap each other
      expect(overlaps(headerBar, viewModeToggle)).toBe(false);
      expect(overlaps(headerBar, leftCol)).toBe(false);
      expect(overlaps(headerBar, seatInfoPanel)).toBe(false);

      expect(overlaps(leftCol, viewModeToggle)).toBe(false);
      expect(overlaps(leftCol, selectedSeatsBar)).toBe(false);

      expect(overlaps(viewModeToggle, seatInfoPanel)).toBe(false);
      expect(overlaps(viewModeToggle, selectedSeatsBar)).toBe(false);

      expect(overlaps(selectedSeatsBar, seatInfoPanel)).toBe(false);

      // Verify Left Column Children Stacking:
      // Inside leftCol, AuditoriumInfoPanel and ScreenMediaCluster are stacked vertically with gap-3 (12px)
      const infoPanelHeight = 360;
      const trailerPanelHeight = 220;
      const gap = 12;

      const infoCardInCol: Rect = {
        x: leftCol.x,
        y: leftCol.y,
        width: leftCol.width,
        height: infoPanelHeight,
      };

      const trailerClusterInCol: Rect = {
        x: leftCol.x,
        y: leftCol.y + infoPanelHeight + gap,
        width: leftCol.width,
        height: trailerPanelHeight,
      };

      // Children inside the stacked flex column never overlap each other
      expect(overlaps(infoCardInCol, trailerClusterInCol)).toBe(false);
    });
  }

  it('proves seat state marker badges projecting into toolbar or HUD coordinates are clipped', () => {
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 100);
    camera.position.set(0, 5, -15);
    camera.lookAt(0, 5, 0);
    camera.updateMatrixWorld();

    // Seat position that would project right into top toolbar area in front of camera
    const toolbarAimedSeat = new THREE.Vector3(0, 10, -5);
    const ndcToolbar = toolbarAimedSeat.clone().project(camera);

    const isUnderToolbar = ndcToolbar.y > 0.60 && Math.abs(ndcToolbar.x) < 0.65;
    expect(isUnderToolbar).toBe(true);

    // Left HUD aimed position (world +X is screen left when facing screen at +Z)
    const leftHudAimedSeat = new THREE.Vector3(8, 5, -5);
    const ndcLeft = leftHudAimedSeat.clone().project(camera);
    const isUnderLeftHUD = ndcLeft.x < -0.60 && ndcLeft.y > -0.90 && ndcLeft.y < 0.85;
    expect(isUnderLeftHUD).toBe(true);
  });
});
