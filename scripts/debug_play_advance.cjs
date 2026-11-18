const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--enable-webgl', '--use-gl=angle', '--enable-gpu-rasterization', '--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3002/cinemas/23/auditorium/74?showtime=2048&mode=3d', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const initialDiag = await page.evaluate(() => {
    const yt = window.__cineverse_yt_player;
    const vid = window.__cineverse_video;
    const iframes = Array.from(document.querySelectorAll('iframe')).map(f => f.src);
    return {
      hasYt: !!yt,
      hasVid: !!vid,
      iframes,
      playerState: yt && typeof yt.getPlayerState === 'function' ? yt.getPlayerState() : -99,
    };
  });
  console.log('Initial Diag:', initialDiag);

  const playBtn = page.locator('[data-testid="screen-3d-play-button"]').first();
  console.log('Play button visible:', await playBtn.isVisible());

  await page.evaluate(() => {
    if (window.__cineverse_play_trailer) {
      window.__cineverse_play_trailer();
    } else {
      document.querySelector('[data-testid="screen-3d-play-button"]')?.click();
    }
  });

  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(200);
    const state = await page.evaluate(() => {
      const yt = window.__cineverse_yt_player;
      return {
        time: yt && typeof yt.getCurrentTime === 'function' ? yt.getCurrentTime() : -1,
        state: yt && typeof yt.getPlayerState === 'function' ? yt.getPlayerState() : -99,
      };
    });
    console.log(`Poll ${i*200}ms:`, state);
    if (state.time > 0.01) break;
  }

  await browser.close();
})();
