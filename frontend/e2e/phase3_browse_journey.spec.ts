import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-3');

test.beforeAll(async () => {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
});

test.describe.serial('Phase 3 — Discovery, Movies, Cinemas, Showtimes E2E Journey', () => {

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      localStorage.setItem('cineverse_city', 'bengaluru');
      localStorage.setItem('cineverse_city_id', '1');
    });
  });

  test('01. City selection and Home page discovery', async ({ page }) => {
    // Clear city to test modal trigger on home
    await page.addInitScript(() => {
      localStorage.removeItem('cineverse_city');
      localStorage.removeItem('cineverse_city_id');
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    const cityBtn = page.locator('[data-testid="city-selector-button"]');
    await expect(cityBtn).toBeVisible();

    // The city modal auto-opens on first visit if no city is in localStorage
    const modalHeading = page.getByText('Select Your City');
    if (!await modalHeading.isVisible()) {
      await cityBtn.click();
    }
    await page.waitForTimeout(500);

    // Capture City Selector Modal screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_city_modal.png') });

    // Select Bengaluru from modal
    const blrOption = page.locator('[data-testid="city-option-bengaluru"]');
    await expect(blrOption).toBeVisible();
    await blrOption.click();
    await page.waitForTimeout(600);

    // Verify city updated
    await expect(cityBtn).toContainText('Bengaluru');

    // Verify Home sections
    await expect(page.getByText('Now Showing in Cinemas')).toBeVisible();
    await expect(page.getByText('Top Theatres in Your City')).toBeVisible();
    await expect(page.getByText('Exclusive Offers & Promotions')).toBeVisible();
    await expect(page.getByText('Choose Seats Inside a Real 3D Auditorium')).toBeVisible();

    // Capture Home Desktop screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_home_desktop.png'), fullPage: false });
  });

  test('02. Mobile responsive viewport (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(1200);

    // Verify header and mobile layout
    await expect(page.getByRole('link', { name: 'CINEVERSE' })).toBeVisible();
    await expect(page.getByText('Now Showing in Cinemas')).toBeVisible();

    // Capture Home Mobile screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_home_mobile.png') });
  });

  test('03. Global search with autocomplete suggestions and recent history', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const searchInput = page.locator('[data-testid="global-search-input"]');
    await expect(searchInput).toBeVisible();

    // Type movie keyword
    await searchInput.fill('Quantum');
    await page.waitForTimeout(800);

    const dropdown = page.locator('[data-testid="search-suggestions-dropdown"]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toContainText('Quantum Odyssey');

    // Capture Search Autocomplete screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '06_global_search_autocomplete.png') });

    // Click suggested movie
    await dropdown.getByText('Quantum Odyssey').first().click();
    await page.waitForURL(/\/movies\//);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Quantum Odyssey');
  });

  test('04. Movies listing with URL-synced filters and sorting', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/movies');
    await page.waitForTimeout(1000);

    // Filter by Genre = Sci-Fi
    const genreSelect = page.locator('[data-testid="genre-filter"]');
    await genreSelect.selectOption('Sci-Fi');

    // Filter by Format = IMAX 3D
    const formatSelect = page.locator('[data-testid="format-filter"]');
    await formatSelect.selectOption('IMAX 3D');

    // Sort by Top Rated
    const sortSelect = page.locator('[data-testid="sort-filter"]');
    await sortSelect.selectOption('rating');
    await page.waitForTimeout(1000);

    // Verify URL parameters are synchronized
    const url = page.url();
    expect(url).toContain('genre=Sci-Fi');
    expect(url).toContain('format=IMAX+3D');
    expect(url).toContain('sort=rating');

    // Capture Movies Filter screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_movies_filter_desktop.png') });
  });

  test('05. Movie detail page with 7-day showtimes and SEO JSON-LD', async ({ page }) => {
    await page.goto('/movies/1');
    await page.waitForTimeout(1000);

    // Verify movie elements
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Cast & Crew')).toBeVisible();

    // Check JSON-LD structured data for Movie
    const jsonLd = await page.locator('script[type="application/ld+json"]').innerText();
    const parsed = JSON.parse(jsonLd);
    expect(parsed['@type']).toBe('Movie');
    expect(parsed.name).toBeDefined();

    // Verify showtime chips exist for Today
    const showtimeChips = page.locator('[data-testid="showtime-chip"]');
    await expect(showtimeChips.first()).toBeVisible();
    const chipCount = await showtimeChips.count();
    expect(chipCount).toBeGreaterThan(0);

    // Capture Movie Detail Showtimes screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '05_movie_detail_showtimes.png') });
  });

  test('06. Showtime chip navigation to 3D Auditorium', async ({ page }) => {
    await page.goto('/movies/1');
    await page.waitForTimeout(1000);

    const first3DChip = page.locator('[data-testid="showtime-chip"][data-has-3d="true"]').first();
    await expect(first3DChip).toBeVisible();
    await first3DChip.click();

    // Verify navigated to 3D auditorium route
    await page.waitForURL(/\/auditorium\//);

    // Wait for 3D state initialization
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    const state = await page.evaluate(() => window.__cineverse!.getState());
    expect(state.cameraMode).toBe('orbit');
  });

  test('07. Cinema detail with real showtimes grouped by movie', async ({ page }) => {
    await page.goto('/cinemas/1');
    await page.waitForTimeout(1200);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('CineVerse');
    await expect(page.getByText('Available Shows at')).toBeVisible();

    // Capture Cinema Detail screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '07_cinema_detail_showtimes.png') });
  });

  test('08. Fallback 2D Seat Map for screens without 3D asset', async ({ page }) => {
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=2d');
    await page.waitForTimeout(1200);

    const fallbackContainer = page.locator('[data-testid="fallback-2d-seat-list"]');
    await expect(fallbackContainer).toBeVisible();
    await expect(page.getByText('3D Auditorium Sightline View Coming Soon')).toBeVisible();
    await expect(page.getByText('CINEMA SCREEN (EYES THIS WAY)')).toBeVisible();

    // Select available seat
    const seatBtn = page.locator('[data-testid^="seat-btn-"]:not([disabled])').first();
    await expect(seatBtn).toBeVisible();
    await seatBtn.click();
    await page.waitForTimeout(400);

    // Verify checkout button appears with total
    await expect(page.locator('[data-testid="proceed-to-checkout"]')).toBeVisible();

    // Capture Fallback Seat List screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '08_fallback_seat_list_2d.png') });
  });

});
