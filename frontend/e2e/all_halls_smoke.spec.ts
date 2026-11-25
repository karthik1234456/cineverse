import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

interface HallTestTarget {
  typeName: string;
  theatreType: string;
  cinemaId: string;
  auditoriumId: string;
  showtimeId: string;
  seatCount: number;
  expectedName: string;
}

const HALL_TARGETS: HallTestTarget[] = [
  {
    typeName: 'Compact',
    theatreType: 'compact',
    cinemaId: '1',
    auditoriumId: '1',
    showtimeId: '1',
    seatCount: 100,
    expectedName: 'Compact Hall',
  },
  {
    typeName: 'Big Hall Flagship',
    theatreType: 'flagship',
    cinemaId: '1',
    auditoriumId: '2',
    showtimeId: '29',
    seatCount: 560,
    expectedName: 'Big Hall Flagship',
  },
  {
    typeName: 'Grand Balcony',
    theatreType: 'balcony',
    cinemaId: '1',
    auditoriumId: '3',
    showtimeId: '57',
    seatCount: 672,
    expectedName: 'Grand Balcony Auditorium',
  },
  {
    typeName: 'Luxe Recliner Lounge',
    theatreType: 'luxury_recliner',
    cinemaId: '1',
    auditoriumId: '4',
    showtimeId: '85',
    seatCount: 84,
    expectedName: 'Luxe Recliner Lounge',
  },
  {
    typeName: 'Motion-seat Hall',
    theatreType: 'dolby_atmos_4dx',
    cinemaId: '2',
    auditoriumId: '5',
    showtimeId: '113',
    seatCount: 240,
    expectedName: 'Motion-seat Hall',
  },
  {
    typeName: 'Continental Stadium',
    theatreType: 'standard',
    cinemaId: '2',
    auditoriumId: '6',
    showtimeId: '141',
    seatCount: 216,
    expectedName: 'Continental Stadium',
  },
  {
    typeName: 'Large Format Screen',
    theatreType: 'large',
    cinemaId: '3',
    auditoriumId: '8',
    showtimeId: '197',
    seatCount: 414,
    expectedName: 'Large Format Screen',
  },
  {
    typeName: 'Standard Central Aisle',
    theatreType: 'standard',
    cinemaId: '4',
    auditoriumId: '12',
    showtimeId: '309',
    seatCount: 224,
    expectedName: 'Standard Central Aisle',
  },
  {
    typeName: 'Boutique Velvet Salon',
    theatreType: 'boutique',
    cinemaId: '5',
    auditoriumId: '16',
    showtimeId: '421',
    seatCount: 48,
    expectedName: 'Boutique Velvet Salon',
  },
];

test.describe('3D Auditorium All Hall Types Smoke Test', () => {
  const evidenceDir = path.join(process.cwd(), 'evidence', 'all_halls_smoke');

  test.beforeAll(() => {
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('cineverse_city_id', '1');
        localStorage.setItem('cineverse_city_name', 'Bengaluru');
        localStorage.setItem('cineverse_comfort_settings', JSON.stringify({ simpleMode: false, reducedMotion: false }));
      } catch (e) {}
    });
  });

  for (const target of HALL_TARGETS) {
    test(`Smoke test ${target.typeName} (Auditorium ${target.auditoriumId}, ${target.seatCount} seats)`, async ({ page }) => {
      test.setTimeout(60000);

      const pageErrors: string[] = [];
      const runtimeCodeErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const txt = msg.text();
          // Filter out network/offline websocket retry noise or external media CSP warnings
          const isNetworkOrCsp =
            txt.includes('WebSocket') ||
            txt.includes('ERR_CONNECTION_REFUSED') ||
            txt.includes('Content Security Policy') ||
            txt.includes('favicon') ||
            txt.includes('Failed to load resource: the server responded with a status of 404');

          if (!isNetworkOrCsp) {
            runtimeCodeErrors.push(txt);
          }
        }
      });

      page.on('pageerror', (err) => {
        pageErrors.push(`[Unhandled PageError]: ${err.message}`);
      });

      // 1. Navigate to 3D page
      const url = `/cinemas/${target.cinemaId}/auditorium/${target.auditoriumId}?showtime=${target.showtimeId}&mode=3d`;
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      // 2. Wait for 3D canvas and verify it rendered
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible({ timeout: 20000 });
      await page.waitForTimeout(1500);

      // Verify no React error boundary or Next.js error overlay
      const errorBoundaryAlert = page.locator('[data-testid="canvas-error-boundary-fallback"]');
      await expect(errorBoundaryAlert).toHaveCount(0);
      const nextError = page.locator('nextjs-portal, .next-error-h1');
      await expect(nextError).toHaveCount(0);

      // 3. Verify Look around mode (default mode)
      const lookAroundBtn = page.locator('[data-testid="mode-look-around-btn"]');
      await expect(lookAroundBtn).toBeVisible({ timeout: 5000 });
      await expect(lookAroundBtn).toHaveClass(/bg-\[#C8102E\]/);

      // Capture screenshot in Look around mode
      const lookAroundShot = path.join(evidenceDir, `${target.theatreType}_audi_${target.auditoriumId}_lookaround.png`);
      await page.screenshot({ path: lookAroundShot, fullPage: false });

      // 4. Test Switch to Walk mode and move forward
      const walkBtn = page.locator('[data-testid="mode-walk-btn"]');
      await expect(walkBtn).toBeVisible();
      await walkBtn.click();
      await page.waitForTimeout(500);

      // Verify Walk mode active
      await expect(walkBtn).toHaveClass(/bg-\[#C8102E\]/);

      // Move player forward in Walk mode
      await page.keyboard.press('KeyW');
      await page.waitForTimeout(200);
      await page.keyboard.press('KeyW');
      await page.waitForTimeout(300);

      const walkShot = path.join(evidenceDir, `${target.theatreType}_audi_${target.auditoriumId}_walk.png`);
      await page.screenshot({ path: walkShot, fullPage: false });

      // 5. Test Switch to Sit mode, hover and select seat
      const sitBtn = page.locator('[data-testid="mode-sit-btn"], [data-testid="mode-seated-btn"]').first();
      await expect(sitBtn).toBeVisible();
      await sitBtn.click();
      await page.waitForTimeout(600);

      // Verify Sit mode active
      await expect(sitBtn).toHaveClass(/bg-\[#C8102E\]/);

      // Hover on canvas center
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
        await page.waitForTimeout(300);
      }

      // Trigger seat selection programmatically in store or via keyboard space
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);

      const sitShot = path.join(evidenceDir, `${target.theatreType}_audi_${target.auditoriumId}_sit.png`);
      await page.screenshot({ path: sitShot, fullPage: false });

      // Switch back to Look around to confirm full cycle
      await lookAroundBtn.click();
      await page.waitForTimeout(400);
      await expect(lookAroundBtn).toHaveClass(/bg-\[#C8102E\]/);

      // 6. Assert zero runtime code errors and zero unhandled exceptions
      if (runtimeCodeErrors.length > 0) {
        console.error(`Runtime code errors encountered for ${target.typeName}:`, runtimeCodeErrors);
      }
      if (pageErrors.length > 0) {
        console.error(`Page errors encountered for ${target.typeName}:`, pageErrors);
      }
      expect(pageErrors).toEqual([]);
      expect(runtimeCodeErrors).toEqual([]);
    });
  }
});
