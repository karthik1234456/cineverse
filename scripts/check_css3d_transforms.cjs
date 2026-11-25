const { chromium } = require('../frontend/node_modules/@playwright/test');

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: ['--enable-gpu', '--use-gl=angle', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:3002/cinemas/1/auditorium/1?showtime=1&mode=3d');
  await page.waitForTimeout(4000);

  // Trigger play
  await page.evaluate(() => {
    if (typeof window.__cineverse_play_trailer === 'function') {
      window.__cineverse_play_trailer();
    }
  });
  await page.waitForTimeout(2000);

  const rects = await page.evaluate(() => {
    const rootEl = document.querySelector('.cineverse-css3d-root');
    const outerEl = document.querySelector('.cineverse-css3d-outer');
    const innerEl = document.querySelector('.cineverse-css3d-inner');
    const iframe = document.getElementById('cineverse-screen-yt-iframe');

    return {
      window: { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
      root: rootEl ? {
        rect: rootEl.getBoundingClientRect(),
        perspective: rootEl.style.perspective,
      } : null,
      outer: outerEl ? {
        rect: outerEl.getBoundingClientRect(),
        transform: outerEl.style.transform,
      } : null,
      inner: innerEl ? {
        rect: innerEl.getBoundingClientRect(),
        transform: innerEl.style.transform,
      } : null,
      iframe: iframe ? {
        rect: iframe.getBoundingClientRect(),
        offsetWidth: iframe.offsetWidth,
        offsetHeight: iframe.offsetHeight,
      } : null,
    };
  });

  console.log('TRANSFORMS AND RECTS:', JSON.stringify(rects, null, 2));

  await browser.close();
}

run().catch(console.error);
