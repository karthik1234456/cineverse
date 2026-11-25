const { chromium } = require('@playwright/test');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('http://localhost:3002/cinemas/1/auditorium/1?showtime=1123&mode=3d&debug=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'debug_jailer2.png' });
  console.log('Saved debug_jailer2.png');

  const info = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.innerText,
      testid: b.getAttribute('data-testid'),
      visible: b.offsetParent !== null
    }));
    const store = (window).__cineverse_screen_probe;
    return { btns, probe: store };
  });

  console.log('Buttons:', info.btns);
  console.log('Probe:', info.probe);

  await browser.close();
}

main().catch(console.error);
