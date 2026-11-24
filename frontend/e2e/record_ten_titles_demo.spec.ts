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

test('Record Ten Titles Verification Demo (5 YouTube, 3 Hosted, 2 Without Trailer)', async ({ page }) => {
  test.setTimeout(180000); // 3 minutes

  const testBatch = [
    // 5 YouTube Titles
    { id: 113, title: 'Heart of the Beast', type: 'youtube', cin: 5, aud: 16, showtime: 4368 },
    { id: 51, title: 'Hope', type: 'youtube', cin: 1, aud: 1, showtime: 1 },
    { id: 53, title: 'Ghost Soldier', type: 'youtube', cin: 1, aud: 1, showtime: 3 },
    { id: 56, title: 'Street Fighter', type: 'youtube', cin: 1, aud: 1, showtime: 563 },
    { id: 101, title: 'Kantara - A Legend: Chapter 1', type: 'youtube', cin: 3, aud: 10, showtime: 4192 },

    // 3 Hosted Titles
    { id: 1, title: 'Quantum Odyssey', type: 'hosted', cin: 4, aud: 13, showtime: 61 },
    { id: 122, title: 'Sample Showcase', type: 'hosted', cin: 1, aud: 1, showtime: 9999 },
    { id: 2, title: 'Astra: Chronicles of the Celestial Throne', type: 'hosted', cin: 1, aud: 1, showtime: 12000 },

    // 2 Without Trailer (Honest fallback)
    { id: 58, title: 'Mookuthi Amman 2', type: 'none', cin: 1, aud: 1, showtime: 565 },
    { id: 60, title: 'Scene', type: 'none', cin: 1, aud: 1, showtime: 1124 },
  ];

  for (let i = 0; i < testBatch.length; i++) {
    const item = testBatch[i];
    const url = `http://localhost:3002/cinemas/${item.cin}/auditorium/${item.aud}?showtime=${item.showtime}&mode=3d&debug=1`;
    console.log(`[Testing ${i + 1}/10] ${item.title} (${item.type}) -> ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    if (item.type === 'none') {
      // Non-playable title: verify "Trailer not available" badge is visible
      const badge = page.locator('text="Trailer not available"').first();
      await expect(badge).toBeVisible();
      console.log(`   -> Verified honest "Trailer not available" state for ${item.title}`);
      await page.waitForTimeout(2000);
      continue;
    }

    // Playable title: Click play button
    const playBtn = page.locator('[data-testid="trailer-play-toggle"]').first();
    await playBtn.waitFor({ state: 'visible', timeout: 8000 });
    await playBtn.click();
    console.log(`   -> Clicked play for ${item.title}`);

    if (item.type === 'hosted') {
      // Hosted plays on 3D screen / video element
      await page.waitForTimeout(3000);
      const vid = page.locator('video').first();
      await expect(vid).toBeVisible();
      console.log(`   -> Hosted video element active and playing for ${item.title}`);
    } else {
      // YouTube opens in Theatre Mode
      const modal = page.locator('[data-testid="theatre-mode-modal"]');
      await expect(modal).toBeVisible();
      const iframe = page.locator('[data-testid="theatre-mode-youtube-iframe"]');
      await expect(iframe).toBeVisible();
      console.log(`   -> YouTube Theatre Mode active for ${item.title}`);
      await page.waitForTimeout(3500);

      // Close Theatre Mode modal to return to 3D hall
      const closeBtn = page.locator('[data-testid="theatre-mode-close-btn"]');
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  console.log('Successfully completed full 10-title recording session.');
});
