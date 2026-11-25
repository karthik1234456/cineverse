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

  const debugInfo = await page.evaluate(() => {
    const store = window.__cineverse_store?.getState();
    const trailer = store?.trailer;
    const rootEl = document.querySelector('.cineverse-css3d-root');
    const outerEl = document.querySelector('.cineverse-css3d-outer');
    const innerEl = document.querySelector('.cineverse-css3d-inner');
    const iframe = document.getElementById('cineverse-screen-yt-iframe');
    const playerContainer = document.querySelector('[data-testid="screen-youtube-player"]');

    return {
      storeTrailer: trailer,
      auditoriumData: store?.auditoriumData,
      rootEl: rootEl ? {
        outerHTML: rootEl.outerHTML.substring(0, 300),
        rect: rootEl.getBoundingClientRect(),
        style: {
          position: rootEl.style.position,
          zIndex: rootEl.style.zIndex,
          perspective: rootEl.style.perspective,
          transform: rootEl.style.transform,
          display: rootEl.style.display,
          visibility: rootEl.style.visibility,
          width: rootEl.style.width,
          height: rootEl.style.height,
        },
        computedStyle: {
          display: window.getComputedStyle(rootEl).display,
          visibility: window.getComputedStyle(rootEl).visibility,
          opacity: window.getComputedStyle(rootEl).opacity,
          zIndex: window.getComputedStyle(rootEl).zIndex,
          width: window.getComputedStyle(rootEl).width,
          height: window.getComputedStyle(rootEl).height,
        }
      } : null,
      outerEl: outerEl ? {
        styleTransform: outerEl.style.transform,
        computedTransform: window.getComputedStyle(outerEl).transform,
        computedDisplay: window.getComputedStyle(outerEl).display,
        rect: outerEl.getBoundingClientRect(),
      } : null,
      innerEl: innerEl ? {
        styleTransform: innerEl.style.transform,
        computedTransform: window.getComputedStyle(innerEl).transform,
        computedDisplay: window.getComputedStyle(innerEl).display,
        rect: innerEl.getBoundingClientRect(),
      } : null,
      playerContainer: playerContainer ? {
        rect: playerContainer.getBoundingClientRect(),
        computedDisplay: window.getComputedStyle(playerContainer).display,
      } : null,
      iframe: iframe ? {
        src: iframe.src,
        rect: iframe.getBoundingClientRect(),
        computedDisplay: window.getComputedStyle(iframe).display,
        computedVisibility: window.getComputedStyle(iframe).visibility,
        computedOpacity: window.getComputedStyle(iframe).opacity,
      } : null,
    };
  });

  const apiTest = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/v1/showtimes/1/seats');
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('FETCH /api/v1/showtimes/1/seats RESULT:', JSON.stringify(apiTest, null, 2));

  await browser.close();
}

run().catch(console.error);
