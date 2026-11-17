const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  console.log('Navigating to showtime 737...');
  await page.goto('http://localhost:3000/cinemas/11/auditorium/36?showtime=737&mode=3d');
  await page.waitForTimeout(4000);

  const badge = page.locator('[data-testid="screen-playback-status-badge"]');
  console.log('Initial badge text:', await badge.innerText());

  // Check state in useCinemaStore
  const trailerState = await page.evaluate(() => {
    return (window).__cineverse_store?.getState?.().trailer || 'store not found';
  });
  console.log('Trailer state:', trailerState);

  await page.screenshot({ path: 'scripts/st737_initial.png' });

  // Now click the on-screen play button
  const playBtn = page.locator('[data-testid="screen-3d-play-button"]');
  if (await playBtn.count() > 0) {
    console.log('Clicking on-screen play button...');
    await playBtn.click();
    await page.waitForTimeout(2000);
    console.log('Badge after 2s:', await badge.innerText());
    await page.screenshot({ path: 'scripts/st737_after_play_2s.png' });
    await page.waitForTimeout(3000);
    console.log('Badge after 5s:', await badge.innerText());
    await page.screenshot({ path: 'scripts/st737_after_play_5s.png' });
  }

  await browser.close();
})();
