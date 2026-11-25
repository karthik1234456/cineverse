import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.use({
  viewport: { width: 1280, height: 720 },
  launchOptions: {
    headless: false,
    args: ['--enable-webgl', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required'],
  },
  video: {
    mode: 'on',
    size: { width: 1280, height: 720 },
  },
});

test('Record Three Titles Playing in Theatre Mode', async ({ page }) => {
  test.setTimeout(90000);

  // Title 1: Heart of the Beast (Showtime 4368)
  console.log('Recording Title 1: Heart of the Beast...');
  await page.goto('http://localhost:3002/cinemas/5/auditorium/16?showtime=4368&mode=3d&debug=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const playBtn1 = page.locator('[data-testid="trailer-play-toggle"]').first();
  await playBtn1.click();
  await page.waitForTimeout(5000); // Record playback
  const closeBtn1 = page.locator('[data-testid="theatre-mode-close-btn"]');
  await closeBtn1.click();
  await page.waitForTimeout(1500);

  // Title 2: Hope (Showtime 1)
  console.log('Recording Title 2: Hope...');
  await page.goto('http://localhost:3002/cinemas/1/auditorium/1?showtime=1&mode=3d&debug=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const playBtn2 = page.locator('[data-testid="trailer-play-toggle"]').first();
  await playBtn2.click();
  await page.waitForTimeout(5000); // Record playback
  const closeBtn2 = page.locator('[data-testid="theatre-mode-close-btn"]');
  await closeBtn2.click();
  await page.waitForTimeout(1500);

  // Title 3: Sample Showcase (Hosted, Showtime 9999)
  console.log('Recording Title 3: Sample Showcase...');
  await page.goto('http://localhost:3002/cinemas/1/auditorium/1?showtime=9999&mode=3d&debug=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const playBtn3 = page.locator('[data-testid="trailer-play-toggle"]').first();
  await playBtn3.click();
  await page.waitForTimeout(5000); // Record playback

  console.log('Finished 3-title recording.');
});
