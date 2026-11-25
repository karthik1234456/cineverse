const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  console.log('Navigating to Screen 3 (showtime 3374)...');
  await page.goto('http://localhost:3002/cinemas/1/auditorium/37?showtime=3374&mode=3d', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  
  const initialState = await page.evaluate(() => {
    const s = window.__cineverse_store ? window.__cineverse_store.getState() : null;
    return {
      movieTitle: s?.trailer?.movieTitle,
      trailerUrl: s?.trailer?.trailerUrl,
      activeStrategy: s?.trailer?.trailerStrategy,
      isPlaying: s?.trailer?.isPlaying,
      isMuted: s?.trailer?.isMuted,
      playbackStatus: s?.trailer?.playbackStatus,
      isTheatreMode: s?.trailer?.isTheatreMode,
      ytPlayer: Boolean(window.__cineverse_yt_player),
    };
  });
  console.log('Initial state:', initialState);

  // Click the 3D play button
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="screen-3d-play-button"]');
    if (btn) {
      btn.click();
      return '3D play button clicked';
    }
    const clusterBtn = document.querySelector('[data-testid="screen-cluster-play-btn"]');
    if (clusterBtn) {
      clusterBtn.click();
      return 'Cluster play button clicked';
    }
    return 'No play button found';
  });
  console.log('Play click result:', clicked);

  await page.waitForTimeout(4000);

  const afterPlay = await page.evaluate(() => {
    const s = window.__cineverse_store ? window.__cineverse_store.getState() : null;
    const yt = window.__cineverse_yt_player;
    return {
      isPlaying: s?.trailer?.isPlaying,
      playbackStatus: s?.trailer?.playbackStatus,
      ytState: yt?.getPlayerState ? yt.getPlayerState() : 'no player',
      ytTime: yt?.getCurrentTime ? yt.getCurrentTime() : null,
      ytMuted: yt?.isMuted ? yt.isMuted() : null,
    };
  });
  console.log('After play state:', afterPlay);

  await page.screenshot({ path: 'test_screen3_real_play.png' });
  console.log('Screenshot saved to test_screen3_real_play.png');

  await browser.close();
})();
