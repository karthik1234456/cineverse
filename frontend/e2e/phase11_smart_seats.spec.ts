import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-11');

test.describe.serial('Phase 11 — Smart Seats, Comfort Heatmap, View Obstruction & Pricing', () => {
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

  test('01. 2D Comfort Heatmap Toggle and Legend Verification', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=2d');
    await page.waitForLoadState('networkidle');

    // Verify heatmap button is present
    const heatmapToggle = page.locator('[data-testid="toggle-heatmap-btn"]');
    await expect(heatmapToggle).toBeVisible({ timeout: 15000 });

    // Click to turn on Heatmap
    await heatmapToggle.click();
    await page.waitForTimeout(500);

    // Verify legend is visible with disclaimer
    const legend = page.locator('[data-testid="heatmap-legend"]');
    await expect(legend).toBeVisible();
    await expect(legend).toContainText('Viewing comfort estimate');
    await expect(legend).toContainText('Not a physical cinema measurement');

    // Verify seats have data-score and numeric score displayed
    const seatE05 = page.locator('[data-testid="seat-2d-E05"]');
    await expect(seatE05).toBeVisible();
    const scoreVal = await seatE05.getAttribute('data-score');
    expect(Number(scoreVal)).toBeGreaterThan(50);

    // Capture screenshot of active 2D heatmap
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '01_2d_heatmap_active.png'),
      fullPage: true,
    });
  });

  test('02. Smart Best-Seat Engine and Preference Selection', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=2d');
    await page.waitForLoadState('networkidle');

    // Set preference to direct centre
    const prefSelect = page.locator('[data-testid="seat-preference-select"]');
    await expect(prefSelect).toBeVisible({ timeout: 15000 });
    await prefSelect.selectOption('centre');

    // Click 2 seats quick button
    const btn2 = page.locator('[data-testid="btn-best-2"]');
    await btn2.click();
    await page.waitForTimeout(600);

    // Verify footer summary shows 2 selected seats
    const footer = page.locator('[data-testid="seatmap-2d-summary-footer"]');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Selected (2)');

    // Capture screenshot of best seats selected
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '02_best_seats_selected.png'),
      fullPage: true,
    });
  });

  test('03. Seat View Obstruction & Sightline Inspection', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=2d');
    await page.waitForLoadState('networkidle');

    // Click seat E05 to inspect
    const seatE05 = page.locator('[data-testid="seat-2d-E05"]');
    await expect(seatE05).toBeVisible({ timeout: 15000 });
    await seatE05.click();
    await page.waitForTimeout(500);

    // Verify inspection card appears
    const card = page.locator('[data-testid="seat-inspection-card"]');
    await expect(card).toBeVisible();

    // Verify viewing comfort score badge is shown
    const badge = page.locator('[data-testid="seat-comfort-score-badge"]');
    await expect(badge).toBeVisible();

    // Verify visibility estimate and disclaimer
    const visibility = page.locator('[data-testid="seat-visibility-pct"]');
    await expect(visibility).toBeVisible();
    await expect(card).toContainText('Geometric raycast estimate against static theatre geometry only');
    await expect(card).toContainText('No audience members or physical heads modelled');

    // Capture screenshot of obstruction inspection
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '03_seat_obstruction_inspection.png'),
      fullPage: false,
    });
  });

  test('04. 3D Theatre Heatmap and Sightline HUD Inspection', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForLoadState('networkidle');

    // Wait for 3D canvas to render
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2000);

    // Toggle 3D Heatmap
    const toggle3D = page.locator('[data-testid="toggle-3d-heatmap-btn"]');
    await expect(toggle3D).toBeVisible();
    await toggle3D.click();
    await page.waitForTimeout(1000);

    // Verify 3D inspection panel displays comfort score and obstruction estimate
    const comfortCard = page.locator('[data-testid="3d-seat-comfort-card"]');
    await expect(comfortCard).toBeVisible();
    await expect(comfortCard).toContainText('Viewing Comfort Score');

    const obstructionCard = page.locator('[data-testid="3d-seat-obstruction-card"]');
    await expect(obstructionCard).toBeVisible();
    await expect(obstructionCard).toContainText('Screen Line-of-Sight');
    await expect(obstructionCard).toContainText('No audience members or physical heads modelled');

    // Capture screenshot of 3D heatmap and inspection
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '04_3d_heatmap_active.png'),
      fullPage: false,
    });
  });

  test('05. Fair FIFO Waitlist Modal Verification', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=2d');
    await page.waitForLoadState('networkidle');

    // Open waitlist modal
    const openWaitlistBtn = page.locator('[data-testid="open-waitlist-btn"]');
    await expect(openWaitlistBtn).toBeVisible({ timeout: 15000 });
    await openWaitlistBtn.click();
    await page.waitForTimeout(500);

    // Verify modal content
    const modalHeading = page.locator('text=Fair FIFO Waitlist');
    await expect(modalHeading).toBeVisible();
    const explanation = page.locator('text=10-minute claim window');
    await expect(explanation).toBeVisible();

    // Capture screenshot of waitlist modal
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '05_waitlist_modal.png'),
      fullPage: false,
    });
  });
});

