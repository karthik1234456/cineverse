const { spawn } = require('child_process');
const port = process.env.PORT || '3002';

console.log(`[frontend] Starting Next.js development server on port ${port}...`);
const nextProc = spawn('npx', ['next', 'dev', '-p', port], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

nextProc.on('exit', (code) => {
  process.exit(code || 0);
});
