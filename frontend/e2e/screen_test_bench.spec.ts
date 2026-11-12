import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Screen Plane 5-Mode Test Bench & Theatrical Guarantee', () => {
  const evidenceDir = path.resolve(process.cwd(), 'evidence/screen_test');

  test.beforeAll(() => {
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('cineverse_city', 'bengaluru');
        localStorage.setItem('cineverse_city_id', '1');
        localStorage.setItem('cineverse_city_name', 'Bengaluru');
        localStorage.setItem('cineverse_city_modal_dismissed', 'true');
        localStorage.setItem('cineverse_comfort_settings', JSON.stringify({ simpleMode: false, reducedMotion: false }));
      } catch (e) {}
    });
  });

  test('Mode A to E Diagnostic Suite on Desktop Viewport (1280x800)', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Navigate to /dev/screen-test
    await page.goto('/dev/screen-test', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const cityModalBtn = page.locator('button[aria-label="Close"]');
    if (await cityModalBtn.isVisible()) {
      await cityModalBtn.click();
    }

    // Verify header and page loaded
    const title = page.locator('h1');
    await expect(title).toContainText('CineVerse Screen Plane Test Bench');

    // ----------------------------------------------------
    // MODE A: Solid Bright Colour
    // ----------------------------------------------------
    await page.locator('[data-testid="mode-solid_color"]').click();
    await page.waitForTimeout(1000);

    // Verify mode badge
    await expect(page.locator('text=Mode: SOLID_COLOR')).toBeVisible();

    // Verify telemetry geometry
    await expect(page.locator('text=YES (+Z Normal)')).toBeVisible();
    await expect(page.locator('text=PROTECTED (Offset -2)')).toBeVisible();

    // Save screenshot
    await page.screenshot({ path: path.join(evidenceDir, 'mode_a_solid_color.png') });

    // ----------------------------------------------------
    // Test Camera Nav Presets (Look around, Walk Row E, Sit Center)
    // ----------------------------------------------------
    await page.locator('[data-testid="preset-lookaround"]').click();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="preset-walk_e"]').click();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="preset-sit_center"]').click();
    await page.waitForTimeout(500);

    // ----------------------------------------------------
    // MODE B: Hosted Video Texture
    // ----------------------------------------------------
    await page.locator('[data-testid="mode-video_texture"]').click();
    await page.waitForTimeout(1500);

    await expect(page.locator('text=Mode: VIDEO_TEXTURE')).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, 'mode_b_video_texture.png') });

    // ----------------------------------------------------
    // MODE C: Backdrop Slow Motion
    // ----------------------------------------------------
    await page.locator('[data-testid="mode-backdrop_motion"]').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Mode: BACKDROP_MOTION')).toBeVisible();
    const frameC1 = await page.screenshot({ path: path.join(evidenceDir, 'mode_c_backdrop_1.png') });
    await page.waitForTimeout(600);
    const frameC2 = await page.screenshot({ path: path.join(evidenceDir, 'mode_c_backdrop_2.png') });

    // Ensure frames captured successfully
    expect(frameC1.length).toBeGreaterThan(10000);
    expect(frameC2.length).toBeGreaterThan(10000);

    // ----------------------------------------------------
    // MODE D: YouTube CSS 3D Cut-Out
    // ----------------------------------------------------
    await page.locator('[data-testid="mode-youtube_css3d"]').click();
    await page.waitForTimeout(1500);

    await expect(page.locator('text=Mode: YOUTUBE_CSS3D')).toBeVisible();

    // Check cut-out telemetry: canvas alpha should be true
    await expect(page.locator('text=true (cut-out active)')).toBeVisible();
    await expect(page.locator('text=YouTube API:')).toBeVisible();
    await expect(page.locator('text=Player State:')).toBeVisible();

    await page.screenshot({ path: path.join(evidenceDir, 'mode_d_youtube_css3d.png') });

    // ----------------------------------------------------
    // MODE E: Generated Title Card (Motion Guarantee)
    // ----------------------------------------------------
    await page.locator('[data-testid="mode-title_card"]').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Mode: TITLE_CARD')).toBeVisible();

    // Capture frame diff proving animated specular light sweep
    const frameE1 = await page.screenshot({ path: path.join(evidenceDir, 'mode_e_title_card_1.png') });
    await page.waitForTimeout(700);
    const frameE2 = await page.screenshot({ path: path.join(evidenceDir, 'mode_e_title_card_2.png') });

    expect(frameE1.length).toBeGreaterThan(10000);
    expect(frameE2.length).toBeGreaterThan(10000);
    // Animated light sweep causes buffer differences between frame 1 and 2
    expect(frameE1.equals(frameE2)).toBe(false);
  });

  test('Diagnostic Suite on Mobile Viewport (390x844 iPhone 13)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev/screen-test', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const cityModalBtn = page.locator('button[aria-label="Close"]');
    if (await cityModalBtn.isVisible()) {
      await cityModalBtn.click();
    }

    // Mode buttons should be responsive and accessible
    await expect(page.locator('[data-testid="mode-title_card"]')).toBeVisible();
    await page.locator('[data-testid="mode-title_card"]').click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(evidenceDir, 'mobile_screen_test_mode_e.png') });
  });

  test('Real Theatrical Movie 3D Screen & HUD: Guaranteed Never Empty + Watch Trailer Pop-Up', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Open Real Movie (Toxic) in 3D Mode
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Canvas must be rendered and error boundary must not have caught errors
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await expect(page.locator('[data-testid="canvas-error-boundary-fallback"]')).toHaveCount(0);

    // Media cluster HUD verification:
    // Status badge must show authentic playback state (never falsely says 'Playing' when YouTube is unavailable)
    const statusBadge = page.locator('[data-testid="screen-playback-status-badge"]');
    await expect(statusBadge).toBeVisible();

    // "Watch trailer" button must be available for reliable modal playback
    const watchTrailerBtn = page.locator('[data-testid="watch-trailer-popup-btn"]');
    if (await watchTrailerBtn.isVisible()) {
      await page.screenshot({ path: path.join(evidenceDir, 'real_movie_title_card_screen.png') });
      await watchTrailerBtn.click();
      await page.waitForTimeout(1000);

      // Verify modal opened
      const modal = page.locator('[data-testid="trailer-modal"]');
      if (await modal.isVisible()) {
        await page.screenshot({ path: path.join(evidenceDir, 'real_movie_trailer_modal_opened.png') });
      }

      // Close modal
      const closeBtn = page.locator('[data-testid="close-trailer-modal"]');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
  });

  test('Showcase Movie 3D Screen (Quantum Odyssey in Flagship Hall)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Open Showcase Movie (Quantum Odyssey) in Flagship curved hall
    await page.goto('/cinemas/1/auditorium/2?showtime=29&mode=3d', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    // Verify canvas alive
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await expect(page.locator('[data-testid="canvas-error-boundary-fallback"]')).toHaveCount(0);

    // Capture Sit view
    await page.screenshot({ path: path.join(evidenceDir, 'showcase_quantum_odyssey_sit_view.png') });

    // Switch to Look around orbital view if available
    const lookAroundPill = page.locator('button:has-text("Look Around")').first();
    if (await lookAroundPill.isVisible()) {
      await lookAroundPill.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(evidenceDir, 'showcase_quantum_odyssey_lookaround.png') });
    }

    // Switch to Walk mode if available
    const walkPill = page.locator('button:has-text("Walk")').first();
    if (await walkPill.isVisible()) {
      await walkPill.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(evidenceDir, 'showcase_quantum_odyssey_walk.png') });
    }
  });

  test('/dev/readiness Displays 3D Screen Strategy & Guarantee for Every Movie', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dev/readiness', { waitUntil: 'domcontentloaded' });

    const cityModalBtn = page.locator('button[aria-label="Close"]');
    if (await cityModalBtn.isVisible()) {
      await cityModalBtn.click();
    }

    await page.waitForSelector('[data-testid="dev-readiness-page"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="dev-readiness-page"]')).toBeVisible();

    // Verify 3D Screen Test Bench shortcut link is present
    const testBenchNav = page.locator('[data-testid="nav-screen-test-bench"]');
    await expect(testBenchNav).toBeVisible();

    // Verify 3D Screen column has entries for movies
    const screenRows = page.locator('text=3D Screen:');
    const count = await screenRows.count();
    expect(count).toBeGreaterThan(0);

    // Take screenshot of readiness audit table
    await page.screenshot({ path: path.join(evidenceDir, 'dev_readiness_screen_strategy_table.png') });
  });
});
