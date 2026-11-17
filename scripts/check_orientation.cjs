const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3000/cinemas/1/auditorium/1?showtime=1&mode=3d');
  await page.waitForTimeout(4000);

  // Evaluate the button text and check positions of first character vs last character
  const result = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="screen-3d-play-button"]');
    if (!btn) return { error: 'btn not found' };
    
    // Add two test span elements to measure left vs right
    const spanA = document.createElement('span');
    spanA.id = 'test-marker-left';
    spanA.textContent = 'A';
    spanA.style.position = 'absolute';
    spanA.style.left = '0px';
    spanA.style.top = '0px';

    const spanZ = document.createElement('span');
    spanZ.id = 'test-marker-right';
    spanZ.textContent = 'Z';
    spanZ.style.position = 'absolute';
    spanZ.style.right = '0px';
    spanZ.style.top = '0px';

    btn.appendChild(spanA);
    btn.appendChild(spanZ);

    const rectA = spanA.getBoundingClientRect();
    const rectZ = spanZ.getBoundingClientRect();

    return {
      rectA: { x: rectA.x, y: rectA.y },
      rectZ: { x: rectZ.x, y: rectZ.y },
      isMirrored: rectA.x > rectZ.x,
      deltaX: rectZ.x - rectA.x
    };
  });

  console.log('Orientation check result:', result);
  await browser.close();
})();
