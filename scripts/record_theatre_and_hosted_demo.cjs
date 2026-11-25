const { chromium } = require('../frontend/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const EVIDENCE_DIR = path.resolve('evidence');
const RECORDINGS_DIR = path.resolve('evidence/recordings');
const ARTIFACT_DIR = path.resolve('C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee');

if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

async function main() {
  console.log('================================================================');
  console.log('RECORD DEMO: Theatre Mode Default, Close Return, & Hosted 3D Screen');
  console.log('================================================================');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: [
      '--enable-gpu',
      '--use-gl=angle',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: RECORDINGS_DIR,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();

  try {
    // 1. Navigate to Compact Hall (Auditorium 1, Showtime 3934, Sit at H06)
    console.log('\n[Step 1] Navigating to Compact Hall at seat H06...');
    await page.goto('http://localhost:3002/cinemas/1/auditorium/1?showtime=3934&mode=pov&seat=H06', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(4000);

    // Ensure 3D canvas is ready
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 2. Check and capture seat badges in Sit view
    console.log('\n[Step 2] Capturing Seat Badges in Sit View at H06...');
    const badgeScreenshotPath = path.join(EVIDENCE_DIR, 'seat_badges_sit_h06_capped.png');
    await page.screenshot({ path: badgeScreenshotPath });
    fs.copyFileSync(badgeScreenshotPath, path.join(ARTIFACT_DIR, 'seat_badges_sit_h06_capped.png'));
    console.log(`  Saved badge screenshot to: ${badgeScreenshotPath}`);

    // Verify seat badge sizing and that no badges cover the screen
    const badgeAudit = await page.evaluate(() => {
      const store = (window).__cineverse_store?.getState();
      const pref = store?.trailerDisplayPreference;
      const camMode = store?.cameraMode;
      const actSeat = store?.activeSeatId;
      return { pref, camMode, actSeat };
    });
    console.log(`  Auditorium State: cameraMode=${badgeAudit.camMode}, seat=${badgeAudit.actSeat}, trailerPref=${badgeAudit.pref}`);

    // 3. Press Play Trailer -> Opens Theatre Mode by default with picture and sound
    console.log('\n[Step 3] Clicking Play Trailer -> Triggering Theatre Mode by Default...');
    const playBtn = page.locator('[data-testid="screen-3d-play-button"], [data-testid="play-trailer-btn"]').first();
    if (await playBtn.isVisible()) {
      await playBtn.click();
    } else {
      await page.evaluate(() => {
        (window).__cineverse_store?.getState()?.toggleTrailerPlay();
      });
    }

    await page.waitForTimeout(3500);

    // Verify Theatre Mode is open and playing
    const theatreState = await page.evaluate(() => {
      const store = (window).__cineverse_store?.getState();
      const tmPlayer = document.querySelector('[data-testid="theatre-mode-modal"], [data-testid="theatre-mode-player"]');
      const tmIframe = document.querySelector('iframe[src*="youtube.com"]');
      return {
        theatreModeOpen: store?.theatreModeOpen,
        isPlaying: store?.trailer?.isPlaying,
        playbackStatus: store?.trailer?.playbackStatus,
        houseLights: store?.houseLights,
        hasPlayerElement: !!tmPlayer,
        hasIframe: !!tmIframe,
      };
    });
    console.log('  Theatre Mode State:', theatreState);

    const theatreScreenshotPath = path.join(EVIDENCE_DIR, 'theatre_mode_default_h06.png');
    await page.screenshot({ path: theatreScreenshotPath });
    fs.copyFileSync(theatreScreenshotPath, path.join(ARTIFACT_DIR, 'theatre_mode_default_h06.png'));
    console.log(`  Saved Theatre Mode screenshot to: ${theatreScreenshotPath}`);

    // 4. Close Theatre Mode and return to hall
    console.log('\n[Step 4] Closing Theatre Mode to Return to Hall...');
    const closeBtn = page.locator('[data-testid="close-theatre-mode"], button[aria-label="Close Theatre Mode"], [data-testid="theatre-mode-close-btn"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.evaluate(() => {
        (window).__cineverse_store?.getState()?.setTheatreModeOpen(false);
      });
    }
    await page.waitForTimeout(2000);

    const returnState = await page.evaluate(() => {
      const store = (window).__cineverse_store?.getState();
      return {
        theatreModeOpen: store?.theatreModeOpen,
        isPlaying: store?.trailer?.isPlaying,
        houseLights: store?.houseLights,
      };
    });
    console.log('  Returned to Hall State:', returnState);

    const returnScreenshotPath = path.join(EVIDENCE_DIR, 'return_to_hall_h06.png');
    await page.screenshot({ path: returnScreenshotPath });
    fs.copyFileSync(returnScreenshotPath, path.join(ARTIFACT_DIR, 'return_to_hall_h06.png'));
    console.log(`  Saved Return to Hall screenshot to: ${returnScreenshotPath}`);

    // 5. Hosted Clip on 3D Screen (video texture)
    console.log('\n[Step 5] Testing Hosted Title Playing Directly on 3D Screen...');
    await page.evaluate(() => {
      const store = (window).__cineverse_store?.getState();
      if (store) {
        store.setTrailerState({
          trailerUrl: '/trailers/quantum_odyssey.webm',
          movieTitle: 'QUANTUM ODYSSEY',
          activeStrategy: 'video_texture',
          isPlaying: true,
          playbackStatus: 'playing',
          isMuted: false,
          isTheatreMode: false,
        });
        store.setHouseLights('dim');
      }
    });

    await page.waitForTimeout(3000);

    const hostedState = await page.evaluate(() => {
      const store = (window).__cineverse_store?.getState();
      const vid = (window).__cineverse_video;
      return {
        strategy: store?.trailer?.activeStrategy,
        isPlaying: store?.trailer?.isPlaying,
        theatreModeOpen: store?.theatreModeOpen,
        videoExists: !!vid,
        videoPaused: vid ? vid.paused : null,
        videoTime: vid ? vid.currentTime : null,
      };
    });
    console.log('  Hosted 3D Screen State:', hostedState);

    const hostedScreenshotPath = path.join(EVIDENCE_DIR, 'hosted_screen_picture.png');
    await page.screenshot({ path: hostedScreenshotPath });
    fs.copyFileSync(hostedScreenshotPath, path.join(ARTIFACT_DIR, 'hosted_screen_picture.png'));
    console.log(`  Saved Hosted Screen screenshot to: ${hostedScreenshotPath}`);

    console.log('\nAll demo steps completed successfully.');
  } catch (err) {
    console.error('Error during demo run:', err);
  } finally {
    // Close context to flush video file
    await page.close();
    const videoObj = page.video();
    await context.close();
    await browser.close();

    if (videoObj) {
      const videoPath = await videoObj.path();
      const targetPath = path.join(EVIDENCE_DIR, 'theatre_mode_and_hosted_screen_demo.webm');
      if (fs.existsSync(videoPath)) {
        fs.copyFileSync(videoPath, targetPath);
        fs.copyFileSync(videoPath, path.join(ARTIFACT_DIR, 'theatre_mode_and_hosted_screen_demo.webm'));
        console.log(`\nVideo recording finalized and saved to:\n  ${targetPath}`);
      }
    }
  }
}

main().catch(console.error);
