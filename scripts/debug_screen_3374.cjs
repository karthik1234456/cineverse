const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3002/cinemas/1/auditorium/3?showtime=3374&mode=3d');
  await page.waitForTimeout(4000);

  const beforePlay = await page.evaluate(() => {
    const s = window.useCinemaStore?.getState?.();
    return {
      activeStrategy: s?.trailer?.activeStrategy,
      isPlaying: s?.trailer?.isPlaying,
      trailerUrl: s?.trailer?.trailerUrl,
      playbackStatus: s?.trailer?.playbackStatus,
      movieTitle: s?.trailer?.movieTitle,
      hasIframe: !!document.querySelector('iframe'),
      iframeSrc: document.querySelector('iframe')?.src,
      outerStyle: document.querySelector('.cineverse-css3d-outer')?.getAttribute('style'),
      innerStyle: document.querySelector('.cineverse-css3d-inner')?.getAttribute('style'),
    };
  });
  console.log('Before Play:', beforePlay);

  // Click play
  await page.evaluate(() => {
    if (window.__cineverse_play_trailer) {
      window.__cineverse_play_trailer();
    } else {
      document.querySelector('[data-testid="screen-3d-play-button"]')?.click();
    }
  });

  await page.waitForTimeout(3000);

  const afterPlay = await page.evaluate(() => {
    const s = window.useCinemaStore?.getState?.();
    const iframe = document.querySelector('iframe');
    const outer = document.querySelector('.cineverse-css3d-outer');
    const inner = document.querySelector('.cineverse-css3d-inner');
    return {
      activeStrategy: s?.trailer?.activeStrategy,
      isPlaying: s?.trailer?.isPlaying,
      playbackStatus: s?.trailer?.playbackStatus,
      hasIframe: !!iframe,
      iframeSrc: iframe?.src,
      outerStyle: outer?.getAttribute('style'),
      innerStyle: inner?.getAttribute('style'),
      outerBounds: outer ? outer.getBoundingClientRect() : null,
      iframeBounds: iframe ? iframe.getBoundingClientRect() : null,
      iframeVisible: iframe ? (window.getComputedStyle(iframe).visibility !== 'hidden' && window.getComputedStyle(iframe).display !== 'none') : false,
      ytPlayerState: window.__cineverse_yt_player?.getPlayerState?.(),
      currentTime: window.__cineverse_yt_player?.getCurrentTime?.(),
    };
  });
  console.log('After Play:', afterPlay);

  await page.screenshot({ path: path.resolve('evidence/debug_screen_3374.png') });
  console.log('Screenshot saved to evidence/debug_screen_3374.png');
  await browser.close();
})();
