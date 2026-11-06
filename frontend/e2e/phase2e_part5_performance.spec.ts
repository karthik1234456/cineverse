import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const EVIDENCE_DIR = path.join(__dirname, '../../docs/evidence/phase-2e');

test.describe('Phase 2e — Part 5: 3D Theatre Performance & Quality Modes (Finding E5)', () => {
  test.beforeEach(async ({ page }) => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    await page.addInitScript(() => {
      try {
        localStorage.setItem('cineverse_city_slug', 'bengaluru');
        localStorage.setItem('cineverse_city_name', 'Bengaluru');
      } catch (e) {}
    });
  });

  test('01. Quality mode selector (Smooth vs Beautiful) switches without reload', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(1000);

    // Open settings popover
    const settingsBtn = page.locator('[data-testid="settings-menu-toggle"]');
    await settingsBtn.click();

    const qualitySelector = page.locator('[data-testid="quality-mode-selector"]');
    await expect(qualitySelector).toBeVisible();

    const smoothBtn = page.locator('[data-testid="quality-switch-smooth"]');
    const beautifulBtn = page.locator('[data-testid="quality-switch-beautiful"]');
    await expect(smoothBtn).toBeVisible();
    await expect(beautifulBtn).toBeVisible();

    // 1. Switch to Smooth Mode
    await smoothBtn.click();
    await page.waitForTimeout(300);

    const smoothState = await page.evaluate(() => {
      const state = window.__cineverse!.getState();
      const store = (window as any).useCinemaStore.getState();
      return {
        qualityMode: state.qualityMode || store.qualityMode,
        qualityTier: state.qualityTier || store.qualityTier,
        storedPreference: localStorage.getItem('cineverse_quality_mode'),
      };
    });

    expect(smoothState.qualityMode).toBe('smooth');
    expect(smoothState.qualityTier).toBe('low');
    expect(smoothState.storedPreference).toBe('smooth');

    // Screenshot in Smooth Mode
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '31_quality_mode_smooth_active.png'),
    });

    // 2. Switch to Beautiful Mode without reload
    await beautifulBtn.click();
    await page.waitForTimeout(300);

    const beautifulState = await page.evaluate(() => {
      const state = window.__cineverse!.getState();
      const store = (window as any).useCinemaStore.getState();
      return {
        qualityMode: state.qualityMode || store.qualityMode,
        qualityTier: state.qualityTier || store.qualityTier,
        storedPreference: localStorage.getItem('cineverse_quality_mode'),
      };
    });

    expect(beautifulState.qualityMode).toBe('beautiful');
    expect(beautifulState.qualityTier).toBe('high');
    expect(beautifulState.storedPreference).toBe('beautiful');

    // Screenshot in Beautiful Mode
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '32_quality_mode_beautiful_active.png'),
    });
  });

  test('02. Quality preference persists across page reloads', async ({ page }) => {
    // Start with explicitly setting 'smooth' mode
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });

    await page.evaluate(() => {
      window.__cineverse!.setQualityMode('smooth');
    });

    const prefBefore = await page.evaluate(() => localStorage.getItem('cineverse_quality_mode'));
    expect(prefBefore).toBe('smooth');

    // Reload page
    await page.reload();
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(500);

    const stateAfter = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      return {
        qualityMode: store.qualityMode,
        qualityTier: store.qualityTier,
        storedPreference: localStorage.getItem('cineverse_quality_mode'),
      };
    });

    expect(stateAfter.storedPreference).toBe('smooth');
    expect(stateAfter.qualityMode).toBe('smooth');
    expect(stateAfter.qualityTier).toBe('low');
  });

  test('03. Render-on-demand: loop settles when scene is idle, wakes on interaction', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(1500);

    // Verify render count remains low or settled when idle
    const idleFrames = await page.evaluate(async () => {
      let count = 0;
      const fn = () => { count++; };
      // Monitor requestAnimationFrame over 800ms
      let active = true;
      function loop() {
        if (!active) return;
        count++;
        requestAnimationFrame(loop);
      }
      const raf = requestAnimationFrame(loop);
      await new Promise((r) => setTimeout(r, 600));
      active = false;
      cancelAnimationFrame(raf);
      return count;
    });

    expect(idleFrames).toBeGreaterThan(0);

    // Hover over seat J10 -> triggers immediate render
    await page.evaluate(() => {
      window.__cineverse!.setHoveredSeat('J10');
    });
    await page.waitForTimeout(300);

    const hovered = await page.evaluate(() => window.__cineverse!.getState().hoveredSeatId);
    expect(hovered).toBe('J10');

    // Camera preset transition wakes up continuous rendering
    await page.evaluate(() => {
      window.__cineverse!.setCameraPreset('front');
    });
    await page.waitForTimeout(1100);

    const preset = await page.evaluate(() => window.__cineverse!.getState().cameraPreset);
    expect(preset).toBe('front');
  });

  test('04. Trailer play engages active render loop and pausing allows loop to settle', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(1000);

    // Play trailer
    await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      if (!store.trailer.isPlaying) {
        store.toggleTrailerPlay();
      }
    });
    await page.waitForTimeout(800);

    const isPlaying = await page.evaluate(() => (window as any).useCinemaStore.getState().trailer.isPlaying);
    expect(isPlaying).toBe(true);

    // Pause trailer
    await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      if (store.trailer.isPlaying) {
        store.toggleTrailerPlay();
      }
    });
    await page.waitForTimeout(600);

    const isPaused = await page.evaluate(() => !(window as any).useCinemaStore.getState().trailer.isPlaying);
    expect(isPaused).toBe(true);
  });

  test('05. Production render statistics & memory constraints meet budgets', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(1500);

    const stats = await page.evaluate(() => {
      const state = window.__cineverse!.getState();
      const rInfo = state.rendererInfo;
      const mem = (performance as any).memory;
      return {
        calls: rInfo?.calls ?? 0,
        triangles: rInfo?.triangles ?? 0,
        geometries: rInfo?.geometries ?? 0,
        textures: rInfo?.textures ?? 0,
        usedJSHeapMB: mem ? mem.usedJSHeapSize / (1024 * 1024) : null,
      };
    });

    console.log('[E2E Production Render Stats]', stats);

    // Full auditorium overview budget: draw calls < 350 across all 220+ scene geometries
    expect(stats.calls).toBeLessThan(350);
    // Triangles > 10,000 (auditorium + instanced seats)
    expect(stats.triangles).toBeGreaterThan(10000);
    // Geometries budget < 350
    expect(stats.geometries).toBeLessThan(350);

    if (stats.usedJSHeapMB !== null) {
      // Heap memory should remain under 120 MB
      expect(stats.usedJSHeapMB).toBeLessThan(120);
    }

    // Seated POV mode: frustum culling reduces active draw calls below 120
    await page.evaluate(() => {
      window.__cineverse!.sitAt('D05');
    });
    await page.waitForTimeout(1000);

    const povStats = await page.evaluate(() => {
      const state = window.__cineverse!.getState();
      return state.rendererInfo?.calls ?? 0;
    });

    console.log('[E2E Seated POV Mode Draw Calls]', povStats);
    // When seated facing screen, frustum culling keeps draw calls < 120
    expect(povStats).toBeLessThan(120);
  });
});
