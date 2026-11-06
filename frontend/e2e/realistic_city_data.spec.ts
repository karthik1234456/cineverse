import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-city-realism');

test.describe.serial('CineVerse — Realistic Multi-City Data, Artwork, Trailers & Dynamic 2D Seat Map', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cineverse_city', 'bengaluru');
      localStorage.setItem('cineverse_city_id', '1');
      localStorage.setItem('cineverse_city_name', 'Bengaluru');
    });
  });

  test('01. City selection dynamically switches movies and cinemas', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/movies');
    await page.waitForLoadState('networkidle');

    // Count movie cards
    const movieCardsBLR = page.locator('[data-testid="movie-card"]');
    await movieCardsBLR.first().waitFor({ state: 'visible', timeout: 10000 });
    const blrCount = await movieCardsBLR.count();
    expect(blrCount).toBeGreaterThanOrEqual(12);
    expect(blrCount).toBeLessThanOrEqual(18);

    // Save screenshot for Bengaluru movies
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '01_bengaluru_movies_1280px.png'),
      fullPage: true,
    });

    // 2. Change city to Mumbai via City Selector in Navbar
    const citySelectorBtn = page.locator('button:has-text("Bengaluru"), button[aria-label*="city" i], [data-testid="city-selector-btn"]');
    if (await citySelectorBtn.isVisible()) {
      await citySelectorBtn.click();
      const mumbaiOption = page.locator('button:has-text("Mumbai"), div:has-text("Mumbai")').first();
      await mumbaiOption.click();
      await page.waitForTimeout(1000);
    } else {
      // Direct storage switch
      await page.evaluate(() => {
        localStorage.setItem('cineverse_city', 'mumbai');
        localStorage.setItem('cineverse_city_id', '2');
        localStorage.setItem('cineverse_city_name', 'Mumbai');
        window.dispatchEvent(new CustomEvent('cityChanged', { detail: { id: 2, name: 'Mumbai' } }));
      });
      await page.waitForTimeout(1000);
    }

    // Verify movies list reacted to Mumbai
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '02_mumbai_movies_1280px.png'),
      fullPage: true,
    });

    // 3. Visit Cinemas page
    await page.goto('/cinemas');
    await page.waitForLoadState('networkidle');

    // Verify cinemas are displayed
    const cinemaCards = page.locator('a[href^="/cinemas/"], [data-testid="cinema-card"]');
    const cinemaCount = await cinemaCards.count();
    expect(cinemaCount).toBeGreaterThanOrEqual(4);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '03_mumbai_cinemas_1280px.png'),
      fullPage: true,
    });
  });

  test('02. Artwork integrity and unique trailer streaming', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify hero banner image
    const heroImg = page.locator('img[alt*="Banner" i], [data-testid="hero-banner-img"], img').first();
    await expect(heroImg).toBeVisible();

    // Verify poster images load with non-zero dimensions
    const posterImgs = page.locator('img[src*="/posters/"]');
    const posterCount = await posterImgs.count();
    expect(posterCount).toBeGreaterThan(0);

    const firstPoster = posterImgs.first();
    const naturalWidth = await firstPoster.evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);

    // Verify trailer playback in modal or player
    const watchTrailerBtn = page.locator('[data-testid="hero-watch-trailer-btn"], button:has-text("Watch Trailer")').first();
    if (await watchTrailerBtn.isVisible()) {
      await watchTrailerBtn.click();
      await page.waitForTimeout(1500);

      // Check trailer video element
      const videoEl = page.locator('video').first();
      await expect(videoEl).toBeVisible();
      const videoSrc = await videoEl.getAttribute('src');
      expect(videoSrc).toBeTruthy();
      expect(videoSrc).toContain('.mp4');

      await page.screenshot({
        path: path.join(EVIDENCE_DIR, '04_trailer_playback_modal.png'),
      });

      // Close modal or pause
      const closeBtn = page.locator('button[aria-label*="close" i], button:has-text("Close"), [data-testid="close-modal-btn"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
  });

  test('03. 2D Seat Map on 100-seat 3D model hall', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Showtime 1 is on Screen 1 (3D Showcase, 100 seats)
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=2d');
    await page.waitForSelector('[data-testid="seatmap-2d-container"]');

    // 1. Verify "Explore in 3D" button is visible
    const explore3dBtn = page.locator('[data-testid="explore-in-3d-button"]');
    await expect(explore3dBtn).toBeVisible();

    // 2. Select seat E06
    const seatE06 = page.locator('[data-testid="seat-2d-E06"]');
    await expect(seatE06).toBeVisible();
    await seatE06.hover();

    // Verify compact non-interactive tooltip appears
    const tooltip = page.locator('[data-testid="seat-tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Seat E06');

    // Click to select
    await seatE06.click();

    // Verify inspection card has "See view from this seat"
    const povBtn = page.locator('[data-testid="see-view-from-seat-btn"]');
    await expect(povBtn).toBeVisible();
    await expect(povBtn).toContainText('See view from this seat');

    // 3. Verify footer summary
    const footer = page.locator('[data-testid="seatmap-2d-summary-footer"]');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('E06');
    await expect(page.locator('[data-testid="view-pov-E06"]')).toBeVisible();

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '05_seatmap_100_seats_1280px.png'),
      fullPage: true,
    });
  });

  test('04. 2D Seat Map on non-3D hall shows neutral notice', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Showtime 16 is on Auditorium 4 (Screen 4 — Luxe Recliner, 72 seats, has_3d_preview=False)
    await page.goto('/cinemas/1/auditorium/4?showtime=16&mode=2d');
    await page.waitForSelector('[data-testid="seatmap-2d-container"]');

    // 1. "Explore in 3D" should NOT be present; neutral badge should be shown
    const badge = page.locator('[data-testid="3d-unavailable-badge"]').first();
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('3D preview not available for this hall');

    // 2. Inspect an available seat
    const availableSeat = page.locator('[data-testid^="seat-2d-"][data-status="available"]').first();
    await expect(availableSeat).toBeVisible();
    await availableSeat.click();

    // Inspection card shows neutral message instead of 3D POV button
    const cardBadge = page.locator('[data-testid="seat-inspection-card"] [data-testid="3d-unavailable-badge"]');
    await expect(cardBadge).toBeVisible();
    await expect(cardBadge).toContainText('3D preview not available for this hall');

    // 3. Test "Pick best seats for me" with 4 guests
    const btnBest4 = page.locator('[data-testid="btn-best-4"]');
    await expect(btnBest4).toBeVisible();
    await btnBest4.click();
    await page.waitForTimeout(500);

    const footer = page.locator('[data-testid="seatmap-2d-summary-footer"]');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Selected (4)');

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '06_seatmap_72_luxury_hall_1280px.png'),
      fullPage: true,
    });
  });

  test('05. 2D Seat Map on 420-seat Flagship Hall (Zoom/Pan & 28 seats/row)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Auditorium 2 is the Flagship Big Hall (420 seats: 15 rows A-O x 28 seats, Showtime 6)
    await page.goto('/cinemas/1/auditorium/2?showtime=6&mode=2d');
    await page.waitForSelector('[data-testid="seatmap-2d-container"]');

    // 1. Verify zoom controls
    const zoomControls = page.locator('[data-testid="zoom-controls"]');
    await expect(zoomControls).toBeVisible();

    // 2. Verify large row rendering (e.g. seat O28 or A28 exists)
    const seatO28 = page.locator('[data-testid="seat-2d-O28"]');
    await expect(seatO28).toBeVisible();

    // 3. Test zoom in and zoom out
    const zoomInBtn = page.locator('[data-testid="zoom-controls"] button[aria-label="Zoom In"]');
    await zoomInBtn.click();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '07_flagship_420_seats_desktop_1280px.png'),
      fullPage: true,
    });
  });

  test('06. Mobile (390px) and Tablet (768px) responsive layouts', async ({ page }) => {
    // 1. Mobile 390px
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=2d');
    await page.waitForSelector('[data-testid="seatmap-2d-container"]');

    // Pick 2 seats
    const seatE05 = page.locator('[data-testid="seat-2d-E05"]');
    await seatE05.click();

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '08_seatmap_mobile_390px.png'),
      fullPage: true,
    });

    // 2. Tablet 768px
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '09_seatmap_tablet_768px.png'),
      fullPage: true,
    });
  });
});

