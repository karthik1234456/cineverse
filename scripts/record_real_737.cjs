const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const REC_DIR = 'C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee/evidence/recordings';
if (!fs.existsSync(REC_DIR)) {
  fs.mkdirSync(REC_DIR, { recursive: true });
}

async function recordReal() {
  console.log('--- RECORDING REAL MOVIE: Clayface (Showtime 737) ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: REC_DIR,
      size: { width: 1280, height: 800 }
    }
  });

  await context.addInitScript(() => localStorage.setItem('cineverse_city', 'mumbai'));
  const page = await context.newPage();
  
  console.log('Navigating to showtime 737...');
  await page.goto('http://localhost:3000/cinemas/11/auditorium/36?showtime=737&mode=3d');
  await page.waitForTimeout(4000);

  // Take screenshot of initial state before click
  await page.screenshot({ path: path.join(REC_DIR, 'st737_initial.png') });

  // Locate the on-screen Play button
  const playBtn = page.locator('[data-testid="screen-3d-play-button"]');
  console.log('Play button visible:', await playBtn.isVisible());

  // Click the Play button
  console.log('Clicking on-screen Play trailer button...');
  await playBtn.click();

  // Wait 3.5s for 3s watchdog to transition to Theatre Mode, then capture t=2s after modal open
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(REC_DIR, 'st737_theatre_mode_t0.png') });
  
  // Play for 3 more seconds in Theatre Mode
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(REC_DIR, 'st737_theatre_mode_t3.png') });

  const status = await page.evaluate(() => {
    const theatreModal = document.querySelector('[data-testid="theatre-mode-modal"]');
    const iframe = document.querySelector('iframe');
    const video = document.querySelector('video');
    return {
      isTheatreMode: Boolean(theatreModal),
      hasIframe: Boolean(iframe),
      hasVideo: Boolean(video),
      theatreVideoTime: video ? video.currentTime : null
    };
  });
  console.log('Showtime 737 playback status in Theatre Mode:', status);

  await page.close();
  const videoPath = await page.video().path();
  await context.close();

  const finalVideoPath = path.join(REC_DIR, 'clayface_st737_playback.webm');
  if (fs.existsSync(videoPath)) {
    fs.renameSync(videoPath, finalVideoPath);
    console.log('Real movie recording successfully saved to:', finalVideoPath);
  }

  await browser.close();
  return status;
}

recordReal().catch(err => {
  console.error('Real movie recording failed:', err);
  process.exit(1);
});
