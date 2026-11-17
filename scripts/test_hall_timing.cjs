const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--enable-webgl', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required']
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Test Standard Hall (Cinema 4, Aud 12, ST 56) with movie Hope
  await page.goto('http://localhost:3000/cinemas/4/auditorium/12?showtime=56&mode=3d', { waitUntil: 'domcontentloaded' });

  await page.waitForFunction(() => {
    return !document.body.innerText.includes('Verifying sightlines') &&
           Boolean(document.querySelector('[data-testid="screen-3d-play-button"]'));
  }, { timeout: 25000 });

  await page.waitForFunction(() => {
    const yt = window.__cineverse_yt_player;
    return Boolean(yt && typeof yt.playVideo === 'function');
  }, { timeout: 15000 });

  const playBtn = page.locator('[data-testid="screen-3d-play-button"]');
  console.log('Clicking play button...');
  await playBtn.click();

  // Wait for state === 1 (PLAYING)
  console.log('Waiting for player to report state === 1 (PLAYING)...');
  await page.waitForFunction(() => {
    const yt = window.__cineverse_yt_player;
    const store = window.__cineverse_store?.getState?.();
    return (yt && typeof yt.getPlayerState === 'function' && yt.getPlayerState() === 1) || store?.trailer?.isTheatreMode;
  }, { timeout: 10000 });

  const s1 = await page.evaluate(() => {
    const yt = window.__cineverse_yt_player;
    return {
      wallNow: performance.now(),
      mediaTime: yt?.getCurrentTime?.(),
      state: yt?.getPlayerState?.(),
      isTheatre: window.__cineverse_store?.getState?.().trailer?.isTheatreMode
    };
  });

  await page.waitForTimeout(2500);

  const s2 = await page.evaluate(() => {
    const yt = window.__cineverse_yt_player;
    return {
      wallNow: performance.now(),
      mediaTime: yt?.getCurrentTime?.(),
      state: yt?.getPlayerState?.(),
      isTheatre: window.__cineverse_store?.getState?.().trailer?.isTheatreMode
    };
  });

  const deltaWall = (s2.wallNow - s1.wallNow) / 1000.0;
  const deltaMedia = s2.mediaTime - s1.mediaTime;
  const ratio = deltaMedia / deltaWall;

  console.log({ s1, s2, deltaWall, deltaMedia, ratio, pass: ratio >= 0.8 && ratio <= 1.2 && s2.state === 1 && !s2.isTheatre });

  await browser.close();
})();
