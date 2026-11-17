const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = path.resolve('evidence/real-screen-trailers');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const TEST_CASES = [
  {
    movieId: 55,
    title: 'Clayface',
    youtubeId: 'F1jCd_tMEDM',
    showtimeId: 737,
    cinemaId: 11,
    audId: 36,
    url: 'http://localhost:3000/cinemas/11/auditorium/36?showtime=737&mode=3d'
  },
  {
    movieId: 51,
    title: 'Hope',
    youtubeId: 'JNJ6luyhR2I',
    showtimeId: 1,
    cinemaId: 1,
    audId: 1,
    url: 'http://localhost:3000/cinemas/1/auditorium/1?showtime=1&mode=3d'
  },
  {
    movieId: 53,
    title: 'Ghost Soldier',
    youtubeId: 'UKaWzMf9Ybc',
    showtimeId: 3,
    cinemaId: 1,
    audId: 1,
    url: 'http://localhost:3000/cinemas/1/auditorium/1?showtime=3&mode=3d'
  },
  {
    movieId: 54,
    title: 'Wildwood',
    youtubeId: 'B2Cx_5_YLxQ',
    showtimeId: 4,
    cinemaId: 1,
    audId: 1,
    url: 'http://localhost:3000/cinemas/1/auditorium/1?showtime=4&mode=3d'
  }
];

(async () => {
  console.log('====================================================');
  console.log(' STARTING REAL-MOVIE HEADED CHROME VERIFICATION');
  console.log('====================================================');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--enable-webgl', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  await context.addInitScript(() => {
    localStorage.setItem('cineverse_city', 'mumbai');
    localStorage.setItem('cineverse_city_id', '2');
  });

  const page = await context.newPage();
  const results = [];

  for (const tc of TEST_CASES) {
    console.log(`\n----------------------------------------------------`);
    console.log(`Testing Movie: ${tc.title} (ID ${tc.movieId})`);
    console.log(`YouTube ID: ${tc.youtubeId} | URL: ${tc.url}`);
    console.log(`----------------------------------------------------`);

    try {
      await page.goto(tc.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);

      // Derive camera dynamically from hall screen position
      const screenInfo = await page.evaluate(() => {
        const store = window.__cineverse_store?.getState?.();
        const scr = store?.auditoriumLayout?.screen;
        const center = scr?.center_gltf_y_up || [0, 5.55, -1.255];
        const width = scr?.width || 16.0;
        const height = scr?.height || 7.5;

        // Position camera derived from screen: directly in front of screen at optimal distance
        const camPos = [center[0], center[1] * 0.95, center[2] - width * 1.25];
        const camTarget = [center[0], center[1], center[2]];

        store?.setCameraPose?.(camPos, camTarget);

        return {
          center,
          width,
          height,
          camPos,
          camTarget,
          activeStrategy: store?.trailer?.activeStrategy,
          trailerUrl: store?.trailer?.trailerUrl,
          movieTitle: store?.trailer?.movieTitle,
        };
      });

      console.log(`Derived Camera: Pos=[${screenInfo.camPos.map(v => v.toFixed(2)).join(', ')}] Target=[${screenInfo.camTarget.map(v => v.toFixed(2)).join(', ')}]`);
      await page.waitForTimeout(1000);

      const t0Path = path.join(EVIDENCE_DIR, `${tc.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_t0_ready.png`);
      await page.screenshot({ path: t0Path });
      console.log(`Saved t0 screenshot: ${t0Path}`);

      // Locate Play button
      const playBtn = page.locator('[data-testid="screen-3d-play-button"]');
      const btnVisible = await playBtn.isVisible();
      console.log(`On-screen Play Button Visible: ${btnVisible}`);

      if (!btnVisible) {
        throw new Error('On-screen Play Button was not visible');
      }

      // Real user gesture click on play button
      console.log(`Clicking on-screen Play Button with real user gesture...`);
      await playBtn.click();

      // Wait 3 seconds for playback to establish
      await page.waitForTimeout(3000);

      const sample1 = await page.evaluate(() => {
        const store = window.__cineverse_store?.getState?.();
        const yt = window.__cineverse_yt_player;
        const modal = document.querySelector('[data-testid="theatre-mode-modal"]');
        return {
          playbackStatus: store?.trailer?.playbackStatus,
          isPlaying: store?.trailer?.isPlaying,
          isTheatreMode: store?.trailer?.isTheatreMode,
          theatreModalVisible: modal ? window.getComputedStyle(modal).display !== 'none' : false,
          ytState: typeof yt?.getPlayerState === 'function' ? yt.getPlayerState() : null,
          ytTime: typeof yt?.getCurrentTime === 'function' ? yt.getCurrentTime() : null,
        };
      });

      const t1Path = path.join(EVIDENCE_DIR, `${tc.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_t1_playing.png`);
      await page.screenshot({ path: t1Path });
      console.log(`Sample 1 (T+3s): State=${sample1.ytState} Time=${sample1.ytTime?.toFixed(2)}s Status=${sample1.playbackStatus} TheatreMode=${sample1.isTheatreMode}`);

      // Wait 2.5 seconds more
      await page.waitForTimeout(2500);

      const sample2 = await page.evaluate(() => {
        const store = window.__cineverse_store?.getState?.();
        const yt = window.__cineverse_yt_player;
        const modal = document.querySelector('[data-testid="theatre-mode-modal"]');
        return {
          playbackStatus: store?.trailer?.playbackStatus,
          isPlaying: store?.trailer?.isPlaying,
          isTheatreMode: store?.trailer?.isTheatreMode,
          theatreModalVisible: modal ? window.getComputedStyle(modal).display !== 'none' : false,
          ytState: typeof yt?.getPlayerState === 'function' ? yt.getPlayerState() : null,
          ytTime: typeof yt?.getCurrentTime === 'function' ? yt.getCurrentTime() : null,
        };
      });

      const t2Path = path.join(EVIDENCE_DIR, `${tc.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_t2_playing.png`);
      await page.screenshot({ path: t2Path });
      console.log(`Sample 2 (T+5.5s): State=${sample2.ytState} Time=${sample2.ytTime?.toFixed(2)}s Status=${sample2.playbackStatus} TheatreMode=${sample2.isTheatreMode}`);

      const timeDelta = (sample2.ytTime || 0) - (sample1.ytTime || 0);
      const isAdvancing = timeDelta >= 1.5 && sample2.ytState === 1 && !sample2.isTheatreMode;

      results.push({
        movieId: tc.movieId,
        title: tc.title,
        youtubeId: tc.youtubeId,
        showtimeId: tc.showtimeId,
        strategy: 'youtube_css3d',
        status1: sample1.playbackStatus,
        status2: sample2.playbackStatus,
        ytState1: sample1.ytState,
        ytState2: sample2.ytState,
        ytTime1: sample1.ytTime,
        ytTime2: sample2.ytTime,
        timeDelta: timeDelta,
        isTheatreMode: sample2.isTheatreMode,
        passedAdvancing: isAdvancing,
        t0Screenshot: t0Path,
        t1Screenshot: t1Path,
        t2Screenshot: t2Path,
      });

      console.log(`Advancing Check: Delta=${timeDelta.toFixed(2)}s (>= 1.5s): ${isAdvancing ? 'PASS' : 'FAIL'}`);
    } catch (err) {
      console.error(`Error testing movie ${tc.title}:`, err);
      results.push({
        movieId: tc.movieId,
        title: tc.title,
        youtubeId: tc.youtubeId,
        showtimeId: tc.showtimeId,
        strategy: 'youtube_css3d',
        error: err.message,
        passedAdvancing: false
      });
    }
  }

  await browser.close();

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'real_movies_bench_results.json'), JSON.stringify(results, null, 2));
  console.log('\n====================================================');
  console.log(' BENCHMARK COMPLETED. RESULTS SAVED:');
  console.log(path.join(EVIDENCE_DIR, 'real_movies_bench_results.json'));
  console.log('====================================================');
})();
