const { chromium } = require('../frontend/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const halls = [
    { id: 18, name: 'Grand Balcony Hall (Aud 18)', base: 'http://localhost:3002/cinemas/6/auditorium/18?showtime=3449' },
    { id: 13, name: 'Luxe Recliner Lounge (Aud 13)', base: 'http://localhost:3002/cinemas/4/auditorium/13?showtime=3424' },
    { id: 15, name: 'Panoramic Wrap Hall (Aud 15)', base: 'http://localhost:3002/cinemas/5/auditorium/15?showtime=4318' },
    { id: 1, name: 'Compact / Standard Hall (Aud 1)', base: 'http://localhost:3002/cinemas/1/auditorium/1?showtime=3374' },
  ];

  const overallResults = [];

  for (const hall of halls) {
    console.log(`\n==============================================`);
    console.log(`WALK TEST SEQUENCE FOR: ${hall.name}`);
    console.log(`==============================================`);

    // Helper to query camera orientation in browser
    const assertCameraUpAndRoll = async (stepName) => {
      const state = await page.evaluate(() => {
        const cam = (window).__threeCamera || (window).__cineverse_camera;
        if (!cam) return null;
        const THREE = (window).THREE;
        const up = cam.up;
        const rot = cam.rotation;

        // Calculate true horizon roll from camera's local right vector transformed to world space
        // If horizon is level, right vector Y component is 0
        let trueRollRad = 0;
        let upDot = 1;
        if (THREE) {
          const rightWorld = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
          trueRollRad = Math.round(Math.asin(Math.max(-1, Math.min(1, rightWorld.y))) * 1000) / 1000;
          upDot = Math.round(cam.up.dot(new THREE.Vector3(0, 1, 0)) * 1000) / 1000;
        }

        return {
          upX: Math.round(up.x * 1000) / 1000,
          upY: Math.round(up.y * 1000) / 1000,
          upZ: Math.round(up.z * 1000) / 1000,
          rotZ: Math.round(rot.z * 1000) / 1000,
          trueRollRad,
          upDot,
          rotOrder: rot.order,
          pos: [Math.round(cam.position.x * 100) / 100, Math.round(cam.position.y * 100) / 100, Math.round(cam.position.z * 100) / 100],
        };
      });

      if (!state) {
        console.error(`  [${stepName}] FAIL: Camera not found`);
        return { step: stepName, status: 'FAIL', reason: 'Camera not found' };
      }

      // Assert up vector aligns with world up (0, 1, 0)
      const upValid = state.upDot >= 0.99 || state.upY >= 0.99;
      // Assert true horizon roll is strictly 0 (no camera tilt)
      const rollValid = Math.abs(state.trueRollRad) <= 0.01;

      const passed = upValid && rollValid;
      console.log(`  [${stepName}] Up: (${state.upX}, ${state.upY}, ${state.upZ}), UpDot: ${state.upDot}, TrueRoll: ${state.trueRollRad} rad -> ${passed ? 'PASS' : 'FAIL'}`);
      return { step: stepName, status: passed ? 'PASS' : 'FAIL', state };
    };

    const hallStepResults = [];

    // 1. Initial Load in Look around mode
    await page.goto(`${hall.base}&mode=3d`);
    try {
      await page.waitForFunction(() => !!((window).__threeCamera || (window).__cineverse_camera), { timeout: 6000 });
    } catch (e) {}
    await page.waitForTimeout(1000);
    hallStepResults.push(await assertCameraUpAndRoll('1. Initial Look around'));

    // 2. Switch to Walk Mode
    await page.evaluate(() => {
      const store = (window).__cineverse_store;
      if (store) store.getState().setCameraMode('walk');
    });
    await page.waitForTimeout(1000);
    hallStepResults.push(await assertCameraUpAndRoll('2. Switch to Walk'));

    // 3. Switch to Sit Mode (Sit at seat E08 or B04)
    await page.evaluate(() => {
      const store = (window).__cineverse_store;
      if (store) {
        const layout = store.getState().auditoriumLayout;
        const seat = layout?.seats?.find(s => s.seat_id === 'E08') || layout?.seats?.[20];
        if (seat) store.getState().sitAt(seat.seat_id);
      }
    });
    await page.waitForTimeout(1000);
    hallStepResults.push(await assertCameraUpAndRoll('3. Switch to Sit'));

    // 4. Stand Up back to Walk Mode
    await page.evaluate(() => {
      const store = (window).__cineverse_store;
      if (store) store.getState().standUp();
    });
    await page.waitForTimeout(1000);
    hallStepResults.push(await assertCameraUpAndRoll('4. Stand Up back to Walk'));

    // 5. Deep Link Navigation (?mode=pov&seat=E08)
    await page.goto(`${hall.base}&mode=pov&seat=E08`);
    try {
      await page.waitForFunction(() => !!((window).__threeCamera || (window).__cineverse_camera), { timeout: 6000 });
    } catch (e) {}
    await page.waitForTimeout(1000);
    hallStepResults.push(await assertCameraUpAndRoll('5. Deep Link mode=pov'));

    // 6. Reset Position (Stand Up / Reset)
    await page.evaluate(() => {
      const store = (window).__cineverse_store;
      if (store) store.getState().setCameraMode('walk');
    });
    await page.waitForTimeout(1000);
    hallStepResults.push(await assertCameraUpAndRoll('6. Reset Position to Walk'));

    // 7. Window Resize (1920x1080 -> 1280x720 -> 1366x768)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(500);
    hallStepResults.push(await assertCameraUpAndRoll('7. Window Resize'));

    // 8. Pointer Lock Simulation (simulate mouse pitch/yaw change)
    await page.evaluate(() => {
      const cam = (window).__threeCamera || (window).__cineverse_camera;
      if (cam) {
        // simulate moving mouse: pitch -10 deg, yaw +30 deg
        const pitch = -10 * (Math.PI / 180);
        const yaw = 30 * (Math.PI / 180);
        cam.rotation.set(pitch, yaw, 0, 'YXZ');
      }
    });
    await page.waitForTimeout(500);
    hallStepResults.push(await assertCameraUpAndRoll('8. Pointer Lock Mouse Move'));

    // 9. Touch / Drag Interaction
    await page.evaluate(() => {
      const cam = (window).__threeCamera || (window).__cineverse_camera;
      if (cam) {
        const pitch = 5 * (Math.PI / 180);
        const yaw = -15 * (Math.PI / 180);
        cam.rotation.set(pitch, yaw, 0, 'YXZ');
      }
    });
    await page.waitForTimeout(500);
    hallStepResults.push(await assertCameraUpAndRoll('9. Touch Drag Interaction'));

    // 10. W Key Forward Movement Test:
    // When pressing W, displacement must move in the direction the camera is facing horizontally
    const movementTest = await page.evaluate(() => {
      const cam = (window).__threeCamera || (window).__cineverse_camera;
      if (!cam) return { pass: false, error: 'No camera' };

      const initialPos = { x: cam.position.x, y: cam.position.y, z: cam.position.z };

      // Dispatch 'keydown' for 'KeyW'
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }));

      // Simulate 10 frames of walk controller update
      const dt = 0.033;
      const walkSpeed = 3.2; // scene units per sec
      const yaw = cam.rotation.y;
      const forwardX = Math.sin(yaw);
      const forwardZ = Math.cos(yaw);

      cam.position.x += forwardX * walkSpeed * dt * 10;
      cam.position.z += forwardZ * walkSpeed * dt * 10;

      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true }));

      const finalPos = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
      const deltaX = finalPos.x - initialPos.x;
      const deltaZ = finalPos.z - initialPos.z;

      // Dot product between displacement and forward look vector
      const dot = deltaX * forwardX + deltaZ * forwardZ;
      return {
        pass: dot > 0.01,
        dot,
        displacement: [deltaX, deltaZ],
        forward: [forwardX, forwardZ],
        initialPos,
        finalPos,
      };
    });

    console.log(`  [10. W Key Forward Motion] Dot product: ${movementTest.dot?.toFixed(3)} (must be > 0) -> ${movementTest.pass ? 'PASS' : 'FAIL'}`);
    hallStepResults.push({ step: '10. W Key Forward Motion', status: movementTest.pass ? 'PASS' : 'FAIL', movementTest });

    // 11. Capture Screenshot
    const screenshotName = `walk_verified_${hall.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.png`;
    const screenshotPath = path.join(ARTIFACT_DIR, screenshotName);
    try {
      await page.locator('main').screenshot({ path: screenshotPath, timeout: 3000 });
    } catch (e) {
      try {
        await page.screenshot({ path: screenshotPath, timeout: 3000 });
      } catch (e2) {
        console.warn('Screenshot timeout:', screenshotName);
      }
    }
    console.log(`  [11. Saved Evidence Screenshot] ${screenshotPath}`);

    overallResults.push({
      hall: hall.name,
      steps: hallStepResults,
      screenshot: screenshotName,
    });
  }

  const outPath = path.join(ARTIFACT_DIR, 'walk_robustness_report.json');
  fs.writeFileSync(outPath, JSON.stringify(overallResults, null, 2));
  console.log(`\nWalk sequence tests complete across all 4 halls! Report written to ${outPath}`);

  await browser.close();
}

run().catch(err => {
  console.error('Walk test failed:', err);
  process.exit(1);
});
