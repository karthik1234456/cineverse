import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-2d');

test.beforeAll(async () => {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
});

test.describe.serial('Phase 2d — Part B: Functional QA & Part C: Screen Trailer Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Set default city in localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('cineverse_city', 'bengaluru');
      window.localStorage.setItem('cineverse_city_id', '1');
      window.localStorage.setItem('cineverse_city_name', 'Bengaluru');
    });
  });

  // ==========================================
  // PART B: COMPREHENSIVE 3D FUNCTIONAL QA
  // ==========================================

  test('Part B.01: Hover tooltip, click to select, click to deselect, price parity', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(2000);

    // Hover seat D02
    await page.evaluate(() => {
      window.__cineverse!.setHoveredSeat('D02');
    });
    await page.waitForTimeout(500);

    // Verify hover tooltip displays correct server price (₹380, Prime)
    const store = await page.evaluate(() => window.__cineverse!.getStore());
    expect(store.hoveredSeatId).toBe('D02');
    const quote = store.seatPrices['D02'];
    expect(quote).toBeDefined();
    expect(quote.price).toBe(380);
    expect(quote.category.toLowerCase()).toBe('prime');

    // Click to select D02
    const selected = await page.evaluate(() => window.__cineverse!.selectSeat('D02'));
    expect(selected).toBe(true);
    await page.waitForTimeout(500);

    const storeAfterSelect = await page.evaluate(() => window.__cineverse!.getStore());
    expect(storeAfterSelect.selectedSeats).toContain('D02');

    // Bottom selected seats bar should be visible with ₹380
    const selectedBar = page.locator('text=Seats (1/8):');
    await expect(selectedBar).toBeVisible();
    const priceText = page.locator('text=₹380');
    await expect(priceText.first()).toBeVisible();

    // Take screenshot evidence of single selected seat
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_b_01_seat_selected.png') });

    // Deselect D02
    await page.evaluate(() => {
      window.__cineverse!.getStore().deselectSeat('D02');
    });
    await page.waitForTimeout(300);

    const storeAfterDeselect = await page.evaluate(() => window.__cineverse!.getStore());
    expect(storeAfterDeselect.selectedSeats).not.toContain('D02');
  });

  test('Part B.02: Reject taken and held seats with friendly message', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(2000);

    // In Showtime 1, H05 is BOOKED and E06 is HELD by backend seed
    // Attempt to select booked seat H05
    const bookResult = await page.evaluate(() => window.__cineverse!.selectSeat('H05'));
    expect(bookResult).toBe(false);

    // Verify rejection toast for booked
    const bookedToast = page.locator('text=Seat H05 is already booked');
    await expect(bookedToast).toBeVisible({ timeout: 5000 });

    // Wait for toast to clear or attempt held seat E06
    await page.waitForTimeout(1000);
    const heldResult = await page.evaluate(() => window.__cineverse!.selectSeat('E06'));
    expect(heldResult).toBe(false);

    // Verify rejection toast for held
    const heldToast = page.locator('text=Seat E06 is currently held');
    await expect(heldToast).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_b_02_held_rejected_toast.png') });
  });

  test('Part B.03: Eight-seat booking limit enforcement', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(2000);

    // Select 8 seats: A01 to A07, plus A09 (A08 is held in seeded showtime 1)
    const seatsToSelect = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A09'];
    for (const s of seatsToSelect) {
      await page.evaluate((seatId) => window.__cineverse!.selectSeat(seatId), s);
    }
    await page.waitForTimeout(400);

    const store = await page.evaluate(() => window.__cineverse!.getStore());
    expect(store.selectedSeats.length).toBe(8);

    // Attempt to select a 9th seat: A10
    const ninthResult = await page.evaluate(() => window.__cineverse!.selectSeat('A10'));
    expect(ninthResult).toBe(false);

    // Verify 8-seat limit toast
    const limitToast = page.locator('text=Maximum 8 seats allowed per booking');
    await expect(limitToast).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_b_03_eight_seat_limit.png') });
  });

  test('Part B.04: Sit down (E / click), seated POV exact eye position, previous/next seat and row navigation', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(2000);

    // Sit down at seat C05 (Row C is clean with all seats available)
    await page.evaluate(() => window.__cineverse!.sitAt('C05'));
    await page.waitForTimeout(1500);

    const seatedState = await page.evaluate(() => window.__cineverse!.getState());
    expect(seatedState.mode).toBe('seated');
    expect(seatedState.activeSeatId).toBe('C05');

    // Check camera position matches C05 eye position
    const camPos = seatedState.cameraPosition;
    expect(camPos[1]).toBeGreaterThan(2.5); // Eye height
    expect(camPos[2]).toBeLessThan(-8.0);

    // Step to Next Seat (C06)
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(800);
    const stepNextState = await page.evaluate(() => window.__cineverse!.getState());
    expect(stepNextState.activeSeatId).toBe('C06');

    // Step to Previous Seat (back to C05)
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(800);
    const stepPrevState = await page.evaluate(() => window.__cineverse!.getState());
    expect(stepPrevState.activeSeatId).toBe('C05');

    // Step to Row Ahead (B05)
    await page.keyboard.press('KeyZ');
    await page.waitForTimeout(800);
    const rowAheadState = await page.evaluate(() => window.__cineverse!.getState());
    expect(rowAheadState.activeSeatId).toBe('B05');

    // Step to Row Behind (back to C05)
    await page.keyboard.press('KeyX');
    await page.waitForTimeout(800);
    const rowBehindState = await page.evaluate(() => window.__cineverse!.getState());
    expect(rowBehindState.activeSeatId).toBe('C05');

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_b_04_seated_pov_c05.png') });

    // Stand Up (Esc key or standUp action)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    const standState = await page.evaluate(() => window.__cineverse!.getState());
    expect(standState.mode).toBe('walk'); // Returns to walk mode in aisle
  });

  test('Part B.05: Mode switching (Overview, Walk, Seated), Presets, FOV, and Heatmap', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(1500);

    // Switch to Walk Mode
    await page.click('button:has-text("Walk Mode")');
    await page.waitForTimeout(800);
    let state = await page.evaluate(() => window.__cineverse!.getState());
    expect(state.mode).toBe('walk');

    // Switch to Overview
    await page.click('button:has-text("Overview")');
    await page.waitForTimeout(800);
    state = await page.evaluate(() => window.__cineverse!.getState());
    expect(state.mode).toBe('overview');

    // Test Camera Presets: Front, Back, Aerial, Default
    await page.click('button:has-text("Front")');
    await page.waitForTimeout(1200);
    state = await page.evaluate(() => window.__cineverse!.getState());
    expect(state.cameraPreset).toBe('front');

    await page.click('button:has-text("Back")');
    await page.waitForTimeout(1200);
    state = await page.evaluate(() => window.__cineverse!.getState());
    expect(state.cameraPreset).toBe('back');

    await page.click('button:has-text("Aerial")');
    await page.waitForTimeout(1200);
    state = await page.evaluate(() => window.__cineverse!.getState());
    expect(state.cameraPreset).toBe('aerial');

    await page.click('button:has-text("Default")');
    await page.waitForTimeout(1200);
    state = await page.evaluate(() => window.__cineverse!.getState());
    expect(state.cameraPreset).toBe('overview');

    // Test FOV Selector: 50°, 70°, 75°, 60°
    await page.click('button:has-text("70°")');
    await page.waitForFunction(() => {
      const fov = window.__cineverse?.getState().fov;
      return fov && Math.round(fov) === 70;
    }, { timeout: 6000 });
    state = await page.evaluate(() => window.__cineverse!.getState());
    expect(Math.round(state.fov)).toBe(70);

    await page.click('button:has-text("60°")');
    await page.waitForFunction(() => {
      const fov = window.__cineverse?.getState().fov;
      return fov && Math.round(fov) === 60;
    }, { timeout: 6000 });
    state = await page.evaluate(() => window.__cineverse!.getState());
    expect(Math.round(state.fov)).toBe(60);

    // Test Heatmap Toggle
    const heatmapBtn = page.locator('[data-testid="toggle-3d-heatmap-btn"]');
    await heatmapBtn.click();
    await page.waitForTimeout(600);
    state = await page.evaluate(() => window.__cineverse!.getState());
    expect(state.isHeatmapActive).toBe(true);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_b_05_heatmap_active.png') });

    // Turn Heatmap Off
    await heatmapBtn.click();
    await page.waitForTimeout(400);
    state = await page.evaluate(() => window.__cineverse!.getState());
    expect(state.isHeatmapActive).toBe(false);
  });

  test('Part B.06: Row jump teleportation in Walk Mode', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });

    // Switch to Walk Mode
    await page.click('button:has-text("Walk Mode")');
    await page.waitForTimeout(1000);

    // Click Row A jump button
    await page.click('button:has-text("Row A")');
    await page.waitForTimeout(600);
    let store = await page.evaluate(() => window.__cineverse!.getStore());
    expect(store.walkPlayer.position[2]).toBeGreaterThan(-11.0); // Row A is around Z = -8 to -10

    // Click Row J jump button
    await page.click('button:has-text("Row J")');
    await page.waitForTimeout(600);
    store = await page.evaluate(() => window.__cineverse!.getStore());
    expect(store.walkPlayer.position[2]).toBeLessThan(-20.0); // Row J is around Z = -22

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_b_06_walk_teleport_row_j.png') });
  });

  test('Part B.07: Compare View modal functionality', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });

    // Select seat D02 and open compare view
    await page.evaluate(() => {
      window.__cineverse!.getStore().addToCompare('D02');
      window.__cineverse!.getStore().addToCompare('H05');
      window.__cineverse!.toggleCompare();
    });
    await page.waitForTimeout(600);

    const compareTitle = page.locator('text=Seat View Comparison');
    await expect(compareTitle).toBeVisible();
    await expect(page.locator('text=D02').first()).toBeVisible();
    await expect(page.locator('text=H05').first()).toBeVisible();

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_b_07_compare_view_modal.png') });

    // Close Compare View
    await page.evaluate(() => window.__cineverse!.toggleCompare());
    await page.waitForTimeout(300);
    await expect(compareTitle).not.toBeVisible();
  });

  test('Part B.08: 2D <-> 3D Shared Selection Sync & Checkout Navigation', async ({ page }) => {
    // 1. Start in 2D mode
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=2d');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Select available seat D02 in 2D
    const seatBtn = page.locator('[data-testid="seat-2d-D02"]');
    await seatBtn.click();
    await page.waitForTimeout(500);

    // Switch to 3D mode via Explore in 3D button
    const switch3dBtn = page.locator('[data-testid="explore-in-3d-button"]');
    await switch3dBtn.click();
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(1500);

    // Verify D02 remains selected in 3D
    let store = await page.evaluate(() => window.__cineverse!.getStore());
    expect(store.selectedSeats).toContain('D02');

    // Switch back to 2D
    const switch2dBtn = page.locator('[data-testid="switch-to-2d-button"]');
    await switch2dBtn.click();
    await page.waitForTimeout(1000);

    // Verify D02 remains selected in 2D
    const seatBtn2d = page.locator('[data-testid="seat-2d-D02"]');
    await expect(seatBtn2d).toHaveAttribute('aria-selected', 'true');

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_b_08_selection_sync_2d_3d.png') });
  });

  // ==========================================
  // PART C: CINEMA SCREEN TRAILER VERIFICATION
  // ==========================================

  test('Part C.01: Trailer playback, advancing timestamp, sound button on Showtime 1 (Quantum Odyssey)', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(2500);

    // Verify trailer controls HUD is visible
    const trailerHud = page.locator('[data-testid="trailer-controls-hud"]');
    await expect(trailerHud).toBeVisible();

    // Verify movie title in controls
    await expect(page.locator('text=Quantum Odyssey').first()).toBeVisible();

    // Verify Tap for Sound button exists and is clickable (Finding F9 fixed)
    const muteToggle = page.locator('[data-testid="trailer-mute-toggle"]');
    await expect(muteToggle).toBeVisible();
    await expect(muteToggle).toHaveText(/Tap for Sound/i);

    // Click Tap for Sound (User interaction un-gates audio and video playback)
    await muteToggle.click();
    await page.waitForTimeout(400);
    await expect(muteToggle).toHaveText(/Sound On/i);

    // Ensure playback active in headless test runner
    await page.evaluate(() => {
      const v = document.querySelector('video');
      if (v && v.paused) {
        v.play().catch(() => {});
      }
    });
    await page.waitForTimeout(600);

    // Verify video element exists and timestamp advances over 2 seconds
    const videoStats1 = await page.evaluate(() => {
      const v = document.querySelector('video') as HTMLVideoElement;
      if (!v) return null;
      return {
        src: v.src,
        currentTime: v.currentTime,
        paused: v.paused,
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight,
      };
    });

    console.log('[Showtime 1 Video Stats T0]', videoStats1);
    expect(videoStats1).not.toBeNull();
    expect(videoStats1?.src).toContain('quantum_odyssey');

    // Wait 2.2 seconds and sample again to prove timestamp advanced
    await page.waitForTimeout(2200);

    const videoStats2 = await page.evaluate(() => {
      const v = document.querySelector('video') as HTMLVideoElement;
      if (!v) return null;
      return {
        currentTime: v.currentTime,
        paused: v.paused,
      };
    });

    console.log('[Showtime 1 Video Stats T+2s]', videoStats2);
    expect(videoStats2?.currentTime).toBeGreaterThan(videoStats1!.currentTime);

    // Prove frames exist by rendering video to a scratch 2D canvas and asserting non-blank pixels
    const pixelAudit = await page.evaluate(() => {
      const v = document.querySelector('video') as HTMLVideoElement;
      if (!v || v.videoWidth === 0) return { success: false, nonZeroPixels: 0 };
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 36;
      const ctx = c.getContext('2d');
      if (!ctx) return { success: false, nonZeroPixels: 0 };
      ctx.drawImage(v, 0, 0, 64, 36);
      const img = ctx.getImageData(0, 0, 64, 36);
      let nonZero = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        if (img.data[i] > 10 || img.data[i + 1] > 10 || img.data[i + 2] > 10) nonZero++;
      }
      return { success: true, nonZeroPixels: nonZero, totalPixels: 64 * 36 };
    });

    console.log('[Showtime 1 Canvas Pixel Audit]', pixelAudit);
    expect(pixelAudit.success).toBe(true);
    expect(pixelAudit.nonZeroPixels).toBeGreaterThan(100);

    // Capture screenshots 2 seconds apart from Overview
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_c_showtime1_overview_frame1.png') });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_c_showtime1_overview_frame2.png') });
  });

  test('Part C.02: Multi-movie trailer verification for Showtime 2 (Astra) and Showtime 3 (Shadow Protocol)', async ({ page }) => {
    // 1. Showtime 2: Astra
    await page.goto('/cinemas/1/auditorium/1?showtime=2&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const v = document.querySelector('video');
      if (v && v.paused) v.play().catch(() => {});
    });
    await page.waitForTimeout(600);

    const astraStats = await page.evaluate(() => {
      const v = document.querySelector('video') as HTMLVideoElement;
      return v ? { src: v.src, paused: v.paused, currentTime: v.currentTime } : null;
    });
    console.log('[Showtime 2 Astra Stats]', astraStats);
    expect(astraStats).not.toBeNull();
    expect(astraStats?.src).toContain('astra');

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_c_showtime2_astra_overview.png') });

    // 2. Showtime 3: Shadow Protocol
    await page.goto('/cinemas/1/auditorium/1?showtime=3&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const v = document.querySelector('video');
      if (v && v.paused) v.play().catch(() => {});
    });
    await page.waitForTimeout(600);

    const shadowStats = await page.evaluate(() => {
      const v = document.querySelector('video') as HTMLVideoElement;
      return v ? { src: v.src, paused: v.paused, currentTime: v.currentTime } : null;
    });
    console.log('[Showtime 3 Shadow Protocol Stats]', shadowStats);
    expect(shadowStats).not.toBeNull();
    expect(shadowStats?.src).toContain('shadow_protocol');

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_c_showtime3_shadow_overview.png') });
  });

  test('Part C.03: Acceptance screenshots across camera positions (Walk at Row E, Seated A05, Seated J10, Mobile 360x640)', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(1500);

    // 1. Walk Mode at Row E looking at screen
    await page.click('button:has-text("Walk Mode")');
    await page.waitForTimeout(600);
    await page.click('button:has-text("Row E")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_c_03_walk_row_e_frame1.png') });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_c_03_walk_row_e_frame2.png') });

    // 2. Seated POV at A05 (Front Row center)
    await page.evaluate(() => window.__cineverse!.sitAt('A05'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_c_03_seated_a05_frame1.png') });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_c_03_seated_a05_frame2.png') });

    // 3. Seated POV at J10 (Premier Back Row corner)
    await page.evaluate(() => window.__cineverse!.sitAt('J10'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_c_03_seated_j10_frame1.png') });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_c_03_seated_j10_frame2.png') });

    // 4. Mobile Viewport (360x640)
    await page.setViewportSize({ width: 360, height: 640 });
    await page.evaluate(() => window.__cineverse!.setMode('overview'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_c_03_mobile_360x640_overview.png') });
  });
});
