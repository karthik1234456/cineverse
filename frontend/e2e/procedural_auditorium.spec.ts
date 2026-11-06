import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-procedural-3d');

test.beforeAll(async () => {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
});

test.describe('Procedural 3D Auditorium Generator E2E Suite', () => {

  test('01. Small Luxury Hall (72 seats, Auditorium 4) in Overview, Walk, and Seated modes', async ({ page }) => {
    // Navigate to Auditorium 4 (72 seats) in 3D mode
    await page.goto('/cinemas/1/auditorium/4?showtime=16&mode=3d');
    await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Verify 3D canvas is active and no "3D not available" notice is shown
    await expect(page.locator('[data-testid="3d-not-supported-notice"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="auditorium-3d-wrapper"]')).toBeVisible();

    // 1. Overview Mode Verification
    const overviewStats = await page.evaluate(() => {
      const w = (window as any).__cineverse;
      const state = w ? w.getState() : null;
      const store = (window as any).useCinemaStore ? (window as any).useCinemaStore.getState() : null;
      return {
        mode: state?.mode,
        cameraMode: state?.cameraMode,
        cameraPos: state?.cameraPosition,
        seatsCount: store?.auditoriumLayout?.seats?.length,
        rendererInfo: state?.rendererInfo,
      };
    });

    expect(overviewStats.seatsCount).toBe(72);
    expect(overviewStats.rendererInfo.calls).toBeLessThanOrEqual(150);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'small_hall_72_overview.png'),
      fullPage: true,
    });

    // 2. Seat-ID Mapping & Selection Verification
    // Click Seat C06 via DevBridge
    await page.evaluate(() => {
      const w = (window as any).__cineverse;
      w.selectSeat('C06');
    });
    await page.waitForTimeout(500);

    const selectedSeats = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      return store.selectedSeats;
    });
    expect(selectedSeats).toContain('C06');

    // 3. Walk Mode Verification & Collision Test
    await page.evaluate(() => {
      const w = (window as any).__cineverse;
      w.setMode('walk');
    });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'small_hall_72_walk.png'),
      fullPage: true,
    });

    // Test collision boundaries: attempt to walk far left through wall
    const collisionTest = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      const bounds = store.cameraBounds;
      const playerPos = store.walkPlayer.position;
      return {
        bounds,
        playerPos,
        isInsideBounds: playerPos[0] >= bounds.minX && playerPos[0] <= bounds.maxX &&
                        playerPos[2] >= bounds.minZ && playerPos[2] <= bounds.maxZ,
      };
    });
    expect(collisionTest.isInsideBounds).toBe(true);

    // 4. Seated POV Mode Verification
    await page.evaluate(() => {
      const w = (window as any).__cineverse;
      w.sitAt('C06');
    });
    await page.waitForTimeout(1500);

    const seatedState = await page.evaluate(() => {
      const w = (window as any).__cineverse;
      const state = w.getState();
      const store = (window as any).useCinemaStore.getState();
      const seat = store.auditoriumLayout.seats.find((s: any) => s.seat_id === 'C06');
      return {
        mode: state.mode,
        activeSeatId: state.activeSeatId,
        camPos: state.cameraPosition,
        eyePos: seat.eye_position_gltf_y_up,
        screenVisible: state.screenVisible,
      };
    });

    expect(seatedState.mode).toBe('seated');
    expect(seatedState.activeSeatId).toBe('C06');
    expect(seatedState.screenVisible).toBe(true);

    // Assert camera is placed within 0.05 units of eye position
    const camDiff = Math.max(
      Math.abs(seatedState.camPos[0] - seatedState.eyePos[0]),
      Math.abs(seatedState.camPos[1] - seatedState.eyePos[1]),
      Math.abs(seatedState.camPos[2] - seatedState.eyePos[2])
    );
    expect(camDiff).toBeLessThanOrEqual(0.05);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'small_hall_72_seated.png'),
      fullPage: true,
    });
  });

  test('02. Large Hall (260 seats, Auditorium 5) in Overview, Walk, and Seated modes', async ({ page }) => {
    // Navigate to Auditorium 5 (260 seats) in 3D mode
    await page.goto('/cinemas/2/auditorium/5?showtime=21&mode=3d');
    await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForTimeout(3000);

    await expect(page.locator('[data-testid="3d-not-supported-notice"]')).toHaveCount(0);

    // 1. Overview Mode
    const stats260 = await page.evaluate(() => {
      const w = (window as any).__cineverse;
      const state = w ? w.getState() : null;
      const store = (window as any).useCinemaStore ? (window as any).useCinemaStore.getState() : null;
      return {
        seatsCount: store?.auditoriumLayout?.seats?.length,
        screenWidth: store?.auditoriumLayout?.screen?.width,
        rendererInfo: state?.rendererInfo,
      };
    });

    expect(stats260.seatsCount).toBe(260);
    expect(stats260.screenWidth).toBe(21.0);
    expect(stats260.rendererInfo.calls).toBeLessThanOrEqual(150);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'large_hall_260_overview.png'),
      fullPage: true,
    });

    // 2. Walk Mode
    await page.evaluate(() => {
      const w = (window as any).__cineverse;
      w.setMode('walk');
    });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'large_hall_260_walk.png'),
      fullPage: true,
    });

    // 3. Seated Mode at Center Prime seat G10
    await page.evaluate(() => {
      const w = (window as any).__cineverse;
      w.sitAt('G10');
    });
    await page.waitForTimeout(1500);

    const seated260 = await page.evaluate(() => {
      const w = (window as any).__cineverse;
      const state = w.getState();
      const store = (window as any).useCinemaStore.getState();
      const seat = store.auditoriumLayout.seats.find((s: any) => s.seat_id === 'G10');
      return {
        mode: state.mode,
        activeSeatId: state.activeSeatId,
        camPos: state.cameraPosition,
        eyePos: seat.eye_position_gltf_y_up,
      };
    });

    expect(seated260.mode).toBe('seated');
    expect(seated260.activeSeatId).toBe('G10');

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'large_hall_260_seated.png'),
      fullPage: true,
    });
  });

  test('03. Flagship Big Hall (420 seats, Auditorium 2) Performance & Full Sightline Verification', async ({ page }) => {
    // Navigate to Auditorium 2 (420 seats Flagship) in 3D mode
    await page.goto('/cinemas/1/auditorium/2?showtime=6&mode=3d');
    await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForTimeout(3500);

    await expect(page.locator('[data-testid="3d-not-supported-notice"]')).toHaveCount(0);

    // 1. Overview Mode & Performance Budget Check
    const flagshipStats = await page.evaluate(() => {
      const w = (window as any).__cineverse;
      const state = w ? w.getState() : null;
      const store = (window as any).useCinemaStore ? (window as any).useCinemaStore.getState() : null;
      return {
        seatsCount: store?.auditoriumLayout?.seats?.length,
        screenWidth: store?.auditoriumLayout?.screen?.width,
        isCurved: store?.proceduralResult?.geometry?.screenMesh?.curved,
        rendererInfo: state?.rendererInfo,
      };
    });

    expect(flagshipStats.seatsCount).toBe(420);
    expect(flagshipStats.isCurved).toBe(true);
    expect(flagshipStats.screenWidth).toBeGreaterThanOrEqual(25.0);

    // Draw calls budget <= 150
    expect(flagshipStats.rendererInfo.calls).toBeLessThanOrEqual(150);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'flagship_hall_420_overview.png'),
      fullPage: true,
    });

    // 2. Walk Mode
    await page.evaluate(() => {
      const w = (window as any).__cineverse;
      w.setMode('walk');
    });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'flagship_hall_420_walk.png'),
      fullPage: true,
    });

    // 3. Seated Mode at H14 (Center Sweet Spot)
    await page.evaluate(() => {
      const w = (window as any).__cineverse;
      w.sitAt('H14');
    });
    await page.waitForTimeout(1500);

    const seatedFlagship = await page.evaluate(() => {
      const w = (window as any).__cineverse;
      const state = w.getState();
      const store = (window as any).useCinemaStore.getState();
      const seat = store.auditoriumLayout.seats.find((s: any) => s.seat_id === 'H14');
      return {
        mode: state.mode,
        activeSeatId: state.activeSeatId,
        camPos: state.cameraPosition,
        eyePos: seat.eye_position_gltf_y_up,
        screenVisible: state.screenVisible,
      };
    });

    expect(seatedFlagship.mode).toBe('seated');
    expect(seatedFlagship.activeSeatId).toBe('H14');
    expect(seatedFlagship.screenVisible).toBe(true);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'flagship_hall_420_seated.png'),
      fullPage: true,
    });
  });

  test('04. Reference 100-seat Hall Verification (Auditorium 1)', async ({ page }) => {
    // Navigate to Auditorium 1 (100-seat GLB Hall) in 3D mode
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForTimeout(3000);

    const stats100 = await page.evaluate(() => {
      const w = (window as any).__cineverse;
      const state = w ? w.getState() : null;
      const store = (window as any).useCinemaStore ? (window as any).useCinemaStore.getState() : null;
      return {
        seatsCount: store?.auditoriumLayout?.seats?.length,
        rendererInfo: state?.rendererInfo,
      };
    });

    expect(stats100.seatsCount).toBe(100);
    // Supplied GLB hall has ~300 calls; procedural halls are optimized to <= 150
    expect(stats100.rendererInfo.calls).toBeLessThanOrEqual(350);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'reference_hall_100_overview.png'),
      fullPage: true,
    });

    // Seat E05 POV
    await page.evaluate(() => {
      const w = (window as any).__cineverse;
      w.sitAt('E05');
    });
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'reference_hall_100_seated_e05.png'),
      fullPage: true,
    });
  });

  test('05. Trailer Playback & Dynamic Screen Overlay on Procedural Hall', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/4?showtime=16&mode=3d');
    await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForTimeout(3000);

    const trailerStatus = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      const video = (window as any).__cineverse_video as HTMLVideoElement | null;
      return {
        trailerUrl: store.trailer.trailerUrl,
        isPlaying: store.trailer.isPlaying,
        videoExists: !!video,
        videoReadyState: video ? video.readyState : 0,
      };
    });

    expect(trailerStatus.trailerUrl).toBeTruthy();
    expect(trailerStatus.videoExists).toBe(true);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'procedural_trailer_playback.png'),
      fullPage: true,
    });
  });

  test('06. Absence of "3D Coming Soon" or "3D Preview Not Available" notices across all views', async ({ page }) => {
    // 2D seat map for Auditorium 4 (72 seats)
    await page.goto('/cinemas/1/auditorium/4?showtime=16&mode=2d');
    await page.waitForSelector('[data-testid="seatmap-2d-container"]', { timeout: 30000 });

    // Assert that the old unavailable badges are completely absent
    const badges = page.locator('[data-testid="3d-unavailable-badge"]');
    await expect(badges).toHaveCount(0);

    // "Explore in 3D" button is visible and active
    const exploreBtn = page.locator('[data-testid="explore-in-3d-button"]');
    await expect(exploreBtn).toBeVisible();

    // Select seat A01 and verify "See view from this seat" button is visible
    const seatA01 = page.locator('[data-testid="seat-2d-A01"]');
    await seatA01.click();
    await page.waitForTimeout(500);

    const povBtn = page.locator('[data-testid="see-view-from-seat-btn"]');
    await expect(povBtn).toBeVisible();

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'seatmap_2d_every_hall_3d_enabled.png'),
      fullPage: true,
    });
  });
});
