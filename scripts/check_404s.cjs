const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => localStorage.setItem('cineverse_city', 'mumbai'));
  const page = await context.newPage();

  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log(`[HTTP ${resp.status()}]:`, resp.url());
    }
  });

  await page.goto('http://localhost:3000/cinemas/11/auditorium/36?showtime=737&mode=3d');
  await page.waitForTimeout(3000);

  await browser.close();
})();
