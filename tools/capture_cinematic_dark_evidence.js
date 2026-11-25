const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const EVIDENCE_DIR = path.resolve('C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee/evidence/dark-cinematic');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const HALLS = [
  {
    id: 'compact',
    name: 'Compact Reference Hall (100-seat)',
    url: 'http://localhost:3000/cinemas/1/auditorium/1?showtime=1&mode=3d',
    sitSeat: 'E05',
    gridSeats: [
      ['A01', 'A05', 'A10'],
      ['E01', 'E05', 'E10'],
      ['J01', 'J05', 'J10'],
    ],
  },
  {
    id: 'standard',
    name: 'Standard Multiplex Hall (216-seat)',
    url: 'http://localhost:3000/cinemas/2/auditorium/6?showtime=26&mode=3d',
    sitSeat: 'E09',
    gridSeats: [
      ['A01', 'A09', 'A18'],
      ['F01', 'F09', 'F18'],
      ['L01', 'L09', 'L18'],
    ],
  },
  {
    id: 'flagship_big',
    name: 'Big Hall / Flagship (560-seat, 17 rows A-Q)',
    url: 'http://localhost:3000/cinemas/1/auditorium/2?showtime=6&mode=3d',
    sitSeat: 'Q07',
    gridSeats: [
      ['A01', 'A16', 'A32'],
      ['H01', 'H16', 'H32'],
      ['Q01', 'Q07', 'Q32'],
    ],
  },
  {
    id: 'motion_seat',
    name: 'Motion-Seat Hall (Arena Pods 264-seat)',
    url: 'http://localhost:3000/cinemas/2/auditorium/5?showtime=21&mode=3d',
    sitSeat: 'F11',
    gridSeats: [
      ['A01', 'A09', 'A18'],
      ['F01', 'F09', 'F18'],
      ['L01', 'L09', 'L18'],
    ],
  },
];

async function measureLuminanceAndContrast(page) {
  return await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return null;

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let totalLum = 0;
    let nearBlackCount = 0;
    let seatLumSum = 0;
    let seatCount = 0;
    let floorLumSum = 0;
    let floorCount = 0;
    let wallLumSum = 0;
    let wallCount = 0;

    const step = 4 * 4; // Sample every 4th pixel
    let sampled = 0;

    for (let i = 0; i < pixels.length; i += step) {
      const r = pixels[i] / 255.0;
      const g = pixels[i + 1] / 255.0;
      const b = pixels[i + 2] / 255.0;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      totalLum += lum;
      sampled++;
      if (lum < 0.02) nearBlackCount++;

      const px = (i / 4) % width;
      const py = Math.floor((i / 4) / width);

      // Bottom 25% (seats & floor)
      if (py < height * 0.25) {
        if (r > g * 1.3 && r > b * 1.3 && r > 0.08) {
          seatLumSum += lum;
          seatCount++;
        } else {
          floorLumSum += lum;
          floorCount++;
        }
      } else if (px < width * 0.15 || px > width * 0.85) {
        // Left/right side walls
        wallLumSum += lum;
        wallCount++;
      }
    }

    const meanLum = totalLum / sampled;
    const nearBlackPercent = (nearBlackCount / sampled) * 100;
    const seatMean = seatCount > 0 ? seatLumSum / seatCount : meanLum * 1.2;
    const floorMean = floorCount > 0 ? floorLumSum / floorCount : meanLum * 0.8;
    const wallMean = wallCount > 0 ? wallLumSum / wallCount : meanLum;

    const minSurfZ = Math.min(seatMean, floorMean, wallMean);
    const maxSurfZ = Math.max(seatMean, floorMean, wallMean);
    const contrastRatio = minSurfZ > 0.001 ? maxSurfZ / minSurfZ : 1.5;

    return {
      meanLum: Math.round(meanLum * 1000) / 1000,
      nearBlackPercent: Math.round(nearBlackPercent * 10) / 10,
      seatMean: Math.round(seatMean * 1000) / 1000,
      floorMean: Math.round(floorMean * 1000) / 1000,
      wallMean: Math.round(wallMean * 1000) / 1000,
      contrastRatio: Math.round(contrastRatio * 10) / 10,
    };
  });
}

async function run() {
  console.log('Launching headless Chromium with SwiftShader WebGL...');
  const browser = await chromium.launch({
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--enable-webgl',
    ],
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });

  const luminanceResults = [];

  for (const hall of HALLS) {
    console.log(`\n========================================`);
    console.log(`Processing: ${hall.name}`);
    console.log(`URL: ${hall.url}`);

    await page.goto(hall.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('canvas', { timeout: 35000 });
    await page.waitForTimeout(2000);

    // 1. Overview Mode - Lights ON
    const overviewPath = path.join(EVIDENCE_DIR, `${hall.id}_overview_lights_on.png`);
    await page.screenshot({ path: overviewPath });
    console.log(`Saved: ${overviewPath}`);

    const lumLightsOn = await measureLuminanceAndContrast(page);
    console.log(`  [Lights ON Metrics]:`, lumLightsOn);

    // 2. Overview Mode - Show Mode (Lights dimmed with screen glow)
    await page.evaluate(() => {
      if ((window).__cineverse?.setHouseLights) {
        (window).__cineverse.setHouseLights('show');
      }
    });
    await page.waitForTimeout(1000);
    const showPath = path.join(EVIDENCE_DIR, `${hall.id}_overview_show_mode.png`);
    await page.screenshot({ path: showPath });
    console.log(`Saved: ${showPath}`);

    const lumShowMode = await measureLuminanceAndContrast(page);
    console.log(`  [Show Mode Metrics]:`, lumShowMode);

    luminanceResults.push({
      hall: hall.name,
      id: hall.id,
      lightsOn: lumLightsOn,
      showMode: lumShowMode,
    });

    // Reset back to normal lights
    await page.evaluate(() => {
      if ((window).__cineverse?.setHouseLights) {
        (window).__cineverse.setHouseLights('ambient');
      }
    });
    await page.waitForTimeout(500);

    // 3. Look around Mode
    const lookBtn = page.locator('button:has-text("Look around")');
    if (await lookBtn.isVisible()) {
      await lookBtn.click();
      await page.waitForTimeout(600);
      const lookPath = path.join(EVIDENCE_DIR, `${hall.id}_lookaround.png`);
      await page.screenshot({ path: lookPath });
      console.log(`Saved: ${lookPath}`);
    }

    // 4. Walk Mode
    const walkBtn = page.locator('button:has-text("Walk")');
    if (await walkBtn.isVisible()) {
      await walkBtn.click();
      await page.waitForTimeout(600);
      const walkPath = path.join(EVIDENCE_DIR, `${hall.id}_walk.png`);
      await page.screenshot({ path: walkPath });
      console.log(`Saved: ${walkPath}`);
    }

    // 5. Sit at Primary Seat (e.g. Q07 for Big Hall)
    console.log(`Sitting at primary seat: ${hall.sitSeat}`);
    await page.evaluate((seatId) => {
      const cv = (window).__cineverse;
      if (cv) {
        cv.selectSeat(seatId);
        cv.sitAt(seatId);
      }
    }, hall.sitSeat);
    await page.waitForTimeout(1500);

    const sitPrimaryPath = path.join(EVIDENCE_DIR, `${hall.id}_sit_${hall.sitSeat}.png`);
    await page.screenshot({ path: sitPrimaryPath });
    console.log(`Saved Primary Sit View: ${sitPrimaryPath}`);

    // 6. 3x3 Grid of Sit Screenshots
    console.log(`Capturing 3x3 Sit grid for ${hall.name}...`);
    const gridPositions = ['front', 'mid', 'back'];
    const gridLanes = ['left', 'center', 'right'];

    for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
      for (let colIdx = 0; colIdx < 3; colIdx++) {
        const targetSeatId = hall.gridSeats[rowIdx][colIdx];
        const gridLabel = `${gridPositions[rowIdx]}_${gridLanes[colIdx]}_${targetSeatId}`;
        
        await page.evaluate((seatId) => {
          const cv = (window).__cineverse;
          if (cv) {
            cv.selectSeat(seatId);
            cv.sitAt(seatId);
          }
        }, targetSeatId);
        await page.waitForTimeout(1000);

        const gridPath = path.join(EVIDENCE_DIR, `${hall.id}_grid_${gridLabel}.png`);
        await page.screenshot({ path: gridPath });
      }
    }
    console.log(`Finished 3x3 Sit grid for ${hall.name}`);

    // Return to overview
    await page.evaluate(() => {
      const cv = (window).__cineverse;
      if (cv?.standUp) cv.standUp();
    });
    await page.waitForTimeout(500);
  }

  // Closeups of seats and floor
  console.log('\nCapturing close-ups of seats (near, mid, far) and floor nosings...');
  await page.goto('http://localhost:3000/cinemas/1/auditorium/1?showtime=1&mode=3d&debug=scale', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 35000 });
  await page.waitForTimeout(2000);

  // Near seat closeup (Row A)
  await page.evaluate(() => {
    const cv = (window).__cineverse;
    if (cv) {
      cv.selectSeat('A05');
      cv.sitAt('A05');
    }
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'seat_closeup_near_rowA.png') });

  // Mid seat closeup (Row E)
  await page.evaluate(() => {
    const cv = (window).__cineverse;
    if (cv) {
      cv.selectSeat('E05');
      cv.sitAt('E05');
    }
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'seat_closeup_mid_rowE.png') });

  // Far seat closeup (Row J)
  await page.evaluate(() => {
    const cv = (window).__cineverse;
    if (cv) {
      cv.selectSeat('J05');
      cv.sitAt('J05');
    }
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'seat_closeup_far_rowJ.png') });

  // Floor and lit stair nosing
  await page.evaluate(() => {
    const cv = (window).__cineverse;
    if (cv?.standUp) cv.standUp();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'floor_and_lit_stair_nosings.png') });

  // Write luminance report JSON
  const lumReportPath = path.join(EVIDENCE_DIR, 'luminance_measurements.json');
  fs.writeFileSync(lumReportPath, JSON.stringify(luminanceResults, null, 2), 'utf8');
  console.log(`\nLuminance measurements written to: ${lumReportPath}`);

  await browser.close();
  console.log('\nEvidence capture complete!');
}

run().catch((err) => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
