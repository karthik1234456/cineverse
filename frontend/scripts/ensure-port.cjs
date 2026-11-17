const net = require('net');
const { execSync } = require('child_process');

const targetPort = parseInt(process.argv[2] || process.env.PORT || '3002', 10);

function getProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
      const lines = output.trim().split('\n');
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          return parts[parts.length - 1]; // PID
        }
      }
    } else {
      const output = execSync(`lsof -ti :${port}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
      return output.trim();
    }
  } catch (e) {
    return null;
  }
  return null;
}

const server = net.createServer();

server.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const pid = getProcessOnPort(targetPort);
    const pidInfo = pid ? ` (occupied by PID ${pid})` : '';
    console.error(`\n======================================================================`);
    console.error(`[FATAL] Port ${targetPort} is already in use${pidInfo}!`);
    console.error(`Dev setup cannot start because port ${targetPort} is occupied.`);
    console.error(`Silent port hunting is disabled to avoid connecting to stale servers.`);
    console.error(`Please terminate the conflicting process or run on the assigned port.`);
    console.error(`======================================================================\n`);
    process.exit(1);
  } else {
    console.error(`[FATAL] Unexpected error checking port ${targetPort}:`, err);
    process.exit(1);
  }
});

server.once('listening', () => {
  server.close(() => {
    // Port is available
    process.exit(0);
  });
});

server.listen(targetPort, '0.0.0.0');
