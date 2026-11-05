import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const EVIDENCE_DIR = path.join(process.cwd(), '..', 'docs', 'evidence', 'phase-2e');

function computeBufferDiffPct(pathA: string, pathB: string): number {
  if (!fs.existsSync(pathA) || !fs.existsSync(pathB)) return 0;
  const bufA = fs.readFileSync(pathA);
  const bufB = fs.readFileSync(pathB);
  const minLen = Math.min(bufA.length, bufB.length);
  if (minLen === 0) return 0;
  let diffCount = 0;
  let total = 0;
  for (let i = 64; i < minLen - 64; i += 4) {
    total++;
    if (Math.abs(bufA[i] - bufB[i]) > 8) {
      diffCount++;
    }
  }
  return total > 0 ? (diffCount / total) * 100 : 0;
}

test.describe('Phase 2e — Part 4: Reliable 3D Screen Trailer Playback (Finding E4)', () => {
  test.beforeAll(async () => {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    // Pre-seed city selection in localStorage so city modal does not intercept pointer clicks
    await page.addInitScript(() => {
      localStorage.setItem('cineverse_city_slug', 'bengaluru');
      localStorage.setItem('cineverse_city_id', '1');
      localStorage.setItem('cineverse_city_name', 'Bengaluru');
    });
  });

  test('01. Movie Page: Watch Trailer modal plays active video with advancing time', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/movies/1');
    await page.waitForLoadState('networkidle');

    // Dismiss city modal if still present
    const cityClose = page.locator('button[aria-label="Close"]');
    if (await cityClose.isVisible().catch(() => false)) {
      await cityClose.click().catch(() => {});
    }

    const playBtn = page.locator('[data-testid="movie-play-trailer-btn"]');
    await expect(playBtn).toBeVisible({ timeout: 15000 });
    await playBtn.click({ force: true });

    const video = page.locator('video[data-testid="main-trailer-video"]');
    await expect(video).toBeVisible({ timeout: 15000 });

    // Ensure video is playing and currentTime is advancing
    await page.waitForFunction(() => {
      const v = document.querySelector('video[data-testid="main-trailer-video"]') as HTMLVideoElement;
      return v && !v.paused && v.currentTime > 0;
    }, { timeout: 15000 });

    const shotT0 = path.join(EVIDENCE_DIR, '15_modal_frame_t0.png');
    await page.screenshot({ path: shotT0 });

    // Wait 2.2 seconds
    await page.waitForTimeout(2200);

    const shotT2 = path.join(EVIDENCE_DIR, '16_modal_frame_t2.png');
    await page.screenshot({ path: shotT2 });

    const diffPct = computeBufferDiffPct(shotT0, shotT2);
    console.log(`Modal trailer frame difference: ${diffPct.toFixed(2)}%`);
    expect(diffPct).toBeGreaterThan(0.5);
  });

  test('02. 3D Theatre: Movie 1 (Quantum Odyssey) plays on screen in Overview, Walk, A05, and J10', async ({ page }) => {
    test.setTimeout(90000); // 90s for multi-view test
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');

    // Wait for 3D engine & video element
    await page.waitForFunction(() => {
      const cv = (window as any).__cineverse;
      const v = (window as any).__cineverse_video;
      return cv && v && v.readyState >= 2;
    }, { timeout: 20000 });

    // Start video playback if paused
    await page.evaluate(() => {
      const v = (window as any).__cineverse_video;
      if (v && v.paused) v.play().catch(() => {});
    });
    await page.waitForTimeout(1000);

    // 1. Overview Mode (t0 and t2)
    const ovT0 = path.join(EVIDENCE_DIR, '17_3d_movie1_overview_t0.png');
    await page.screenshot({ path: ovT0 });
    await page.waitForTimeout(2200);
    const ovT2 = path.join(EVIDENCE_DIR, '18_3d_movie1_overview_t2.png');
    await page.screenshot({ path: ovT2 });
    const ovDiff = computeBufferDiffPct(ovT0, ovT2);
    console.log(`Movie 1 Overview diff: ${ovDiff.toFixed(2)}%`);
    expect(ovDiff).toBeGreaterThan(0.2);

    // 2. Walk Mode at Row E (t0 and t2)
    await page.evaluate(() => {
      (window as any).__cineverse.setMode('walk');
      (window as any).__cineverse.teleportToRow('E');
    });
    await page.waitForTimeout(800);

    const walkT0 = path.join(EVIDENCE_DIR, '19_3d_movie1_walk_rowE_t0.png');
    await page.screenshot({ path: walkT0 });
    await page.waitForTimeout(2200);
    const walkT2 = path.join(EVIDENCE_DIR, '20_3d_movie1_walk_rowE_t2.png');
    await page.screenshot({ path: walkT2 });
    const walkDiff = computeBufferDiffPct(walkT0, walkT2);
    console.log(`Movie 1 Walk Row E diff: ${walkDiff.toFixed(2)}%`);
    expect(walkDiff).toBeGreaterThan(0.2);

    // 3. Seated at A05 (Front center)
    await page.evaluate(() => (window as any).__cineverse.sitAt('A05'));
    await page.waitForTimeout(1000);

    const a05T0 = path.join(EVIDENCE_DIR, '21_3d_movie1_seated_A05_t0.png');
    await page.screenshot({ path: a05T0 });
    await page.waitForTimeout(2200);
    const a05T2 = path.join(EVIDENCE_DIR, '22_3d_movie1_seated_A05_t2.png');
    await page.screenshot({ path: a05T2 });
    const a05Diff = computeBufferDiffPct(a05T0, a05T2);
    console.log(`Movie 1 Seated A05 diff: ${a05Diff.toFixed(2)}%`);
    expect(a05Diff).toBeGreaterThan(0.2);

    // 4. Seated at J10 (Rear right)
    await page.evaluate(() => (window as any).__cineverse.sitAt('J10'));
    await page.waitForTimeout(1000);

    const j10T0 = path.join(EVIDENCE_DIR, '23_3d_movie1_seated_J10_t0.png');
    await page.screenshot({ path: j10T0 });
    await page.waitForTimeout(2200);
    const j10T2 = path.join(EVIDENCE_DIR, '24_3d_movie1_seated_J10_t2.png');
    await page.screenshot({ path: j10T2 });
    const j10Diff = computeBufferDiffPct(j10T0, j10T2);
    console.log(`Movie 1 Seated J10 diff: ${j10Diff.toFixed(2)}%`);
    expect(j10Diff).toBeGreaterThan(0.2);
  });

  test('03. 3D Theatre: Movie 2 (Astra) plays continuously on 3D screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/cinemas/1/auditorium/1?showtime=2&mode=3d');

    await page.waitForFunction(() => {
      const cv = (window as any).__cineverse;
      const v = (window as any).__cineverse_video;
      return cv && v && v.readyState >= 2;
    }, { timeout: 20000 });

    await page.evaluate(() => {
      const v = (window as any).__cineverse_video;
      if (v && v.paused) v.play().catch(() => {});
    });
    await page.waitForTimeout(1000);

    const m2T0 = path.join(EVIDENCE_DIR, '25_3d_movie2_overview_t0.png');
    await page.screenshot({ path: m2T0 });
    await page.waitForTimeout(2200);
    const m2T2 = path.join(EVIDENCE_DIR, '26_3d_movie2_overview_t2.png');
    await page.screenshot({ path: m2T2 });

    const m2Diff = computeBufferDiffPct(m2T0, m2T2);
    console.log(`Movie 2 Overview diff: ${m2Diff.toFixed(2)}%`);
    expect(m2Diff).toBeGreaterThan(0.2);
  });

  test('04. 3D Theatre: Movie 3 plays continuously on 3D screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/cinemas/1/auditorium/1?showtime=3&mode=3d');

    await page.waitForFunction(() => {
      const cv = (window as any).__cineverse;
      return !!cv;
    }, { timeout: 20000 });

    await page.evaluate(() => {
      const v = (window as any).__cineverse_video;
      if (v && v.paused) v.play().catch(() => {});
    });
    await page.waitForTimeout(1000);

    const m3T0 = path.join(EVIDENCE_DIR, '27_3d_movie3_overview_t0.png');
    await page.screenshot({ path: m3T0 });
    await page.waitForTimeout(2200);
    const m3T2 = path.join(EVIDENCE_DIR, '28_3d_movie3_overview_t2.png');
    await page.screenshot({ path: m3T2 });

    const m3Diff = computeBufferDiffPct(m3T0, m3T2);
    console.log(`Movie 3 diff: ${m3Diff.toFixed(2)}%`);
    expect(m3Diff).toBeGreaterThan(0.1);
  });

  test('05. Phone Viewport (390x844): Trailer playback on 3D screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');

    await page.waitForFunction(() => {
      const cv = (window as any).__cineverse;
      return !!cv;
    }, { timeout: 20000 });

    await page.evaluate(() => {
      const v = (window as any).__cineverse_video;
      if (v && v.paused) v.play().catch(() => {});
    });
    await page.waitForTimeout(1000);

    const mobT0 = path.join(EVIDENCE_DIR, '29_3d_mobile_trailer_t0.png');
    await page.screenshot({ path: mobT0 });
    await page.waitForTimeout(2200);
    const mobT2 = path.join(EVIDENCE_DIR, '30_3d_mobile_trailer_t2.png');
    await page.screenshot({ path: mobT2 });

    const mobDiff = computeBufferDiffPct(mobT0, mobT2);
    console.log(`Mobile 3D trailer diff: ${mobDiff.toFixed(2)}%`);
    expect(mobDiff).toBeGreaterThan(0.2);
  });
});
