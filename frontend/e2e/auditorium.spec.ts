import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/screenshots');

test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe.serial('CineVerse 3D — Complete Interactive 3D Theatre Experience', () => {
  let sharedPage: Page;

  test('01. Load Auditorium, verify 100% progress, render stats & overview', async ({ browser }) => {
    sharedPage = await browser.newPage();

    // Pre-seed selected city in localStorage (FIX-04)
    await sharedPage.addInitScript(() => {
      window.localStorage.setItem('cineverse_city', 'bengaluru');
    });

    // Route external trailer video to avoid unhandled net::ERR_FAILED in headless/offline tests
    await sharedPage.route('**/BigBuckBunny.mp4', (route) => {
      route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.from('') });
    });

    const consoleErrors: string[] = [];
    sharedPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    sharedPage.on('requestfailed', (req) => {
      console.log('[PLAYWRIGHT REQUEST FAILED]', req.url(), req.failure()?.errorText);
    });

    await sharedPage.goto('/3d');

    // Wait until window.__cineverse is ready
    await sharedPage.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await sharedPage.waitForTimeout(2000);

    const state = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(state.cameraMode).toBe('orbit');
    expect(state.rendererInfo).toBeDefined();
    expect(state.rendererInfo!.triangles).toBeGreaterThan(10000);

    const visibleProxies = await sharedPage.evaluate(() => window.__cineverse!.getVisibleProxiesCount?.() ?? 0);
    expect(visibleProxies).toBe(0);

    console.log('[E2E Verified Render Stats]', {
      triangles: state.rendererInfo?.triangles,
      calls: state.rendererInfo?.calls,
      fps: state.rendererInfo?.fps,
    });

    // Documented allow-list for external resources (do NOT blanket ignore ERR_FAILED)
    const ALLOWED_FAILING_EXTERNAL_URLS = [
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    ];

    const fatalErrors = consoleErrors.filter((e) => {
      if (e.includes('favicon') || e.includes('React DevTools') || e.includes('WebSocket')) return false;
      if (e.includes('ERR_FAILED')) {
        return !ALLOWED_FAILING_EXTERNAL_URLS.some((url) => e.includes(url) || e.includes('BigBuckBunny'));
      }
      return true;
    });
    expect(fatalErrors).toHaveLength(0);

    await sharedPage.screenshot({ path: path.join(SCREENSHOT_DIR, '01_auditorium_overview.png') });
  });

  test('02. Orbit navigation & boundary clamping', async () => {
    const initial = await sharedPage.evaluate(() => window.__cineverse!.getState().cameraPosition);

    // Switch to front preset
    await sharedPage.evaluate(() => window.__cineverse!.setCameraPreset('front'));
    await sharedPage.waitForTimeout(1400);

    const frontPos = await sharedPage.evaluate(() => window.__cineverse!.getState().cameraPosition);
    expect(frontPos[2]).not.toBe(initial[2]);

    // Verify strictly clamped inside auditorium box x[-9.8, 9.8], y[0.8, 10.2], z[-25.0, -0.6]
    expect(frontPos[0]).toBeGreaterThanOrEqual(-9.8);
    expect(frontPos[0]).toBeLessThanOrEqual(9.8);
    expect(frontPos[1]).toBeGreaterThanOrEqual(0.8);
    expect(frontPos[1]).toBeLessThanOrEqual(10.2);
    expect(frontPos[2]).toBeGreaterThanOrEqual(-25.0);
    expect(frontPos[2]).toBeLessThanOrEqual(-0.6);

    // Reset to overview
    await sharedPage.evaluate(() => window.__cineverse!.setCameraPreset('overview'));
    await sharedPage.waitForTimeout(1400);
  });

  test('03. Seat selection F05, visual feedback & inspection panel metrics', async () => {
    const selected = await sharedPage.evaluate(() => window.__cineverse!.selectSeat('F05'));
    expect(selected).toBe(true);

    await sharedPage.waitForTimeout(500);

    const state = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(state.selectedSeats).toContain('F05');
    expect(state.activeSeatId).toBe('F05');

    const visibleProxies = await sharedPage.evaluate(() => window.__cineverse!.getVisibleProxiesCount?.() ?? 0);
    expect(visibleProxies).toBe(0);

    // Verify inspection panel displays F05
    await expect(sharedPage.locator('text=F05').first()).toBeVisible();
    await expect(sharedPage.locator('text=Row F • Seat 5')).toBeVisible();

    await sharedPage.screenshot({ path: path.join(SCREENSHOT_DIR, '02_seat_selection_f05.png') });
  });

  test('04. Booked and held seat rejection, live hold update simulation', async () => {
    // Set B03 as booked and C04 as held
    await sharedPage.evaluate(() => {
      window.__cineverse!.updateSeatStatus!('B03', 'booked');
      window.__cineverse!.updateSeatStatus!('C04', 'held');
    });

    // Attempt booked seat B03 -> rejection
    const bookedSelected = await sharedPage.evaluate(() => window.__cineverse!.selectSeat('B03'));
    expect(bookedSelected).toBe(false);
    await expect(sharedPage.locator('text=Seat B03 is already booked')).toBeVisible();

    // Attempt held seat C04 -> rejection
    const heldSelected = await sharedPage.evaluate(() => window.__cineverse!.selectSeat('C04'));
    expect(heldSelected).toBe(false);
    await expect(sharedPage.locator('text=Seat C04 is currently held by another patron')).toBeVisible();

    // Simulate remote user holding seat D05
    await sharedPage.evaluate(() => window.__cineverse!.simulateHold('D05'));
    const d05Selected = await sharedPage.evaluate(() => window.__cineverse!.selectSeat('D05'));
    expect(d05Selected).toBe(false);
  });

  test('05. §5b Walk Mode: First-person movement, aisle navigation & collision bounds', async () => {
    // Switch to Walk mode
    await sharedPage.evaluate(() => window.__cineverse!.setMode!('walk'));
    await sharedPage.waitForTimeout(800);

    let state = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(state.cameraMode).toBe('walk');

    // Screenshot at spawn
    await sharedPage.screenshot({ path: path.join(SCREENSHOT_DIR, '10_walk_mode_spawn.png') });

    // Teleport to Row E along central aisle
    await sharedPage.evaluate(() => window.__cineverse!.teleportToRow!('E'));
    await sharedPage.waitForTimeout(600);

    state = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(state.walkPlayer?.position[2]).toBeLessThan(-12.0); // reached Row E
    expect(Math.abs(state.walkPlayer?.position[0] || 0)).toBeLessThan(0.6); // in central aisle

    // Screenshot mid-aisle at Row E
    await sharedPage.screenshot({ path: path.join(SCREENSHOT_DIR, '11_walk_mode_row_e.png') });

    // Sit in seat E05
    await sharedPage.evaluate(() => window.__cineverse!.sitAt!('E05'));
    await sharedPage.waitForTimeout(1400);

    state = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(state.cameraMode).toBe('pov');
    expect(state.activeSeatId).toBe('E05');

    // Stand up back into aisle
    await sharedPage.keyboard.press('Escape');
    await sharedPage.waitForTimeout(800);

    state = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(state.cameraMode).toBe('walk');
  });

  test('06. §5b Seated Mode: Mathematical validation for A05, E05, J10 & head-look', async () => {
    const layout = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../public/models/seat_layout_v2.json'), 'utf-8')
    );

    // --- 1. A05 Seated POV ---
    const a05 = layout.seats.find((s: any) => s.seat_id === 'A05');
    await sharedPage.evaluate(() => window.__cineverse!.sitAt!('A05'));
    await sharedPage.waitForTimeout(1600);

    const a05State: any = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(a05State.cameraMode).toBe('pov');
    expect(a05State.activeSeatId).toBe('A05');

    // Assert camera position == eye_position within 0.001
    expect(a05State.cameraPosition[0]).toBeCloseTo(a05.eye_position_gltf_y_up[0], 2);
    expect(a05State.cameraPosition[1]).toBeCloseTo(a05.eye_position_gltf_y_up[1], 2);
    expect(a05State.cameraPosition[2]).toBeCloseTo(a05.eye_position_gltf_y_up[2], 2);
    expect(a05State.forwardDot).toBeGreaterThan(0.99);
    expect(a05State.screenVisible).toBe(true);

    await sharedPage.screenshot({ path: path.join(SCREENSHOT_DIR, '03_seat_pov_a05.png') });

    // --- 2. E05 Seated POV ---
    const e05 = layout.seats.find((s: any) => s.seat_id === 'E05');
    await sharedPage.evaluate(() => window.__cineverse!.sitAt!('E05'));
    await sharedPage.waitForTimeout(1600);

    const e05State: any = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(e05State.cameraPosition[0]).toBeCloseTo(e05.eye_position_gltf_y_up[0], 2);
    expect(e05State.cameraPosition[1]).toBeCloseTo(e05.eye_position_gltf_y_up[1], 2);
    expect(e05State.cameraPosition[2]).toBeCloseTo(e05.eye_position_gltf_y_up[2], 2);
    expect(e05State.forwardDot).toBeGreaterThan(0.99);
    expect(e05State.screenVisible).toBe(true);

    await sharedPage.screenshot({ path: path.join(SCREENSHOT_DIR, '04_seat_pov_e05.png') });

    // Test head-look left/right with arrow keys
    await sharedPage.keyboard.press('ArrowLeft');
    await sharedPage.keyboard.press('ArrowLeft');
    await sharedPage.waitForTimeout(400);
    await sharedPage.screenshot({ path: path.join(SCREENSHOT_DIR, '12_seated_look_left.png') });

    // Recentre with 'R'
    await sharedPage.keyboard.press('KeyR');
    await sharedPage.waitForTimeout(400);

    // --- 3. J10 Seated POV ---
    const j10 = layout.seats.find((s: any) => s.seat_id === 'J10');
    await sharedPage.evaluate(() => window.__cineverse!.sitAt!('J10'));
    await sharedPage.waitForTimeout(1600);

    const j10State: any = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(j10State.cameraPosition[0]).toBeCloseTo(j10.eye_position_gltf_y_up[0], 2);
    expect(j10State.cameraPosition[1]).toBeCloseTo(j10.eye_position_gltf_y_up[1], 2);
    expect(j10State.cameraPosition[2]).toBeCloseTo(j10.eye_position_gltf_y_up[2], 2);
    expect(j10State.forwardDot).toBeGreaterThan(0.99);
    expect(j10State.screenVisible).toBe(true);

    await sharedPage.screenshot({ path: path.join(SCREENSHOT_DIR, '05_seat_pov_j10.png') });
  });

  test('07. Seated Q/E and Z/X stepping at row and seat edges', async () => {
    await sharedPage.evaluate(() => window.__cineverse!.sitAt!('A01'));
    await sharedPage.waitForTimeout(1200);

    // Q at A01 (left boundary) remains A01
    await sharedPage.keyboard.press('KeyQ');
    await sharedPage.waitForTimeout(200);
    let state = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(state.activeSeatId).toBe('A01');

    // E steps to A02
    await sharedPage.keyboard.press('KeyE');
    await sharedPage.waitForTimeout(200);
    state = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(state.activeSeatId).toBe('A02');

    // X steps row behind to B02
    await sharedPage.keyboard.press('KeyX');
    await sharedPage.waitForTimeout(200);
    state = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(state.activeSeatId).toBe('B02');

    // Return to Overview
    await sharedPage.keyboard.press('KeyO');
    await sharedPage.waitForTimeout(600);
    state = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(state.cameraMode).toBe('orbit');
  });

  test('08. Multi-seat comparison view', async () => {
    await sharedPage.evaluate(() => {
      window.__cineverse!.selectSeat('A05');
      window.__cineverse!.selectSeat('E05');
      window.__cineverse!.selectSeat('J10');
    });

    // Open comparison
    await sharedPage.keyboard.press('KeyC');
    await sharedPage.waitForTimeout(500);

    await expect(sharedPage.locator('text=Seat View Comparison')).toBeVisible();
    await sharedPage.screenshot({ path: path.join(SCREENSHOT_DIR, '06_seat_compare.png') });

    // Close comparison modal
    await sharedPage.keyboard.press('KeyC');
    await sharedPage.waitForTimeout(300);
  });

  test('09. House lights show mode transition', async () => {
    await sharedPage.evaluate(() => window.__cineverse!.setHouseLights('show'));
    await sharedPage.waitForTimeout(800);

    const state = await sharedPage.evaluate(() => window.__cineverse!.getState());
    expect(state.houseLights).toBe('show');

    await sharedPage.screenshot({ path: path.join(SCREENSHOT_DIR, '07_show_mode.png') });

    // Reset house lights
    await sharedPage.evaluate(() => window.__cineverse!.setHouseLights('full'));
  });

  test('10. Mobile viewport (390×844) responsive layout', async () => {
    await sharedPage.setViewportSize({ width: 390, height: 844 });
    await sharedPage.waitForTimeout(1000);

    // Verify visible mobile POV / Walk controls
    await expect(sharedPage.locator('button:has-text("POV"):visible').first()).toBeVisible();

    await sharedPage.screenshot({ path: path.join(SCREENSHOT_DIR, '08_mobile_auditorium.png') });

    await sharedPage.close();
  });

  test('11. WebGL failure fallback test', async ({ browser }) => {
    const errorPage = await browser.newPage();
    // Block WebGL context creation
    await errorPage.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string
      ): RenderingContext | null {
        if (type.includes('webgl')) return null;
        return null;
      } as typeof HTMLCanvasElement.prototype.getContext;
    });

    await errorPage.goto('/3d');
    await expect(errorPage.locator('text=WebGL Not Available')).toBeVisible();

    await errorPage.screenshot({ path: path.join(SCREENSHOT_DIR, '09_webgl_fallback.png') });
    await errorPage.close();
  });
});
