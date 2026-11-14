import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('2D Seat Map Comprehensive Verification', () => {
  const BASE_URL = 'http://localhost:3000';

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

  test('1. Compact hall: DOM order, orientation, continuous plan, no wing labels', async ({ page, request }) => {
    // Fetch server ground truth for Showtime 4
    const res = await request.get(`http://127.0.0.1:8000/api/v1/showtimes/4/seats`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    const serverTiers = data.tiers;

    // Visit Compact hall (Cinema 1, Auditorium 1, Showtime 4, mode=2d)
    await page.goto(`${BASE_URL}/cinemas/1/auditorium/1?showtime=4&mode=2d`, { waitUntil: 'domcontentloaded' });

    // Dismiss city modal if visible
    const modalBtn = page.locator('button[aria-label="Close"]');
    if (await modalBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await modalBtn.click().catch(() => {});
    }

    // Wait for the seat map container to be visible
    const seatMap = page.locator('[data-testid="2d-seat-map"]');
    await expect(seatMap).toBeVisible({ timeout: 15000 });

    // 1. Screen element exists and is placed ABOVE Row A in DOM order
    const screenElement = page.locator('[data-testid="screen-element"]');
    await expect(screenElement).toBeVisible();

    const rowA = page.locator('[data-row-id="A"]');
    await expect(rowA).toBeVisible();

    const isScreenAboveRowA = await page.evaluate(() => {
      const screen = document.querySelector('[data-testid="screen-element"]');
      const rowAEl = document.querySelector('[data-row-id="A"]');
      if (!screen || !rowAEl) return false;
      const pos = screen.compareDocumentPosition(rowAEl);
      return Boolean(pos & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(isScreenAboveRowA).toBe(true);

    // 2. Rows exist in order A to J down the page
    const expectedRows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const rowOrderCheck = await page.evaluate((rows) => {
      const elements = rows.map((r) => document.querySelector(`[data-row-id="${r}"]`));
      for (let i = 0; i < elements.length - 1; i++) {
        const curr = elements[i];
        const next = elements[i + 1];
        if (!curr || !next) return false;
        const pos = curr.compareDocumentPosition(next);
        if (!(pos & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
      }
      return true;
    }, expectedRows);
    expect(rowOrderCheck).toBe(true);

    // 3. Row letters exist on BOTH sides of every row
    for (const r of expectedRows) {
      await expect(page.locator(`[data-testid="row-label-left-${r}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="row-label-right-${r}"]`)).toBeVisible();
    }

    // 4. Compact hall has 2 blocks of 5 seats with 1 centre aisle:
    // Check that there are NO wing or stalls labels
    const textContent = await page.content();
    expect(textContent).not.toContain('Left wing');
    expect(textContent).not.toContain('Centre stalls');
    expect(textContent).not.toContain('Right wing');

    // For 2 blocks, block headers are NOT rendered
    await expect(page.locator('[data-testid="block-headers"]')).not.toBeVisible();

    // Check row A seats: A01 to A10
    const rowASeats = page.locator('[data-row-id="A"] [role="gridcell"]');
    await expect(rowASeats).toHaveCount(10);

    // Check aisle gap is placed after seat 5 (5th gridcell has aisle margin class)
    const fifthSeatCell = rowASeats.nth(4);
    const fifthCellClass = await fifthSeatCell.getAttribute('class');
    expect(fifthCellClass).toContain('mr-5');

    // 5. Category naming: Compact hall is NOT recliner, so category must be "Premier", NOT "Premier Recliner"
    const premierBand = page.locator('[data-testid="category-band-premier"]');
    await expect(premierBand).toBeVisible();
    await expect(premierBand).toContainText('Premier');
    const premierText = await premierBand.innerText();
    expect(premierText).not.toContain('Recliner');
    await expect(premierBand).toContainText('(incl. fees)');

    // Verify all category bands match server prices
    for (const t of serverTiers) {
      const cat = t.category.toLowerCase();
      const band = page.locator(`[data-testid="category-band-${cat}"]`);
      await expect(band).toBeVisible();
      await expect(band).toContainText(`₹${Math.round(t.price)}`);
      await expect(band).toContainText('(incl. fees)');
    }

    // 6. Mini-map matches main map in orientation and row order
    const miniMap = page.locator('[data-testid="interactive-minimap"]');
    await expect(miniMap).toBeVisible();
    const miniMapRows = await page.evaluate(() => {
      const mm = document.querySelector('[data-testid="interactive-minimap"]');
      if (!mm) return [];
      const spans = Array.from(mm.querySelectorAll('span.font-mono'));
      return spans.map((s) => s.textContent?.trim());
    });
    expect(miniMapRows).toEqual(expectedRows);
  });

  // Test pricing parity between 2D and 3D across >= 5 showtimes
  const parityShowtimes = [1, 4, 6, 11, 16];
  for (const showtimeId of parityShowtimes) {
    test(`2. Pricing parity across 2D & 3D: Showtime ${showtimeId}`, async ({ page, request }) => {
      test.setTimeout(45000);
      const res = await request.get(`http://127.0.0.1:8000/api/v1/showtimes/${showtimeId}/seats`);
      expect(res.ok()).toBe(true);
      const data = await res.json();
      const serverTiers = data.tiers;
      expect(serverTiers.length).toBeGreaterThanOrEqual(2);

      const expectedPrices: Record<string, number> = {};
      for (const t of serverTiers) {
        expectedPrices[t.category.toLowerCase()] = Math.round(t.price);
      }

      // Check 2D mode
      await page.goto(`${BASE_URL}/cinemas/${data.cinema_id}/auditorium/${data.auditorium_id}?showtime=${showtimeId}&mode=2d`, {
        waitUntil: 'domcontentloaded'
      });
      await expect(page.locator('[data-testid="2d-seat-map"]')).toBeVisible({ timeout: 15000 });

      for (const t of serverTiers) {
        const cat = t.category.toLowerCase();
        const band = page.locator(`[data-testid="category-band-${cat}"]`);
        await expect(band).toBeVisible();
        await expect(band).toContainText(`₹${expectedPrices[cat]}`);
        await expect(band).toContainText('(incl. fees)');
      }

      // Check 3D mode panel prices
      await page.goto(`${BASE_URL}/cinemas/${data.cinema_id}/auditorium/${data.auditorium_id}?showtime=${showtimeId}&mode=3d`, {
        waitUntil: 'domcontentloaded'
      });
      const infoPanel = page.locator('[data-testid="auditorium-info-panel"]');
      await expect(infoPanel).toBeVisible({ timeout: 15000 });

      for (const t of serverTiers) {
        const cat = t.category.toLowerCase();
        const tierCard = page.locator(`[data-testid="tier-card-${cat}"]`);
        await expect(tierCard).toBeVisible();
        await expect(tierCard).toContainText(`₹${expectedPrices[cat]}`);
      }
    });
  }

  test('3. Capture evidence screenshots (Compact, Standard, Largest hall desktop & phone with zoom/pan)', async ({ page }) => {
    test.setTimeout(90000);
    const evidenceDir = path.resolve(process.cwd(), 'evidence/seatmap-2d');
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }

    // A. Compact Hall (Aud 1, 100 seats, Showtime 4)
    // Desktop (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/cinemas/1/auditorium/1?showtime=4&mode=2d`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="2d-seat-map"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="category-band-front"]')).toContainText('₹');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(evidenceDir, 'compact_hall_desktop.png'), fullPage: false });

    // Phone (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/cinemas/1/auditorium/1?showtime=4&mode=2d`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="2d-seat-map"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="category-band-front"]')).toContainText('₹');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(evidenceDir, 'compact_hall_phone.png'), fullPage: false });

    // B. Standard Hall (Cinema 4, Aud 12, Showtime 56)
    // Desktop (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/cinemas/4/auditorium/12?showtime=56&mode=2d`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="2d-seat-map"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="category-band-front"]')).toContainText('₹');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(evidenceDir, 'standard_hall_desktop.png'), fullPage: false });

    // Phone (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/cinemas/4/auditorium/12?showtime=56&mode=2d`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="2d-seat-map"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="category-band-front"]')).toContainText('₹');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(evidenceDir, 'standard_hall_phone.png'), fullPage: false });

    // C. Largest Hall (Cinema 1, Aud 4, IMAX 3D 522 seats, Showtime 16)
    // Desktop (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/cinemas/1/auditorium/4?showtime=16&mode=2d`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="2d-seat-map"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="category-band-front"]')).toContainText('₹');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(evidenceDir, 'largest_hall_desktop.png'), fullPage: false });

    // Demonstrate Zoom and Pan on Largest Hall
    const zoomInBtn = page.locator('button[aria-label="Zoom In"]');
    if (await zoomInBtn.isVisible()) {
      await zoomInBtn.click();
      await zoomInBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(evidenceDir, 'largest_hall_zoomed_in.png'), fullPage: false });

      // Pan by scrolling the container
      await page.evaluate(() => {
        const el = document.querySelector('[data-testid="2d-seat-map"]');
        if (el) {
          el.scrollLeft = 300;
          el.scrollTop = 200;
        }
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(evidenceDir, 'largest_hall_panned.png'), fullPage: false });
    }

    // Phone (390x844) on Largest Hall
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/cinemas/1/auditorium/4?showtime=16&mode=2d`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="2d-seat-map"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="category-band-front"]')).toContainText('₹');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(evidenceDir, 'largest_hall_phone.png'), fullPage: false });
  });

});
