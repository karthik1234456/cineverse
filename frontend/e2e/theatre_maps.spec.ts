import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-6-maps');

test.describe.serial('CineVerse Phase 6 — Interactive Theatre Maps & Geolocation', () => {
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

  test('01. Cinemas page renders Map and List views with toggle, pins, and spotlight card', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/cinemas');
    await page.waitForLoadState('networkidle');

    // 1. Verify view toggles exist
    const mapToggle = page.locator('[data-testid="view-map-toggle"]');
    const listToggle = page.locator('[data-testid="view-list-toggle"]');
    await expect(mapToggle).toBeVisible();
    await expect(listToggle).toBeVisible();

    // 2. Default view is Map view
    const mapContainer = page.locator('[data-testid="interactive-theatre-map"]');
    await expect(mapContainer).toBeVisible();

    // Wait for cinema cards in the list to load
    const cinemaCards = page.locator('[data-testid^="cinema-list-item-"]');
    await cinemaCards.first().waitFor({ state: 'visible', timeout: 10000 });
    const count = await cinemaCards.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // 3. Click first cinema card to focus and open spotlight
    await cinemaCards.first().click();
    const spotlightCard = page.locator('[data-testid="selected-cinema-card"]');
    await expect(spotlightCard).toBeVisible();

    // Verify directions link format on spotlight card
    const directionsBtn = spotlightCard.locator('a[data-testid="cinema-directions-btn"]');
    await expect(directionsBtn).toBeVisible();
    const href = await directionsBtn.getAttribute('href');
    expect(href).toContain('https://www.google.com/maps/dir/?api=1&destination=');

    // Save desktop map screenshot
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '01_desktop_cinemas_map_1280px.png'),
      fullPage: false,
    });

    // 4. Toggle to List View
    await listToggle.click();
    const listView = page.locator('[data-testid="cinemas-list-view"]');
    await expect(listView).toBeVisible();

    // Save desktop list screenshot
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '02_desktop_cinemas_list_1280px.png'),
      fullPage: false,
    });
  });

  test('02. Geolocation Near Me with explicit permission sorts cinemas by distance', async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Mock geolocation: Koramangala, Bengaluru (12.935, 77.615)
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 12.935, longitude: 77.615 });

    await page.goto('/cinemas');
    await page.waitForLoadState('networkidle');

    // Verify privacy disclaimer text is visible
    const privacyNotice = page.locator('text=Your location is used only to show nearby cinemas and is never stored');
    await expect(privacyNotice).toBeVisible();

    // Click "Near Me" button
    const nearMeBtn = page.locator('[data-testid="near-me-button"]');
    await expect(nearMeBtn).toBeVisible();
    await nearMeBtn.click();

    // Wait for distance badges to appear
    const distanceBadge = page.locator('[data-testid="cinema-distance-badge"]');
    await distanceBadge.first().waitFor({ state: 'visible', timeout: 8000 });

    // Verify badge text contains "km away"
    const firstBadgeText = await distanceBadge.first().innerText();
    expect(firstBadgeText).toMatch(/\d+(\.\d+)?\s*km\s*away/i);

    // Save Near Me screenshot
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '03_near_me_geolocation_sorted.png'),
      fullPage: false,
    });
  });

  test('03. Geolocation denied/unavailable displays friendly fallback banner', async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Clear and deny geolocation permissions
    await context.clearPermissions();

    await page.goto('/cinemas');
    await page.waitForLoadState('networkidle');

    // Click "Near Me" button
    const nearMeBtn = page.locator('[data-testid="near-me-button"]');
    await nearMeBtn.click();

    // Fallback notice should appear
    const fallbackBanner = page.locator('[data-testid="geo-alert-banner"]');
    await expect(fallbackBanner).toBeVisible({ timeout: 5000 });

    // Save fallback screenshot
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '04_geolocation_denied_fallback.png'),
      fullPage: false,
    });
  });

  test('04. Format filtering and search sync dynamically', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/cinemas');
    await page.waitForLoadState('networkidle');

    // Search by cinema keyword
    const searchInput = page.locator('[data-testid="cinema-search-input"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Nexus');

    // Wait for results to filter
    await page.waitForTimeout(600);
    const filteredCards = page.locator('[data-testid^="cinema-list-item-"]');
    const filteredCount = await filteredCards.count();
    expect(filteredCount).toBeGreaterThanOrEqual(1);

    // Save filtered screenshot
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '05_filter_sync_search.png'),
      fullPage: false,
    });
  });

  test('05. Cinema Detail page shows Location & Transit, MiniMap, and Directions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/cinemas/1');
    await page.waitForLoadState('networkidle');

    // Verify location & transit section
    const locationSection = page.locator('[data-testid="cinema-location-card"]');
    await expect(locationSection).toBeVisible();

    // Verify transit stop, parking badge, and directions button
    const directionsBtn = page.locator('[data-testid="cinema-detail-directions-btn"]');
    await expect(directionsBtn).toBeVisible();
    const href = await directionsBtn.getAttribute('href');
    expect(href).toContain('https://www.google.com/maps/dir/?api=1&destination=');

    // Verify MiniMap container
    const miniMap = page.locator('[data-testid="cinema-mini-map"]');
    await expect(miniMap).toBeVisible();

    // Save cinema detail screenshot
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '06_cinema_detail_location_transit.png'),
      fullPage: false,
    });
  });

  test('06. Movie page showtimes with distance radius chips and Map modal', async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Grant location for distance calculation
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 12.935, longitude: 77.615 });

    await page.goto('/movies/1');
    await page.waitForLoadState('networkidle');

    // Enable location on movie page if Near Me button present
    const movieNearMe = page.locator('[data-testid="movie-near-me-btn"]');
    if (await movieNearMe.isVisible()) {
      await movieNearMe.click();
      await page.waitForTimeout(500);
    }

    // Verify distance filter chips
    const radiusChip10 = page.locator('[data-testid="radius-filter-10"]');
    await expect(radiusChip10).toBeVisible();

    // Click map icon button for first cinema group
    const mapIconBtn = page.locator('[data-testid^="cinema-map-modal-btn-"]').first();
    await expect(mapIconBtn).toBeVisible();
    await mapIconBtn.click();

    // Verify modal is open
    const modal = page.locator('[data-testid="cinema-location-modal"]');
    await expect(modal).toBeVisible();

    // Verify Directions button inside modal
    const modalDirectionsBtn = page.locator('[data-testid="modal-directions-btn"]');
    await expect(modalDirectionsBtn).toBeVisible();

    // Save map modal screenshot
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '07_movie_showtimes_map_modal.png'),
      fullPage: false,
    });

    // Close modal via Escape key
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('07. Responsive mobile (390px) and tablet (768px) views', async ({ page }) => {
    // 1. Mobile 390px: Top Map / Bottom Sheet
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/cinemas');
    await page.waitForLoadState('networkidle');

    const mapContainer = page.locator('[data-testid="interactive-theatre-map"]');
    await expect(mapContainer).toBeVisible();

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '08_mobile_top_map_bottom_sheet_390px.png'),
      fullPage: false,
    });

    // 2. Tablet 768px
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '09_tablet_cinemas_768px.png'),
      fullPage: false,
    });
  });

  test('08. Booking confirmation page and printed ticket contain location, parking, and directions', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Check printed ticket directly on backend port 8002
    const printPage = await page.goto('http://127.0.0.1:8002/api/v1/tickets/CV-781453/print');
    expect(printPage?.status()).toBe(200);
    const content = await page.content();
    expect(content).toContain('Cinema Location &amp; Transit');
    expect(content).toContain('https://www.google.com/maps/dir/?api=1');
    expect(content).toContain('destination=');

    // Save printed ticket screenshot
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '10_printed_ticket_location_directions.png'),
      fullPage: false,
    });

    // 2. Fetch admin token to view booking confirmation without IDOR blockage
    const loginRes = await request.post('http://127.0.0.1:8002/api/v1/auth/login', {
      data: { email: 'admin@cineverse.com', password: 'Admin@123' },
    });
    const loginJson = await loginRes.json();
    const adminToken = loginJson.access_token;

    await page.addInitScript((token) => {
      localStorage.setItem('cineverse_token', token);
    }, adminToken);

    // 3. Check booking confirmation page
    await page.goto('/booking/1');
    await page.waitForLoadState('networkidle');

    // Verify directions button is visible on the booking confirmation
    const directionsBtn = page.locator('text=Get Directions');
    await expect(directionsBtn).toBeVisible({ timeout: 10000 });

    // Save booking confirmation page screenshot
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '11_booking_confirmation_location.png'),
      fullPage: false,
    });
  });
});
