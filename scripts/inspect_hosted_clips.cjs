const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function main() {
  const trailersDir = path.resolve(__dirname, '../frontend/public/trailers');
  const files = fs.readdirSync(trailersDir).filter(f => f.endsWith('.mp4'));
  console.log(`Found ${files.length} MP4 files in ${trailersDir}`);

  // Query SQLite to know which movies are mapped to which files
  // We can run an inspection inside Chromium
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Create an HTML testbed
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body>
        <video id="v" muted playsinline crossOrigin="anonymous"></video>
        <canvas id="c" width="32" height="32"></canvas>
      </body>
    </html>
  `);

  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(trailersDir, file);
    const videoUrl = 'http://localhost:3002/trailers/' + file;

    try {
      const info = await page.evaluate(async (url) => {
        const v = document.getElementById('v');
        const c = document.getElementById('c');
        const ctx = c.getContext('2d', { willReadFrequently: true });

        v.src = url;
        await new Promise((resolve, reject) => {
          v.onloadedmetadata = resolve;
          v.onerror = (e) => reject(v.error ? v.error.message : 'load error');
          setTimeout(() => reject('timeout loading metadata'), 5000);
        });

        const duration = v.duration;
        const sampleTimes = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map(r => r * duration);
        const frameHashes = [];
        const frameSamples = [];

        for (const t of sampleTimes) {
          v.currentTime = t;
          await new Promise((res) => {
            v.onseeked = res;
            setTimeout(res, 500);
          });

          ctx.drawImage(v, 0, 0, 32, 32);
          const imgData = ctx.getImageData(0, 0, 32, 32);
          // calculate average hash (aHash) or dHash
          let sum = 0;
          const grays = [];
          for (let p = 0; p < imgData.data.length; p += 4) {
            const g = (imgData.data[p] * 0.299 + imgData.data[p+1] * 0.587 + imgData.data[p+2] * 0.114);
            grays.push(g);
            sum += g;
          }
          const avg = sum / grays.length;
          let bitStr = '';
          for (const g of grays) {
            bitStr += g >= avg ? '1' : '0';
          }
          frameHashes.push(bitStr);
          // sample first 10 grayscale values for quick diff
          frameSamples.push(grays.slice(0, 10));
        }

        return {
          duration,
          frameHashes,
          sampleFirstFrameSum: frameSamples[0]
        };
      }, videoUrl);

      results.push({ file, ...info });
      if ((i + 1) % 10 === 0 || i === files.length - 1) {
        console.log(`Processed ${i + 1}/${files.length} clips`);
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message || err);
      results.push({ file, error: String(err) });
    }
  }

  await browser.close();

  // Compare pairwise hamming distances
  function hammingDistance(s1, s2) {
    let dist = 0;
    for (let i = 0; i < s1.length; i++) {
      if (s1[i] !== s2[i]) dist++;
    }
    return dist;
  }

  console.log('\n--- Comparing pairwise perceptual signatures ---');
  let duplicateCount = 0;
  for (let i = 0; i < results.length; i++) {
    if (results[i].error) continue;
    for (let j = i + 1; j < results.length; j++) {
      if (results[j].error) continue;
      // compare all 9 frame hashes
      let totalDiffBits = 0;
      for (let k = 0; k < 9; k++) {
        totalDiffBits += hammingDistance(results[i].frameHashes[k], results[j].frameHashes[k]);
      }
      const avgBitDiff = totalDiffBits / 9; // out of 1024 bits
      if (avgBitDiff < 30) {
        console.log(`NEAR IDENTICAL (${avgBitDiff.toFixed(1)} bits diff): ${results[i].file} and ${results[j].file}`);
        duplicateCount++;
      }
    }
  }
  console.log(`\nTotal near-identical pairs: ${duplicateCount}`);
}

main().catch(console.error);
