const { chromium } = require('../frontend/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const EVIDENCE_DIR = path.resolve('evidence');
const ARTIFACT_DIR = path.resolve('C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee');

const hallTypes = [
  {
    name: 'Compact Hall (Aud 1 - Flat Screen)',
    type: 'flat',
    url: 'http://localhost:3002/cinemas/1/auditorium/1?showtime=3934&mode=pov&seat=H06',
  },
  {
    name: 'Luxe Recliner Lounge (Aud 4 - Large Curved)',
    type: 'curved',
    url: 'http://localhost:3002/cinemas/1/auditorium/4?showtime=17&mode=3d',
  },
  {
    name: 'Panoramic Wrap (Aud 5 - Wrap Screen)',
    type: 'wrap',
    url: 'http://localhost:3002/cinemas/2/auditorium/5?showtime=24&mode=3d',
  },
  {
    name: 'Direct-View LED (Aud 3 - Premium Direct-View)',
    type: 'direct_view',
    url: 'http://localhost:3002/cinemas/1/auditorium/3?showtime=9&mode=3d',
  },
];

async function runBenchmark() {
  console.log('================================================================');
  console.log('EXPERIMENTAL ON-SCREEN PATH: 20-Play Benchmark per Hall Type');
  console.log('Testing: Headed Chrome, Real GPU, Experimental On-Screen Mode');
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

  const results = [];

  for (const hall of hallTypes) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Benchmarking: ${hall.name}`);
    console.log(`URL: ${hall.url}`);
    console.log(`----------------------------------------------------------------`);

    await page.goto(hall.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    let successfulPlays = 0;
    let watchdogTriggers = 0;
    let soundWithoutPictureViolations = 0;
    const playDetails = [];

    for (let trial = 1; trial <= 20; trial++) {
      // 1. Reset trailer state to ready & switch preference to screen_3d
      await page.evaluate(() => {
        const store = (window).__cineverse_store?.getState();
        if (store) {
          store.setTrailerDisplayPreference('screen_3d');
          store.setTrailerState({
            isPlaying: false,
            playbackStatus: 'ready',
            isMuted: true,
            isTheatreMode: false,
          });
        }
      });
      await page.waitForTimeout(300);

      // 2. Trigger Play via play trailer handler
      await page.evaluate(() => {
        if (typeof (window).__cineverse_play_trailer === 'function') {
          (window).__cineverse_play_trailer();
        } else {
          (window).__cineverse_store?.getState()?.toggleTrailerPlay();
        }
      });

      // 3. Monitor for 2.2 seconds to verify watchdog and audio invariant
      await page.waitForTimeout(2200);

      const status = await page.evaluate(() => {
        const store = (window).__cineverse_store?.getState();
        const trailer = store?.trailer;
        const yt = (window).__cineverse_yt_player;
        const vid = (window).__cineverse_video;

        let ytState = -1;
        let ytTime = -1;
        if (yt && typeof yt.getPlayerState === 'function') {
          ytState = yt.getPlayerState();
          ytTime = typeof yt.getCurrentTime === 'function' ? yt.getCurrentTime() : -1;
        }

        const isMuted = trailer?.isMuted ?? true;
        const isPlaying = trailer?.isPlaying ?? false;
        const playbackStatus = trailer?.playbackStatus ?? 'ready';
        const toast = store?.toastMessage;

        // Invariant check: Sound played while picture was NOT advancing/visible
        const pictureVisible = (ytState === 1 && ytTime > 0.05) || (vid && !vid.paused && vid.currentTime > 0.05);
        const soundWithoutPicture = !isMuted && !pictureVisible;

        return {
          trial: 0,
          isPlaying,
          playbackStatus,
          isMuted,
          pictureVisible,
          soundWithoutPicture,
          watchdogFired: playbackStatus === 'error' || toast === 'The picture is not visible on the 3D screen',
          ytState,
          ytTime,
        };
      });

      status.trial = trial;
      playDetails.push(status);

      if (status.soundWithoutPicture) {
        soundWithoutPictureViolations++;
      }
      if (status.watchdogFired) {
        watchdogTriggers++;
      }
      if (status.pictureVisible && !status.soundWithoutPicture) {
        successfulPlays++;
      }

      if (trial % 5 === 0) {
        console.log(`  Trial ${trial}/20: status=${status.playbackStatus}, pictureVisible=${status.pictureVisible}, watchdogFired=${status.watchdogFired}`);
      }
    }

    const successRate = (successfulPlays / 20) * 100;
    console.log(`  Summary for ${hall.name}:`);
    console.log(`    Successful Plays: ${successfulPlays}/20 (${successRate.toFixed(1)}%)`);
    console.log(`    Watchdog Triggers (stopped sound): ${watchdogTriggers}/20`);
    console.log(`    Sound Without Picture Violations: ${soundWithoutPictureViolations} (MUST BE 0)`);

    results.push({
      hall: hall.name,
      type: hall.type,
      totalTrials: 20,
      successfulPlays,
      watchdogTriggers,
      soundWithoutPictureViolations,
      successRate: `${successRate.toFixed(1)}%`,
      theatreModeRecommendation: successRate < 95 ? 'Opt-in only; Theatre Mode is recommended default' : 'Eligible for default',
    });
  }

  await page.close();
  await context.close();
  await browser.close();

  const report = {
    timestamp: new Date().toISOString(),
    benchmark: '20 plays per hall type for experimental on-screen mode',
    results,
  };

  const reportPath = path.join(EVIDENCE_DIR, 'success_rate_table.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'success_rate_table.json'), JSON.stringify(report, null, 2));
  console.log(`\nBenchmark completed. Report written to: ${reportPath}`);
}

runBenchmark().catch(console.error);
