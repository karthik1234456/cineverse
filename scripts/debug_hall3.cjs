const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3000/cinemas/6/auditorium/20?showtime=99&mode=3d', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    return !document.body.innerText.includes('Verifying sightlines') &&
           Boolean(document.querySelector('[data-testid="screen-3d-play-button"]'));
  }, { timeout: 20000 });
  await page.waitForTimeout(1000);
  const playBtn = page.locator('[data-testid="screen-3d-play-button"]');
  console.log('Play button isVisible:', await playBtn.isVisible());
  const info = await page.evaluate(() => {
    const store = window.__cineverse_store?.getState?.();
    const btn = document.querySelector('[data-testid="screen-3d-play-button"]');
    return {
      title: store?.trailer?.movieTitle,
      trailerUrl: store?.trailer?.trailerUrl,
      strategy: store?.trailer?.activeStrategy,
      btnExists: Boolean(btn),
      btnStyle: btn ? window.getComputedStyle(btn).display : null,
      errorText: document.body.innerText.slice(0, 300)
    };
  });
  console.log(info);
  await browser.close();
})();
