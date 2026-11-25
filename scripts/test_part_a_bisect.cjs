const { chromium } = require('../frontend/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee');

const testCases = [
  {
    name: 'Flat Screen (Aud 1 - Hope)',
    shape: 'flat',
    movie: 'Hope',
    url: 'http://localhost:3002/cinemas/1/auditorium/1?showtime=1&mode=3d',
  },
  {
    name: 'Curved Screen (Aud 4 - Ramayana)',
    shape: 'curved',
    movie: 'Ramayana: Rise of a Legend',
    url: 'http://localhost:3002/cinemas/1/auditorium/4?showtime=17&mode=3d',
  },
  {
    name: 'Wrap Screen (Aud 5 - Wildwood)',
    shape: 'wrap',
    movie: 'Wildwood',
    url: 'http://localhost:3002/cinemas/2/auditorium/5?showtime=24&mode=3d',
  },
];

async function run() {
  console.log('================================================================');
  console.log('PART A BISECT: Headed Chrome with Real GPU Rendering on Prod Build');
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
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  const report = [];

  for (const tc of testCases) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Testing: ${tc.name} [Shape: ${tc.shape}, Movie: ${tc.movie}]`);
    console.log(`URL: ${tc.url}`);
    console.log(`----------------------------------------------------------------`);

    await page.goto(tc.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    // Wait for 3D canvas and window.__cineverse
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Trigger video playback
    await page.evaluate(() => {
      const store = (window).__cineverse_store;
      if (store) {
        store.getState().setTrailerState({
          isPlaying: true,
          playbackStatus: 'playing',
          isTheatreMode: false,
          activeStrategy: 'youtube_css3d',
        });
      }
      if (typeof (window).__cineverse_play_trailer === 'function') {
        (window).__cineverse_play_trailer();
      }
    });

    // Wait for player to spin up
    await page.waitForTimeout(3000);

    // Verify player API state: playing and time advancing
    const playerStatus = await page.evaluate(async () => {
      const yt = (window).__cineverse_yt_player;
      const vid = (window).__cineverse_video;
      let state = 'unknown';
      let currentTime = -1;
      let duration = -1;

      if (yt && typeof yt.getPlayerState === 'function') {
        const s = yt.getPlayerState();
        state = s === 1 ? 'playing' : s === 2 ? 'paused' : s === 3 ? 'buffering' : String(s);
        currentTime = typeof yt.getCurrentTime === 'function' ? yt.getCurrentTime() : -1;
        duration = typeof yt.getDuration === 'function' ? yt.getDuration() : -1;
      } else if (vid) {
        state = !vid.paused ? 'playing' : 'paused';
        currentTime = vid.currentTime;
        duration = vid.duration;
      }

      return { state, currentTime, duration, hasYt: !!yt, hasVid: !!vid };
    });

    console.log(`  Player API Status: state=${playerStatus.state}, currentTime=${playerStatus.currentTime}s, duration=${playerStatus.duration}s`);

    const tcResults = {
      testCase: tc.name,
      shape: tc.shape,
      movie: tc.movie,
      playerStatus,
      steps: {},
    };

    // -------------------------------------------------------------
    // Step 1: DOM Hierarchy, Size, Transforms, Ancestor Styles, Z-Index
    // -------------------------------------------------------------
    console.log('\n  [Step 1: DOM Check]');
    const domCheck = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const rootEl = document.querySelector('.cineverse-css3d-root');
      const outerEl = document.querySelector('.cineverse-css3d-outer');
      const innerEl = document.querySelector('.cineverse-css3d-inner');
      const playerContainer = document.querySelector('[data-testid="screen-youtube-player"]');
      const iframe = document.getElementById('cineverse-screen-yt-iframe');

      if (!rootEl || !canvas) {
        return { error: 'rootEl or canvas missing', hasRoot: !!rootEl, hasCanvas: !!canvas };
      }

      const canvasRect = canvas.getBoundingClientRect();
      const canvasStyle = window.getComputedStyle(canvas);
      const rootRect = rootEl.getBoundingClientRect();
      const rootStyle = window.getComputedStyle(rootEl);
      const outerStyle = outerEl ? window.getComputedStyle(outerEl) : null;
      const innerStyle = innerEl ? window.getComputedStyle(innerEl) : null;
      const iframeRect = iframe ? iframe.getBoundingClientRect() : null;

      // Ancestor chain inspection
      const ancestors = [];
      let cur = rootEl.parentElement;
      while (cur && cur !== document.body) {
        const cs = window.getComputedStyle(cur);
        ancestors.push({
          tagName: cur.tagName.toLowerCase(),
          className: cur.className,
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          overflow: cs.overflow,
          backgroundColor: cs.backgroundColor,
          zIndex: cs.zIndex,
        });
        cur = cur.parentElement;
      }

      return {
        canvas: {
          rect: { width: canvasRect.width, height: canvasRect.height, top: canvasRect.top, left: canvasRect.left },
          zIndex: canvasStyle.zIndex,
          position: canvasStyle.position,
        },
        root: {
          rect: { width: rootRect.width, height: rootRect.height, top: rootRect.top, left: rootRect.left },
          zIndex: rootStyle.zIndex,
          position: rootStyle.position,
          perspective: rootStyle.perspective,
          display: rootStyle.display,
          visibility: rootStyle.visibility,
        },
        outer: outerStyle ? {
          transform: outerStyle.transform,
          transformStyle: outerStyle.transformStyle,
        } : null,
        inner: innerStyle ? {
          transform: innerStyle.transform,
          width: innerStyle.width,
          height: innerStyle.height,
        } : null,
        iframe: iframeRect ? {
          width: iframeRect.width,
          height: iframeRect.height,
          top: iframeRect.top,
          left: iframeRect.left,
        } : null,
        ancestors,
      };
    });

    console.log(`    Canvas Z-Index: ${domCheck.canvas?.zIndex}, Root Z-Index: ${domCheck.root?.zIndex}`);
    console.log(`    Root Size: ${domCheck.root?.rect?.width}x${domCheck.root?.rect?.height}, Display: ${domCheck.root?.display}`);
    console.log(`    Iframe Rect: ${JSON.stringify(domCheck.iframe)}`);
    console.log(`    Ancestors count: ${domCheck.ancestors?.length}`);
    for (const anc of (domCheck.ancestors || [])) {
      if (anc.backgroundColor && anc.backgroundColor !== 'rgba(0, 0, 0, 0)' && anc.backgroundColor !== 'transparent') {
        console.log(`      * Ancestor ${anc.tagName}.${anc.className} has opaque background: ${anc.backgroundColor}`);
      }
    }

    const step1Shot = path.join(ARTIFACT_DIR, `bisect_step1_dom_${tc.shape}.png`);
    await page.screenshot({ path: step1Shot });
    tcResults.steps.step1_dom = { result: domCheck, screenshot: `bisect_step1_dom_${tc.shape}.png` };

    // -------------------------------------------------------------
    // Step 2: Does the iframe paint? Hide canvas and capture
    // -------------------------------------------------------------
    console.log('\n  [Step 2: Hide Canvas & Verify Iframe Paint]');
    await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (c) c.style.display = 'none';
    });
    await page.waitForTimeout(600);

    const step2Shot = path.join(ARTIFACT_DIR, `bisect_step2_iframe_paint_${tc.shape}.png`);
    await page.screenshot({ path: step2Shot });

    // Restore canvas
    await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (c) c.style.display = 'block';
    });
    await page.waitForTimeout(300);
    tcResults.steps.step2_iframe_paint = { screenshot: `bisect_step2_iframe_paint_${tc.shape}.png` };
    console.log(`    Captured iframe paint without canvas to: ${step2Shot}`);

    // -------------------------------------------------------------
    // Step 3: Is the cutout really transparent? Test with neon green div
    // -------------------------------------------------------------
    console.log('\n  [Step 3: Cutout Transparency Test with Bright Div]');
    const cutoutTest = await page.evaluate(() => {
      // Create a solid bright magenta (#FF00FF) div behind the canvas
      let testDiv = document.getElementById('cineverse-cutout-probe-div');
      if (!testDiv) {
        testDiv = document.createElement('div');
        testDiv.id = 'cineverse-cutout-probe-div';
        testDiv.style.cssText = `
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          background: #FF00FF;
          z-index: 0;
          pointer-events: none;
        `;
        const canvas = document.querySelector('canvas');
        if (canvas && canvas.parentElement) {
          canvas.parentElement.insertBefore(testDiv, canvas);
        }
      }

      // Check pixel at screen center
      const cv = (window).__cineverse;
      const rgba = cv && typeof cv.samplePixelAt === 'function' ? cv.samplePixelAt(0.5, 0.5) : [0, 0, 0, 0];
      return { rgba, inserted: !!testDiv };
    });

    const step3Shot = path.join(ARTIFACT_DIR, `bisect_step3_cutout_color_${tc.shape}.png`);
    await page.screenshot({ path: step3Shot });

    // Clean up probe div
    await page.evaluate(() => {
      const testDiv = document.getElementById('cineverse-cutout-probe-div');
      if (testDiv) testDiv.remove();
    });
    console.log(`    Cutout sampled RGBA: ${JSON.stringify(cutoutTest.rgba)}`);
    tcResults.steps.step3_cutout_transparency = { result: cutoutTest, screenshot: `bisect_step3_cutout_color_${tc.shape}.png` };

    // -------------------------------------------------------------
    // Step 4: Renderer Settings & Post-Processing Alpha Blockers
    // -------------------------------------------------------------
    console.log('\n  [Step 4: Renderer Settings & Tone Mapping Check]');
    const rendererSettings = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas ? canvas.getContext('webgl2') || canvas.getContext('webgl') : null;
      if (!gl) return { error: 'No WebGL context' };

      const attrs = gl.getContextAttributes();
      const clearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE);

      const scene = (window).__threeScene;
      const camera = (window).__threeCamera || (window).__cineverse_camera;

      return {
        alpha: attrs?.alpha,
        premultipliedAlpha: attrs?.premultipliedAlpha,
        preserveDrawingBuffer: attrs?.preserveDrawingBuffer,
        antialias: attrs?.antialias,
        clearColor: clearColor ? [clearColor[0], clearColor[1], clearColor[2], clearColor[3]] : null,
        sceneBackground: scene?.background ? (scene.background.isColor ? scene.background.getHexString() : 'object') : null,
      };
    });
    console.log(`    WebGL Context: alpha=${rendererSettings.alpha}, premultipliedAlpha=${rendererSettings.premultipliedAlpha}, clearColor=${JSON.stringify(rendererSettings.clearColor)}, sceneBackground=${rendererSettings.sceneBackground}`);
    tcResults.steps.step4_renderer = { result: rendererSettings };

    // -------------------------------------------------------------
    // Step 5: Screen Meshes Isolation (What sits between camera and screen?)
    // -------------------------------------------------------------
    console.log('\n  [Step 5: Scene Meshes Analysis]');
    const meshAnalysis = await page.evaluate(() => {
      const scene = (window).__threeScene;
      if (!scene) return { error: 'Scene not found on window.__threeScene' };

      const screenMeshes = [];
      scene.traverse((obj) => {
        if (obj.isMesh) {
          const name = obj.name || 'unnamed';
          const pos = obj.position;
          const worldPos = new (window).THREE.Vector3();
          obj.getWorldPosition(worldPos);
          const mat = obj.material;

          // Check if mesh is anywhere near the screen (within 2m of Z=-1.255)
          if (Math.abs(worldPos.z - (-1.255)) < 4.0 || name.includes('Screen') || name.includes('frame') || name.includes('wall')) {
            screenMeshes.push({
              name,
              visible: obj.visible,
              position: [Math.round(pos.x * 100) / 100, Math.round(pos.y * 100) / 100, Math.round(pos.z * 100) / 100],
              worldPosition: [Math.round(worldPos.x * 100) / 100, Math.round(worldPos.y * 100) / 100, Math.round(worldPos.z * 100) / 100],
              renderOrder: obj.renderOrder,
              material: {
                type: mat?.type,
                color: mat?.color?.getHexString?.(),
                transparent: mat?.transparent,
                opacity: mat?.opacity,
                depthWrite: mat?.depthWrite,
                depthTest: mat?.depthTest,
                blending: mat?.blending,
              },
            });
          }
        }
      });

      return { screenMeshes };
    });

    console.log(`    Found ${meshAnalysis.screenMeshes?.length} relevant meshes near screen:`);
    for (const m of (meshAnalysis.screenMeshes || [])) {
      console.log(`      * ${m.name} @ worldPos=${JSON.stringify(m.worldPosition)}, visible=${m.visible}, matType=${m.material?.type}, color=${m.material?.color}, depthWrite=${m.material?.depthWrite}`);
    }

    const step5Shot = path.join(ARTIFACT_DIR, `bisect_step5_mesh_isolation_${tc.shape}.png`);
    await page.screenshot({ path: step5Shot });
    tcResults.steps.step5_meshes = { result: meshAnalysis, screenshot: `bisect_step5_mesh_isolation_${tc.shape}.png` };

    // -------------------------------------------------------------
    // Step 6: Alignment of Projected Screen Corners vs Iframe Rect
    // -------------------------------------------------------------
    console.log('\n  [Step 6: Alignment Comparison]');
    const alignment = await page.evaluate(() => {
      const camera = (window).__threeCamera || (window).__cineverse_camera;
      const THREE = (window).THREE;
      const iframe = document.getElementById('cineverse-screen-yt-iframe');
      const screenMesh = (window).__threeScene?.getObjectByName('DynamicScreenOverlay');

      if (!camera || !THREE || !iframe || !screenMesh) {
        return { error: 'Missing camera, THREE, iframe or DynamicScreenOverlay' };
      }

      screenMesh.geometry.computeBoundingBox();
      const bbox = screenMesh.geometry.boundingBox;
      const corners = [
        new THREE.Vector3(bbox.min.x, bbox.min.y, 0).applyMatrix4(screenMesh.matrixWorld),
        new THREE.Vector3(bbox.max.x, bbox.min.y, 0).applyMatrix4(screenMesh.matrixWorld),
        new THREE.Vector3(bbox.max.x, bbox.max.y, 0).applyMatrix4(screenMesh.matrixWorld),
        new THREE.Vector3(bbox.min.x, bbox.max.y, 0).applyMatrix4(screenMesh.matrixWorld),
      ];

      const projectedCorners = corners.map((c) => {
        const v = c.clone().project(camera);
        return {
          x: ((v.x + 1) / 2) * window.innerWidth,
          y: ((-v.y + 1) / 2) * window.innerHeight,
        };
      });

      const iframeRect = iframe.getBoundingClientRect();
      const iframeCorners = [
        { x: iframeRect.left, y: iframeRect.bottom },
        { x: iframeRect.right, y: iframeRect.bottom },
        { x: iframeRect.right, y: iframeRect.top },
        { x: iframeRect.left, y: iframeRect.top },
      ];

      const cornerErrors = projectedCorners.map((p, i) => {
        const target = iframeCorners[i];
        return Math.hypot(p.x - target.x, p.y - target.y);
      });

      const maxErrorPx = Math.max(...cornerErrors);

      return {
        projectedCorners,
        iframeRect: { left: iframeRect.left, top: iframeRect.top, width: iframeRect.width, height: iframeRect.height },
        cornerErrors,
        maxErrorPx,
      };
    });

    console.log(`    Alignment Max Corner Error: ${alignment.maxErrorPx?.toFixed(2)} px`);
    console.log(`    Corner Errors: ${alignment.cornerErrors?.map(e => e.toFixed(1)).join(', ')} px`);

    const step6Shot = path.join(ARTIFACT_DIR, `bisect_step6_alignment_${tc.shape}.png`);
    await page.screenshot({ path: step6Shot });
    tcResults.steps.step6_alignment = { result: alignment, screenshot: `bisect_step6_alignment_${tc.shape}.png` };

    report.push(tcResults);
  }

  const reportPath = path.join(ARTIFACT_DIR, 'bisect_part_a_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n================================================================`);
  console.log(`Bisect completed for all 3 halls! Report written to: ${reportPath}`);
  console.log(`================================================================`);

  await browser.close();
}

run().catch((err) => {
  console.error('Bisect error:', err);
  process.exit(1);
});
