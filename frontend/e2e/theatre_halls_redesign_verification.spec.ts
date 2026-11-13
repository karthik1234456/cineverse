import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-theatre-redesign');

test.beforeAll(async () => {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
});

test.beforeEach(async ({ page }) => {
  test.setTimeout(240000);
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('[BROWSER CONSOLE ERROR]', msg.text());
    }
  });
});

test.describe.serial('Real-World Cinema Halls Redesign Verification', () => {

  // Hall 1: Standard Multiplex Hall
  test('01. Standard Multiplex Hall — Triple block, navy coffered ceiling, blue wall-wash, dark charcoal carpet, deep red fabric seats', async ({ page }) => {
    await page.goto('/cinemas/2/auditorium/6?mode=3d&showtime=26', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(1000);

    // Verify architecture & palette
    const info = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      const geo = store.proceduralResult?.geometry;
      const layout = store.auditoriumLayout;
      return {
        theatreType: layout?.theatre_type,
        totalSeats: layout?.seats?.length,
        hasStageGrille: !!document.querySelector('[name="stage_lip_grille"]'),
        screenAspect: layout?.screen?.aspect,
      };
    });

    expect(info.theatreType).toBe('standard');

    // Set Lights on
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('full');
      (window as any).__cineverse.setCameraPreset('overview');
    });
    await page.waitForTimeout(600);

    // 1. Aisle view toward screen
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('walk');
    });
    await page.waitForTimeout(600);
    const aislePath = path.join(EVIDENCE_DIR, '01_standard_aisle_view_lightson.png');
    await page.screenshot({ path: aislePath });
    expect(fs.existsSync(aislePath)).toBe(true);

    const lumAisle = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('Standard Hall Aisle Luminance:', lumAisle);
    expect(lumAisle.meanLuminance).toBeGreaterThanOrEqual(0.35);
    expect(lumAisle.meanLuminance).toBeLessThanOrEqual(0.50);
    expect(lumAisle.nearBlackPercent).toBeLessThanOrEqual(5.0);
    expect(lumAisle.maxHueDominancePercent).toBeLessThanOrEqual(40.0);

    // 2. View from behind seats
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('rear');
    });
    await page.waitForTimeout(600);
    const rearPath = path.join(EVIDENCE_DIR, '01_standard_rear_seats_view_lightson.png');
    await page.screenshot({ path: rearPath });
    expect(fs.existsSync(rearPath)).toBe(true);

    // 3. Close-up of seats and a stair
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('sit');
    });
    await page.waitForTimeout(600);
    const closeupPath = path.join(EVIDENCE_DIR, '01_standard_seats_stairs_closeup_lightson.png');
    await page.screenshot({ path: closeupPath });
    expect(fs.existsSync(closeupPath)).toBe(true);

    // 4. Show Mode
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('show');
    });
    await page.waitForTimeout(800);
    const showPath = path.join(EVIDENCE_DIR, '01_standard_showmode.png');
    await page.screenshot({ path: showPath });
    expect(fs.existsSync(showPath)).toBe(true);

    const lumShow = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('Standard Hall Show Mode Luminance:', lumShow);
    expect(lumShow.meanLuminance).toBeLessThan(lumAisle.meanLuminance);
  });

  // Hall 2: Grand Curved Hall with Balcony
  test('02. Grand Curved Hall with Balcony — Curved rows, mid-hall cross aisle handrail, real balcony with see-through rails and no columns, burgundy-brown panels, black stage apron', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/3?mode=3d&showtime=11', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(1000);

    // Verify balcony structure & support columns
    const balconyCheck = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      const geo = store.proceduralResult?.geometry;
      return {
        hasBalconyStructure: !!geo?.balconyStructure,
        columnsCount: geo?.balconyStructure?.columns?.length ?? 0,
        handrailsCount: geo?.crossAisleHandrails?.length ?? 0,
        isCurved: Boolean(
          store.auditoriumLayout?.screen?.is_curved ||
          store.auditoriumLayout?.features?.curved_screen ||
          (store.auditoriumLayout?.curve_radius && store.auditoriumLayout.curve_radius > 0)
        ),
      };
    });

    console.log('Balcony Structure Check:', balconyCheck);
    expect(balconyCheck.hasBalconyStructure).toBe(true);
    // Structural columns removed from seating area; balcony cantilevered from rear wall/ceiling
    expect(balconyCheck.columnsCount).toBe(0);
    expect(balconyCheck.handrailsCount).toBeGreaterThanOrEqual(1);
    expect(balconyCheck.isCurved).toBe(true);

    // Set Lights on
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('full');
      (window as any).__cineverse.setCameraPreset('overview');
    });
    await page.waitForTimeout(600);

    // 1. Aisle view toward screen
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('walk');
    });
    await page.waitForTimeout(600);
    const aislePath = path.join(EVIDENCE_DIR, '02_balcony_aisle_view_lightson.png');
    await page.screenshot({ path: aislePath });
    expect(fs.existsSync(aislePath)).toBe(true);

    const lumAisle = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('Balcony Hall Aisle Luminance:', lumAisle);
    expect(lumAisle.meanLuminance).toBeGreaterThanOrEqual(0.30);
    expect(lumAisle.meanLuminance).toBeLessThanOrEqual(0.45);
    expect(lumAisle.nearBlackPercent).toBeLessThanOrEqual(5.0);
    expect(lumAisle.maxHueDominancePercent).toBeLessThanOrEqual(40.0);

    // 2. View from behind seats (Balcony tier view)
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('balcony');
    });
    await page.waitForTimeout(600);
    const rearPath = path.join(EVIDENCE_DIR, '02_balcony_rear_seats_view_lightson.png');
    await page.screenshot({ path: rearPath });
    expect(fs.existsSync(rearPath)).toBe(true);

    // 3. Close-up of seats and a stair
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('sit');
    });
    await page.waitForTimeout(600);
    const closeupPath = path.join(EVIDENCE_DIR, '02_balcony_seats_stairs_closeup_lightson.png');
    await page.screenshot({ path: closeupPath });
    expect(fs.existsSync(closeupPath)).toBe(true);

    // 4. Show Mode
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('show');
    });
    await page.waitForTimeout(800);
    const showPath = path.join(EVIDENCE_DIR, '02_balcony_showmode.png');
    await page.screenshot({ path: showPath });
    expect(fs.existsSync(showPath)).toBe(true);
  });

  // Hall 3: Luxury Recliner Hall
  test('03. Luxury Recliner Hall — Black walls with amber outline panels, quilted caramel leather recliners with wooden swivel tables, brass badges, dark wood side panels', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/4?mode=3d&showtime=16', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(1000);

    // Verify recliner accessories & amber panels
    const reclinerCheck = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      const geo = store.proceduralResult?.geometry;
      return {
        theatreType: store.auditoriumLayout?.theatre_type,
        tablesCount: geo?.reclinerAccessories?.length ?? 0,
        amberPanelsCount: geo?.amberOutlinePanels?.length ?? 0,
      };
    });

    console.log('Luxury Recliner Check:', reclinerCheck);
    expect(reclinerCheck.theatreType).toBe('luxury_recliner');
    expect(reclinerCheck.tablesCount).toBeGreaterThanOrEqual(50);
    expect(reclinerCheck.amberPanelsCount).toBeGreaterThanOrEqual(6);

    // Set Lights on
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('full');
      (window as any).__cineverse.setCameraPreset('overview');
    });
    await page.waitForTimeout(600);

    // 1. Aisle view toward screen
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('walk');
    });
    await page.waitForTimeout(600);
    const aislePath = path.join(EVIDENCE_DIR, '03_luxury_aisle_view_lightson.png');
    await page.screenshot({ path: aislePath });
    expect(fs.existsSync(aislePath)).toBe(true);

    const lumAisle = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('Luxury Recliner Hall Aisle Luminance:', lumAisle);
    expect(lumAisle.meanLuminance).toBeGreaterThanOrEqual(0.22);
    expect(lumAisle.meanLuminance).toBeLessThanOrEqual(0.35);
    expect(lumAisle.nearBlackPercent).toBeLessThanOrEqual(5.0);
    expect(lumAisle.maxHueDominancePercent).toBeLessThanOrEqual(40.0);

    // 2. View from behind seats
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('rear');
    });
    await page.waitForTimeout(600);
    const rearPath = path.join(EVIDENCE_DIR, '03_luxury_rear_seats_view_lightson.png');
    await page.screenshot({ path: rearPath });
    expect(fs.existsSync(rearPath)).toBe(true);

    // 3. Close-up of seats with swivel table, brass badge and a stair
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('sit');
    });
    await page.waitForTimeout(600);
    const closeupPath = path.join(EVIDENCE_DIR, '03_luxury_seats_stairs_closeup_lightson.png');
    await page.screenshot({ path: closeupPath });
    expect(fs.existsSync(closeupPath)).toBe(true);

    // 4. Show Mode
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('show');
    });
    await page.waitForTimeout(800);
    const showPath = path.join(EVIDENCE_DIR, '03_luxury_showmode.png');
    await page.screenshot({ path: showPath });
    expect(fs.existsSync(showPath)).toBe(true);
  });

  // Hall 4: Motion-Seat Hall
  test('04. Motion-Seat Hall — Black walls/ceiling with radiating coloured LED bars, pod bases with red LED edges, cross-aisle handrails, panoramic wrap screen, generic branding', async ({ page }) => {
    await page.goto('/cinemas/2/auditorium/5?mode=3d&showtime=21', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as any).__cineverse, { timeout: 60000 });
    await page.waitForTimeout(1000);

    // Verify motion LED bars, pod bases & handrails
    const motionCheck = await page.evaluate(() => {
      const store = (window as any).useCinemaStore.getState();
      const geo = store.proceduralResult?.geometry;
      const previewBtn = document.querySelector('[data-testid="start-4dx-preview-btn"]');
      return {
        theatreType: store.auditoriumLayout?.theatre_type,
        motionLedBarsCount: geo?.motionLedBars?.length ?? 0,
        podBasesCount: geo?.motionPodBases?.length ?? 0,
        handrailsCount: geo?.crossAisleHandrails?.length ?? 0,
        previewBtnText: previewBtn?.textContent?.trim() || '',
      };
    });

    console.log('Motion Hall Architecture Check:', motionCheck);
    expect(['motion_seat', 'dolby_atmos_4dx']).toContain(motionCheck.theatreType);
    expect(motionCheck.motionLedBarsCount).toBeGreaterThanOrEqual(12);
    expect(motionCheck.podBasesCount).toBeGreaterThanOrEqual(10);
    expect(motionCheck.handrailsCount).toBeGreaterThanOrEqual(1);
    // Generic button text check (strictly no 4DX trademark)
    expect(motionCheck.previewBtnText).toMatch(/Motion[- ]seat (experience )?preview/i);
    expect(motionCheck.previewBtnText).not.toContain('4DX');

    // Set Lights on
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('full');
      (window as any).__cineverse.setCameraPreset('overview');
    });
    await page.waitForTimeout(600);

    // 1. Aisle view toward screen
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('walk');
    });
    await page.waitForTimeout(600);
    const aislePath = path.join(EVIDENCE_DIR, '04_motion_aisle_view_lightson.png');
    await page.screenshot({ path: aislePath });
    expect(fs.existsSync(aislePath)).toBe(true);

    const lumAisle = await page.evaluate(() => (window as any).__cineverse.sampleLuminance());
    console.log('Motion Hall Aisle Luminance:', lumAisle);
    expect(lumAisle.meanLuminance).toBeGreaterThanOrEqual(0.18);
    expect(lumAisle.meanLuminance).toBeLessThanOrEqual(0.30);
    expect(lumAisle.nearBlackPercent).toBeLessThanOrEqual(5.0);
    expect(lumAisle.maxHueDominancePercent).toBeLessThanOrEqual(40.0);

    // 2. View from behind seats
    await page.evaluate(() => {
      (window as any).__cineverse.setCameraPreset('rear');
    });
    await page.waitForTimeout(600);
    const rearPath = path.join(EVIDENCE_DIR, '04_motion_rear_seats_view_lightson.png');
    await page.screenshot({ path: rearPath });
    expect(fs.existsSync(rearPath)).toBe(true);

    // 3. Close-up of seats on pod bases and a stair
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('sit');
    });
    await page.waitForTimeout(600);
    const closeupPath = path.join(EVIDENCE_DIR, '04_motion_seats_stairs_closeup_lightson.png');
    await page.screenshot({ path: closeupPath });
    expect(fs.existsSync(closeupPath)).toBe(true);

    // 4. Show Mode
    await page.evaluate(() => {
      (window as any).__cineverse.setHouseLights('show');
    });
    await page.waitForTimeout(800);
    const showPath = path.join(EVIDENCE_DIR, '04_motion_showmode.png');
    await page.screenshot({ path: showPath });
    expect(fs.existsSync(showPath)).toBe(true);
  });
});
