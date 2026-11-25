const { chromium } = require('../frontend/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

async function analyze(imageName) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const imgPath = path.resolve(imageName);
  const imgBase64 = fs.readFileSync(imgPath).toString('base64');

  await page.setContent('<canvas id="c" width="1920" height="1080"></canvas>');

  const res = await page.evaluate(async (b64) => {
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = 'data:image/png;base64,' + b64; });
    ctx.drawImage(img, 0, 0);

    const center = ctx.getImageData(960, 450, 1, 1).data;
    const top = ctx.getImageData(960, 300, 1, 1).data;
    const left = ctx.getImageData(600, 450, 1, 1).data;
    const right = ctx.getImageData(1300, 450, 1, 1).data;

    return {
      center: [center[0], center[1], center[2], center[3]],
      top: [top[0], top[1], top[2], top[3]],
      left: [left[0], left[1], left[2], left[3]],
      right: [right[0], right[1], right[2], right[3]],
    };
  }, imgBase64);

  await browser.close();
  return res;
}

async function run() {
  console.log('probe_playing.png:', await analyze('probe_playing.png'));
  console.log('probe_no_canvas.png:', await analyze('probe_no_canvas.png'));
  console.log('probe_magenta_behind_canvas.png:', await analyze('probe_magenta_behind_canvas.png'));
}

run().catch(console.error);
