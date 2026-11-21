const { chromium } = require('../frontend/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee';

async function run() {
  console.log('=== Capturing Evidence for Parts B, C, D, E ===');
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=gl', '--enable-webgl', '--no-sandbox']
  });

  // 1. Full HD Viewport (1920x1080)
  const context1080 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page1080 = await context1080.newPage();

  console.log('Navigating to Auditorium 13 (Luxe Recliner Lounge)...');
  await page1080.goto('http://localhost:3002/cinemas/4/auditorium/13?showtime=3424&mode=3d', { waitUntil: 'networkidle', timeout: 30000 });
  await page1080.waitForTimeout(4000);

  // Take Look around screenshot (Auditorium 13, Luxe Recliner Lounge)
  const lookaroundPath = path.join(ARTIFACT_DIR, 'evidence_part_b_aud13_lookaround.png');
  await page1080.screenshot({ path: lookaroundPath });
  console.log('Saved Look around screenshot:', lookaroundPath);

  // Verify Depth Layering DOM order
  const zIndices = await page1080.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const css3dRoot = document.querySelector('.cineverse-css3d-root');
    const leftCol = document.querySelector('#hud-left-column');
    const toolbar = document.querySelector('header');
    return {
      canvasZ: canvas ? window.getComputedStyle(canvas).zIndex : null,
      canvasPos: canvas ? window.getComputedStyle(canvas).position : null,
      css3dZ: css3dRoot ? window.getComputedStyle(css3dRoot).zIndex : null,
      leftColZ: leftCol ? window.getComputedStyle(leftCol).zIndex : null,
      toolbarZ: toolbar ? window.getComputedStyle(toolbar).zIndex : null,
    };
  });
  console.log('Depth Layering CSS Check:', zIndices);

  // Close-up on Recliner Seat Shape (Part E)
  await page1080.evaluate(() => {
    const store = window.__CINEVERSE_STORE__ || (window.useCinemaStore && window.useCinemaStore.getState && window.useCinemaStore.getState());
    if (store && store.setCameraPose) {
      // Position camera right next to Row C seat for close-up view of headrest, armrests, cushion
      store.setCameraPose([0.0, 3.2, -18.0], [0.0, 2.5, -20.0]);
    }
  });
  await page1080.waitForTimeout(1500);
  const seatCloseupPath = path.join(ARTIFACT_DIR, 'evidence_part_e_recliner_closeup.png');
  await page1080.screenshot({ path: seatCloseupPath });
  console.log('Saved Seat Close-up screenshot:', seatCloseupPath);

  // 2. Sit View (POV Mode)
  console.log('Navigating to Sit View (E04)...');
  await page1080.goto('http://localhost:3002/cinemas/4/auditorium/13?showtime=3424&mode=pov&seat=E04', { waitUntil: 'networkidle', timeout: 30000 });
  await page1080.waitForTimeout(3500);
  const sitViewPath = path.join(ARTIFACT_DIR, 'evidence_part_b_sit_view_e04.png');
  await page1080.screenshot({ path: sitViewPath });
  console.log('Saved Sit View screenshot:', sitViewPath);

  // 3. Walk Mode Verification (Part C)
  console.log('Entering Walk Mode in Auditorium 13...');
  await page1080.evaluate(() => {
    const store = window.__CINEVERSE_STORE__ || (window.useCinemaStore && window.useCinemaStore.getState && window.useCinemaStore.getState());
    if (store && store.setMode) {
      store.setMode('walk');
    }
  });
  await page1080.waitForTimeout(2500);
  const walkAud13Path = path.join(ARTIFACT_DIR, 'evidence_part_c_walk_aud13.png');
  await page1080.screenshot({ path: walkAud13Path });
  console.log('Saved Walk Mode screenshot (Auditorium 13):', walkAud13Path);

  // Walk Mode in Standard Hall (Auditorium 18)
  console.log('Entering Walk Mode in Grand Balcony Hall (Auditorium 18)...');
  await page1080.goto('http://localhost:3002/cinemas/6/auditorium/18?showtime=3449&mode=walk', { waitUntil: 'networkidle', timeout: 30000 });
  await page1080.waitForTimeout(3500);
  const walkAud18Path = path.join(ARTIFACT_DIR, 'evidence_part_c_walk_aud18.png');
  await page1080.screenshot({ path: walkAud18Path });
  console.log('Saved Walk Mode screenshot (Auditorium 18):', walkAud18Path);

  // 4. HUD Overlap Verification at 1366x768 and 1920x1080 (Part D)
  console.log('Testing HUD non-overlap at 1366x768...');
  const context768 = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page768 = await context768.newPage();
  await page768.goto('http://localhost:3002/cinemas/4/auditorium/13?showtime=3424&mode=3d', { waitUntil: 'networkidle', timeout: 30000 });
  await page768.waitForTimeout(3500);

  const hudOverlap768 = await page768.evaluate(() => {
    const leftCol = document.querySelector('#hud-left-column');
    const infoPanel = document.querySelector('[data-testid="auditorium-info-panel"]');
    const trailerHud = document.querySelector('[data-testid="trailer-controls-hud"]');
    const header = document.querySelector('header');

    const getBBox = (el) => el ? el.getBoundingClientRect() : null;

    return {
      leftCol: getBBox(leftCol),
      infoPanel: getBBox(infoPanel),
      trailerHud: getBBox(trailerHud),
      header: getBBox(header),
    };
  });
  console.log('HUD Bounding Boxes at 1366x768:', hudOverlap768);

  const hud1366Path = path.join(ARTIFACT_DIR, 'evidence_part_d_hud_1366x768.png');
  await page768.screenshot({ path: hud1366Path });
  console.log('Saved 1366x768 HUD screenshot:', hud1366Path);

  const hud1920Path = path.join(ARTIFACT_DIR, 'evidence_part_d_hud_1920x1080.png');
  await page1080.screenshot({ path: hud1920Path });
  console.log('Saved 1920x1080 HUD screenshot:', hud1920Path);

  await browser.close();
  console.log('=== All Evidence Captured Successfully ===');
}

run().catch((err) => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
