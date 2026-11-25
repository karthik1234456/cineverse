import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('Extract 3 frames from sample hosted videos', async ({ page }) => {
  const outputDir = path.resolve('evidence/ocr_frames');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sampleSlugs = ['astra-celestial-throne', 'sample-showcase', 'zero-gravity-protocol'];

  for (const slug of sampleSlugs) {
    const videoUrl = `http://localhost:3002/trailers/${slug}.mp4`;
    await page.goto('about:blank');
    
    // Create HTML with video
    await page.setContent(`
      <html>
        <body style="margin:0; background:#000;">
          <video id="v" src="${videoUrl}" width="1280" height="720" muted playsinline style="object-fit:contain;"></video>
          <canvas id="c" width="1280" height="720"></canvas>
        </body>
      </html>
    `);

    // Seek to 1s, 3s, 5s
    const timestamps = [1.0, 3.0, 5.0];
    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      await page.evaluate(async (seekTime) => {
        const v = document.getElementById('v') as HTMLVideoElement;
        return new Promise<void>((resolve) => {
          v.currentTime = seekTime;
          v.onseeked = () => resolve();
        });
      }, t);

      // Save screenshot of the video element
      const outPath = path.join(outputDir, `${slug}_f${i + 1}.png`);
      const vLoc = page.locator('#v');
      await vLoc.screenshot({ path: outPath });
      console.log(`Saved frame ${i + 1} at t=${t}s: ${outPath}`);
    }
  }
});
