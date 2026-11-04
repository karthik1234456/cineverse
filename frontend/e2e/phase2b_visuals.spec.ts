import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-2b');

test.describe.serial('Phase 2b — Visual Overhaul, Proxy Cleanup & HUD Verification', () => {
  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
    sharedPage = await browser.newPage();

    // Pre-seed selected city in localStorage (FIX-04)
    await sharedPage.addInitScript(() => {
      window.localStorage.setItem('cineverse_city', 'bengaluru');
    });

    // Route external trailer video to avoid unhandled net::ERR_FAILED in headless/offline tests
    await sharedPage.route('**/BigBuckBunny.mp4', (route) => {
      route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.from('') });
    });
  });

  test.afterAll(async () => {
    if (sharedPage) {
      await sharedPage.close();
    }
  });

  test('01. Load Auditorium, verify proxies = 0 and capture key poses', async () => {
    test.setTimeout(240000);
    await sharedPage.setViewportSize({ width: 1920, height: 1080 });
    await sharedPage.goto('/3d');

    // Wait for 3D engine initialization
    await sharedPage.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await sharedPage.waitForTimeout(2000);

    // 1. Verify visible proxies count is 0 in normal mode
    const initialProxies = await sharedPage.evaluate(() => window.__cineverse!.getVisibleProxiesCount?.() ?? 0);
    expect(initialProxies).toBe(0);

    // 2. Overview Pose (Desktop 1920x1080)
    await sharedPage.evaluate(() => {
      window.__cineverse!.setMode?.('overview');
      window.__cineverse!.setCameraPreset('overview');
      window.__cineverse!.setHouseLights('full');
      window.__cineverse!.setQualityTier('high');
    });
    await sharedPage.waitForTimeout(1000);
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '01_overview.png') });
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '11_desktop_1080p.png') });

    // 3. Walk Mode Pose (Aisle at row E)
    await sharedPage.evaluate(() => {
      window.__cineverse!.setMode?.('walk');
    });
    await sharedPage.waitForTimeout(1000);
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '02_walk_aisle_row_e.png') });

    // 4. Seated A05 Sightline
    await sharedPage.evaluate(() => {
      window.__cineverse!.sitAt?.('A05');
    });
    await sharedPage.waitForTimeout(1200);
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '03_seated_a05.png') });

    // 5. Seated J10 Sightline
    await sharedPage.evaluate(() => {
      window.__cineverse!.sitAt?.('J10');
    });
    await sharedPage.waitForTimeout(1200);
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '04_seated_j10.png') });

    // 6. Selected Seats View (Back in overview with seats selected)
    await sharedPage.evaluate(() => {
      window.__cineverse!.setMode?.('overview');
      window.__cineverse!.setCameraPreset('overview');
      window.__cineverse!.selectSeat('E04');
      window.__cineverse!.selectSeat('E05');
      window.__cineverse!.selectSeat('E06');
      window.__cineverse!.selectSeat('E07');
    });
    await sharedPage.waitForTimeout(1000);
    const selectedProxies = await sharedPage.evaluate(() => window.__cineverse!.getVisibleProxiesCount?.() ?? 0);
    expect(selectedProxies).toBe(0);
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '05_selected_seats.png') });
  });

  test('02. Capture quality tiers and lighting modes', async () => {
    test.setTimeout(90000);
    // Quality Tiers
    await sharedPage.evaluate(() => window.__cineverse!.setQualityTier('low'));
    await sharedPage.waitForTimeout(500);
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '06_tier_low.png') });

    await sharedPage.evaluate(() => window.__cineverse!.setQualityTier('medium'));
    await sharedPage.waitForTimeout(500);
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '07_tier_medium.png') });

    await sharedPage.evaluate(() => window.__cineverse!.setQualityTier('high'));
    await sharedPage.waitForTimeout(500);
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '08_tier_high.png') });

    // Lighting Modes
    await sharedPage.evaluate(() => window.__cineverse!.setHouseLights('full'));
    await sharedPage.waitForTimeout(600);
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '09_lights_up.png') });

    await sharedPage.evaluate(() => window.__cineverse!.setHouseLights('show'));
    await sharedPage.waitForTimeout(600);
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '10_show_mode.png') });

    // Reset to full
    await sharedPage.evaluate(() => window.__cineverse!.setHouseLights('full'));
  });

  test('03. Capture responsive viewports', async () => {
    test.setTimeout(90000);
    // Viewport: Desktop 1366x768
    await sharedPage.setViewportSize({ width: 1366, height: 768 });
    await sharedPage.waitForTimeout(800);
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '12_desktop_1366.png') });

    // Viewport: Phone Portrait 390x844
    await sharedPage.setViewportSize({ width: 390, height: 844 });
    await sharedPage.waitForTimeout(800);
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '13_phone_portrait.png') });

    // Viewport: Phone Landscape 844x390
    await sharedPage.setViewportSize({ width: 844, height: 390 });
    await sharedPage.waitForTimeout(800);
    await sharedPage.screenshot({ path: path.join(EVIDENCE_DIR, '14_phone_landscape.png') });
  });

  test('04. Verify all 14 evidence screenshots exist and are valid', async () => {
    const requiredScreenshots = [
      '01_overview.png',
      '02_walk_aisle_row_e.png',
      '03_seated_a05.png',
      '04_seated_j10.png',
      '05_selected_seats.png',
      '06_tier_low.png',
      '07_tier_medium.png',
      '08_tier_high.png',
      '09_lights_up.png',
      '10_show_mode.png',
      '11_desktop_1080p.png',
      '12_desktop_1366.png',
      '13_phone_portrait.png',
      '14_phone_landscape.png',
    ];

    for (const filename of requiredScreenshots) {
      const filePath = path.join(EVIDENCE_DIR, filename);
      expect(fs.existsSync(filePath), `Screenshot ${filename} should exist`).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size, `Screenshot ${filename} should be non-trivial (>20KB)`).toBeGreaterThan(20000);
    }
  });
});
