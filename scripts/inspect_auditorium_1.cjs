const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const url = 'http://localhost:3002/cinemas/1/auditorium/1?showtime=3921&mode=3d';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(2500);

  const meshes = await page.evaluate(() => {
    const list = [];
    if (!window.THREE || !window.__threeScene) return list;
    window.__threeScene.traverse((obj) => {
      if (obj.isMesh) {
        const box = new window.THREE.Box3().setFromObject(obj);
        const size = new window.THREE.Vector3();
        box.getSize(size);
        const center = new window.THREE.Vector3();
        box.getCenter(center);

        let color = null;
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            color = obj.material.map(m => m.color ? m.color.getHexString() : null);
          } else if (obj.material.color) {
            color = obj.material.color.getHexString();
          }
        }

        list.push({
          name: obj.name,
          parent: obj.parent?.name,
          visible: obj.visible,
          color,
          opacity: obj.material?.opacity,
          size: [Math.round(size.x * 100) / 100, Math.round(size.y * 100) / 100, Math.round(size.z * 100) / 100],
          center: [Math.round(center.x * 100) / 100, Math.round(center.y * 100) / 100, Math.round(center.z * 100) / 100],
        });
      }
    });
    return list;
  });

  console.log('Auditorium 1 total meshes:', meshes.length);
  const largeOrBlack = meshes.filter(m => m.size[0] > 7 && m.size[1] > 3);
  console.log('Large meshes:', JSON.stringify(largeOrBlack, null, 2));

  await page.screenshot({ path: 'evidence/inspect_aud1.png' });
  await browser.close();
})();
