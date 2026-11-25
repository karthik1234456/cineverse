const { chromium } = require('../frontend/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee');

async function run() {
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { width: 1366, height: 768, label: '1366x768' },
    { width: 1280, height: 720, label: '1280x720' },
  ];

  const views = ['orbit', 'walk', 'pov'];
  const testResults = [];

  for (const vp of viewports) {
    console.log(`\n======================================================`);
    console.log(`TESTING HUD AT VIEWPORT: ${vp.label}`);
    console.log(`======================================================`);

    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    for (const view of views) {
      const modeQuery = view === 'orbit' ? '3d' : view;
      const url = `http://localhost:3002/cinemas/6/auditorium/18?showtime=3449&mode=${modeQuery}${view === 'pov' ? '&seat=E08' : ''}`;
      console.log(`\n--- Mode: ${view.toUpperCase()} at ${vp.label} ---`);
      await page.goto(url);
      await page.waitForTimeout(3000);

      // Verify Info Panel collapse state
      const panelState = await page.evaluate((currentView) => {
        const expandBtn = document.querySelector('[data-testid="expand-auditorium-info-btn"]');
        const fullPanel = document.querySelector('[data-testid="auditorium-info-panel"]');
        return {
          isCollapsed: !!expandBtn,
          isFullPanel: !!fullPanel,
          defaultCollapsedInFirstPerson: (currentView === 'walk' || currentView === 'pov') ? !!expandBtn : true,
        };
      }, view);

      console.log(`  Info Panel collapsed: ${panelState.isCollapsed}, Full: ${panelState.isFullPanel} (Default collapsed in first person: ${panelState.defaultCollapsedInFirstPerson ? 'PASS' : 'FAIL'})`);

      // Check compact trailer controls and bottom bar controls bounding boxes
      const controlsBounds = await page.evaluate((vpBounds) => {
        const bottomTrailerControls = document.querySelector('[data-testid="bottom-bar-compact-trailer-controls"]');
        const compactOverlay = document.querySelector('[data-testid="compact-trailer-controls-overlay"]');
        const hudTrailer = document.querySelector('[data-testid="trailer-controls-hud"]');

        const activeControls = bottomTrailerControls || compactOverlay || hudTrailer;
        if (!activeControls) return { found: false };

        const rect = activeControls.getBoundingClientRect();
        const fullyInsideViewport =
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= vpBounds.height &&
          rect.right <= vpBounds.width;

        const playBtn = document.querySelector('[data-testid="bottom-bar-trailer-play"]') ||
                        document.querySelector('[data-testid="compact-trailer-play-toggle"]') ||
                        document.querySelector('[data-testid="trailer-play-toggle"]');
        const muteBtn = document.querySelector('[data-testid="bottom-bar-trailer-mute"]') ||
                        document.querySelector('[data-testid="compact-trailer-mute-toggle"]') ||
                        document.querySelector('[data-testid="trailer-mute-toggle"]');
        const restartBtn = document.querySelector('[data-testid="bottom-bar-trailer-restart"]') ||
                           document.querySelector('[data-testid="compact-trailer-restart-btn"]') ||
                           document.querySelector('[data-testid="trailer-restart-btn"]');

        return {
          found: true,
          rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
          fullyInsideViewport,
          playBtnVisible: !!playBtn,
          muteBtnVisible: !!muteBtn,
          restartBtnVisible: !!restartBtn,
        };
      }, vp);

      console.log(`  Trailer controls bounds: top=${controlsBounds.rect?.top?.toFixed(0)}, bottom=${controlsBounds.rect?.bottom?.toFixed(0)} <= ${vp.height} -> ${controlsBounds.fullyInsideViewport ? 'PASS (No scrolling required)' : 'FAIL'}`);
      console.log(`  Buttons present: Play=${controlsBounds.playBtnVisible}, Mute=${controlsBounds.muteBtnVisible}, Restart=${controlsBounds.restartBtnVisible}`);

      const screenshotName = `hud_${vp.label}_${view}.png`;
      const screenshotPath = path.join(ARTIFACT_DIR, screenshotName);
      try {
        await page.screenshot({ path: screenshotPath, timeout: 8000, animations: 'disabled' });
        console.log(`  Screenshot saved: ${screenshotName}`);
      } catch (e) {
        console.warn(`  Screenshot timed out for ${screenshotName}`);
      }

      testResults.push({
        viewport: vp.label,
        mode: view,
        panelState,
        controlsBounds,
        screenshot: screenshotName,
      });
    }

    await context.close();
  }

  const outReport = path.join(ARTIFACT_DIR, 'hud_viewport_report.json');
  fs.writeFileSync(outReport, JSON.stringify(testResults, null, 2));
  console.log(`\nHUD viewport verification complete! Saved to ${outReport}`);

  await browser.close();
}

run().catch(err => {
  console.error('HUD test failed:', err);
  process.exit(1);
});
