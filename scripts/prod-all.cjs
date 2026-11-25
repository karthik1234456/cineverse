/**
 * prod-all.cjs
 * One-command production server starter for Windows (and cross-platform).
 * Frees ports 8000 and 3002, starts FastAPI and Next.js production build,
 * and polls until both answer before declaring READY.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { freePort, getListeningPids } = require('./dev-stop.cjs');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

const BACKEND_PORT = 8000;
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || process.env.PORT || '3002', 10);

const BACKEND_PROBE_URL = `http://127.0.0.1:${BACKEND_PORT}/api/v1/movies/catalog-info`;
const FRONTEND_PROBE_URL = `http://localhost:${FRONTEND_PORT}`;

console.log('==============================================================');
console.log(' Starting CineVerse Production Environment (Windows / Node)');
console.log('==============================================================');
console.log(`[prod:all] Checking and freeing ports: 8000, 3000, 3001, 3002...`);

const PORTS_TO_CHECK = Array.from(new Set([BACKEND_PORT, FRONTEND_PORT, 3000, 3001, 3002]));
for (const port of PORTS_TO_CHECK) {
  const freed = freePort(port);
  if (!freed) {
    const pids = getListeningPids(port);
    console.error(`\n[FATAL] Port ${port} is busy (PID ${pids.join(', ')}) and could not be freed.`);
    process.exit(1);
  }
}

// Resolve Python executable
let pythonExe = 'python';
const venvPythonWin = path.join(BACKEND_DIR, '.venv', 'Scripts', 'python.exe');
const venvPythonUnix = path.join(BACKEND_DIR, '.venv', 'bin', 'python');

if (fs.existsSync(venvPythonWin)) {
  pythonExe = venvPythonWin;
} else if (fs.existsSync(venvPythonUnix)) {
  pythonExe = venvPythonUnix;
}

console.log('\n[prod:all] Starting servers on fixed ports:');
console.log(`  Frontend (Prod): http://localhost:${FRONTEND_PORT}`);
console.log(`  Backend API:     http://127.0.0.1:${BACKEND_PORT}`);
console.log(`  Swagger Docs:    http://127.0.0.1:${BACKEND_PORT}/docs`);
console.log(`  Dev Readiness:   http://localhost:${FRONTEND_PORT}/dev/readiness`);
console.log('--------------------------------------------------------------\n');

// Spawn backend
console.log(`[prod:all] Launching backend (FastAPI/Uvicorn on port ${BACKEND_PORT})...`);
const backendProc = spawn(
  pythonExe,
  ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)],
  {
    cwd: BACKEND_DIR,
    env: { ...process.env, PYTHONPATH: 'backend' },
    stdio: ['inherit', 'pipe', 'pipe'],
  }
);

backendProc.stdout.on('data', (d) => {
  const text = d.toString().trim();
  if (text && !text.includes('GET /api/v1/movies/catalog-info')) {
    console.log(`[backend] ${text}`);
  }
});
backendProc.stderr.on('data', (d) => {
  const text = d.toString().trim();
  if (text) console.error(`[backend-err] ${text}`);
});

// Spawn frontend in production mode
console.log(`[prod:all] Launching frontend in production mode (Next.js on port ${FRONTEND_PORT})...`);
const frontendProc = spawn('npm run start -- -p ' + FRONTEND_PORT, {
  cwd: FRONTEND_DIR,
  shell: true,
  env: { ...process.env, PORT: String(FRONTEND_PORT) },
  stdio: ['inherit', 'pipe', 'pipe'],
});

frontendProc.stdout.on('data', (d) => {
  const text = d.toString().trim();
  if (text) console.log(`[frontend] ${text}`);
});
frontendProc.stderr.on('data', (d) => {
  const text = d.toString().trim();
  if (text) console.error(`[frontend-err] ${text}`);
});

function probeUrl(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = http.request(
        {
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname + parsed.search,
          method: 'GET',
          timeout: timeoutMs,
        },
        (res) => {
          resolve(res.statusCode >= 200 && res.statusCode < 400);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

async function waitForReadiness(maxWaitSeconds = 60) {
  console.log('[prod:all] Verifying HTTP responses on fixed ports...');
  const startTime = Date.now();
  let backendReady = false;
  let frontendReady = false;

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    if (!backendReady) {
      backendReady = await probeUrl(BACKEND_PROBE_URL);
      if (backendReady) {
        console.log(`  ✓ Backend answering at http://127.0.0.1:${BACKEND_PORT}`);
      }
    }

    if (!frontendReady) {
      frontendReady = await probeUrl(FRONTEND_PROBE_URL);
      if (frontendReady) {
        console.log(`  ✓ Frontend answering at http://localhost:${FRONTEND_PORT}`);
      }
    }

    if (backendReady && frontendReady) {
      console.log('\n==============================================================');
      console.log(' [READY] CineVerse Production is live and accepting traffic!');
      console.log(`  Access the app at: http://localhost:${FRONTEND_PORT}`);
      console.log('==============================================================\n');
      return true;
    }

    await new Promise((r) => setTimeout(r, 750));
  }

  console.error('\n[TIMEOUT] One or both servers did not answer within 60 seconds.');
  if (!backendReady) console.error(`  ✗ Backend failed to respond at ${BACKEND_PROBE_URL}`);
  if (!frontendReady) console.error(`  ✗ Frontend failed to respond at ${FRONTEND_PROBE_URL}`);
  return false;
}

waitForReadiness();

function cleanup() {
  console.log('\n[prod:all] Terminating CineVerse server processes...');
  try { backendProc.kill('SIGTERM'); } catch {}
  try { frontendProc.kill('SIGTERM'); } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
