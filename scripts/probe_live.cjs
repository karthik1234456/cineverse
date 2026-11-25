const { chromium } = require('../frontend/node_modules/@playwright/test');

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: ['--enable-gpu', '--use-gl=angle', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:3002/cinemas/1/auditorium/1?showtime=1&mode=3d');
  await page.waitForTimeout(4000);

  const initialInfo = await page.evaluate(() => {
    const store = window.__cineverse_store?.getState();
    const iframe = document.querySelector('iframe');
    const playBtn = document.querySelector('[data-testid="screen-3d-play-button"]');
    const rootEl = document.querySelector('.cineverse-css3d-root');
    const playerEl = document.querySelector('[data-testid="screen-youtube-player"]');
    const ytPlayer = window.__cineverse_yt_player;
    return {
      trailer: store?.trailer,
      hasIframe: !!iframe,
      iframeSrc: iframe?.src,
      hasPlayBtn: !!playBtn,
      hasRootEl: !!rootEl,
      hasPlayerEl: !!playerEl,
      hasYtPlayer: !!ytPlayer,
    };
  });
  console.log('INITIAL STATE:', JSON.stringify(initialInfo, null, 2));

  // Now trigger playback
  console.log('\n--- Triggering Playback via __cineverse_play_trailer ---');
  await page.evaluate(() => {
    if (typeof window.__cineverse_play_trailer === 'function') {
      window.__cineverse_play_trailer();
    }
  });
  await page.waitForTimeout(3000);

  const playingInfo = await page.evaluate(() => {
    const store = window.__cineverse_store?.getState();
    const iframe = document.querySelector('iframe');
    const rootEl = document.querySelector('.cineverse-css3d-root');
    const playerEl = document.querySelector('[data-testid="screen-youtube-player"]');
    const ytPlayer = window.__cineverse_yt_player;
    const canvas = document.querySelector('canvas');
    const scene = window.__threeScene;

    const screenMesh = scene?.getObjectByName('DynamicScreenOverlay');
    const proscenium = scene?.getObjectByName('ScreenProsceniumFrame');
    const screenFrame = scene?.getObjectByName('screen_frame');
    const frontWall = scene?.getObjectByName('front_wall');

    return {
      trailer: store?.trailer,
      hasIframe: !!iframe,
      iframeSrc: iframe?.src,
      hasRootEl: !!rootEl,
      rootElDisplay: rootEl ? window.getComputedStyle(rootEl).display : null,
      rootElZIndex: rootEl ? window.getComputedStyle(rootEl).zIndex : null,
      canvasZIndex: canvas ? window.getComputedStyle(canvas).zIndex : null,
      hasYtPlayer: !!ytPlayer,
      ytState: ytPlayer && typeof ytPlayer.getPlayerState === 'function' ? ytPlayer.getPlayerState() : null,
      ytTime: ytPlayer && typeof ytPlayer.getCurrentTime === 'function' ? ytPlayer.getCurrentTime() : null,
      screenMesh: screenMesh ? {
        name: screenMesh.name,
        visible: screenMesh.visible,
        materialType: screenMesh.material?.type,
        materialColor: screenMesh.material?.color?.getHexString?.(),
        isCutout: screenMesh.material?.type === 'ShaderMaterial',
      } : null,
      proscenium: proscenium ? {
        name: proscenium.name,
        visible: proscenium.visible,
        worldZ: proscenium.position.z,
      } : null,
      screenFrame: screenFrame ? {
        name: screenFrame.name,
        visible: screenFrame.visible,
        worldZ: screenFrame.position.z,
      } : null,
      frontWall: frontWall ? {
        name: frontWall.name,
        visible: frontWall.visible,
        worldZ: frontWall.position.z,
      } : null,
    };
  });
  console.log('PLAYING STATE:', JSON.stringify(playingInfo, null, 2));

  await page.screenshot({ path: 'probe_playing.png' });

  // Test hiding canvas
  console.log('\n--- Hiding Canvas to check if iframe paints ---');
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.style.display = 'none';
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'probe_no_canvas.png' });

  // Test probe div behind canvas
  console.log('\n--- Testing solid bright magenta div behind canvas ---');
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.style.display = 'block';
    const testDiv = document.createElement('div');
    testDiv.id = 'probe-magenta-div';
    testDiv.style.cssText = 'position:fixed;inset:0;background:#FF00FF;z-index:0;';
    document.body.appendChild(testDiv);
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'probe_magenta_behind_canvas.png' });

  await browser.close();
}

run().catch(console.error);
