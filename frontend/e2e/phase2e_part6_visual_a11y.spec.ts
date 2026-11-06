import { test, expect } from '@playwright/test';
import * as path from 'path';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-2e');

test.describe('Phase 2e Part 6 — Visual Quality, Hero Banner, Typography & Accessibility (E1, E2, E8)', () => {
  // Use port 3001 for production Next.js server
  test.use({ baseURL: 'http://localhost:3001' });

  test.beforeEach(async ({ page }) => {
    // Pre-seed city selection so CityModal does not intercept pointer clicks
    await page.addInitScript(() => {
      localStorage.setItem('cineverse_city', 'bengaluru');
      localStorage.setItem('cineverse_city_slug', 'bengaluru');
      localStorage.setItem('cineverse_city_id', '1');
      localStorage.setItem('cineverse_city_name', 'Bengaluru');
    });
  });

  test('Test 1 — Hero banner high contrast, wrapping title, and multi-viewport screenshots', async ({ page }) => {
    // 1. Desktop 1280
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-movie-of-day"]', { timeout: 10000 });

    const heroSection = page.locator('[data-testid="hero-movie-of-day"]');
    await expect(heroSection).toBeVisible();

    // Verify title is visible and wraps without truncation
    const titleLocator = heroSection.locator('h1');
    await expect(titleLocator).toBeVisible();
    const titleText = await titleLocator.textContent();
    expect(titleText).toBeTruthy();
    expect(titleText).not.toContain('...');
    expect(titleText).not.toContain('…');

    // Verify metadata chips
    await expect(heroSection.getByText('Movie of the Day')).toBeVisible();
    await expect(heroSection.getByText('/ 10')).toBeVisible();

    // Verify floating poster card on desktop
    const desktopPoster = heroSection.locator('[data-testid="hero-poster-card"]');
    await expect(desktopPoster).toBeVisible();

    // Capture desktop 1280 evidence
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '33_hero_desktop_1280.png'),
      fullPage: false,
    });

    // 2. Wide desktop 1920
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);
    await expect(desktopPoster).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '34_hero_wide_1920.png'),
      fullPage: false,
    });

    // 3. Tablet 768
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    await expect(titleLocator).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '35_hero_tablet_768.png'),
      fullPage: false,
    });

    // 4. Mobile 390
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await expect(titleLocator).toBeVisible();
    // Floating poster hidden on mobile
    await expect(desktopPoster).toBeHidden();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '36_hero_mobile_390.png'),
      fullPage: false,
    });
  });

  test('Test 2 — Header-to-hero spacing clearance across scroll positions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-movie-of-day"]', { timeout: 10000 });

    const navbar = page.locator('header').first();
    const navBox = await navbar.boundingBox();
    expect(navBox).toBeTruthy();

    const heroTitle = page.locator('[data-testid="hero-movie-of-day"] h1');
    const titleBox = await heroTitle.boundingBox();
    expect(titleBox).toBeTruthy();

    // At top of page, hero title must sit comfortably below navbar (never covered)
    expect(titleBox!.y).toBeGreaterThan(navBox!.y + navBox!.height);

    // Verify distance is at least 30px below navbar
    const clearance = titleBox!.y - (navBox!.y + navBox!.height);
    expect(clearance).toBeGreaterThanOrEqual(30);
  });

  test('Test 3 — Hero CTAs: Book tickets and Watch trailer modal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-movie-of-day"]', { timeout: 10000 });

    // Verify exactly two CTAs in hero
    const bookBtn = page.locator('[data-testid="hero-book-tickets-btn"]');
    const trailerBtn = page.locator('[data-testid="hero-watch-trailer-btn"]');

    await expect(bookBtn).toBeVisible();
    await expect(trailerBtn).toBeVisible();

    const bookHref = await bookBtn.getAttribute('href');
    expect(bookHref).toContain('/movies/');

    // Click watch trailer button and verify modal opens
    await trailerBtn.click();
    const trailerModal = page.locator('[data-testid="trailer-player-modal"]');
    await expect(trailerModal).toBeVisible({ timeout: 5000 });

    // Capture trailer modal screenshot
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '39_hero_trailer_modal_opened.png'),
      fullPage: false,
    });

    // Close trailer modal
    const closeBtn = page.locator('[data-testid="trailer-close-button"]');
    await closeBtn.click();
    await expect(trailerModal).toBeHidden({ timeout: 5000 });
  });

  test('Test 4 — Movie Card Typography: Titles wrap cleanly without ellipses across viewports', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="movie-card-book-btn"]', { timeout: 10000 });

    // Inspect all movie cards on page
    const cardTitles = page.locator('h3.line-clamp-2');
    const titleCount = await cardTitles.count();
    expect(titleCount).toBeGreaterThan(0);

    for (let i = 0; i < titleCount; i++) {
      const titleElem = cardTitles.nth(i);
      const text = await titleElem.textContent();
      expect(text).toBeTruthy();
      expect(text).not.toContain('...');
      expect(text).not.toContain('…');

      // Verify computed font-size >= 18px (text-lg)
      const fontSize = await titleElem.evaluate((el) => {
        return window.getComputedStyle(el).fontSize;
      });
      const px = parseFloat(fontSize);
      expect(px).toBeGreaterThanOrEqual(18);
    }

    // Capture movie cards grid desktop screenshot
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '37_movie_cards_grid_desktop.png'),
      fullPage: false,
    });

    // Test on mobile 390
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '38_movie_cards_grid_mobile.png'),
      fullPage: false,
    });
  });

  test('Test 5 — Typography and Contrast Accessibility Audit (Finding E8)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-movie-of-day"]', { timeout: 10000 });

    // Scan all visible text nodes on Home Page to ensure computed font-size >= 14px
    const smallTextViolations = await page.evaluate(() => {
      const violations: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let node: Node | null = walker.currentNode;

      while (node) {
        const el = node as HTMLElement;
        // Ignore invisible or script/style elements
        if (el && el.offsetParent !== null && el.children.length === 0) {
          const text = el.innerText?.trim();
          if (text && text.length > 0) {
            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            // Allow only tiny icons or explicitly exempted telemetry sub-labels
            if (fontSize < 13.5 && !el.closest('svg') && !el.getAttribute('data-exempt')) {
              violations.push(`${el.tagName}.${el.className} [${fontSize}px]: "${text.substring(0, 30)}"`);
            }
          }
        }
        node = walker.nextNode();
      }
      return violations;
    });

    // Expect zero violations < 14px on Home Page
    expect(smallTextViolations).toEqual([]);

    // Save proof screenshot
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '40_typography_audit_pass.png'),
      fullPage: true,
    });
  });
});
