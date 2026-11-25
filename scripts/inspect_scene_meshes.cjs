const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const url = 'http://localhost:3002/cinemas/6/auditorium/18?showtime=3449&mode=3d';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(2000);

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
          transparent: obj.material?.transparent,
          size: [Math.round(size.x * 100) / 100, Math.round(size.y * 100) / 100, Math.round(size.z * 100) / 100],
          center: [Math.round(center.x * 100) / 100, Math.round(center.y * 100) / 100, Math.round(center.z * 100) / 100],
        });
      }
    });
    return list;
  });

  console.log('Meshes with black / dark color or large size:');
  const blackMeshes = meshes.filter(m => m.color === '000000' || m.color === '0e0f12' || (m.size[0] > 10 && m.size[1] > 3));
  console.log(JSON.stringify(blackMeshes, null, 2));

  console.log('All meshes count:', meshes.length);
  const screenRelated = meshes.filter(m => m.name.toLowerCase().includes('screen') || m.name.toLowerCase().includes('frame') || m.name.toLowerCase().includes('mask') || m.name.toLowerCase().includes('occlud'));
  console.log('Screen related meshes:', JSON.stringify(screenRelated, null, 2));

  await browser.close();
})();
