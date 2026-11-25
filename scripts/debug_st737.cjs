const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => localStorage.setItem('cineverse_city', 'mumbai'));
  const page = await context.newPage();

  page.on('console', msg => console.log(`[BROWSER ${msg.type()}]:`, msg.text()));

  await page.goto('http://localhost:3000/cinemas/11/auditorium/36?showtime=737&mode=3d');
  await page.waitForTimeout(4000);

  console.log('Initial Store State:');
  const s0 = await page.evaluate(() => {
    const s = (window).__cineverse_store?.getState();
    return {
      movieTitle: s?.trailer?.movieTitle,
      trailerUrl: s?.trailer?.trailerUrl,
      strategy: s?.trailer?.strategy,
      isPlaying: s?.trailer?.isPlaying,
      playbackStatus: s?.trailer?.playbackStatus,
      theatreModeOpen: s?.theatreModeOpen
    };
  });
  console.log(s0);

  console.log('Clicking on-screen button...');
  await page.click('[data-testid="screen-3d-play-button"]');

  await page.waitForTimeout(4000);

  console.log('Store State after 4s:');
  const s1 = await page.evaluate(() => {
    const s = (window).__cineverse_store?.getState();
    const theatreModal = document.querySelector('[data-testid="theatre-mode-modal"]');
    return {
      movieTitle: s?.trailer?.movieTitle,
      trailerUrl: s?.trailer?.trailerUrl,
      strategy: s?.trailer?.strategy,
      isPlaying: s?.trailer?.isPlaying,
      playbackStatus: s?.trailer?.playbackStatus,
      theatreModeOpen: s?.theatreModeOpen,
      theatreModalInDOM: Boolean(theatreModal)
    };
  });
  console.log(s1);

  await browser.close();
})();
