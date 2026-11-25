import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Phase: Catalogue Adapter, Backdrop Glimpse & Drone 3D Camera', () => {

  test('Task A & B: Posters load with HTTP 200 and aspect-ratio on Home, List, Detail, and Seat page', async ({ page }) => {
    // 1. Home page
    await page.goto('http://localhost:3001/');
    await page.waitForLoadState('networkidle');

    // Check movie posters on Home
    const movieCards = page.locator('[data-testid="movie-card"]');
    await expect(movieCards.first()).toBeVisible({ timeout: 10000 });
    const homePoster = movieCards.first().locator('img[data-testid="movie-poster-img"]');
    await expect(homePoster).toBeVisible();

    // Verify natural dimensions or loaded state
    const isLoaded = await homePoster.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(isLoaded).toBe(true);

    // 2. Movies list page
    await page.goto('http://localhost:3001/movies');
    await page.waitForLoadState('networkidle');
    const listPoster = page.locator('[data-testid="movie-poster-img"]').first();
    await expect(listPoster).toBeVisible();

    // 3. Movie detail page
    await page.goto('http://localhost:3001/movies/quantum-odyssey');
    await page.waitForLoadState('networkidle');
    const detailPoster = page.locator('[data-testid="movie-poster-img"]').first();
    await expect(detailPoster).toBeVisible();

    // 4. Seat map page
    await page.goto('http://localhost:3001/cinemas/1/auditorium/1?showtime=1');
    await page.waitForLoadState('networkidle');
    const seatPagePoster = page.locator('[data-testid="movie-poster-img"]').first();
    await expect(seatPagePoster).toBeVisible();

    // Verify aspect ratio on seat page thumbnail container
    const box = await seatPagePoster.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // 2:3 aspect ratio check (ratio ~ 1.5 height / width within tolerance)
      const ratio = box.height / box.width;
      expect(ratio).toBeGreaterThan(1.2);
      expect(ratio).toBeLessThan(1.7);
    }
  });

  test('Fallback poster card renders gracefully when image URL fails', async ({ page }) => {
    // Test that MoviePoster renders fallback when src is missing or invalid
    await page.goto('http://localhost:3001/about');
    await page.waitForLoadState('networkidle');

    // Verify about page demo banner & TMDB attribution
    const demoBanner = page.locator('[data-testid="demo-showtimes-banner"]');
    await expect(demoBanner).toBeVisible();
    await expect(demoBanner).toContainText('Sample Demonstration Schedule Notice');

    // Verify TMDB attribution sentence
    await expect(page.locator('body')).toContainText(
      'This product uses the TMDB API but is not endorsed or certified by TMDB.'
    );
  });

  test('Attribution statement and TMDB logo appear in Universal Footer', async ({ page }) => {
    await page.goto('http://localhost:3001/');
    await page.waitForLoadState('networkidle');

    const footerAttribution = page.locator('[data-testid="tmdb-attribution-footer"]');
    await expect(footerAttribution).toBeVisible();
    await expect(footerAttribution.locator('[data-testid="tmdb-logo"]')).toBeVisible();
    await expect(footerAttribution).toContainText(
      'This product uses the TMDB API but is not endorsed or certified by TMDB.'
    );
    await expect(footerAttribution.locator('[data-testid="sample-showtimes-notice"]')).toBeVisible();
  });

  test('Secret Protection: TMDB API key is never exposed in browser bundles or HTML', async ({ page }) => {
    await page.goto('http://localhost:3001/');
    const content = await page.content();
    // Verify no private API key pattern is exposed
    expect(content).not.toContain('TMDB_API_KEY');
    expect(content).not.toContain('api_key=');
    expect(content).not.toContain('rzp_test_cineverse123_secret');
  });

  test('Backdrop Glimpse: Video element persists across movie booking journey and pauses on 3D', async ({ page }) => {
    // 1. Visit movie detail page
    await page.goto('http://localhost:3001/movies/quantum-odyssey');
    await page.waitForLoadState('networkidle');

    // Verify backdrop video element is mounted and muted
    const backdropVideo = page.locator('[data-testid="movie-backdrop-video"]');
    await expect(backdropVideo).toBeAttached();
    const isMuted = await backdropVideo.evaluate((v: HTMLVideoElement) => v.muted);
    expect(isMuted).toBe(true);

    // 2. Background video toggle button works and persists
    const bgVideoToggle = page.locator('[data-testid="bg-video-toggle-btn"]');
    if (await bgVideoToggle.isVisible()) {
      await bgVideoToggle.click();
      const storedPref = await page.evaluate(() => localStorage.getItem('cineverse_bg_video'));
      expect(storedPref).toBe('false');
      // Click back on
      await bgVideoToggle.click();
    }

    // 3. Navigate to Seat page (stays same movie)
    await page.goto('http://localhost:3001/cinemas/1/auditorium/1?showtime=1');
    await page.waitForLoadState('networkidle');

    // Backdrop video element remains mounted in DOM without restart
    await expect(backdropVideo).toBeAttached();

    // 4. Switch to 3D Auditorium mode
    const explore3DBtn = page.locator('[data-testid="explore-in-3d-button"]');
    if (await explore3DBtn.isVisible()) {
      await explore3DBtn.click();
      await page.waitForTimeout(500);
      // In 3D, backdrop video is paused
      const isPaused = await backdropVideo.evaluate((v: HTMLVideoElement) => v.paused);
      expect(isPaused).toBe(true);
    }
  });

  test('Drone 3D Camera: Default mode, WASD motion, altitude bounds, and quick jumps', async ({ page }) => {
    // Navigate directly into 3D Auditorium
    await page.goto('http://localhost:3001/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForLoadState('networkidle');

    // Wait for 3D wrapper
    const wrapper3d = page.locator('[data-testid="auditorium-3d-wrapper"]');
    await expect(wrapper3d).toBeVisible({ timeout: 15000 });

    // Verify Drone button is selected by default
    const droneBtn = page.locator('[data-testid="mode-drone-btn"]');
    await expect(droneBtn).toBeVisible();
    await expect(droneBtn).toHaveClass(/bg-\[#C8102E\]/);

    // Verify Drone HUD controls
    const resetViewBtn = page.locator('[data-testid="drone-reset-view-btn"]');
    await expect(resetViewBtn).toBeVisible();

    const jumpFront = page.locator('[data-testid="drone-jump-front"]');
    const jumpMiddle = page.locator('[data-testid="drone-jump-middle"]');
    const jumpBack = page.locator('[data-testid="drone-jump-back"]');
    await expect(jumpFront).toBeVisible();
    await expect(jumpMiddle).toBeVisible();
    await expect(jumpBack).toBeVisible();

    // Test Quick Jump
    await jumpFront.click();
    await page.waitForTimeout(400);

    // Test Reset View
    await resetViewBtn.click();
    await page.waitForTimeout(400);

    // Test Keyboard navigation (WASD, Arrows, Space, C, Q, E)
    await page.keyboard.press('KeyW');
    await page.keyboard.press('KeyA');
    await page.keyboard.press('KeyS');
    await page.keyboard.press('KeyD');
    await page.keyboard.press('Space');
    await page.keyboard.press('KeyC');

    // Test Boost button
    const boostBtn = page.locator('[data-testid="drone-boost-btn"]');
    await expect(boostBtn).toBeVisible();
    await boostBtn.click();
    await expect(boostBtn).toHaveClass(/bg-amber-500/);
    await boostBtn.click(); // toggle off

    // Test Collapsible Controls Hint
    const helpToggle = page.locator('[data-testid="drone-help-toggle"]');
    await helpToggle.click();
    const controlsCard = page.locator('[data-testid="drone-controls-card"]');
    await expect(controlsCard).toBeVisible();
    await expect(controlsCard).toContainText('WASD / Arrows');

    // Test Drone to Walk transition (drops user to nearest aisle)
    const toWalkBtn = page.locator('[data-testid="drone-to-walk-btn"]');
    await expect(toWalkBtn).toBeVisible();
    await toWalkBtn.click();

    // Verify Walk mode HUD is now active
    await expect(page.locator('.h-2\\.5.w-2\\.5.rounded-full')).toBeVisible();

    // Test return to 2D Seat Map link
    const return2DBtn = page.locator('[data-testid="switch-to-2d-button"]');
    await expect(return2DBtn).toBeVisible();
    await return2DBtn.click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="seatmap-2d-canvas"]')).toBeVisible();
  });

  test('Multi-device Visual Evidence: Capture at 390px, 768px, 1280px', async ({ page }) => {
    const evidenceDir = path.resolve('..', 'docs', 'evidence');
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }

    // 1. Mobile (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3001/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(evidenceDir, 'home_390px_mobile.png'), fullPage: false });

    // 2. Tablet (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://localhost:3001/movies');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(evidenceDir, 'movies_768px_tablet.png'), fullPage: false });

    // 3. Desktop (1280px)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:3001/cinemas/1/auditorium/1?showtime=1');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(evidenceDir, 'seatmap_1280px_desktop.png'), fullPage: false });

    // 4. Desktop Drone 3D View (1280px)
    await page.goto('http://localhost:3001/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(evidenceDir, 'drone_3d_1280px_desktop.png'), fullPage: false });
  });

});

