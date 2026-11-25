const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const url = 'http://localhost:3002/cinemas/6/auditorium/18?showtime=3449&mode=3d';
  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(3000);

  // Take screenshot before play
  await page.screenshot({ path: 'evidence/part_a_before_play.png' });
  console.log('Saved evidence/part_a_before_play.png');

  // Check 3D scene objects and DOM elements
  const sceneInfo = await page.evaluate(() => {
    const meshes = [];
    const traverse = (obj) => {
      if (obj.isMesh) {
        meshes.push({
          name: obj.name,
          type: obj.type,
          visible: obj.visible,
          position: [obj.position.x, obj.position.y, obj.position.z],
          geometryType: obj.geometry?.type,
          materialColor: obj.material?.color?.getHexString ? obj.material.color.getHexString() : null,
          materialTransparent: obj.material?.transparent,
          materialOpacity: obj.material?.opacity,
        });
      }
      if (obj.children) {
        obj.children.forEach(traverse);
      }
    };
    if (window.THREE && window.__threeScene) {
      traverse(window.__threeScene);
    }

    const css3dRoots = Array.from(document.querySelectorAll('.cineverse-css3d-root, .cineverse-css3d-outer, .cineverse-css3d-inner, iframe')).map(el => {
      const rect = el.getBoundingClientRect();
      return {
        className: el.className,
        tagName: el.tagName,
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        style: el.getAttribute('style'),
      };
    });

    return { meshes, css3dRoots };
  });
  console.log('CSS3D elements before play:', JSON.stringify(sceneInfo.css3dRoots, null, 2));

  // Click 3D play button
  const playBtn = page.locator('[data-testid="screen-3d-play-button"]').first();
  if (await playBtn.isVisible()) {
    console.log('Clicking 3D play button...');
    await playBtn.click();
  } else {
    console.log('Clicking trailer play toggle HUD...');
    await page.locator('[data-testid="trailer-play-toggle"]').first().click();
  }
  await page.waitForTimeout(3000);

  // Take screenshot with player active
  await page.screenshot({ path: 'evidence/part_a_player_active.png' });
  console.log('Saved evidence/part_a_player_active.png');

  // Inspect elements and raycasting
  const afterPlayInfo = await page.evaluate(() => {
    const css3dRoots = Array.from(document.querySelectorAll('.cineverse-css3d-root, .cineverse-css3d-outer, .cineverse-css3d-inner, iframe')).map(el => {
      const rect = el.getBoundingClientRect();
      return {
        className: el.className,
        tagName: el.tagName,
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        style: el.getAttribute('style'),
      };
    });

    // Check pointer events on elements at center of screen (e.g. 720, 450) and below screen (e.g. 720, 650)
    const elAtScreenCenter = document.elementFromPoint(720, 300);
    const elAtSeats = document.elementFromPoint(720, 650);

    return {
      css3dRoots,
      elAtScreenCenter: elAtScreenCenter ? { tag: elAtScreenCenter.tagName, class: elAtScreenCenter.className, id: elAtScreenCenter.id } : null,
      elAtSeats: elAtSeats ? { tag: elAtSeats.tagName, class: elAtSeats.className, id: elAtSeats.id } : null,
    };
  });
  console.log('After play info:', JSON.stringify(afterPlayInfo, null, 2));

  // Try hovering a seat
  await page.mouse.move(720, 650);
  await page.waitForTimeout(500);
  const tooltipVisible = await page.locator('[data-testid="seat-tooltip"], .seat-tooltip, [role="tooltip"]').count();
  console.log('Tooltip visible on hover at (720, 650):', tooltipVisible);

  await browser.close();
})();
