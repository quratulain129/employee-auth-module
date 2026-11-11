#!/usr/bin/env python3
"""
Cap Detection Inference Service (OpenVINO / YOLO / OpenCV Fallback)
Matches the object detection model architecture from Object_Detection_OpenVINO.ipynb.
Classes: 0 = 'No cap', 1 = 'cap'
"""

import sys
import os
import json
import time
from base64 import b64decode
import numpy as np
import cv2

CLASS_NAMES = {0: "No cap", 1: "cap"}

def find_model_path():
    """Look for trained weights in backend/models."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(script_dir, "..", "models")
    
    candidates = [
        os.path.join(models_dir, "best.pt"),
        os.path.join(models_dir, "best_openvino_model"),
        os.path.join(models_dir, "best.onnx"),
        os.path.join(models_dir, "cap_yolo26n_e30-5", "weights", "best.pt"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return None

def load_detector():
    """Initialize YOLO/OpenVINO model if present, otherwise computer vision fallback."""
    model_path = find_model_path()
    model = None
    engine = "opencv_fallback"
    
    if model_path:
        try:
            old_stdout = sys.stdout
            sys.stdout = sys.stderr
            try:
                from ultralytics import YOLO
                model = YOLO(model_path, task="detect")
                engine = "openvino" if "openvino" in model_path.lower() else "yolo"
                # Warm up model once so initialization messages don't pollute stdout
                dummy = np.zeros((640, 640, 3), dtype=np.uint8)
                model.predict(dummy, imgsz=640, verbose=False)
            finally:
                sys.stdout = old_stdout
            sys.stderr.write(f"[detector] Loaded model from {model_path} (engine: {engine})\n")
        except Exception as e:
            sys.stderr.write(f"[detector] Could not load model: {e}\n")
            model = None

    face_cascade = None
    if hasattr(cv2, "CascadeClassifier") and hasattr(cv2, "data"):
        try:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            if os.path.exists(cascade_path):
                face_cascade = cv2.CascadeClassifier(cascade_path)
        except Exception:
            face_cascade = None

    return {
        "model": model,
        "model_path": model_path,
        "engine": engine,
        "cascade": face_cascade,
    }

def decode_image(data_url_or_b64):
    """Convert base64 string or data URL to OpenCV BGR image."""
    if "," in data_url_or_b64:
        data_url_or_b64 = data_url_or_b64.split(",", 1)[1]
    raw = b64decode(data_url_or_b64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)

def run_inference(detector_ctx, img, conf_threshold=0.4):
    """Run model inference on the image and return detected bounding boxes."""
    start_t = time.perf_counter()
    model = detector_ctx["model"]
    
    # 1. Custom YOLO / OpenVINO model inference (if weights placed in backend/models)
    if model is not None:
        old_stdout = sys.stdout
        sys.stdout = sys.stderr
        try:
            r = model.predict(img, imgsz=640, conf=conf_threshold, verbose=False)[0]
        finally:
            sys.stdout = old_stdout
        boxes = [
            [float(xyxy[0]), float(xyxy[1]), float(xyxy[2]), float(xyxy[3]), int(c), round(float(p), 3)]
            for xyxy, c, p in zip(r.boxes.xyxy.tolist(), r.boxes.cls.tolist(), r.boxes.conf.tolist())
        ]
        names = {int(k): v for k, v in r.names.items()} if hasattr(r, 'names') and r.names else CLASS_NAMES
        elapsed = (time.perf_counter() - start_t) * 1000
        return {
            "ok": True,
            "boxes": boxes,
            "names": names,
            "isSimulation": False,
            "engine": detector_ctx["engine"],
            "inferenceMs": round(elapsed, 1),
            "modelPath": detector_ctx["model_path"]
        }

    # 2. Computer Vision Fallback (Face & Head Detection via Color/Contour Analysis)
    h, w = img.shape[:2]
    boxes = []

    # First, try Haar cascade if available in OpenCV build
    cascade = detector_ctx.get("cascade")
    if cascade is not None:
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(60, 60))
            for (fx, fy, fw, fh) in faces:
                x1 = max(0, int(fx - fw * 0.05))
                x2 = min(w, int(fx + fw * 1.05))
                y1 = max(0, int(fy - fh * 0.45))
                y2 = min(h, int(fy + fh * 1.05))
                crown_strip = img[max(0, y1):max(0, y1 + int(fh * 0.4)), x1:x2]
                is_cap = False
                if crown_strip.size > 0:
                    hsv = cv2.cvtColor(crown_strip, cv2.COLOR_BGR2HSV)
                    is_cap = np.mean(hsv[:, :, 1]) > 45 or np.std(crown_strip) < 32
                cls_id = 1 if is_cap else 0
                conf = 0.88 if is_cap else 0.82
                boxes.append([float(x1), float(y1), float(x2), float(y2), cls_id, conf])
        except Exception:
            pass

    # If no cascade was found or cascade didn't detect, use robust YCrCb skin & head contour detection
    if not boxes and img.size > 0:
        try:
            ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
            mask = cv2.inRange(ycrcb, np.array([0, 133, 77]), np.array([255, 173, 127]))
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
            mask = cv2.morphologyEx(mask, cv2.MORPH_DILATE, kernel, iterations=2)
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            min_face_area = int((w * h) * 0.012)
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area >= min_face_area:
                    x, y, fw, fh = cv2.boundingRect(cnt)
                    aspect = fh / float(fw)
                    if 0.65 <= aspect <= 2.4:
                        x1 = max(0, int(x - fw * 0.1))
                        x2 = min(w, int(x + fw * 1.1))
                        y1 = max(0, int(y - fh * 0.45))
                        y2 = min(h, int(y + fh * 1.05))

                        crown_strip = img[max(0, y1):max(0, y1 + int(fh * 0.4)), x1:x2]
                        is_cap = False
                        if crown_strip.size > 0:
                            hsv_crown = cv2.cvtColor(crown_strip, cv2.COLOR_BGR2HSV)
                            sat_mean = np.mean(hsv_crown[:, :, 1])
                            std_val = np.std(crown_strip)
                            is_cap = sat_mean > 45 or std_val < 32

                        cls_id = 1 if is_cap else 0
                        conf = min(0.95, max(conf_threshold, round(0.78 + (0.15 if is_cap else 0.08), 2)))
                        if conf >= conf_threshold:
                            boxes.append([float(x1), float(y1), float(x2), float(y2), int(cls_id), float(conf)])
        except Exception as e:
            sys.stderr.write(f"[detector] Fallback error: {e}\n")

    elapsed = (time.perf_counter() - start_t) * 1000
    return {
        "ok": True,
        "boxes": boxes,
        "names": CLASS_NAMES,
        "isSimulation": True,
        "engine": "opencv_fallback",
        "message": "Running with OpenCV face/head fallback. Place best.pt or best_openvino_model in backend/models to use your custom trained YOLO model.",
        "inferenceMs": round(elapsed, 1),
    }

def main():
    detector_ctx = load_detector()
    sys.stderr.write(f"[detector] Engine ready: {detector_ctx['engine']}\n")
    sys.stderr.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            action = req.get("action", "detect")
            
            if action == "status":
                status = {
                    "ok": True,
                    "engine": detector_ctx["engine"],
                    "modelPath": detector_ctx["model_path"],
                    "hasModel": detector_ctx["model"] is not None,
                    "isSimulation": detector_ctx["model"] is None,
                    "names": CLASS_NAMES,
                }
                print(json.dumps(status), flush=True)
                continue

            image_data = req.get("image")
            conf = float(req.get("conf", 0.4))

            if not image_data:
                print(json.dumps({"ok": False, "error": "No image provided", "boxes": []}), flush=True)
                continue

            img = decode_image(image_data)
            if img is None or img.size == 0:
                print(json.dumps({"ok": False, "error": "Could not decode image", "boxes": []}), flush=True)
                continue

            result = run_inference(detector_ctx, img, conf_threshold=conf)
            print(json.dumps(result), flush=True)

        except Exception as e:
            err_res = {"ok": False, "error": str(e), "boxes": []}
            print(json.dumps(err_res), flush=True)
            sys.stderr.write(f"[detector] Error processing request: {e}\n")
            sys.stderr.flush()

if __name__ == "__main__":
    main()
