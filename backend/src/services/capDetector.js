import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../../scripts/detect.py');

let pythonProc = null;
let lineReader = null;
const pendingQueue = [];

function startProcess() {
  if (pythonProc && !pythonProc.killed) return;

  try {
    pythonProc = spawn('python3', [scriptPath], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: {
        ...process.env,
        HOME: '/tmp',
        OPENVINO_TELEMETRY_OPTOUT: '1',
      },
    });

    lineReader = readline.createInterface({
      input: pythonProc.stdout,
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    lineReader.on('line', (line) => {
      const pending = pendingQueue.shift();
      if (!pending) return;
      try {
        const parsed = JSON.parse(line);
        pending.resolve(parsed);
      } catch (err) {
        pending.reject(err);
      }
    });

    pythonProc.on('error', (err) => {
      console.error('[capDetector] Python spawn error:', err.message);
      drainQueueWithError(err);
    });

    pythonProc.on('exit', (code) => {
      console.warn(`[capDetector] Python process exited with code ${code}`);
      drainQueueWithError(new Error(`Python detector exited with code ${code}`));
      pythonProc = null;
    });
  } catch (err) {
    console.error('[capDetector] Failed to initialize detector:', err);
  }
}

function drainQueueWithError(err) {
  while (pendingQueue.length > 0) {
    const item = pendingQueue.shift();
    item.reject(err);
  }
}

function sendCommand(payload, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    startProcess();

    if (!pythonProc || !pythonProc.stdin.writable) {
      return reject(new Error('Detector process is not available.'));
    }

    const timer = setTimeout(() => {
      const idx = pendingQueue.findIndex((p) => p.timer === timer);
      if (idx !== -1) {
        pendingQueue.splice(idx, 1);
        reject(new Error('Inference timed out.'));
      }
    }, timeoutMs);

    pendingQueue.push({ resolve, reject, timer });

    try {
      pythonProc.stdin.write(`${JSON.stringify(payload)}\n`);
    } catch (err) {
      clearTimeout(timer);
      const idx = pendingQueue.findIndex((p) => p.timer === timer);
      if (idx !== -1) pendingQueue.splice(idx, 1);
      reject(err);
    }
  });
}

export function stopDetector() {
  if (lineReader) {
    try {
      lineReader.close();
    } catch { }
    lineReader = null;
  }
  if (pythonProc) {
    try {
      pythonProc.stdin.end();
    } catch { }
    try {
      pythonProc.kill();
    } catch { }
    pythonProc = null;
  }
}

export async function detectCap({ image, conf = 0.4 }) {
  try {
    const res = await sendCommand({ action: 'detect', image, conf });
    return res;
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      isSimulation: true,
      boxes: [],
      names: { 0: 'No cap', 1: 'cap' },
    };
  }
}

export async function getDetectorStatus(timeoutMs = 4000) {
  try {
    const res = await sendCommand({ action: 'status' }, timeoutMs);
    return res;
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      engine: 'unavailable',
      hasModel: false,
      isSimulation: true,
      names: { 0: 'No cap', 1: 'cap' },
    };
  }
}

