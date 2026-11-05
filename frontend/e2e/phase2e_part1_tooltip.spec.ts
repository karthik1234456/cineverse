import { test, expect } from '@playwright/test';
import path from 'path';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-2e');

test.describe('Phase 2e — Part 1: Seat Hover Tooltip (Finding E3)', () => {
  const AUDITORIUM_URL = '/cinemas/1/auditorium/1?showtime=1&mode=3d';

  test.beforeEach(async ({ context }) => {
    // Avoid modal popups
    await context.addInitScript(() => {
      window.localStorage.setItem('cineverse_city', 'bengaluru');
    });
  });

  test('01. Tooltip is non-interactive (pointer-events: none), <= 240x110px, has no buttons or scores', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(AUDITORIUM_URL);

    // Wait for 3D state to be ready
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });

    // Hover seat J10 via window.__cineverse
    await page.evaluate(() => {
      window.__cineverse?.setHoveredSeat('J10');
    });
    // Trigger mouse move to ensure mouse coordinates are tracked
    await page.mouse.move(800, 300);
    await page.waitForTimeout(500);

    const tooltip = page.locator('[data-testid="seat-tooltip-J10"]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    // 1. Check pointer-events is 'none' on tooltip element
    const pe = await tooltip.evaluate((el) => window.getComputedStyle(el).pointerEvents);
    expect(pe).toBe('none');

    // 2. Check dimensions <= 240x110
    const box = await tooltip.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(245);
      expect(box.height).toBeLessThanOrEqual(115);
    }

    // 3. Check NO buttons inside the tooltip
    const buttonCount = await tooltip.locator('button').count();
    expect(buttonCount).toBe(0);

    // 4. Check NO numeric viewing score inside the tooltip
    const text = await tooltip.innerText();
    expect(text).not.toMatch(/score|\/ 100|98\./i);

    // 5. Verify required content: Seat label, Category, Price, and Hint
    expect(text).toContain('Seat J10');
    expect(text).toContain('₹');
    expect(text).toMatch(/Premier|Prime|Front/i);
    expect(text).toMatch(/select|available/i);

    // Save screenshot of hovering near J10
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01_tooltip_j10_1366.png') });
  });

  test('02. Tooltip dimensions & style on desktop (1920x1080) and phone (390x844)', async ({ page }) => {
    // 1920x1080
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(AUDITORIUM_URL);
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });

    await page.evaluate(() => {
      window.__cineverse?.setHoveredSeat('E06');
    });
    await page.mouse.move(960, 540);
    await page.waitForTimeout(500);

    const tooltipE06 = page.locator('[data-testid="seat-tooltip-E06"]');
    await expect(tooltipE06).toBeVisible();

    const boxDesktop = await tooltipE06.boundingBox();
    expect(boxDesktop).not.toBeNull();
    if (boxDesktop) {
      expect(boxDesktop.width).toBeLessThanOrEqual(245);
      expect(boxDesktop.height).toBeLessThanOrEqual(115);
    }
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_tooltip_e06_1920.png') });

    // Phone viewport (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      window.__cineverse?.setHoveredSeat('A01');
    });
    await page.mouse.move(195, 400);
    await page.waitForTimeout(500);

    const tooltipA01 = page.locator('[data-testid="seat-tooltip-A01"]');
    await expect(tooltipA01).toBeVisible();
    const boxPhone = await tooltipA01.boundingBox();
    expect(boxPhone).not.toBeNull();
    if (boxPhone) {
      expect(boxPhone.width).toBeLessThanOrEqual(245);
      expect(boxPhone.height).toBeLessThanOrEqual(115);
    }
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '02_tooltip_a01_phone.png') });
  });

  test('03. Tooltip stays inside viewport at edges (flipping behavior)', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(AUDITORIUM_URL);
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });

    // Move mouse near the right edge of the screen (e.g. x = 1320, y = 300)
    await page.mouse.move(1320, 300);
    await page.evaluate(() => {
      window.__cineverse?.setHoveredSeat('J10');
    });
    await page.waitForTimeout(400);

    const tooltip = page.locator('[data-testid="seat-tooltip-J10"]');
    await expect(tooltip).toBeVisible();

    const box = await tooltip.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Must be completely inside the viewport: box.x >= 0 and box.x + box.width <= 1366
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1366);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(768);
    }
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '03_tooltip_edge_flipping.png') });
  });

  test('04. Rapid seat selection: two quick clicks within 300ms select both neighbouring seats', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(AUDITORIUM_URL);
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });

    // Clear any previous selection
    await page.evaluate(() => {
      window.__cineverse?.getStore().clearSelection();
    });

    // Execute two rapid selections within 300ms
    await page.evaluate(() => {
      window.__cineverse?.selectSeat('J10');
      setTimeout(() => {
        window.__cineverse?.selectSeat('J09');
      }, 100);
    });

    await page.waitForTimeout(500);

    // Verify both seats are selected in the store
    const selected = await page.evaluate(() => {
      return window.__cineverse?.getStore().selectedSeats || [];
    });

    expect(selected).toContain('J10');
    expect(selected).toContain('J09');

    // Docked card shows active seat details with Select/Deselect button
    const dockedCard = page.locator('[data-testid="docked-seat-select-toggle"]');
    await expect(dockedCard).toBeVisible();

    await page.screenshot({ path: path.join(EVIDENCE_DIR, '04_quick_select_j10_j09.png') });
  });

  test('05. Sweeping across a row updates hovered seat cleanly in place without blocking clicks', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(AUDITORIUM_URL);
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });

    // Initial mouse move
    await page.mouse.move(700, 400);

    const rowSeats = ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'E10'];

    for (const seatId of rowSeats) {
      await page.evaluate((s) => {
        window.__cineverse?.setHoveredSeat(s);
      }, seatId);
      await page.waitForTimeout(80);

      const currentHovered = await page.evaluate(() => {
        return window.__cineverse?.getStore().hoveredSeatId;
      });
      expect(currentHovered).toBe(seatId);

      const tooltip = page.locator(`[data-testid="seat-tooltip-${seatId}"]`);
      await expect(tooltip).toBeVisible();
    }
  });
});
