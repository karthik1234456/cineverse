const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'frontend', 'node_modules', '@playwright', 'test'));

const candidates = [
  { title: 'Clayface', id: 'F1jCd_tMEDM' },
  { title: 'Hope', id: 'JNJ6luyhR2I' },
  { title: 'Ghost Soldier', id: 'UKaWzMf9Ybc' },
  { title: 'Wildwood', id: 'B2Cx_5_YLxQ' },
  { title: 'Street Fighter', id: 'YoC737pGAE8' },
  { title: 'The Cat in the Hat', id: 'G06AnY72ufE' },
  { title: 'Jailer 2', id: '3vkHWYL2JmA' },
  { title: 'Godzilla Minus Zero', id: 'Pu0pH5BuCPM' },
  { title: 'Sathyavan Savithiri', id: '43hxXUSCIYs' }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Testing YouTube embedded playback and player API for candidate real movies...\n');

  for (const c of candidates) {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://www.youtube.com/iframe_api"></script>
      </head>
      <body>
        <div id="player"></div>
        <script>
          window.playerState = 'UNSTARTED';
          window.errorCode = null;
          window.currentTime = 0;
          function onYouTubeIframeAPIReady() {
            window.ytPlayer = new YT.Player('player', {
              videoId: '${c.id}',
              playerVars: { autoplay: 1, mute: 1, origin: 'http://localhost:3000' },
              events: {
                onReady: (e) => { e.target.playVideo(); },
                onStateChange: (e) => {
                  window.playerState = e.data;
                },
                onError: (e) => {
                  window.errorCode = e.data;
                }
              }
            });
          }
        </script>
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const result = await page.evaluate(async () => {
      let t0 = -1, t1 = -1;
      if (window.ytPlayer && typeof window.ytPlayer.getCurrentTime === 'function') {
        try {
          t0 = window.ytPlayer.getCurrentTime();
        } catch(e) {}
      }
      await new Promise(r => setTimeout(r, 1200));
      if (window.ytPlayer && typeof window.ytPlayer.getCurrentTime === 'function') {
        try {
          t1 = window.ytPlayer.getCurrentTime();
        } catch(e) {}
      }
      return {
        state: window.playerState,
        errorCode: window.errorCode,
        t0,
        t1,
        advancing: t1 > t0 && t1 > 0
      };
    });

    console.log(`Movie: ${c.title.padEnd(25)} | ID: ${c.id} | State: ${result.state} | Error: ${result.errorCode} | t0: ${result.t0.toFixed(2)}s -> t1: ${result.t1.toFixed(2)}s | Advancing: ${result.advancing ? 'YES' : 'NO'}`);
  }

  await browser.close();
})();
