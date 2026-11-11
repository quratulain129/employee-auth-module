import * as detector from '../services/capDetector.js';

export async function getStatus(req, res) {
  const status = await detector.getDetectorStatus();
  res.json({
    tool: 'cap_detection',
    title: 'Cap Detection (OpenVINO / YOLO)',
    ...status,
  });
}

export async function detect(req, res) {
  const { image, conf } = req.body || {};

  if (!image || typeof image !== 'string') {
    return res.status(400).json({ ok: false, error: 'image (base64 string or data URL) is required.' });
  }

  const result = await detector.detectCap({
    image,
    conf: typeof conf === 'number' ? conf : 0.4,
  });

  return res.json(result);
}

