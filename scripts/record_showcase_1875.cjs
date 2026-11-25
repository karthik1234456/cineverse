const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const REC_DIR = 'C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee/evidence/recordings';
if (!fs.existsSync(REC_DIR)) {
  fs.mkdirSync(REC_DIR, { recursive: true });
}

async function recordShowcase() {
  console.log('--- RECORDING SHOWCASE: Quantum Odyssey (Showtime 1875) ---');
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
  
  console.log('Navigating to showtime 1875...');
  await page.goto('http://localhost:3000/cinemas/12/auditorium/39?showtime=1875&mode=3d');
  await page.waitForTimeout(4000);

  // Take screenshot of initial state before click
  await page.screenshot({ path: path.join(REC_DIR, 'st1875_initial.png') });

  // Locate the on-screen Play button
  const playBtn = page.locator('[data-testid="screen-3d-play-button"]');
  console.log('Play button visible:', await playBtn.isVisible());

  // Click the Play button
  console.log('Clicking on-screen Play trailer button...');
  await playBtn.click();

  // Allow video to play for 5 seconds
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(REC_DIR, 'st1875_playing_t2.png') });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(REC_DIR, 'st1875_playing_t5.png') });

  const status = await page.evaluate(() => {
    const vid = document.querySelector('#cineverse-trailer-video') || (window).__cineverse_video;
    const store = (window).__cineverse_store ? (window).__cineverse_store.getState() : null;
    return {
      playbackStatus: store?.trailer?.playbackStatus,
      isPlaying: store?.trailer?.isPlaying,
      videoTime: vid ? vid.currentTime : null,
      videoPaused: vid ? vid.paused : null,
      videoSrc: vid ? vid.src : null,
      readyState: vid ? vid.readyState : null
    };
  });
  console.log('Showtime 1875 playback status:', status);

  await page.close();
  const videoPath = await page.video().path();
  await context.close();

  const finalVideoPath = path.join(REC_DIR, 'quantum_odyssey_st1875_playback.webm');
  if (fs.existsSync(videoPath)) {
    fs.renameSync(videoPath, finalVideoPath);
    console.log('Showcase recording saved to:', finalVideoPath);
  }

  await browser.close();
  return status;
}

recordShowcase().catch(err => {
  console.error('Showcase recording failed:', err);
  process.exit(1);
});
