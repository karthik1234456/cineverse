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

  test('01. City selection and Home page discovery (simplified 3-row layout)', async ({ page }) => {
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

    // Verify city updated in selector
    await expect(cityBtn).toContainText('Bengaluru');

    // Verify Simplified Hero (Movie of the Day, Book Tickets, Watch Trailer)
    await expect(page.locator('[data-testid="hero-movie-of-day"]')).toBeVisible();
    await expect(page.locator('[data-testid="hero-book-tickets-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="hero-watch-trailer-btn"]')).toBeVisible();

    // Verify EXACTLY 3 discovery rows (Tightening mandate 1)
    await expect(page.getByRole('heading', { name: 'Now Showing' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Coming Soon' })).toBeVisible();
    await expect(page.getByText('Exclusive Offer')).toBeVisible();

    // Verify carousel, trending row, top cinemas row, or 3D showcase are absent
    await expect(page.getByText('Top Theatres in Your City')).not.toBeVisible();
    await expect(page.getByText('Choose Seats Inside a Real 3D Auditorium')).not.toBeVisible();

    // Capture Home Desktop screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_home_desktop.png'), fullPage: false });
  });

  test('02. Mobile responsive viewport (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(1200);

    // Verify header and mobile layout
    await expect(page.getByRole('link', { name: 'CINEVERSE' })).toBeVisible();
    await expect(page.locator('[data-testid="hero-movie-of-day"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Now Showing' })).toBeVisible();

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
    await page.waitForTimeout(300);

    // Filter by Format = IMAX 3D
    const formatSelect = page.locator('[data-testid="format-filter"]');
    await formatSelect.selectOption('IMAX 3D');
    await page.waitForTimeout(300);

    // Sort by Top Rated
    const sortSelect = page.locator('[data-testid="sort-filter"]');
    await sortSelect.selectOption('rating');
    await page.waitForTimeout(800);

    // Verify URL parameters are synchronized
    const url = decodeURIComponent(page.url());
    expect(url).toContain('genre=Sci-Fi');
    expect(url).toMatch(/format=(IMAX\+3D|IMAX 3D)/);
    expect(url).toContain('sort=rating');

    // Capture Movies Filter screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_movies_filter_desktop.png') });
  });

  test('05. Movie detail page with 7-day showtimes, server price quote, and SEO JSON-LD', async ({ page }) => {
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

    // Verify chip shows server quote lowest price (₹) and text availability badge
    const firstChip = showtimeChips.first();
    const lowestPriceEl = firstChip.locator('[data-testid="chip-lowest-price"]');
    await expect(lowestPriceEl).toBeVisible();
    await expect(lowestPriceEl).toContainText('₹');

    const availBadge = firstChip.locator('[data-testid="chip-availability-label"]');
    await expect(availBadge).toBeVisible();
    const availText = (await availBadge.innerText()).trim().toUpperCase();
    expect(['AVAILABLE', 'FAST FILLING', 'ALMOST FULL', 'SOLD OUT']).toContain(availText);

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

    // Verify showtime chip has price and text availability
    const firstChip = page.locator('[data-testid="showtime-chip"]').first();
    await expect(firstChip).toBeVisible();
    await expect(firstChip).toContainText('₹');

    // Capture Cinema Detail screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '07_cinema_detail_showtimes.png') });
  });

  test('08. Fallback 2D Seat Map for screens without 3D asset', async ({ page }) => {
    await page.goto('/cinemas/2/auditorium/2?showtime=1');
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

  test('09. Reusable TrailerPlayer modal with keyboard shortcuts and controls', async ({ page }) => {
    await page.goto('/movies/1');
    await page.waitForTimeout(1000);

    const playTrailerBtn = page.locator('[data-testid="movie-play-trailer-btn"]');
    await expect(playTrailerBtn).toBeVisible();
    await playTrailerBtn.click();

    // Verify modal appears
    const modal = page.locator('[data-testid="trailer-player-modal"]');
    await expect(modal).toBeVisible();

    // Verify video element is loaded
    const video = page.locator('[data-testid="main-trailer-video"]');
    await expect(video).toBeVisible();

    // Check custom controls exist
    await expect(page.locator('[data-testid="trailer-play-pause-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="trailer-mute-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="trailer-speed-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="trailer-captions-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="trailer-dock-button"]')).toBeVisible();

    // Test 'm' key shortcut (mute toggle)
    await page.keyboard.press('m');
    await page.waitForTimeout(300);
    const isMuted = await video.evaluate((el: HTMLVideoElement) => el.muted);
    expect(isMuted).toBe(true);

    // Unmute
    await page.keyboard.press('m');
    await page.waitForTimeout(300);
    const isUnmuted = await video.evaluate((el: HTMLVideoElement) => el.muted);
    expect(isUnmuted).toBe(false);

    // Capture Trailer Player Modal screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '09_trailer_player_modal.png') });

    // Close modal
    await page.locator('[data-testid="trailer-close-button"]').click();
    await expect(modal).not.toBeVisible();
  });

  test('10. MiniPlayerDock persistence across navigation', async ({ page }) => {
    await page.goto('/movies/1');
    await page.waitForTimeout(1000);

    // Open trailer
    await page.locator('[data-testid="movie-play-trailer-btn"]').click();
    const modal = page.locator('[data-testid="trailer-player-modal"]');
    await expect(modal).toBeVisible();

    // Dock to mini player
    const dockBtn = page.locator('[data-testid="trailer-dock-button"]');
    await expect(dockBtn).toBeVisible();
    await dockBtn.click();

    // Modal closes and floating mini player appears at bottom right
    await expect(modal).not.toBeVisible();
    const miniDock = page.locator('[data-testid="mini-player-dock"]');
    await expect(miniDock).toBeVisible();

    // Navigate to cinemas page via header client link
    const cinemasLink = page.locator('header a[href="/cinemas"]').first();
    if (await cinemasLink.isVisible()) {
      await cinemasLink.click();
    } else {
      await page.goto('/cinemas');
    }
    await page.waitForURL(/\/cinemas/);
    await page.waitForTimeout(1000);

    // Mini player is STILL visible on the new page!
    await expect(miniDock).toBeVisible();
    await expect(miniDock.locator('text=Quantum Odyssey')).toBeVisible();

    // Capture Mini Player Dock screenshot during navigation
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '10_mini_player_dock_navigation.png') });

    // Expand back to full modal
    const expandBtn = page.locator('[data-testid="mini-player-expand-button"]');
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();

    // Modal reopens
    await expect(modal).toBeVisible();

    // Close
    await page.locator('[data-testid="trailer-close-button"]').click();
    await expect(modal).not.toBeVisible();
    await expect(miniDock).not.toBeVisible();
  });

  test('11. Fallback for movie without trailer (Movie 4)', async ({ page }) => {
    await page.goto('/movies/4');
    await page.waitForTimeout(1000);

    // Click play trailer
    const playTrailerBtn = page.locator('[data-testid="movie-play-trailer-btn"]');
    await expect(playTrailerBtn).toBeVisible();
    await playTrailerBtn.click();

    // Modal opens with unavailable fallback state
    const fallbackBox = page.locator('[data-testid="trailer-unavailable-fallback"]');
    await expect(fallbackBox).toBeVisible();
    await expect(fallbackBox).toContainText('Trailer not available');

    // Capture Unavailable Fallback screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '11_trailer_unavailable_fallback.png') });

    // Close
    await page.locator('[data-testid="trailer-close-button"]').click();
  });

  test('12. Click budget: Home to showtime list in <= 2 clicks', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // 1st click: Click "Book Tickets" on Hero
    const bookTicketsBtn = page.locator('[data-testid="hero-book-tickets-btn"]');
    await expect(bookTicketsBtn).toBeVisible();
    await bookTicketsBtn.click();

    // Navigated to movie detail showtime list
    await page.waitForURL(/\/movies\//);
    const showtimes = page.locator('[data-testid="showtime-chip"]');
    await expect(showtimes.first()).toBeVisible();

    // Total clicks taken = 1 (Strictly <= 3 clicks budget)
    expect(true).toBe(true);
  });

  test('13. Automated font-size audit: 0 visible text elements under 14px', async ({ page }) => {
    const pagesToTest = ['/', '/movies', '/movies/1', '/cinemas', '/cinemas/1'];

    for (const urlPath of pagesToTest) {
      await page.goto(urlPath);
      await page.waitForTimeout(1000);

      const violations = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        const results: { text: string; fontSize: number; tag: string }[] = [];

        while ((node = walker.nextNode())) {
          const raw = node.nodeValue?.trim();
          if (!raw || raw.length < 2) continue;

          const el = node.parentElement;
          if (!el || el.closest('script, style, noscript, svg')) continue;

          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;

          const fontSize = parseFloat(style.fontSize);
          // Strict 14px threshold
          if (fontSize < 13.9) {
            results.push({
              text: raw.slice(0, 30),
              fontSize,
              tag: el.tagName.toLowerCase(),
            });
          }
        }
        return results;
      });

      if (violations.length > 0) {
        console.warn(`Font size violations on ${urlPath}:`, violations);
      }
      expect(violations).toHaveLength(0);
    }
  });

});
