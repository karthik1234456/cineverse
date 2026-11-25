import { test, expect } from '@playwright/test';

test('Debug Quantum Odyssey playback', async ({ page }) => {
  const url = 'http://localhost:3002/cinemas/4/auditorium/13?showtime=61&mode=3d&debug=1';
  console.log('Navigating to:', url);

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const btn = page.locator('[data-testid="trailer-play-toggle"]').first();
  console.log('Btn visible:', await btn.isVisible());

  await btn.click();
  console.log('Clicked play button');

  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => {
      const v = document.querySelector('video');
      return {
        hasVideo: !!v,
        src: v?.src,
        currentTime: v?.currentTime,
        paused: v?.paused,
        readyState: v?.readyState,
        networkState: v?.networkState,
        error: v?.error?.message,
      };
    });
    console.log(`[t=${i}s] Video state:`, state);
    if (state.hasVideo && state.currentTime > 0) break;
  }
});
