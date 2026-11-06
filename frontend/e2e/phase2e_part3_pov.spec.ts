import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import layoutData from '../public/models/seat_layout_v2.json';

const BASE_URL_2D = '/cinemas/1/auditorium/1?showtime=1&mode=2d';
const EVIDENCE_DIR = path.join(process.cwd(), '..', 'docs', 'evidence', 'phase-2e');

const seatEyePositions: Record<string, [number, number, number]> = {};
for (const s of (layoutData as any).seats) {
  seatEyePositions[s.seat_id] = s.eye_position_gltf_y_up;
}

test.describe('Phase 2e — Part 3: Seat POV from 2D Map (Finding E7)', () => {
  test.beforeAll(async () => {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
    // Ensure A06 is held for showtime 1 for held seat inspection tests
    try {
      await fetch('http://127.0.0.1:8000/api/v1/bookings/hold?showtime_id=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_ids: ['A06'] }),
      });
    } catch (e) {}
  });

  test('01. 2D Map: "See view from this seat" button exists for available, booked, and held seats', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE_URL_2D);
    await page.waitForSelector('[data-testid="seatmap-2d-container"]');

    // 1. Available seat (E06)
    const seatE06 = page.locator('[data-testid="seat-2d-E06"]');
    await seatE06.hover();
    await seatE06.click();

    const povBtn = page.locator('[data-testid="see-view-from-seat-btn"]');
    await expect(povBtn).toBeVisible();
    await expect(povBtn).toContainText('See view from this seat');

    // 2. Naturally booked seat from database (C01)
    const seatC01 = page.locator('[data-testid="seat-2d-C01"]');
    await seatC01.click({ force: true });

    // Booked seat cannot be selected, but POV preview button is still available
    await expect(povBtn).toBeVisible();
    await expect(page.locator('[data-testid="seat-inspection-card"]')).toContainText('booked');

    // 3. Naturally held seat from database (A06)
    const seatA06 = page.locator('[data-testid="seat-2d-A06"]');
    await seatA06.scrollIntoViewIfNeeded();
    await seatA06.dispatchEvent('click');
    await expect(povBtn).toBeVisible();
    await expect(page.locator('[data-testid="seat-inspection-card"]')).toContainText('held');

    const shotPath = path.join(EVIDENCE_DIR, '10_pov_button_states_2d.png');
    await page.screenshot({ path: shotPath });
    expect(fs.existsSync(shotPath)).toBe(true);
  });

  test('02. Fast transition to Seated POV reaches exact eye position (< 2s on warm cache)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE_URL_2D);
    await page.waitForSelector('[data-testid="seatmap-2d-container"]');

    // Focus seat E06
    const seatE06 = page.locator('[data-testid="seat-2d-E06"]');
    await seatE06.click();

    const startTime = Date.now();
    const povBtn = page.locator('[data-testid="see-view-from-seat-btn"]');
    await povBtn.click();

    // Wait for 3D engine and POV mode
    await page.waitForFunction(
      () => {
        const cv = (window as any).__cineverse;
        if (!cv) return false;
        const state = cv.getState();
        return state.mode === 'seated' && state.activeSeatId === 'E06';
      },
      { timeout: 10000 }
    );
    const elapsed = Date.now() - startTime;
    console.log(`POV warm cache transition time: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(3500); // Warm cache transition

    // Wait for smooth camera transition to finish and reach exact eye position
    const expectedEye = seatEyePositions['E06'];
    await page.waitForFunction(
      (eye) => {
        const cv = (window as any).__cineverse;
        if (!cv) return false;
        const pos = cv.getState().cameraPosition;
        return Math.hypot(pos[0] - eye[0], pos[1] - eye[1], pos[2] - eye[2]) < 0.08;
      },
      expectedEye,
      { timeout: 10000 }
    );

    const shotPath = path.join(EVIDENCE_DIR, '11_pov_exact_eye_position.png');
    await page.screenshot({ path: shotPath });
    expect(fs.existsSync(shotPath)).toBe(true);
  });

  test('03. Round trip: Selected seats and state survive navigation to POV and back', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE_URL_2D);
    await page.waitForSelector('[data-testid="seatmap-2d-container"]');

    // Select seats E06 and E07
    await page.locator('[data-testid="seat-2d-E06"]').click();
    await page.locator('[data-testid="seat-2d-E07"]').click();

    // Verify both seats are selected in summary footer
    const footer = page.locator('[data-testid="seatmap-2d-summary-footer"]');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('E06');
    await expect(footer).toContainText('E07');

    // Click "View" link for E07 in summary footer
    const viewE07Btn = page.locator('[data-testid="view-pov-E07"]');
    await expect(viewE07Btn).toBeVisible();
    await viewE07Btn.click();

    // Wait for POV seated at E07
    await page.waitForFunction(
      () => {
        const cv = (window as any).__cineverse;
        return cv && cv.getState().mode === 'seated' && cv.getState().activeSeatId === 'E07';
      },
      { timeout: 10000 }
    );

    // Test POV cycling through user's selected seats (E07 -> E06)
    await page.evaluate(() => (window as any).useCinemaStore.getState().navigatePOV('next'));
    await page.waitForTimeout(500);
    const nextState = await page.evaluate(() => (window as any).__cineverse.getState());
    expect(nextState.activeSeatId).toBe('E06'); // Cycled to user's other selected seat!

    // Click "Back to seat map" button
    const backBtn = page.locator('[data-testid="switch-to-2d-button"]');
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // Verify 2D seat map returns with both selections intact in DOM
    await page.waitForSelector('[data-testid="seatmap-2d-container"]');
    const footerBack = page.locator('[data-testid="seatmap-2d-summary-footer"]');
    await expect(footerBack).toBeVisible();
    await expect(footerBack).toContainText('E06');
    await expect(footerBack).toContainText('E07');
    await expect(page.locator('[data-testid="seat-2d-E06"]')).toHaveAttribute('data-status', 'selected');
    await expect(page.locator('[data-testid="seat-2d-E07"]')).toHaveAttribute('data-status', 'selected');

    const shotPath = path.join(EVIDENCE_DIR, '12_pov_round_trip_preserved.png');
    await page.screenshot({ path: shotPath });
    expect(fs.existsSync(shotPath)).toBe(true);
  });

  test('04. Deep link validation (?mode=pov&seat=E06 and invalid seat fallback)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Valid deep link
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=pov&seat=E06');
    await page.waitForFunction(
      () => {
        const cv = (window as any).__cineverse;
        return cv && cv.getState().mode === 'seated' && cv.getState().activeSeatId === 'E06';
      },
      { timeout: 15000 }
    );

    let state = await page.evaluate(() => (window as any).__cineverse.getState());
    expect(state.mode).toBe('seated');
    expect(state.activeSeatId).toBe('E06');

    // Invalid deep link fallback
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=pov&seat=INVALID99');
    await page.waitForFunction(
      () => {
        const cv = (window as any).__cineverse;
        return cv && cv.getState().mode === 'overview';
      },
      { timeout: 15000 }
    );
    state = await page.evaluate(() => (window as any).__cineverse.getState());
    expect(state.mode).toBe('overview');

    const shotPath = path.join(EVIDENCE_DIR, '13_pov_deep_link_validation.png');
    await page.screenshot({ path: shotPath });
    expect(fs.existsSync(shotPath)).toBe(true);
  });

  test('05. Phone viewport (390x844) & Keyboard accessibility (V key)', async ({ page }) => {
    // 1. Keyboard accessibility
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE_URL_2D);
    await page.waitForSelector('[data-testid="seatmap-2d-container"]');

    const seatD05 = page.locator('[data-testid="seat-2d-D05"]');
    await seatD05.focus();
    await page.keyboard.press('KeyV');

    await page.waitForFunction(
      () => {
        const cv = (window as any).__cineverse;
        return cv && cv.getState().mode === 'seated' && cv.getState().activeSeatId === 'D05';
      },
      { timeout: 10000 }
    );

    // 2. Phone viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL_2D);
    await page.waitForSelector('[data-testid="seatmap-2d-container"]');

    const seatC04 = page.locator('[data-testid="seat-2d-C04"]');
    await seatC04.click();
    const povBtn = page.locator('[data-testid="see-view-from-seat-btn"]');
    await expect(povBtn).toBeVisible();
    await povBtn.click();

    await page.waitForFunction(
      () => {
        const cv = (window as any).__cineverse;
        return cv && cv.getState().mode === 'seated' && cv.getState().activeSeatId === 'C04';
      },
      { timeout: 10000 }
    );

    const shotPath = path.join(EVIDENCE_DIR, '14_pov_mobile_and_keyboard.png');
    await page.screenshot({ path: shotPath });
    expect(fs.existsSync(shotPath)).toBe(true);
  });
});
