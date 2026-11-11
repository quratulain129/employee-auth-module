import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Alert, Spinner } from '../components/Feedback.jsx';

export default function CapDetectionPage() {
  const { markExpired } = useAuth();
  const navigate = useNavigate();

  // Mode: 'webcam' or 'upload'
  const [mode, setMode] = useState('webcam');
  const [modelStatus, setModelStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState(null);

  // Confidence threshold
  const [confidence, setConfidence] = useState(0.4);

  // Camera Inversion / Mirror mode (default to true for natural selfie camera view)
  const [isMirrored, setIsMirrored] = useState(true);
  const isMirroredRef = useRef(true);

  // Webcam state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [fps, setFps] = useState(0);
  const [inferenceTime, setInferenceTime] = useState(0);
  const [liveCounts, setLiveCounts] = useState({ cap: 0, noCap: 0 });

  // Refs for webcam
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const grabCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isRunningRef = useRef(false);
  const isBusyRef = useRef(false);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());

  // Image Upload state
  const [uploadedImageSrc, setUploadedImageSrc] = useState(null);
  const [uploadDetections, setUploadDetections] = useState([]);
  const [isDetectingUpload, setIsDetectingUpload] = useState(false);
  const [uploadCounts, setUploadCounts] = useState({ cap: 0, noCap: 0 });
  const uploadCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Helper for protected calls
  async function authCall(path, options) {
    const res = await apiFetch(path, options);
    if (res.status === 401) {
      markExpired();
      navigate('/login');
    }
    return res;
  }

  // Load model status on mount
  useEffect(() => {
    let alive = true;
    authCall('/api/tools/cap-detection/status')
      .then((res) => {
        if (!alive) return;
        setStatusLoading(false);
        if (res.ok) {
          setModelStatus(res.data);
        } else if (res.status !== 401) {
          setError('Could not verify model status.');
        }
      })
      .catch(() => {
        if (alive) {
          setStatusLoading(false);
          setError('Cannot connect to backend tool server.');
        }
      });

    return () => {
      alive = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- Webcam Handlers ----------------
  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);
      isRunningRef.current = true;
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = Date.now();

      runWebcamLoop();
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Camera access was denied or is not available. Please allow camera permissions in your browser.');
      setIsCameraActive(false);
    }
  }

  function stopCamera() {
    isRunningRef.current = false;
    setIsCameraActive(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setLiveCounts({ cap: 0, noCap: 0 });
    setFps(0);
  }

  function runWebcamLoop() {
    let latestBoxes = [];
    let latestNames = { 0: 'No cap', 1: 'cap' };

    async function sendFrame() {
      if (isBusyRef.current || !isRunningRef.current || !videoRef.current || !grabCanvasRef.current) return;
      if (videoRef.current.readyState < 2) return;

      isBusyRef.current = true;
      try {
        const grab = grabCanvasRef.current;
        const gctx = grab.getContext('2d');
        gctx.save();
        if (isMirroredRef.current) {
          gctx.translate(grab.width, 0);
          gctx.scale(-1, 1);
        }
        gctx.drawImage(videoRef.current, 0, 0, grab.width, grab.height);
        gctx.restore();

        const dataUrl = grab.toDataURL('image/jpeg', 0.65);

        const res = await authCall('/api/tools/cap-detection/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl, conf: confidence }),
        });

        if (res.ok && res.data) {
          latestBoxes = res.data.boxes || [];
          if (res.data.names) latestNames = res.data.names;
          if (res.data.inferenceMs) setInferenceTime(res.data.inferenceMs);

          // Update count
          let cap = 0;
          let noCap = 0;
          for (const box of latestBoxes) {
            const cls = box[4];
            if (cls === 1) cap++;
            else noCap++;
          }
          setLiveCounts({ cap, noCap });
        }
      } catch (err) {
        // Ignored frame error to keep stream smooth
      } finally {
        isBusyRef.current = false;
      }
    }

    function renderLoop() {
      if (!isRunningRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        // Draw camera frame (with mirror/inversion if enabled)
        ctx.save();
        if (isMirroredRef.current) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, w, h);
        ctx.restore();

        // Draw detection bounding boxes
        ctx.lineWidth = 3;
        ctx.font = 'bold 16px -apple-system, sans-serif';

        for (const [x1, y1, x2, y2, c, p] of latestBoxes) {
          const isCap = c === 1;
          const color = isCap ? '#00c800' : '#ff2222';
          const label = `${latestNames[c] || (isCap ? 'cap' : 'No cap')} ${(p * 100).toFixed(0)}%`;

          // Bounding box
          ctx.strokeStyle = color;
          ctx.fillStyle = isCap ? 'rgba(0, 200, 0, 0.12)' : 'rgba(255, 34, 34, 0.12)';
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
          ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

          // Label background pill
          const textWidth = ctx.measureText(label).width;
          const badgeY = Math.max(y1 - 24, 0);
          ctx.fillStyle = color;
          ctx.fillRect(x1, badgeY, textWidth + 12, 22);

          // Label text
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, x1 + 6, badgeY + 16);
        }

        // FPS tracking
        frameCountRef.current++;
        const now = Date.now();
        if (now - lastFpsUpdateRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastFpsUpdateRef.current = now;
        }

        // Query backend for next detection
        sendFrame();
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    }

    renderLoop();
  }

  // ---------------- Image Upload Handlers ----------------
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  }

  function processImageFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl === 'string') {
        setUploadedImageSrc(dataUrl);
        runImageDetection(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  }

  async function runImageDetection(dataUrl) {
    setIsDetectingUpload(true);
    setUploadDetections([]);
    try {
      const res = await authCall('/api/tools/cap-detection/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, conf: confidence }),
      });

      if (res.ok && res.data) {
        const boxes = res.data.boxes || [];
        const names = res.data.names || { 0: 'No cap', 1: 'cap' };

        const parsed = boxes.map(([x1, y1, x2, y2, c, p]) => ({
          x1,
          y1,
          x2,
          y2,
          classId: c,
          className: names[c] || (c === 1 ? 'cap' : 'No cap'),
          confidence: p,
        }));

        setUploadDetections(parsed);

        let cap = 0;
        let noCap = 0;
        for (const item of parsed) {
          if (item.classId === 1) cap++;
          else noCap++;
        }
        setUploadCounts({ cap, noCap });

        drawUploadBoxes(dataUrl, boxes, names);
      }
    } catch (err) {
      console.error('Detection error:', err);
    } finally {
      setIsDetectingUpload(false);
    }
  }

  function drawUploadBoxes(dataUrl, boxes, names) {
    const img = new Image();
    img.onload = () => {
      const canvas = uploadCanvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, 0, 0);

      const scale = Math.max(1, img.naturalWidth / 640);
      ctx.lineWidth = Math.max(2, 3 * scale);
      ctx.font = `bold ${Math.round(16 * scale)}px -apple-system, sans-serif`;

      for (const [x1, y1, x2, y2, c, p] of boxes) {
        const isCap = c === 1;
        const color = isCap ? '#00c800' : '#ff2222';
        const label = `${names[c] || (isCap ? 'cap' : 'No cap')} ${(p * 100).toFixed(0)}%`;

        ctx.strokeStyle = color;
        ctx.fillStyle = isCap ? 'rgba(0, 200, 0, 0.12)' : 'rgba(255, 34, 34, 0.12)';
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

        const textWidth = ctx.measureText(label).width;
        const badgeY = Math.max(y1 - 26 * scale, 0);
        ctx.fillStyle = color;
        ctx.fillRect(x1, badgeY, textWidth + (14 * scale), 24 * scale);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, x1 + (6 * scale), badgeY + (18 * scale));
      }
    };
    img.src = dataUrl;
  }

  function loadSampleImage() {
    // Generate a simple test portrait on a canvas to test detection without an external file
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 640;
    sampleCanvas.height = 480;
    const ctx = sampleCanvas.getContext('2d');

    // Background
    ctx.fillStyle = '#22323d';
    ctx.fillRect(0, 0, 640, 480);

    // Shoulders
    ctx.fillStyle = '#3a5061';
    ctx.beginPath();
    ctx.ellipse(320, 450, 180, 110, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head / Face
    ctx.fillStyle = '#dcb295';
    ctx.beginPath();
    ctx.ellipse(320, 260, 95, 125, 0, 0, Math.PI * 2);
    ctx.fill();

    // Baseball Cap (Crown & Visor)
    ctx.fillStyle = '#0f6b73';
    ctx.beginPath();
    ctx.ellipse(320, 180, 100, 65, 0, Math.PI, 0, false);
    ctx.fill();

    // Cap visor / brim
    ctx.fillStyle = '#0b545a';
    ctx.beginPath();
    ctx.ellipse(340, 205, 115, 20, 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Text note
    ctx.fillStyle = '#bcd3d6';
    ctx.font = '16px -apple-system, sans-serif';
    ctx.fillText('Sample Test Portrait (Wearing Cap)', 20, 40);

    const dataUrl = sampleCanvas.toDataURL('image/jpeg', 0.9);
    setUploadedImageSrc(dataUrl);
    runImageDetection(dataUrl);
  }

  if (statusLoading) return <Spinner label="Loading Cap Detection Tool…" />;
  if (error) return <Alert kind="error" title="Tool Error">{error}</Alert>;

  const hasModel = modelStatus?.hasModel;
  const isSimulation = modelStatus?.isSimulation;

  return (
    <div className="tool-container">
      {/* Tool Header Card */}
      <section className="card tool-head">
        <div className="tool-title-row">
          <div>
            <div className="tool-badge-row">
              <span className="badge badge-tool">AI Computer Vision</span>
              {hasModel ? (
                <span className="badge badge-success">✓ OpenVINO / YOLO Ready</span>
              ) : (
                <span className="badge badge-warning">⚡ Simulation / Demo Mode</span>
              )}
            </div>
            <h1>Cap Detection Tool</h1>
            <p className="muted">
              Computer vision compliance model to verify whether employees or visitors are wearing safety/company caps.
            </p>
          </div>
          <button className="btn btn-quiet-dark" onClick={() => navigate('/profile')}>
            ← Back to Profile
          </button>
        </div>



        {/* Tab Controls */}
        <div className="tool-tabs">
          <button
            className={`tool-tab ${mode === 'webcam' ? 'active' : ''}`}
            onClick={() => {
              if (mode !== 'webcam') {
                setMode('webcam');
              }
            }}
          >
            📹 Live Webcam Detection
          </button>
          <button
            className={`tool-tab ${mode === 'upload' ? 'active' : ''}`}
            onClick={() => {
              if (mode !== 'upload') {
                stopCamera();
                setMode('upload');
              }
            }}
          >
            🖼️ Upload Image / Photo
          </button>
        </div>
      </section>

      {/* Main Content Area */}
      {mode === 'webcam' ? (
        <section className="card tool-body">
          <div className="control-bar">
            <div className="action-buttons">
              {!isCameraActive ? (
                <button className="btn btn-primary" onClick={startCamera}>
                  ▶ Start Camera
                </button>
              ) : (
                <button className="btn btn-danger" onClick={stopCamera}>
                  ⏹ Stop Camera
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setIsMirrored((m) => {
                    isMirroredRef.current = !m;
                    return !m;
                  });
                }}
                title="Invert / Mirror camera horizontally"
              >
                {isMirrored ? '🪞 Mirrored: ON' : '🪞 Mirrored: OFF'}
              </button>
            </div>

            <div className="slider-control">
              <label htmlFor="conf-slider">
                Confidence Threshold: <strong>{Math.round(confidence * 100)}%</strong>
              </label>
              <input
                id="conf-slider"
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={confidence}
                onChange={(e) => setConfidence(Number.parseFloat(e.target.value))}
              />
            </div>

            <div className="stats-badges">
              <span className={`pill-badge ${liveCounts.cap > 0 ? 'pill-cap' : ''}`}>
                🧢 Cap: {liveCounts.cap}
              </span>
              <span className={`pill-badge ${liveCounts.noCap > 0 ? 'pill-nocap' : ''}`}>
                👤 No cap: {liveCounts.noCap}
              </span>
              {isCameraActive && (
                <span className="pill-badge pill-info">
                  {fps} FPS {inferenceTime > 0 ? `(${inferenceTime}ms)` : ''}
                </span>
              )}
            </div>
          </div>

          {cameraError && <Alert kind="error">{cameraError}</Alert>}

          <div className="webcam-viewport">
            <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
            <canvas ref={grabCanvasRef} width={640} height={480} style={{ display: 'none' }} />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className={`stream-canvas ${isCameraActive ? 'active' : 'idle'}`}
            />
            {!isCameraActive && (
              <div className="viewport-placeholder">
                <div className="placeholder-icon">📷</div>
                <p>Camera is currently turned off.</p>
                <button className="btn btn-primary" onClick={startCamera}>
                  Enable Camera to Begin Detection
                </button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="card tool-body">
          <div className="control-bar">
            <div className="action-buttons">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
                📁 Choose Image File
              </button>
              <button className="btn btn-secondary" onClick={loadSampleImage}>
                ✨ Try Sample Image
              </button>
            </div>

            <div className="slider-control">
              <label htmlFor="upload-conf-slider">
                Confidence Threshold: <strong>{Math.round(confidence * 100)}%</strong>
              </label>
              <input
                id="upload-conf-slider"
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={confidence}
                onChange={(e) => {
                  const val = Number.parseFloat(e.target.value);
                  setConfidence(val);
                  if (uploadedImageSrc) {
                    runImageDetection(uploadedImageSrc);
                  }
                }}
              />
            </div>

            {uploadedImageSrc && (
              <div className="stats-badges">
                <span className={`pill-badge ${uploadCounts.cap > 0 ? 'pill-cap' : ''}`}>
                  🧢 Cap: {uploadCounts.cap}
                </span>
                <span className={`pill-badge ${uploadCounts.noCap > 0 ? 'pill-nocap' : ''}`}>
                  👤 No cap: {uploadCounts.noCap}
                </span>
              </div>
            )}
          </div>

          <div className="upload-viewport">
            {uploadedImageSrc ? (
              <div className="canvas-wrapper">
                {isDetectingUpload && (
                  <div className="detect-overlay">
                    <Spinner label="Running object detection model…" />
                  </div>
                )}
                <canvas ref={uploadCanvasRef} className="upload-result-canvas" />
              </div>
            ) : (
              <div
                className="dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) processImageFile(file);
                }}
              >
                <div className="placeholder-icon">📤</div>
                <h3>Drag & drop an image here, or click to browse</h3>
                <p className="muted">Supports JPG and PNG formats</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadSampleImage();
                  }}
                  style={{ marginTop: '0.8rem' }}
                >
                  Or click here to load a sample portrait
                </button>
              </div>
            )}
          </div>

          {uploadDetections.length > 0 && (
            <div className="detections-table-card">
              <h3>Detections Summary ({uploadDetections.length})</h3>
              <table className="detections-table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Confidence</th>
                    <th>Bounding Box (x1, y1, x2, y2)</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadDetections.map((d, i) => (
                    <tr key={i}>
                      <td>
                        <span className={`badge ${d.classId === 1 ? 'badge-cap' : 'badge-nocap'}`}>
                          {d.classId === 1 ? '🧢 cap' : '👤 No cap'}
                        </span>
                      </td>
                      <td>{(d.confidence * 100).toFixed(1)}%</td>
                      <td>
                        [{Math.round(d.x1)}, {Math.round(d.y1)}, {Math.round(d.x2)}, {Math.round(d.y2)}]
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

