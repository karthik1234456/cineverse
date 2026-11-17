/**
 * dev-stop.cjs
 * Shuts down CineVerse development backend and frontend instances,
 * freeing fixed ports 8000 and 3000 on Windows.
 */

const { execSync } = require('child_process');

const TARGET_PORTS = [8000, 3000, 3001, 3002];

function getListeningPids(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, {
        stdio: ['ignore', 'pipe', 'ignore'],
      }).toString();

      const pids = new Set();
      for (const line of output.split('\n')) {
        if (line.includes(`:${port}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid) && pid !== '0' && pid !== String(process.pid)) {
            pids.add(pid);
          }
        }
      }
      return Array.from(pids);
    } else {
      const output = execSync(`lsof -ti :${port}`, {
        stdio: ['ignore', 'pipe', 'ignore'],
      }).toString();
      return output
        .trim()
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p && p !== String(process.pid));
    }
  } catch (e) {
    return [];
  }
}

function freePort(port) {
  const pids = getListeningPids(port);
  if (pids.length === 0) {
    console.log(`[dev:stop] Port ${port} is free.`);
    return true;
  }

  for (const pid of pids) {
    try {
      console.log(`[dev:stop] Terminating process PID ${pid} listening on port ${port}...`);
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: ['ignore', 'pipe', 'ignore'] });
      } else {
        process.kill(Number(pid), 'SIGKILL');
      }
    } catch (e) {
      // Ignored if process already terminated
    }
  }

  // Small sleep to allow OS socket release
  const start = Date.now();
  while (Date.now() - start < 400) {}

  const remaining = getListeningPids(port);
  if (remaining.length > 0) {
    console.error(`[ERROR] Port ${port} remains busy (PID ${remaining.join(', ')}). Please close it or run as Administrator.`);
    return false;
  }

  console.log(`[dev:stop] Successfully freed port ${port}.`);
  return true;
}

function stopAll() {
  console.log('------------------------------------------------------------');
  console.log(' Stopping CineVerse Development Servers & Freeing Ports');
  console.log('------------------------------------------------------------');

  let allFreed = true;
  for (const port of TARGET_PORTS) {
    const success = freePort(port);
    if (!success) {
      allFreed = false;
    }
  }

  if (allFreed) {
    console.log('[dev:stop] All project ports (3000, 8000) are free.');
    process.exit(0);
  } else {
    console.error('[dev:stop] One or more ports could not be freed.');
    process.exit(1);
  }
}

if (require.main === module) {
  stopAll();
}

module.exports = {
  getListeningPids,
  freePort,
  TARGET_PORTS,
};
