const { chromium } = require('../frontend/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee');
const EVIDENCE_DIR = path.resolve('evidence');

async function reproduce() {
  console.log('================================================================');
  console.log('REPRODUCING ISSUE 1: /cinemas/5/auditorium/16?showtime=4368&mode=3d');
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

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const networkEvents = [];

  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on('response', (res) => {
    if (res.status() >= 400 || res.url().includes('showtime') || res.url().includes('youtube')) {
      networkEvents.push({ url: res.url(), status: res.status(), statusText: res.statusText() });
    }
  });

  page.on('requestfailed', (req) => {
    networkEvents.push({ url: req.url(), failed: true, failure: req.failure() });
  });

  const url = 'http://localhost:3002/cinemas/5/auditorium/16?showtime=4368&mode=3d';
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  // Check what source resolver / store returned
  const storeState = await page.evaluate(() => {
    const s = (window).__cineverse_store?.getState();
    return {
      movieTitle: s?.trailer?.movieTitle,
      trailerUrl: s?.trailer?.trailerUrl,
      activeStrategy: s?.trailer?.activeStrategy,
      playbackStatus: s?.trailer?.playbackStatus,
      isTheatreMode: s?.trailer?.isTheatreMode,
      theatreModeOpen: s?.theatreModeOpen,
      auditoriumId: s?.auditoriumId,
      auditoriumName: s?.auditoriumName,
      screenType: s?.screenType,
    };
  });
  console.log('\n[Initial Store State]:', storeState);

  // Now press Play on the UI (the button on the screen or media cluster)
  console.log('\nClicking Play Trailer on UI...');
  const playBtn = page.locator('[data-testid="screen-3d-play-button"], [data-testid="trailer-play-toggle"]').first();
  if (await playBtn.isVisible()) {
    await playBtn.click();
  } else {
    await page.evaluate(() => {
      (window).__cineverse_store?.getState()?.toggleTrailerPlay();
    });
  }

  await page.waitForTimeout(2500);

  // Inspect Theatre Mode content
  const theatreModeContent = await page.evaluate(() => {
    const tmPlayer = document.querySelector('[data-testid="theatre-mode-modal"], [data-testid="theatre-mode-player"]');
    const iframe = document.querySelector('iframe[data-testid="theatre-mode-youtube-iframe"]');
    const video = document.querySelector('video[data-testid="theatre-mode-video-element"]');
    const innerText = tmPlayer ? tmPlayer.innerText : null;
    const innerHTML = tmPlayer ? tmPlayer.innerHTML : null;
    return {
      theatreModeOpen: (window).__cineverse_store?.getState()?.theatreModeOpen,
      hasPlayerElement: !!tmPlayer,
      hasIframe: !!iframe,
      hasVideo: !!video,
      innerText,
      innerHTMLSnippet: innerHTML ? innerHTML.slice(0, 300) : null,
    };
  });
  console.log('\n[Theatre Mode Content]:', theatreModeContent);

  const screenshotPath = path.join(EVIDENCE_DIR, 'reproduce_heart_beast_failure.png');
  await page.screenshot({ path: screenshotPath });
  fs.copyFileSync(screenshotPath, path.join(ARTIFACT_DIR, 'reproduce_heart_beast_failure.png'));
  console.log(`Saved screenshot to ${screenshotPath}`);

  await page.close();
  await context.close();
  await browser.close();

  const report = {
    url,
    storeState,
    theatreModeContent,
    consoleLogs,
    networkEvents,
  };

  const reportPath = path.join(EVIDENCE_DIR, 'reproduce_heart_beast_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'reproduce_heart_beast_report.json'), JSON.stringify(report, null, 2));
  console.log(`Saved reproduction report to ${reportPath}`);
}

reproduce().catch(console.error);
