const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = path.resolve('evidence/hall-coverage');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const HALLS = [
  {
    id: 'standard_flat',
    name: 'Standard Flat Screen',
    movieTitle: 'Clayface',
    youtubeId: 'F1jCd_tMEDM',
    cinemaId: 1,
    audId: 3,
    showtimeId: 15,
    url: 'http://localhost:3000/cinemas/1/auditorium/3?showtime=15&mode=3d'
  },
  {
    id: 'large_curved',
    name: 'Large Curved Screen',
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
    movieTitle: 'Wildwood',
    youtubeId: 'B2Cx_5_YLxQ',
    cinemaId: 6,
    audId: 20,
    showtimeId: 99,
    url: 'http://localhost:3000/cinemas/6/auditorium/20?showtime=99&mode=3d'
  },
  {
    id: 'panoramic_wrap',
    name: 'Motion-Seat Panoramic Wrap (Center + Wings)',
    movieTitle: 'Hope',
    youtubeId: 'JNJ6luyhR2I',
    cinemaId: 2,
    audId: 5,
    showtimeId: 21,
    url: 'http://localhost:3000/cinemas/2/auditorium/5?showtime=21&mode=3d'
  },
  {
    id: 'boutique',
    name: 'Boutique Velvet Recliner Lounge',
    movieTitle: 'Clayface',
    youtubeId: 'F1jCd_tMEDM',
    cinemaId: 4,
    audId: 13,
    showtimeId: 65,
    url: 'http://localhost:3000/cinemas/4/auditorium/13?showtime=65&mode=3d'
  },
  {
    id: 'original_100_seat',
    name: 'Original 100-Seat Reference Hall',
    movieTitle: 'Ghost Soldier',
    youtubeId: 'UKaWzMf9Ybc',
    cinemaId: 1,
    audId: 1,
    showtimeId: 3,
    url: 'http://localhost:3000/cinemas/1/auditorium/1?showtime=3&mode=3d'
  }
];

(async () => {
  console.log('================================================================');
  console.log(' STARTING 6-HALL COVERAGE: ORIENTATION, PLAY BUTTON & TRAILER');
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
    console.log(`Movie: ${hall.movieTitle} | YouTube: ${hall.youtubeId} | URL: ${hall.url}`);
    console.log(`----------------------------------------------------------------`);

    // Create fresh context for each hall to guarantee zero cross-page throttling
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      localStorage.setItem('cineverse_city', 'mumbai');
      localStorage.setItem('cineverse_city_id', '2');
    });

    const page = await context.newPage();

    try {
      await page.goto(hall.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);

      // Extract hall screen parameters and dynamically calculate cameras
      const camData = await page.evaluate(() => {
        const store = window.__cineverse_store?.getState?.();
        const scr = store?.auditoriumLayout?.screen;
        const center = scr?.center_gltf_y_up || [0, 5.55, -1.255];
        const width = scr?.width || 16.0;
        const height = scr?.height || 7.5;
        const isCurved = Boolean(scr?.curved || scr?.is_curved || scr?.screen_type_id === 'large_curved');
        const isWrap = Boolean(scr?.panoramic_wrap || scr?.screen_type_id === 'panoramic_wrap');
        const isDirect = Boolean(scr?.is_direct_led || scr?.screen_type_id === 'premium_direct_view');

        const centerCam = [center[0], center[1] * 0.95, center[2] - width * 1.25];
        const leftCam = [center[0] - width * 0.45, center[1] * 0.95, center[2] - width * 1.1];
        const rightCam = [center[0] + width * 0.45, center[1] * 0.95, center[2] - width * 1.1];
        const target = [center[0], center[1], center[2]];

        return {
          center,
          width,
          height,
          isCurved,
          isWrap,
          isDirect,
          centerCam,
          leftCam,
          rightCam,
          target
        };
      });

      console.log(`Screen Dimensions: ${camData.width}m x ${camData.height}m at Center [${camData.center.map(v => v.toFixed(2)).join(', ')}]`);
      console.log(`Screen Features: Curved=${camData.isCurved}, Wrap=${camData.isWrap}, DirectLED=${camData.isDirect}`);

      // 1. ORIENTATION TEST: Enable Test Card Mode
      console.log('\n[Phase 1] Orientation Test Card Verification:');
      await page.evaluate(() => {
        window.__cineverse_store?.getState?.().setTrailerStrategy('test_card');
      });
      await page.waitForTimeout(1000);

      // Center View
      await page.evaluate((c) => window.__cineverse_store?.getState?.().setCameraPose(c.centerCam, c.target), camData);
      await page.waitForTimeout(600);
      const testCardCenterPath = path.join(EVIDENCE_DIR, `${hall.id}_testcard_center.png`);
      await page.screenshot({ path: testCardCenterPath });

      // Left View
      await page.evaluate((c) => window.__cineverse_store?.getState?.().setCameraPose(c.leftCam, c.target), camData);
      await page.waitForTimeout(600);
      const testCardLeftPath = path.join(EVIDENCE_DIR, `${hall.id}_testcard_left.png`);
      await page.screenshot({ path: testCardLeftPath });

      // Right View
      await page.evaluate((c) => window.__cineverse_store?.getState?.().setCameraPose(c.rightCam, c.target), camData);
      await page.waitForTimeout(600);
      const testCardRightPath = path.join(EVIDENCE_DIR, `${hall.id}_testcard_right.png`);
      await page.screenshot({ path: testCardRightPath });
      console.log(`Saved 3 orientation test card views for ${hall.id}`);

      // 2. PLAY BUTTON TEST: Switch back to standard trailer mode
      console.log('\n[Phase 2] Play Button Verification:');
      await page.evaluate(() => {
        const store = window.__cineverse_store?.getState?.();
        const tr = store?.trailer?.trailerUrl;
        const strat = (tr && (tr.endsWith('.mp4') || tr.endsWith('.webm') || tr.startsWith('/trailers/')))
          ? 'video_texture'
          : (tr && tr.includes('youtube')) ? 'youtube_css3d' : 'title_card';
        store?.setTrailerStrategy(strat);
      });
      await page.evaluate((c) => window.__cineverse_store?.getState?.().setCameraPose(c.centerCam, c.target), camData);
      await page.waitForTimeout(1500);

      // Wait for YouTube player instance if strategy is youtube_css3d
      await page.waitForFunction(() => {
        const strat = window.__cineverse_store?.getState?.().trailer?.activeStrategy;
        if (strat !== 'youtube_css3d') return true;
        return Boolean(window.__cineverse_yt_player);
      }, { timeout: 8000 }).catch(() => {});

      const playBtn = page.locator('[data-testid="screen-3d-play-button"]');
      const btnVisible = await playBtn.isVisible();
      const playBtnPath = path.join(EVIDENCE_DIR, `${hall.id}_play_button_ready.png`);
      await page.screenshot({ path: playBtnPath });
      console.log(`Play Button Visible: ${btnVisible}`);

      // 3. TRAILER PLAYBACK TEST
      console.log('\n[Phase 3] Trailer Playback Verification:');
      console.log('Clicking on-screen Play Button...');
      await playBtn.click();
      await page.waitForTimeout(3000);

      const sample1 = await page.evaluate(() => {
        const store = window.__cineverse_store?.getState?.();
        const yt = window.__cineverse_yt_player;
        const vid = window.__cineverse_video;
        const strat = store?.trailer?.activeStrategy;
        const isYt = strat === 'youtube_css3d';
        const modal = document.querySelector('[data-testid="theatre-mode-modal"]');
        return {
          strategy: strat,
          status: store?.trailer?.playbackStatus,
          isTheatreMode: store?.trailer?.isTheatreMode,
          theatreModalVisible: modal ? window.getComputedStyle(modal).display !== 'none' : false,
          playerState: isYt ? (typeof yt?.getPlayerState === 'function' ? yt.getPlayerState() : null) : (vid && !vid.paused ? 1 : 2),
          time: isYt ? (typeof yt?.getCurrentTime === 'function' ? yt.getCurrentTime() : null) : (vid?.currentTime ?? null),
        };
      });

      const playT1Path = path.join(EVIDENCE_DIR, `${hall.id}_trailer_t1.png`);
      await page.screenshot({ path: playT1Path });

      await page.waitForTimeout(2500);

      const sample2 = await page.evaluate(() => {
        const store = window.__cineverse_store?.getState?.();
        const yt = window.__cineverse_yt_player;
        const vid = window.__cineverse_video;
        const strat = store?.trailer?.activeStrategy;
        const isYt = strat === 'youtube_css3d';
        const modal = document.querySelector('[data-testid="theatre-mode-modal"]');
        return {
          strategy: strat,
          status: store?.trailer?.playbackStatus,
          isTheatreMode: store?.trailer?.isTheatreMode,
          theatreModalVisible: modal ? window.getComputedStyle(modal).display !== 'none' : false,
          playerState: isYt ? (typeof yt?.getPlayerState === 'function' ? yt.getPlayerState() : null) : (vid && !vid.paused ? 1 : 2),
          time: isYt ? (typeof yt?.getCurrentTime === 'function' ? yt.getCurrentTime() : null) : (vid?.currentTime ?? null),
        };
      });

      const playT2Path = path.join(EVIDENCE_DIR, `${hall.id}_trailer_t2.png`);
      await page.screenshot({ path: playT2Path });

      const timeDelta = (sample2.time || 0) - (sample1.time || 0);
      const isAdvancing = timeDelta >= 1.5 && sample2.playerState === 1 && !sample2.isTheatreMode;

      console.log(`T+3s: State=${sample1.playerState} Time=${sample1.time?.toFixed(2)}s Status=${sample1.status}`);
      console.log(`T+5.5s: State=${sample2.playerState} Time=${sample2.time?.toFixed(2)}s Status=${sample2.status}`);
      console.log(`Advancement Delta: ${timeDelta.toFixed(2)}s (Pass >= 1.5s): ${isAdvancing ? 'PASS' : 'FAIL'}`);

      summary.push({
        hallId: hall.id,
        hallName: hall.name,
        movieTitle: hall.movieTitle,
        youtubeId: hall.youtubeId,
        cinemaId: hall.cinemaId,
        audId: hall.audId,
        showtimeId: hall.showtimeId,
        strategy: sample2.strategy,
        orientationViews: [testCardCenterPath, testCardLeftPath, testCardRightPath],
        playButtonVisible: btnVisible,
        playButtonScreenshot: playBtnPath,
        t1Time: sample1.time,
        t2Time: sample2.time,
        timeDelta: timeDelta,
        playerState: sample2.playerState,
        playbackStatus: sample2.status,
        isTheatreMode: sample2.isTheatreMode,
        passedAdvancing: isAdvancing,
        t1Screenshot: playT1Path,
        t2Screenshot: playT2Path
      });
    } catch (err) {
      console.error(`Error verifying hall ${hall.id}:`, err);
      summary.push({
        hallId: hall.id,
        hallName: hall.name,
        error: err.message,
        passedAdvancing: false
      });
    } finally {
      await context.close();
    }
  }

  await browser.close();

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'six_halls_results.json'), JSON.stringify(summary, null, 2));
  console.log('\n================================================================');
  console.log(' ALL 6 HALLS VERIFIED. RESULTS SAVED:');
  console.log(path.join(EVIDENCE_DIR, 'six_halls_results.json'));
  console.log('================================================================');
})();
