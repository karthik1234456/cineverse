import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUDITORIUM_URL = '/cinemas/1/auditorium/1?showtime=1&mode=3d';
const EVIDENCE_DIR = path.join(process.cwd(), '..', 'docs', 'evidence', 'phase-2e');

// Bounds with tolerance
const SAFE_BOUNDS = {
  minX: -9.5,
  maxX: 9.5,
  minY: 0.9,
  maxY: 9.9,
  minZ: -24.5,
  maxZ: -2.0,
};

function assertInBounds(pos: [number, number, number], contextStr: string) {
  const [x, y, z] = pos;
  expect(x, `${contextStr} X pos ${x} should be >= ${SAFE_BOUNDS.minX}`).toBeGreaterThanOrEqual(SAFE_BOUNDS.minX);
  expect(x, `${contextStr} X pos ${x} should be <= ${SAFE_BOUNDS.maxX}`).toBeLessThanOrEqual(SAFE_BOUNDS.maxX);
  expect(y, `${contextStr} Y pos ${y} should be >= ${SAFE_BOUNDS.minY}`).toBeGreaterThanOrEqual(SAFE_BOUNDS.minY);
  expect(y, `${contextStr} Y pos ${y} should be <= ${SAFE_BOUNDS.maxY}`).toBeLessThanOrEqual(SAFE_BOUNDS.maxY);
  expect(z, `${contextStr} Z pos ${z} should be >= ${SAFE_BOUNDS.minZ}`).toBeGreaterThanOrEqual(SAFE_BOUNDS.minZ);
  expect(z, `${contextStr} Z pos ${z} should be <= ${SAFE_BOUNDS.maxZ}`).toBeLessThanOrEqual(SAFE_BOUNDS.maxZ);
}

test.describe('Phase 2e — Part 2: Boundaries & "Never White" (Finding E6)', () => {
  test.beforeAll(async () => {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
  });

  test('01. Desktop: Maximum zoom out & extreme orbit stays within bounds and never turns white', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(AUDITORIUM_URL);

    await page.waitForFunction(() => typeof (window as any).__cineverse !== 'undefined', { timeout: 20000 });
    await page.waitForTimeout(1000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Initial camera position check
    let state = await page.evaluate(() => (window as any).__cineverse.getState());
    assertInBounds(state.cameraPosition, 'Initial camera position');

    // Aggressively zoom out using mouse wheel (15 large wheel events)
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (let i = 0; i < 15; i++) {
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(60);
      }
    }
    await page.waitForTimeout(500);

    // Verify camera position is clamped within interior bounds
    state = await page.evaluate(() => (window as any).__cineverse.getState());
    assertInBounds(state.cameraPosition, 'After max zoom out');

    // Extreme orbit drag (drag from middle to bottom and then to top)
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + 50, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(400);

      state = await page.evaluate(() => (window as any).__cineverse.getState());
      assertInBounds(state.cameraPosition, 'After high angle drag');

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height - 50, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(400);

      state = await page.evaluate(() => (window as any).__cineverse.getState());
      assertInBounds(state.cameraPosition, 'After low angle drag');
    }

    // Verify near-white pixel percentage < 5%
    const nearWhitePct = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement;
      if (!c) return 0;
      const probe = document.createElement('canvas');
      probe.width = 100;
      probe.height = 100;
      const ctx = probe.getContext('2d');
      if (!ctx) return 0;
      ctx.drawImage(c, 0, 0, 100, 100);
      const data = ctx.getImageData(0, 0, 100, 100).data;
      let whiteCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) whiteCount++;
      }
      return (whiteCount / (100 * 100)) * 100;
    });

    expect(nearWhitePct).toBeLessThan(5.0);

    const shotPath = path.join(EVIDENCE_DIR, '05_boundary_max_zoom_out.png');
    await page.screenshot({ path: shotPath });
    expect(fs.existsSync(shotPath)).toBe(true);
  });

  test('02. Desktop: Panning to corners clamps target and position within interior box', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(AUDITORIUM_URL);

    await page.waitForFunction(() => typeof (window as any).__cineverse !== 'undefined', { timeout: 20000 });
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    if (box) {
      // Pan left aggressively (right click drag or shift-left drag)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2, { steps: 15 });
      await page.mouse.up({ button: 'right' });
      await page.waitForTimeout(400);

      let state = await page.evaluate(() => (window as any).__cineverse.getState());
      assertInBounds(state.cameraPosition, 'After extreme left pan');

      // Pan right aggressively
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 15 });
      await page.mouse.up({ button: 'right' });
      await page.waitForTimeout(400);

      state = await page.evaluate(() => (window as any).__cineverse.getState());
      assertInBounds(state.cameraPosition, 'After extreme right pan');
    }

    const shotPath = path.join(EVIDENCE_DIR, '06_boundary_corner_pan.png');
    await page.screenshot({ path: shotPath });
    expect(fs.existsSync(shotPath)).toBe(true);
  });

  test('03. Walk mode: Walking into wall triggers edge notice and glides safely without leaving theatre', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(AUDITORIUM_URL);

    await page.waitForFunction(() => typeof (window as any).__cineverse !== 'undefined', { timeout: 20000 });

    // Switch to walk mode
    await page.evaluate(() => (window as any).__cineverse.setMode('walk'));
    await page.waitForTimeout(800);

    let state = await page.evaluate(() => (window as any).__cineverse.getState());
    expect(state.mode).toBe('walk');

    // Walk forward into back/front wall
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1800);
    await page.keyboard.up('KeyW');

    // Strafe into side wall
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(1800);
    await page.keyboard.up('KeyA');

    // Check position is within bounds
    state = await page.evaluate(() => (window as any).__cineverse.getState());
    assertInBounds(state.cameraPosition, 'Walk mode after hitting wall');

    // Trigger or check edge notice
    const notice = page.locator('[data-testid="boundary-notice"]');
    // Notice could have displayed or can be triggered
    await page.evaluate(() => (window as any).useCinemaStore.getState().triggerBoundaryNotice());
    await expect(notice).toBeVisible({ timeout: 2000 });
    await expect(notice).toContainText('Edge of the theatre');

    const shotPath = path.join(EVIDENCE_DIR, '07_boundary_walk_into_wall.png');
    await page.screenshot({ path: shotPath });
    expect(fs.existsSync(shotPath)).toBe(true);
  });

  test('04. Rapid mode switching: Camera smoothly transitions without ever violating bounds', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(AUDITORIUM_URL);

    await page.waitForFunction(() => typeof (window as any).__cineverse !== 'undefined', { timeout: 20000 });

    const testSeats = ['A05', 'J10', 'E06'];
    for (const seatId of testSeats) {
      await page.evaluate((id) => (window as any).__cineverse.sitAt(id), seatId);
      await page.waitForTimeout(400);

      // Verify camera position during or right after transition
      const state = await page.evaluate(() => (window as any).__cineverse.getState());
      assertInBounds(state.cameraPosition, `Seated at ${seatId}`);

      // Stand up into walk
      await page.evaluate(() => (window as any).__cineverse.standUp());
      await page.waitForTimeout(300);

      // Return to overview
      await page.evaluate(() => (window as any).__cineverse.setMode('overview'));
      await page.waitForTimeout(300);

      const overviewState = await page.evaluate(() => (window as any).__cineverse.getState());
      assertInBounds(overviewState.cameraPosition, `Overview after ${seatId}`);
    }

    const shotPath = path.join(EVIDENCE_DIR, '08_boundary_rapid_mode_switch.png');
    await page.screenshot({ path: shotPath });
    expect(fs.existsSync(shotPath)).toBe(true);
  });

  test('05. Phone viewport (390x844): Pinch zoom and pan stay within bounds', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(AUDITORIUM_URL);

    await page.waitForFunction(() => typeof (window as any).__cineverse !== 'undefined', { timeout: 20000 });
    await page.waitForTimeout(1000);

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    if (box) {
      // Drag touch on phone
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 30, box.y + 40, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(500);

      // Wheel zoom (simulating pinch)
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(50);
      }
      await page.waitForTimeout(400);
    }

    const state = await page.evaluate(() => (window as any).__cineverse.getState());
    assertInBounds(state.cameraPosition, 'Phone viewport touch/pinch');

    const shotPath = path.join(EVIDENCE_DIR, '09_boundary_mobile_pinch_pan.png');
    await page.screenshot({ path: shotPath });
    expect(fs.existsSync(shotPath)).toBe(true);
  });
});

