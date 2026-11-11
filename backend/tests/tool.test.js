import test from 'node:test';
import assert from 'node:assert/strict';
import { getDetectorStatus, detectCap, stopDetector } from '../src/services/capDetector.js';

test.after(() => {
  stopDetector();
});

test.before(async () => {
  // First call starts Python and loads the model, which can take more than 4 s
  await getDetectorStatus(30000);
});

test('tool: cap detector status reports engine information', async () => {
  const status = await getDetectorStatus();
  assert.equal(status.ok, true);
  assert.ok(status.engine);
  assert.equal(typeof status.isSimulation, 'boolean');
  assert.equal(status.names[0], 'No cap');
  assert.equal(status.names[1], 'cap');
});

test('tool: detectCap handles invalid input gracefully', async () => {
  const result = await detectCap({ image: '' });
  assert.equal(result.ok, false);
});

test('tool: detectCap processes valid base64 image without errors', async () => {
  // 1x1 transparent png
  const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const result = await detectCap({ image: dummyBase64, conf: 0.4 });
  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.boxes));
  assert.equal(result.names[0], 'No cap');
  assert.equal(result.names[1], 'cap');
});

