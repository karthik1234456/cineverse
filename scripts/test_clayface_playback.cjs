const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => localStorage.setItem('cineverse_city', 'mumbai'));
  const page = await context.newPage();

  console.log('Navigating to showtime 737 (Clayface)...');
  await page.goto('http://localhost:3000/cinemas/11/auditorium/36?showtime=737&mode=3d', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Check state before click
  const beforeState = await page.evaluate(() => {
    const s = window.__cineverse_store?.getState?.();
    const yt = window.__cineverse_yt_player;
    return {
      movieTitle: s?.trailer?.movieTitle,
      trailerUrl: s?.trailer?.trailerUrl,
      activeStrategy: s?.trailer?.activeStrategy,
      playbackStatus: s?.trailer?.playbackStatus,
      isPlaying: s?.trailer?.isPlaying,
      isTheatreMode: s?.trailer?.isTheatreMode,
      hasYtPlayer: Boolean(yt),
      ytPlayerState: yt?.getPlayerState ? yt.getPlayerState() : null,
    };
  });
  console.log('Before click state:', beforeState);

  // Click on-screen play button
  const btn = page.locator('[data-testid="screen-3d-play-button"]');
  console.log('Play button count:', await btn.count());
  if (await btn.count() > 0) {
    console.log('Clicking on-screen play button...');
    await btn.click();
  }

  // Monitor over 6 seconds
  for (let i = 1; i <= 6; i++) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => {
      const s = window.__cineverse_store?.getState?.();
      const yt = window.__cineverse_yt_player;
      const modal = document.querySelector('[data-testid="theatre-mode-modal"]');
      return {
        playbackStatus: s?.trailer?.playbackStatus,
        isPlaying: s?.trailer?.isPlaying,
        isTheatreMode: s?.trailer?.isTheatreMode,
        theatreModalPresent: Boolean(modal),
        ytState: yt?.getPlayerState ? yt.getPlayerState() : null,
        ytTime: yt?.getCurrentTime ? yt.getCurrentTime() : null,
      };
    });
    console.log(`T+${i}s state:`, state);
  }

  await page.screenshot({ path: 'scripts/clayface_test_result.png' });
  console.log('Saved scripts/clayface_test_result.png');
  await browser.close();
})();
