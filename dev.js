// Single-command development runner for Employee Auth Module.
// Runs the React build watcher and Express backend concurrently on the same port.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

console.log('\n======================================================');
console.log('  Employee Auth Module — Unified Single-Port Runner');
console.log('  App:       http://localhost:5000');
console.log('  Test Page: http://localhost:5000/auth-test.html');
console.log('======================================================\n');

console.log('📦 Step 1/2: Building frontend assets...');
const initialBuild = spawn('npm', ['run', 'build'], {
  cwd: path.join(root, 'frontend'),
  stdio: 'inherit',
  shell: true,
});

initialBuild.on('close', (code) => {
  if (code !== 0) {
    console.error(`\n❌ Frontend build failed with exit code ${code}.`);
    process.exit(code);
  }

  console.log('\n✅ Frontend build complete.');
  console.log('🚀 Step 2/2: Starting unified server & watchers...\n');

  // Watch frontend and rebuild automatically on file save
  const frontendWatcher = spawn('npm', ['run', 'build', '--', '--watch'], {
    cwd: path.join(root, 'frontend'),
    stdio: 'inherit',
    shell: true,
  });

  // Run backend with auto-reload (watching only src directory)
  const backendServer = spawn('node', ['--watch', '--watch-path=src', 'src/server.js'], {
    cwd: path.join(root, 'backend'),
    stdio: 'inherit',
    shell: true,
  });

  const stopAll = () => {
    console.log('\n🛑 Shutting down development processes...');
    try { frontendWatcher.kill('SIGTERM'); } catch {}
    try { backendServer.kill('SIGTERM'); } catch {}
    process.exit(0);
  };

  process.on('SIGINT', stopAll);
  process.on('SIGTERM', stopAll);
});
