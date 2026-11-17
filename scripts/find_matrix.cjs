const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3000/cinemas/1/auditorium/1?showtime=1&mode=3d');
  await page.waitForTimeout(4000);

  // Check the transform of the Html container
  const container = page.locator('[data-testid="screen-3d-play-button-container"]');
  const parent = container.locator('xpath=..');
  
  const transform = await parent.evaluate(el => {
    // Traverse up to find the element with matrix3d
    let cur = el;
    while (cur && (!cur.style.transform || !cur.style.transform.includes('matrix3d'))) {
      cur = cur.parentElement;
    }
    return cur ? { style: cur.style.transform, tag: cur.tagName } : null;
  });

  console.log('Matrix3D element:', transform);
  await browser.close();
})();
