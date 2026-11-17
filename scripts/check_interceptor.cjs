const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3000/cinemas/11/auditorium/36?showtime=737&mode=3d', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const btn = page.locator('[data-testid="screen-3d-play-button"]');
  const box = await btn.boundingBox();
  console.log('Button box:', box);
  if (box) {
    const elAtPoint = await page.evaluate((pt) => {
      const el = document.elementFromPoint(pt.x, pt.y);
      return {
        tag: el?.tagName,
        id: el?.id,
        className: el?.className,
        outerHTML: el?.outerHTML?.slice(0, 300),
      };
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    console.log('Element at point:', elAtPoint);
  }
  await browser.close();
})();
