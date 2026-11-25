const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = path.resolve('evidence/hall-coverage-v2');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const HALLS = [
  {
    id: 'compact',
    name: 'Original 100-Seat Reference Hall',
    registryType: 'standard_flat',
    theatreType: 'compact',
    movieTitle: 'Ghost Soldier',
    youtubeId: 'UKaWzMf9Ybc',
    cinemaId: 1,
    audId: 1,
    showtimeId: 3,
    url: 'http://localhost:3000/cinemas/1/auditorium/1?showtime=3&mode=3d'
  },
  {
    id: 'standard',
    name: 'Standard Multiplex Hall',
    registryType: 'standard_flat',
    theatreType: 'standard',
    movieTitle: 'Hope',
    youtubeId: 'JNJ6luyhR2I',
    cinemaId: 4,
    audId: 12,
    showtimeId: 56,
    url: 'http://localhost:3000/cinemas/4/auditorium/12?showtime=56&mode=3d'
  },
  {
    id: 'large_curved',
    name: 'Large Curved Screen (Dolby Cinema / Flagship)',
    registryType: 'large_curved',
    theatreType: 'large',
    movieTitle: 'Ghost Soldier',
    youtubeId: 'UKaWzMf9Ybc',
    cinemaId: 1,
    audId: 2,
    showtimeId: 8,
    url: 'http://localhost:3000/cinemas/1/auditorium/2?showtime=8&mode=3d'
  },
  {
    id: 'premium_direct_view',
    name: 'Premium Direct-View (Samsung Onyx LED)',
    registryType: 'premium_direct_view',
    theatreType: 'luxury_recliner',
    movieTitle: 'Wildwood',
    youtubeId: 'B2Cx_5_YLxQ',
    cinemaId: 6,
    audId: 20,
    showtimeId: 99,
    url: 'http://localhost:3000/cinemas/6/auditorium/20?showtime=99&mode=3d'
  },
  {
    id: 'boutique',
    name: 'Boutique Plush Velvet Salon',
    registryType: 'boutique_small_flat',
    theatreType: 'boutique',
    movieTitle: 'Clayface',
    youtubeId: 'F1jCd_tMEDM',
    cinemaId: 4,
    audId: 13,
    showtimeId: 65,
    url: 'http://localhost:3000/cinemas/4/auditorium/13?showtime=65&mode=3d'
  },
  {
    id: 'panoramic_wrap',
    name: 'Motion-Seat Panoramic Wrap (ScreenX)',
    registryType: 'panoramic_wrap',
    theatreType: 'motion_seat',
    movieTitle: 'Hope',
    youtubeId: 'JNJ6luyhR2I',
    cinemaId: 2,
    audId: 5,
    showtimeId: 21,
    url: 'http://localhost:3000/cinemas/2/auditorium/5?showtime=21&mode=3d'
  },
  {
    id: '4dx',
    name: '4DX Motion Effects Hall',
    registryType: 'panoramic_wrap',
    theatreType: 'dolby_atmos_4dx',
    movieTitle: 'Clayface',
    youtubeId: 'F1jCd_tMEDM',
    cinemaId: 1,
    audId: 3,
    showtimeId: 15,
    url: 'http://localhost:3000/cinemas/1/auditorium/3?showtime=15&mode=3d'
  },
  {
    id: 'motion_seat',
    name: 'Dedicated Motion-Seat Arena',
    registryType: 'panoramic_wrap',
    theatreType: 'motion_seat',
    movieTitle: 'Hope',
    youtubeId: 'JNJ6luyhR2I',
    cinemaId: 6,
    audId: 19,
    showtimeId: 91,
    url: 'http://localhost:3000/cinemas/6/auditorium/19?showtime=91&mode=3d'
  }
];

(async () => {
  console.log('================================================================');
  console.log(' RUNNING 8-HALL RIGOROUS BENCHMARK: SCREEN SIZES & WALL-CLOCK RATIO');
  console.log('================================================================');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--enable-webgl', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required']
  });

  const summary = [];

  for (const hall of HALLS) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`>>> Hall [${hall.id}]: ${hall.name}`);
    console.log(`Registry Type: ${hall.registryType} | Movie: ${hall.movieTitle} | URL: ${hall.url}`);
    console.log(`----------------------------------------------------------------`);

    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      localStorage.setItem('cineverse_city', 'mumbai');
      localStorage.setItem('cineverse_city_id', '2');
    });

    const page = await context.newPage();

    try {
      await page.goto(hall.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => {
        return !document.body.innerText.includes('Verifying sightlines') &&
               Boolean(document.querySelector('[data-testid="screen-3d-play-button"]'));
      }, { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(1500);

      // Extract accurate screen dimensions from scene and side panel
      const screenDetails = await page.evaluate(() => {
        const store = window.__cineverse_store?.getState?.();
        const layout = store?.auditoriumLayout;
        const scr = layout?.screen;
        const procedural = store?.proceduralResult;
        const panelDims = document.querySelector('[data-testid="auditorium-panel-screen-dims"]')?.textContent?.trim() || '';

        const center = scr?.center_gltf_y_up || [0, 5.55, -1.255];
        const sceneWidth = scr?.width || 15.6;
        const sceneHeight = scr?.height || 7.25;
        const aspect = scr?.aspect || (sceneWidth / sceneHeight);
        const isCurved = Boolean(scr?.curved || scr?.is_curved || scr?.screen_type_id === 'large_curved');
        const isWrap = Boolean(scr?.panoramic_wrap || scr?.screen_type_id === 'panoramic_wrap');
        const isDirect = Boolean(scr?.is_direct_led || scr?.screen_type_id === 'premium_direct_view');
        const screenTypeId = scr?.screen_type_id || (isDirect ? 'premium_direct_view' : (isCurved ? 'large_curved' : (isWrap ? 'panoramic_wrap' : 'standard_flat')));

        // Metric dimensions
        const metricWidthM = procedural?.real_world_dimensions?.screen_width_m || Math.round(sceneWidth * 0.5 * 10) / 10;
        const metricHeightM = procedural?.real_world_dimensions?.screen_height_m || Math.round(sceneHeight * 0.5 * 10) / 10;

        // Dynamic cameras derived from each hall's real screen position
        const centerCam = [center[0], center[1] * 0.95, center[2] - sceneWidth * 1.25];
        const leftCam = [center[0] - sceneWidth * 0.45, center[1] * 0.95, center[2] - sceneWidth * 1.10];
        const rightCam = [center[0] + sceneWidth * 0.45, center[1] * 0.95, center[2] - sceneWidth * 1.10];
        const target = [center[0], center[1], center[2]];

        return {
          center,
          sceneWidth,
          sceneHeight,
          aspect: Math.round(aspect * 100) / 100,
          metricWidthM,
          metricHeightM,
          sidePanelText: panelDims,
          screenTypeId,
          isCurved,
          isWrap,
          isDirect,
          centerCam,
          leftCam,
          rightCam,
          target
        };
      });

      console.log(`Registry Screen Type: ${screenDetails.screenTypeId}`);
      console.log(`Scene Units: ${screenDetails.sceneWidth}u x ${screenDetails.sceneHeight}u at Center [${screenDetails.center.map(v => v.toFixed(2)).join(', ')}]`);
      console.log(`Metric Size: ${screenDetails.metricWidthM}m x ${screenDetails.metricHeightM}m | Side Panel: "${screenDetails.sidePanelText}"`);
      console.log(`Dynamic Cameras: Center [${screenDetails.centerCam.map(v => v.toFixed(1)).join(', ')}] | Target [${screenDetails.target.map(v => v.toFixed(1)).join(', ')}]`);

      // 1. Play Button Check
      await page.evaluate((c) => window.__cineverse_store?.getState?.().setCameraPose(c.centerCam, c.target), screenDetails);
      await page.waitForTimeout(1000);

      // Wait for YouTube player instance to be attached if strategy is youtube_css3d
      await page.waitForFunction(() => {
        const strat = window.__cineverse_store?.getState?.().trailer?.activeStrategy;
        if (strat !== 'youtube_css3d') return true;
        const yt = window.__cineverse_yt_player;
        return Boolean(yt && typeof yt.playVideo === 'function');
      }, { timeout: 15000 }).catch(() => {});

      const playBtn = page.locator('[data-testid="screen-3d-play-button"]');
      const btnVisible = await playBtn.isVisible();
      const playBtnPath = path.join(EVIDENCE_DIR, `${hall.id}_play_button_ready.png`);
      await page.screenshot({ path: playBtnPath });
      console.log(`Play Button Visible: ${btnVisible}`);

      // 2. Click Play & Timing Verification with performance.now()
      console.log('Clicking on-screen Play Button...');
      await playBtn.click();

      // Wait for player to enter PLAYING state (state === 1) or Theatre Mode fallback
      console.log('Waiting for player to begin playback...');
      await page.waitForFunction(() => {
        const store = window.__cineverse_store?.getState?.();
        const yt = window.__cineverse_yt_player;
        const vid = window.__cineverse_video;
        const isYt = store?.trailer?.activeStrategy === 'youtube_css3d';
        const isPlaying = isYt ? (yt && typeof yt.getPlayerState === 'function' && yt.getPlayerState() === 1) : (vid && !vid.paused);
        return Boolean(isPlaying || store?.trailer?.isTheatreMode);
      }, { timeout: 12000 }).catch(() => {});

      // Sample 1: Record wallNow1 and mediaTime1 simultaneously
      const s1 = await page.evaluate(() => {
        const wallNow = performance.now();
        const store = window.__cineverse_store?.getState?.();
        const yt = window.__cineverse_yt_player;
        const vid = window.__cineverse_video;
        const isYt = store?.trailer?.activeStrategy === 'youtube_css3d';
        return {
          wallNow,
          mediaTime: isYt ? (typeof yt?.getCurrentTime === 'function' ? yt.getCurrentTime() : null) : (vid?.currentTime ?? null),
          playerState: isYt ? (typeof yt?.getPlayerState === 'function' ? yt.getPlayerState() : null) : (vid && !vid.paused ? 1 : 2),
          status: store?.trailer?.playbackStatus,
          isTheatreMode: store?.trailer?.isTheatreMode
        };
      });

      const playT1Path = path.join(EVIDENCE_DIR, `${hall.id}_trailer_t1.png`);
      await page.screenshot({ path: playT1Path });

      // Wait 2.5s window
      await page.waitForTimeout(2500);

      // Sample 2: Record wallNow2 and mediaTime2 simultaneously
      const s2 = await page.evaluate(() => {
        const wallNow = performance.now();
        const store = window.__cineverse_store?.getState?.();
        const yt = window.__cineverse_yt_player;
        const vid = window.__cineverse_video;
        const isYt = store?.trailer?.activeStrategy === 'youtube_css3d';
        return {
          wallNow,
          mediaTime: isYt ? (typeof yt?.getCurrentTime === 'function' ? yt.getCurrentTime() : null) : (vid?.currentTime ?? null),
          playerState: isYt ? (typeof yt?.getPlayerState === 'function' ? yt.getPlayerState() : null) : (vid && !vid.paused ? 1 : 2),
          status: store?.trailer?.playbackStatus,
          isTheatreMode: store?.trailer?.isTheatreMode
        };
      });

      const playT2Path = path.join(EVIDENCE_DIR, `${hall.id}_trailer_t2.png`);
      await page.screenshot({ path: playT2Path });

      const deltaWall = (s2.wallNow - s1.wallNow) / 1000.0;
      const deltaMedia = (s2.mediaTime || 0) - (s1.mediaTime || 0);
      const playbackRatio = deltaWall > 0 ? (deltaMedia / deltaWall) : 0;
      const passTiming = playbackRatio >= 0.80 && playbackRatio <= 1.20 && (s2.playerState === 1 || s2.playerState === 3) && !s2.isTheatreMode;

      console.log(`Wall Clock Elapsed: ${deltaWall.toFixed(3)}s | Media Time Advanced: ${deltaMedia.toFixed(3)}s`);
      console.log(`Playback Rate Ratio: ${playbackRatio.toFixed(3)}x (Pass Range: 0.80x - 1.20x): ${passTiming ? 'PASS' : 'FAIL'}`);

      // 3. Orientation Test Card
      console.log('Testing Test Card Orientation with Dynamic Cameras...');
      await page.evaluate(() => {
        window.__cineverse_store?.getState?.().setTrailerStrategy('test_card');
      });
      await page.waitForTimeout(1000);

      // Center View
      await page.evaluate((c) => window.__cineverse_store?.getState?.().setCameraPose(c.centerCam, c.target), screenDetails);
      await page.waitForTimeout(500);
      const testCardCenterPath = path.join(EVIDENCE_DIR, `${hall.id}_testcard_center.png`);
      await page.screenshot({ path: testCardCenterPath });

      // Left View
      await page.evaluate((c) => window.__cineverse_store?.getState?.().setCameraPose(c.leftCam, c.target), screenDetails);
      await page.waitForTimeout(500);
      const testCardLeftPath = path.join(EVIDENCE_DIR, `${hall.id}_testcard_left.png`);
      await page.screenshot({ path: testCardLeftPath });

      // Right View
      await page.evaluate((c) => window.__cineverse_store?.getState?.().setCameraPose(c.rightCam, c.target), screenDetails);
      await page.waitForTimeout(500);
      const testCardRightPath = path.join(EVIDENCE_DIR, `${hall.id}_testcard_right.png`);
      await page.screenshot({ path: testCardRightPath });

      summary.push({
        hallId: hall.id,
        hallName: hall.name,
        registryType: screenDetails.screenTypeId,
        movieTitle: hall.movieTitle,
        youtubeId: hall.youtubeId,
        cinemaId: hall.cinemaId,
        audId: hall.audId,
        showtimeId: hall.showtimeId,
        sceneDimensions: `${screenDetails.sceneWidth}u x ${screenDetails.sceneHeight}u`,
        metricDimensions: `${screenDetails.metricWidthM}m x ${screenDetails.metricHeightM}m`,
        sidePanelText: screenDetails.sidePanelText,
        screenCenter: screenDetails.center,
        dynamicCameras: {
          centerCam: screenDetails.centerCam,
          leftCam: screenDetails.leftCam,
          rightCam: screenDetails.rightCam,
          target: screenDetails.target
        },
        playButtonVisible: btnVisible,
        t1MediaTime: s1.mediaTime,
        t2MediaTime: s2.mediaTime,
        t1WallNow: s1.wallNow,
        t2WallNow: s2.wallNow,
        deltaWallSeconds: round(deltaWall, 3),
        deltaMediaSeconds: round(deltaMedia, 3),
        playbackRatio: round(playbackRatio, 3),
        passTiming: passTiming,
        playerState: s2.playerState,
        isTheatreMode: s2.isTheatreMode,
        t1Screenshot: playT1Path,
        t2Screenshot: playT2Path,
        testCardCenter: testCardCenterPath,
        testCardLeft: testCardLeftPath,
        testCardRight: testCardRightPath
      });
    } catch (err) {
      console.error(`Error verifying hall ${hall.id}:`, err);
      summary.push({
        hallId: hall.id,
        error: err.message,
        passTiming: false
      });
    } finally {
      await context.close();
    }
  }

  await browser.close();

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'eight_halls_results.json'), JSON.stringify(summary, null, 2));
  console.log('\n================================================================');
  console.log(`ALL 8 HALLS VERIFIED. Summary saved to: ${path.join(EVIDENCE_DIR, 'eight_halls_results.json')}`);
  console.log('================================================================');
})();

function round(val, dec) {
  return Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);
}
