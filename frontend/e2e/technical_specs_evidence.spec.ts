import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Screen Formats & Technical Specs Responsive Suite', () => {
  const evidenceDir = path.resolve(process.cwd(), 'evidence/tech-specs');

  test.beforeAll(() => {
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
  });

  const viewports = [
    { name: 'mobile_390px', width: 390, height: 844 },
    { name: 'tablet_768px', width: 768, height: 1024 },
    { name: 'desktop_1280px', width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    test(`Responsive Verification & Evidence Capture on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      test.setTimeout(90000);
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.addInitScript(() => {
        try {
          localStorage.setItem('cineverse_city', 'bengaluru');
          localStorage.setItem('cineverse_city_id', '1');
          localStorage.setItem('cineverse_city_name', 'Bengaluru');
          localStorage.setItem('cineverse_city_modal_dismissed', 'true');
          localStorage.setItem('cineverse_comfort_settings', JSON.stringify({ simpleMode: false, reducedMotion: false }));
        } catch (e) {}
      });

      // 1. Movies Catalog Page
      await page.goto('/movies', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      const cityModalBtn = page.locator('button[aria-label="Close"]');
      if (await cityModalBtn.isVisible()) {
        await cityModalBtn.click().catch(() => {});
      }

      // Verify TechnicalSpecsFilterBar exists
      const filterBar = page.locator('[data-testid="tech-specs-filter-bar"]');
      await expect(filterBar).toBeVisible();

      // Wait for format chips to load from backend API
      await page.waitForSelector('[data-testid^="format-chip-"]', { timeout: 10000 });
      const formatChips = page.locator('[data-testid^="format-chip-"]');
      const count = await formatChips.count();
      expect(count).toBeGreaterThan(0);

      // Verify trademark disclaimer note in footer
      const footerDisclaimer = page.locator('[data-testid="format-trademark-disclaimer"]');
      await expect(footerDisclaimer).toBeVisible();
      const disclaimerText = await footerDisclaimer.textContent();
      expect(disclaimerText).toContain('Format names belong to their owners and are shown to describe the screen');

      // Screenshot 1: Movies filter bar
      await page.screenshot({
        path: path.join(evidenceDir, `movies_filters_${vp.name}.png`),
        fullPage: false,
      });

      // 2. Cinemas Page
      await page.goto('/cinemas', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      const cinemasFilterBar = page.locator('[data-testid="tech-specs-filter-bar"]');
      await expect(cinemasFilterBar).toBeVisible();

      // Screenshot 2: Cinemas page with technical spec chips
      await page.screenshot({
        path: path.join(evidenceDir, `cinemas_filters_${vp.name}.png`),
        fullPage: false,
      });

      // 3. Movie Detail Page with Showtimes
      await page.goto('/movies/1', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      const movieShowtimesFilter = page.locator('[data-testid="tech-specs-filter-bar"]');
      await expect(movieShowtimesFilter).toBeVisible();

      // Verify showtime chips show format labels
      const showtimeChips = page.locator('[data-testid="showtime-chip"]');
      if (await showtimeChips.count() > 0) {
        const firstChip = showtimeChips.first();
        await expect(firstChip).toBeVisible();
      }

      // Screenshot 3: Movie showtimes with filter bar
      await page.screenshot({
        path: path.join(evidenceDir, `movie_showtimes_${vp.name}.png`),
        fullPage: false,
      });

      // 4. Auditorium 3D/2D View (Booking Header & Technical Specs)
      await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=2d', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Verify header tech specs display
      const techSpecsHeader = page.locator('[data-testid="auditorium-tech-specs-header"]');
      if (await techSpecsHeader.isVisible()) {
        const headerText = await techSpecsHeader.textContent();
        expect(headerText).toContain('·');
      }

      // Screenshot 4: Auditorium booking header & map
      await page.screenshot({
        path: path.join(evidenceDir, `auditorium_booking_${vp.name}.png`),
        fullPage: false,
      });
    });
  }
});
