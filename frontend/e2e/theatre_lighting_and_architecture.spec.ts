import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-theatre-look');

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

test.describe.serial('CineVerse Phase Theatre Architecture & Lighting Verification', () => {

  test('01. Standard Cinema Hall (224 seats) — Lights On, Walk View, Roof Trusses & Projection Booth', async ({ page }) => {
    // Cinema 3, Audi 9: 224-seat Standard Cinema Hall (Showtime 41)
    await page.goto('/cinemas/3/auditorium/9?mode=3d&showtime=41');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2500);

    // Verify architectural elements present in geometry
    const archCheck = await page.evaluate(() => {
      const w = (window as any).__cineverse;
      const store = (window as any).useCinemaStore.getState();
      const geo = store.proceduralResult?.geometry;
      return {
        theatreType: store.auditoriumLayout?.theatre_type,
        ceilingClouds: geo?.ceilingClouds?.length ?? 0,
        roofTrusses: geo?.roofTrusses?.length ?? 0,
        ventilationDucts: geo?.ventilationDucts?.length ?? 0,
        coveLightStrips: geo?.coveLightStrips?.length ?? 0,
        skirtingLights: geo?.skirtingLights?.length ?? 0,
        doorFrames: geo?.doorFrames?.length ?? 0,
        hasBooth: !!geo?.projectionBooth,
        boothAperture: geo?.projectionBooth?.projectorAperture,
      };
    });

    console.log('Standard 224 Architecture Check:', archCheck);
    expect(archCheck.ceilingClouds).toBeGreaterThanOrEqual(6);
    expect(archCheck.roofTrusses).toBeGreaterThanOrEqual(4);
    expect(archCheck.coveLightStrips).toBeGreaterThanOrEqual(4);
    expect(archCheck.hasBooth).toBe(true);

    // 1. Overview (Look around) Screenshot & Luminance Check in Lights On
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('overview');
      (window as any).__cineverse.setHouseLights('full');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'standard_224_overview_lightson.png') });

    const lumOverview = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('Standard 224 Overview Luminance:', lumOverview);
    expect(lumOverview.meanLuminance).toBeGreaterThanOrEqual(55.0);
    expect(lumOverview.meanLuminance).toBeLessThanOrEqual(125.0);
    expect(lumOverview.nearBlackPercent).toBeLessThanOrEqual(5.0);

    // 2. Walk Mode Screenshot & Luminance Check
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('walk');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'standard_224_walk_lightson.png') });

    const lumWalk = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('Standard 224 Walk Luminance:', lumWalk);
    expect(lumWalk.meanLuminance).toBeGreaterThanOrEqual(55.0);
    expect(lumWalk.meanLuminance).toBeLessThanOrEqual(125.0);
    expect(lumWalk.nearBlackPercent).toBeLessThanOrEqual(5.0);

    // 3. Sit View (Front row POV)
    await page.evaluate(() => {
      (window as any).__cineverse.sitAt('D08');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'standard_224_sit_lightson.png') });

    // 4. Show Mode Transition & Projector Beam Check
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('show');
    });
    await page.waitForTimeout(2000); // Allow smooth 0.8s transition to settle
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'standard_224_sit_showmode.png') });

    // 5. Test Settings Modal & Light Intensity setting (Normal vs Brighter)
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('full');
      (window as any).__cineverse.setCameraPreset('overview');
      (window as any).__cineverse.setLightIntensity('brighter');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'standard_224_overview_brighter.png') });

    const lumBrighter = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('Standard 224 Brighter Luminance:', lumBrighter);
    expect(lumBrighter.meanLuminance).toBeGreaterThan(lumOverview.meanLuminance);
  });

  test('02. IMAX-Style Flagship Hall (560 seats) — Acoustic Baffles, Trusses, Ice-Blue Coves & Volumetric Beam', async ({ page }) => {
    // Cinema 1, Audi 2: 560-seat Flagship Hall (Showtime 6)
    await page.goto('/cinemas/1/auditorium/2?mode=3d&showtime=6');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2500);

    // Architecture check
    const archCheck = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      const geo = store.proceduralResult?.geometry;
      return {
        ceilingClouds: geo?.ceilingClouds?.length ?? 0,
        roofTrusses: geo?.roofTrusses?.length ?? 0,
        acousticBaffles: geo?.acousticBaffles?.length ?? 0,
        ventilationDucts: geo?.ventilationDucts?.length ?? 0,
        hasBooth: !!geo?.projectionBooth,
      };
    });
    console.log('Flagship 560 Architecture:', archCheck);
    expect(archCheck.ceilingClouds).toBeGreaterThanOrEqual(12);
    expect(archCheck.roofTrusses).toBeGreaterThanOrEqual(6);
    expect(archCheck.acousticBaffles).toBeGreaterThanOrEqual(6);
    expect(archCheck.hasBooth).toBe(true);

    // Overview in Lights On
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('overview');
      (window as any).__cineverse.setHouseLights('full');
      (window as any).__cineverse.setLightIntensity('normal');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'flagship_560_overview_lightson.png') });

    const lumOverview = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('Flagship 560 Overview Luminance:', lumOverview);
    expect(lumOverview.meanLuminance).toBeGreaterThanOrEqual(55.0);
    expect(lumOverview.meanLuminance).toBeLessThanOrEqual(125.0);
    expect(lumOverview.nearBlackPercent).toBeLessThanOrEqual(5.0);

    // Walk View in Lights On
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('walk');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'flagship_560_walk_lightson.png') });

    const lumWalk = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('Flagship 560 Walk Luminance:', lumWalk);
    expect(lumWalk.meanLuminance).toBeGreaterThanOrEqual(55.0);
    expect(lumWalk.meanLuminance).toBeLessThanOrEqual(125.0);
    expect(lumWalk.nearBlackPercent).toBeLessThanOrEqual(5.0);

    // Sit View in Lights On
    await page.evaluate(() => {
      (window as any).__cineverse.sitAt('K14');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'flagship_560_sit_lightson.png') });

    // Show Mode with Volumetric Projector Beam
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('show');
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'flagship_560_sit_showmode.png') });

    // Low-Tier (Smooth) verification
    await page.evaluate(() => {
      (window as any).__cineverse.setQualityMode('smooth');
      (window as any).__cineverse.setCameraPreset('overview');
      (window as any).__cineverse.setHouseLights('full');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'flagship_560_lowtier_overview.png') });

    // Shadow lights count verification (strictly <= 2)
    const shadowCastersCount = await page.evaluate(() => {
      return (window as any).__cineverse.getShadowCastersCount();
    });
    console.log('Flagship 560 Shadow Casters Count:', shadowCastersCount);
    expect(shadowCastersCount).toBeLessThanOrEqual(2);
  });

  test('03. Grand Balcony Auditorium (672-700 seats) — Deep Ceiling, Balcony Underside Coves & Sightlines', async ({ page }) => {
    // Cinema 1, Audi 3: 672-seat Balcony Hall (Showtime 11)
    await page.goto('/cinemas/1/auditorium/3?mode=3d&showtime=11');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2500);

    // Overview in Lights On
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('overview');
      (window as any).__cineverse.setHouseLights('full');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'balcony_700_overview_lightson.png') });

    const lumOverview = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('Balcony 700 Overview Luminance:', lumOverview);
    expect(lumOverview.meanLuminance).toBeGreaterThanOrEqual(55.0);
    expect(lumOverview.meanLuminance).toBeLessThanOrEqual(125.0);
    expect(lumOverview.nearBlackPercent).toBeLessThanOrEqual(5.0);

    // Walk View
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('walk');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'balcony_700_walk_lightson.png') });

    // Balcony Tier Sit View
    await page.evaluate(() => {
      (window as any).__cineverse.sitAt('S14');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'balcony_700_sit_lightson.png') });

    // Show Mode from Balcony
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('show');
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'balcony_700_sit_showmode.png') });
  });

  test('04. Dolby Atmos 4DX Hall (240 seats) — Environmental Effect Rigs (Fans & Nozzles) & Jet Trims', async ({ page }) => {
    // Cinema 2, Audi 5: 240-seat 4DX Hall (Showtime 21)
    await page.goto('/cinemas/2/auditorium/5?mode=3d&showtime=21');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2500);

    const archCheck = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      const geo = store.proceduralResult?.geometry;
      return {
        effectRigs: geo?.effectRigs?.length ?? 0,
        ceilingClouds: geo?.ceilingClouds?.length ?? 0,
        roofTrusses: geo?.roofTrusses?.length ?? 0,
      };
    });
    console.log('4DX 240 Architecture:', archCheck);
    expect(archCheck.effectRigs).toBeGreaterThanOrEqual(2);

    // Overview in Lights On
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('overview');
      (window as any).__cineverse.setHouseLights('full');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '4dx_240_overview_lightson.png') });

    const lumOverview = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('4DX 240 Overview Luminance:', lumOverview);
    expect(lumOverview.meanLuminance).toBeGreaterThanOrEqual(55.0);
    expect(lumOverview.meanLuminance).toBeLessThanOrEqual(125.0);
    expect(lumOverview.nearBlackPercent).toBeLessThanOrEqual(5.0);

    // Walk View
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('walk');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '4dx_240_walk_lightson.png') });

    // Sit View in Motion Zone
    await page.evaluate(() => {
      (window as any).__cineverse.sitAt('F10');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '4dx_240_sit_lightson.png') });

    // Show Mode
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('show');
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '4dx_240_sit_showmode.png') });
  });

  test('05. Luxury Recliner Lounge (84 seats) — Warm Low Coffered Ceiling & Fluted Walnut Diffusers', async ({ page }) => {
    // Cinema 1, Audi 4: 84-seat Recliner Lounge (Showtime 16)
    await page.goto('/cinemas/1/auditorium/4?mode=3d&showtime=16');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2500);

    // Overview in Lights On
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('overview');
      (window as any).__cineverse.setHouseLights('full');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'luxury_84_overview_lightson.png') });

    const lumOverview = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('Luxury 84 Overview Luminance:', lumOverview);
    expect(lumOverview.meanLuminance).toBeGreaterThanOrEqual(55.0);
    expect(lumOverview.meanLuminance).toBeLessThanOrEqual(125.0);
    expect(lumOverview.nearBlackPercent).toBeLessThanOrEqual(5.0);

    // Walk View
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('walk');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'luxury_84_walk_lightson.png') });

    // Sit View
    await page.evaluate(() => {
      (window as any).__cineverse.sitAt('D05');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'luxury_84_sit_lightson.png') });

    // Show Mode
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('show');
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'luxury_84_sit_showmode.png') });
  });

  test('06. Boutique Velvet Salon (48 seats) — Floating Plush Acoustic Clouds & Velvet Sofas', async ({ page }) => {
    // Cinema 5, Audi 16: 48-seat Boutique Salon (Showtime 76)
    await page.goto('/cinemas/5/auditorium/16?mode=3d&showtime=76');
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(2500);

    // Overview in Lights On
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('overview');
      (window as any).__cineverse.setHouseLights('full');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'boutique_48_overview_lightson.png') });

    const lumOverview = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('Boutique 48 Overview Luminance:', lumOverview);
    expect(lumOverview.meanLuminance).toBeGreaterThanOrEqual(55.0);
    expect(lumOverview.meanLuminance).toBeLessThanOrEqual(125.0);
    expect(lumOverview.nearBlackPercent).toBeLessThanOrEqual(5.0);

    // Walk View
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('walk');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'boutique_48_walk_lightson.png') });

    // Sit View
    await page.evaluate(() => {
      (window as any).__cineverse.sitAt('C04');
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'boutique_48_sit_lightson.png') });

    // Show Mode
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('show');
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'boutique_48_sit_showmode.png') });
  });
});

