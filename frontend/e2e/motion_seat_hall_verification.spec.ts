import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-motion-hall');

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

test.describe.serial('Motion-Seat Hall Type (4DX / Panoramic Wrap) End-to-End Verification', () => {

  test('01. 2D Seat Map — Motion Pods, Banner, & Server Authoritative Pricing', async ({ page }) => {
    // Cinema 2, Audi 5, Showtime 21: Screen 1 — Motion-seat Hall (240 seats)
    await page.goto('/cinemas/2/auditorium/5?mode=2d&showtime=21');
    await page.waitForLoadState('networkidle');

    // 1. Verify "Motion seats" banner / badge
    const banner = page.locator('[data-testid="motion-seats-banner"]');
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(banner).toContainText('Motion seats');

    // 2. Verify all seats have motion pod metadata and server pricing
    const seatsData = await page.evaluate(() => {
      const seatButtons = Array.from(document.querySelectorAll('[role="gridcell"] button'));
      return {
        count: seatButtons.length,
        hasLabels: seatButtons.every((btn) => btn.getAttribute('aria-label')?.includes('Motion pod')),
        labelsSample: seatButtons.slice(0, 5).map((btn) => btn.getAttribute('aria-label')),
      };
    });

    console.log('2D Seat Map Check:', seatsData);
    expect(seatsData.count).toBe(240);
    // Almost all seats are in motion pods
    expect(seatsData.hasLabels).toBe(true);

    // Capture 2D Seat Map Evidence Screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_motion_hall_2d_seatmap.png'), fullPage: true });
  });

  test('02. 3D Structure — Panoramic Wrap Screen, Pod Bases, Actuators, & 30 Atmospheric Props', async ({ page }) => {
    await page.goto('/cinemas/2/auditorium/5?mode=3d&showtime=21');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(3000);

    // Inspect Procedural Geometry & Layout
    const motionAudit = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      const geo = store.proceduralResult?.geometry;
      const layout = store.auditoriumLayout;

      const podBases = geo?.motionPodBases || [];
      const effectProps = geo?.effectProps || [];
      const screenMesh = geo?.screenMesh;
      const presets = geo?.cameraPresets || {};

      return {
        theatreType: layout?.theatre_type,
        theatreTypeLabel: layout?.theatre_type_label,
        isMotionHall: layout?.is_motion_hall,
        motionZone: layout?.motion_zone,
        seatCount: layout?.seats?.length ?? 0,
        podBasesCount: podBases.length,
        hasActuatorPistons: podBases.length > 0 && podBases[0].pistons?.length === 4,
        hasUnderSeatGrilles: podBases.length > 0 && podBases[0].grilles?.length > 0,
        effectPropsCount: effectProps.length,
        effectPropTypes: Array.from(new Set(effectProps.map((p: any) => p.type))),
        screenType: screenMesh?.type,
        hasPanoramicWrap: !!screenMesh?.panoramicWrap,
        wrapSideAngle: screenMesh?.panoramicWrap?.sideAngleDeg,
        hasFrontFloorTrim: !!geo?.frontFloorTrim,
        hasEffectsRigPreset: !!presets?.effects_rig,
        hasWrapScreenPreset: !!presets?.wrap_screen,
      };
    });

    console.log('3D Motion Hall Audit:', motionAudit);
    expect(motionAudit.theatreType).toBe('dolby_atmos_4dx');
    expect(motionAudit.theatreTypeLabel).toBe('Motion-seat Experience');
    expect(motionAudit.seatCount).toBe(240);
    expect(motionAudit.podBasesCount).toBeGreaterThan(0);
    expect(motionAudit.hasActuatorPistons).toBe(true);
    expect(motionAudit.hasUnderSeatGrilles).toBe(true);
    expect(motionAudit.effectPropsCount).toBe(30);
    expect(motionAudit.effectPropTypes).toContain('wind');
    expect(motionAudit.effectPropTypes).toContain('fog');
    expect(motionAudit.effectPropTypes).toContain('water');
    expect(motionAudit.effectPropTypes).toContain('strobe');
    expect(motionAudit.effectPropTypes).toContain('scent');
    expect(motionAudit.effectPropTypes).toContain('poke');
    expect(motionAudit.screenType).toBe('panoramic_wrap');
    expect(motionAudit.hasPanoramicWrap).toBe(true);
    expect(motionAudit.wrapSideAngle).toBe(25);
    expect(motionAudit.hasFrontFloorTrim).toBe(true);
    expect(motionAudit.hasEffectsRigPreset).toBe(true);
    expect(motionAudit.hasWrapScreenPreset).toBe(true);

    // 1. Capture Overview in Lights On Mode
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('full');
      (window as any).__cineverse.setCameraPreset('overview');
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_motion_hall_overview_lightson.png') });

    // 2. Test "Effects Rig" Preset
    const presetsDropdownBtn = page.locator('button:has-text("Presets")');
    if (await presetsDropdownBtn.isVisible()) {
      await presetsDropdownBtn.click();
      await page.waitForTimeout(300);
      const effectsRigBtn = page.locator('[data-testid="preset-effects-rig-btn"]');
      await expect(effectsRigBtn).toBeVisible();
      await effectsRigBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_motion_hall_effects_rig_view.png') });
    }

    // 3. Test "Wrap Screen" Preset
    if (await presetsDropdownBtn.isVisible()) {
      await presetsDropdownBtn.click();
      await page.waitForTimeout(300);
      const wrapScreenBtn = page.locator('[data-testid="preset-wrap-screen-btn"]');
      await expect(wrapScreenBtn).toBeVisible();
      await wrapScreenBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_motion_hall_wrap_screen_view.png') });
    }

    // 4. Test Show Mode (glowing LEDs on effects rig and floor trim)
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('show');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '05_motion_hall_showmode_glowing_leds.png') });

    // 5. Test Walk Mode & Colliders in Motion Hall
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('walk');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '06_motion_hall_walk_mode.png') });

    // 6. Test Sit Mode POV
    await page.evaluate(() => {
      (window as any).__cineverse.sitAt('F10');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '07_motion_hall_seated_pov_f10.png') });
  });

  test('03. Architectural Comparison: Motion-Seat Hall vs Standard Hall vs Large-Screen Hall', async ({ page }) => {
    // 1. Standard Cinema Hall (Cinema 2, Audi 6, Showtime 26 — 216 seats)
    await page.goto('/cinemas/2/auditorium/6?mode=3d&showtime=26');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('full');
      (window as any).__cineverse.setCameraPreset('overview');
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '08_comparison_standard_hall.png') });

    const stdCheck = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      return {
        screenType: store.proceduralResult?.geometry?.screenMesh?.type,
        podCount: store.proceduralResult?.geometry?.motionPodBases?.length ?? 0,
        effectProps: store.proceduralResult?.geometry?.effectProps?.length ?? 0,
      };
    });
    expect(stdCheck.screenType).toBe('standard_flat');
    expect(stdCheck.podCount).toBe(0); // Standard halls have NO motion pods
    expect(stdCheck.effectProps).toBe(0);

    // 2. Large Screen / Flagship Hall (Cinema 1, Audi 2, Showtime 6 — 560 seats, 24m screen)
    await page.goto('/cinemas/1/auditorium/2?mode=3d&showtime=6');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('full');
      (window as any).__cineverse.setCameraPreset('overview');
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '09_comparison_large_screen_flagship.png') });

    const largeCheck = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      return {
        screenType: store.proceduralResult?.geometry?.screenMesh?.type,
        screenWidth: store.proceduralResult?.geometry?.screenMesh?.width,
        podCount: store.proceduralResult?.geometry?.motionPodBases?.length ?? 0,
        bafflesCount: store.proceduralResult?.geometry?.acousticBaffles?.length ?? 0,
      };
    });
    expect(largeCheck.screenType).toBe('large_curved');
    expect(largeCheck.screenWidth).toBeGreaterThanOrEqual(24.0);
    expect(largeCheck.podCount).toBe(0);
    expect(largeCheck.bafflesCount).toBeGreaterThan(0);
  });
});

