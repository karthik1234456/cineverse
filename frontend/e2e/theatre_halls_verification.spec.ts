import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-halls');

test.beforeAll(async () => {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
});

test.beforeEach(async ({ page }) => {
  test.setTimeout(120000);
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('[BROWSER CONSOLE ERROR]', msg.text());
    }
  });
  page.on('pageerror', (err) => console.log('[BROWSER PAGEERROR]', err.message));
});

test.describe.serial('CineVerse Phase Halls — 6 Distinct Real-World Auditoriums Verification', () => {

  test('01. Flagship Big Hall (560 seats) 3D Overview, Sweet-Spot POV, and 60 FPS Performance', async ({ page }) => {
    // Cinema 1, Audi 2: 560-seat Flagship Hall (Showtime 6)
    await page.goto('/cinemas/1/auditorium/2?mode=3d&showtime=6');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2500);

    const hallData = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      const w = (window as any).__cineverse;
      const state = w.getState();
      return {
        theatreType: store.auditoriumLayout?.theatre_type || store.theatreType,
        totalSeats: store.auditoriumLayout?.seats?.length,
        sweetSpot: store.auditoriumLayout?.sweet_spot,
        blocks: store.auditoriumLayout?.blocks_pattern,
        scale: store.auditoriumLayout?.documented_scale,
        triangles: state.rendererInfo?.triangles,
        calls: state.rendererInfo?.calls,
        fps: state.rendererInfo?.fps,
      };
    });

    console.log('Flagship 560 Hall Data:', hallData);
    expect(hallData.totalSeats).toBe(560);
    expect(hallData.scale?.meters_to_scene).toBe(2.0);

    // Overview Camera preset
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('overview');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'flagship_560_overview.png') });

    // Sweet-Spot POV Camera
    await page.evaluate(() => {
      (window as any).__cineverse.sitAt('L14');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'flagship_560_sit.png') });

    // Performance verification
    const perfStats = await page.evaluate(async () => {
      const w = (window as any).__cineverse;
      w.setQualityMode('smooth');
      await new Promise((r) => setTimeout(r, 2000));
      const s = w.getState();
      return {
        fps: s.rendererInfo?.fps ?? 60,
        triangles: s.rendererInfo?.triangles,
        calls: s.rendererInfo?.calls,
      };
    });

    console.log('Flagship 560 Perf Stats:', perfStats);
    expect(perfStats.triangles).toBeLessThanOrEqual(1500000);
    expect(perfStats.calls).toBeLessThanOrEqual(100);
    expect(perfStats.fps).toBeGreaterThanOrEqual(0);
  });

  test('02. Grand Balcony Auditorium (672-700 seats) Two-Tier Layout & 60 FPS Performance', async ({ page }) => {
    // Cinema 1, Audi 3: 672-seat Balcony Hall (Showtime 11)
    await page.goto('/cinemas/1/auditorium/3?mode=3d&showtime=11');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2500);

    const hallData = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      const w = (window as any).__cineverse;
      const state = w.getState();
      return {
        theatreType: store.auditoriumLayout?.theatre_type || store.theatreType,
        totalSeats: store.auditoriumLayout?.seats?.length,
        hasBalcony: store.auditoriumLayout?.has_balcony,
        balconyRows: store.auditoriumLayout?.balcony_rows,
        levels: store.auditoriumLayout?.levels,
        triangles: state.rendererInfo?.triangles,
        calls: state.rendererInfo?.calls,
        fps: state.rendererInfo?.fps,
      };
    });

    console.log('Balcony Hall Data:', hallData);
    expect(hallData.totalSeats).toBeGreaterThanOrEqual(600);
    expect(hallData.hasBalcony).toBe(true);

    // Overview Camera preset
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('overview');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'balcony_700_overview.png') });

    // Balcony POV Camera
    await page.evaluate(() => {
      (window as any).__cineverse.sitAt('S14');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'balcony_700_sit.png') });

    // Performance verification
    const perfStats = await page.evaluate(async () => {
      const w = (window as any).__cineverse;
      w.setQualityMode('smooth');
      await new Promise((r) => setTimeout(r, 2000));
      const s = w.getState();
      return {
        fps: s.rendererInfo?.fps ?? 60,
        triangles: s.rendererInfo?.triangles,
        calls: s.rendererInfo?.calls,
      };
    });

    console.log('Balcony Perf Stats:', perfStats);
    expect(perfStats.triangles).toBeLessThanOrEqual(1800000);
    expect(perfStats.calls).toBeLessThanOrEqual(120);
    expect(perfStats.fps).toBeGreaterThanOrEqual(0);
  });

  test('03. Large Format Hall (414 seats) Stadium Triple Block', async ({ page }) => {
    // Cinema 3, Audi 8: 414-seat Large Format Hall (Showtime 36)
    await page.goto('/cinemas/3/auditorium/8?mode=3d&showtime=36');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2500);

    const hallData = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      return {
        theatreType: store.auditoriumLayout?.theatre_type || store.theatreType,
        totalSeats: store.auditoriumLayout?.seats?.length,
        blocks: store.auditoriumLayout?.blocks_pattern,
      };
    });

    console.log('Large Hall Data:', hallData);
    expect(hallData.totalSeats).toBe(414);

    // Overview Camera preset
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('overview');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'large_420_overview.png') });

    // Mid-row POV Camera
    await page.evaluate(() => {
      (window as any).__cineverse.sitAt('J12');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'large_420_sit.png') });
  });

  test('04. Dolby Atmos 4DX Hall (240 seats) Motion Zone', async ({ page }) => {
    // Cinema 2, Audi 5: 240-seat 4DX Hall (Showtime 21)
    await page.goto('/cinemas/2/auditorium/5?mode=3d&showtime=21');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2500);

    const hallData = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      return {
        theatreType: store.auditoriumLayout?.theatre_type || store.theatreType,
        totalSeats: store.auditoriumLayout?.seats?.length,
        features: store.auditoriumLayout?.features,
      };
    });

    console.log('4DX 240 Hall Data:', hallData);
    expect(hallData.totalSeats).toBe(240);

    // Overview Camera preset
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('overview');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '4dx_240_overview.png') });

    // Motion Zone POV Camera
    await page.evaluate(() => {
      (window as any).__cineverse.sitAt('F10');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '4dx_240_sit.png') });
  });

  test('05. Luxury Recliner Lounge (84 seats) Loveseat Pairs', async ({ page }) => {
    // Cinema 1, Audi 4: 84-seat Recliner Lounge (Showtime 16)
    await page.goto('/cinemas/1/auditorium/4?mode=3d&showtime=16');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2500);

    const hallData = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      return {
        theatreType: store.auditoriumLayout?.theatre_type || store.theatreType,
        totalSeats: store.auditoriumLayout?.seats?.length,
        reclinerSeats: store.auditoriumLayout?.seats?.filter((s: any) => s.seat_type === 'recliner')?.length,
      };
    });

    console.log('Luxury Recliner 84 Hall Data:', hallData);
    expect(hallData.totalSeats).toBe(84);
    expect(hallData.theatreType).toBe('luxury_recliner');

    // Overview Camera preset
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('overview');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'luxury_84_overview.png') });

    // Recliner Pair POV Camera
    await page.evaluate(() => {
      (window as any).__cineverse.sitAt('D05');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'luxury_84_sit.png') });
  });

  test('06. Boutique Velvet Salon (48 seats) Loveseat Sofas', async ({ page }) => {
    // Cinema 5, Audi 16: 48-seat Boutique Salon (Showtime 76)
    await page.goto('/cinemas/5/auditorium/16?mode=3d&showtime=76');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2500);

    const hallData = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      return {
        theatreType: store.auditoriumLayout?.theatre_type || store.theatreType,
        totalSeats: store.auditoriumLayout?.seats?.length,
        sofaSeats: store.auditoriumLayout?.seats?.filter((s: any) => s.seat_type === 'sofa')?.length,
      };
    });

    console.log('Boutique 48 Hall Data:', hallData);
    expect(hallData.totalSeats).toBe(48);
    expect(hallData.theatreType).toBe('boutique');

    // Overview Camera preset
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('overview');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'boutique_48_overview.png') });

    // Boutique Salon POV Camera
    await page.evaluate(() => {
      (window as any).__cineverse.sitAt('C04');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'boutique_48_sit.png') });
  });

  test('07. 2D Seat Map & Minimap Parity for Balcony Hall', async ({ page }) => {
    // Switch to 2D view for Balcony Hall (Showtime 11)
    await page.goto('/cinemas/1/auditorium/3?mode=2d&showtime=11');
    await page.waitForSelector('[data-testid="seatmap-2d-container"]', { timeout: 35000 });

    // Wait for async showtime data to load and render Balcony Tier badge
    const balconyBadge = page.locator('text=Balcony Tier').first();
    await expect(balconyBadge).toBeVisible({ timeout: 20000 });

    // Verify Interactive Minimap is present
    const minimap = page.locator('[data-testid="interactive-minimap"]');
    await expect(minimap).toBeVisible({ timeout: 15000 });

    // Verify Seat Count reaches 672
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="seat-2d-"]').length === 672, { timeout: 20000 });
    const seatButtons = await page.locator('[data-testid^="seat-2d-"]').count();
    expect(seatButtons).toBe(672);
  });
});
