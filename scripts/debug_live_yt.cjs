const { chromium } = require('../frontend/node_modules/@playwright/test');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: ['--enable-gpu', '--use-gl=angle', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:3002/cinemas/1/auditorium/1?showtime=1&mode=3d');
  await page.waitForTimeout(4000);

  console.log('Triggering __cineverse_play_trailer...');
  const res = await page.evaluate(() => {
    if (typeof window.__cineverse_play_trailer === 'function') {
      window.__cineverse_play_trailer();
      return true;
    }
    return false;
  });
  console.log('Trigger result:', res);

  // Poll player state every second for 6 seconds
  for (let i = 1; i <= 6; i++) {
    await page.waitForTimeout(1000);
    const ytInfo = await page.evaluate(() => {
      const yt = window.__cineverse_yt_player;
      return {
        hasYt: !!yt,
        state: yt?.getPlayerState ? yt.getPlayerState() : null,
        time: yt?.getCurrentTime ? yt.getCurrentTime() : null,
        duration: yt?.getDuration ? yt.getDuration() : null
      };
    });
    console.log('Second ' + i + ':', JSON.stringify(ytInfo));
  }

  await page.screenshot({ path: 'youtube_live_6s.png' });
  await browser.close();
})();
