const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3002/cinemas/4/auditorium/13?showtime=61&mode=3d');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(2000);

  const videoInfo = await page.evaluate(() => {
    const vid = window.__cineverse_video;
    return {
      hasVid: !!vid,
      src: vid ? vid.src : null,
      readyState: vid ? vid.readyState : null,
      paused: vid ? vid.paused : null
    };
  });
  console.log('Video info before click:', videoInfo);

  const t0 = performance.now();
  await page.evaluate(() => {
    if (window.__cineverse_play_trailer) {
      window.__cineverse_play_trailer();
    } else {
      document.querySelector('[data-testid="screen-3d-play-button"]')?.click();
    }
  });

  const advanceMs = await page.evaluate(async () => {
    const start = performance.now();
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 50));
      const vid = window.__cineverse_video;
      if (vid && vid.currentTime > 0.05) {
        return performance.now() - start;
      }
    }
    return -1;
  });

  console.log(`Hosted clip time to advance: ${advanceMs.toFixed(1)} ms`);
  await browser.close();
})();
