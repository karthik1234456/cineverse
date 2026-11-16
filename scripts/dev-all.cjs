/**
 * dev-all.cjs
 * One-command development starter for Windows (and cross-platform).
 * Frees ports 8000 and 3000, starts FastAPI and Next.js on fixed ports,
 * prints addresses, and polls until both answer before declaring READY.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { freePort, getListeningPids } = require('./dev-stop.cjs');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3000;

const BACKEND_PROBE_URL = `http://127.0.0.1:${BACKEND_PORT}/api/v1/movies/catalog-info`;
const FRONTEND_PROBE_URL = `http://localhost:${FRONTEND_PORT}`;

// 1. Free ports before starting
console.log('==============================================================');
console.log(' Starting CineVerse Development Environment (Windows / Node)');
console.log('==============================================================');
console.log('[dev:all] Checking and freeing ports 8000 and 3000...');

for (const port of [BACKEND_PORT, FRONTEND_PORT]) {
  const freed = freePort(port);
  if (!freed) {
    const pids = getListeningPids(port);
    console.error(`\n[FATAL] Port ${port} is busy (PID ${pids.join(', ')}) and could not be freed.`);
    console.error(`Please close conflicting applications or run this command as Administrator.`);
    process.exit(1);
  }
}

// 2. Resolve Python executable
let pythonExe = 'python';
const venvPythonWin = path.join(BACKEND_DIR, '.venv', 'Scripts', 'python.exe');
const venvPythonUnix = path.join(BACKEND_DIR, '.venv', 'bin', 'python');

if (fs.existsSync(venvPythonWin)) {
  pythonExe = venvPythonWin;
} else if (fs.existsSync(venvPythonUnix)) {
  pythonExe = venvPythonUnix;
}

// 3. Print assigned addresses
console.log('\n[dev:all] Starting servers on fixed ports:');
console.log(`  Frontend:       http://localhost:${FRONTEND_PORT}`);
console.log(`  Backend API:    http://127.0.0.1:${BACKEND_PORT}`);
console.log(`  Swagger Docs:   http://127.0.0.1:${BACKEND_PORT}/docs`);
console.log(`  Dev Readiness:  http://localhost:${FRONTEND_PORT}/dev/readiness`);
console.log('--------------------------------------------------------------\n');

// 4. Spawn backend
console.log(`[dev:all] Launching backend (FastAPI/Uvicorn on port ${BACKEND_PORT})...`);
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
  if (text) {
    // Suppress noisy heartbeat logs from cluttering output
    if (!text.includes('GET /api/v1/movies/catalog-info')) {
      console.log(`[backend] ${text}`);
    }
  }
});
backendProc.stderr.on('data', (d) => {
  const text = d.toString().trim();
  if (text) console.error(`[backend-err] ${text}`);
});

// 5. Spawn frontend
console.log(`[dev:all] Launching frontend (Next.js on port ${FRONTEND_PORT})...`);
const frontendProc = spawn('npm run dev', {
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

// 6. Cleanup handler
let cleaningUp = false;
function cleanup() {
  if (cleaningUp) return;
  cleaningUp = true;
  console.log('\n[dev:all] Shutting down development servers...');

  const killProc = (proc, name) => {
    if (proc && !proc.killed) {
      try {
        if (process.platform === 'win32' && proc.pid) {
          execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: ['ignore', 'pipe', 'ignore'] });
        } else if (proc.pid) {
          process.kill(proc.pid, 'SIGKILL');
        }
      } catch (e) {
        // Ignored
      }
    }
  };

  killProc(backendProc, 'backend');
  killProc(frontendProc, 'frontend');

  freePort(BACKEND_PORT);
  freePort(FRONTEND_PORT);

  console.log('[dev:all] All servers stopped and ports freed.');
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// 7. Health Probe Polling
function probeUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 1500 }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForBothReady() {
  const startTime = Date.now();
  const timeoutMs = 45000;
  let backendReady = false;
  let frontendReady = false;

  console.log('[dev:all] Waiting for both Backend and Frontend to answer health checks...');

  while (Date.now() - startTime < timeoutMs) {
    if (!backendReady) {
      backendReady = await probeUrl(BACKEND_PROBE_URL);
      if (backendReady) {
        console.log(`[dev:all] \x1b[32m✔ Backend is answering at http://127.0.0.1:${BACKEND_PORT}\x1b[0m`);
      }
    }

    if (!frontendReady) {
      frontendReady = await probeUrl(FRONTEND_PROBE_URL);
      if (frontendReady) {
        console.log(`[dev:all] \x1b[32m✔ Frontend is answering at http://localhost:${FRONTEND_PORT}\x1b[0m`);
      }
    }

    if (backendReady && frontendReady) {
      console.log('\n==============================================================');
      console.log(' \x1b[1m\x1b[32m>>> CineVerse is READY! <<<\x1b[0m');
      console.log(' Both Backend and Frontend answered health checks successfully.');
      console.log(` Frontend:       \x1b[36mhttp://localhost:${FRONTEND_PORT}\x1b[0m`);
      console.log(` Backend API:    \x1b[36mhttp://127.0.0.1:${BACKEND_PORT}\x1b[0m`);
      console.log(` Swagger Docs:   \x1b[36mhttp://127.0.0.1:${BACKEND_PORT}/docs\x1b[0m`);
      console.log(` Dev Readiness:  \x1b[36mhttp://localhost:${FRONTEND_PORT}/dev/readiness\x1b[0m`);
      console.log(' Press Ctrl+C at any time to shut down both servers.');
      console.log('==============================================================\n');
      return;
    }

    await new Promise((r) => setTimeout(r, 600));
  }

  console.warn('\n[WARNING] Timed out waiting for servers to answer within 45s.');
  console.warn(`Backend status: ${backendReady ? 'Ready' : 'Not responding'}`);
  console.warn(`Frontend status: ${frontendReady ? 'Ready' : 'Not responding'}`);
}

waitForBothReady();
