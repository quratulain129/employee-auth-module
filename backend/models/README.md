# Object Detection Models Directory

Place your custom trained YOLO / OpenVINO weights in this directory.

Supported formats (checked automatically by `backend/scripts/detect.py` in order):
1. `best_openvino_model/` (OpenVINO IR directory containing `metadata.yaml`, `*.xml`, `*.bin`)
2. `best.pt` (PyTorch YOLOv8/YOLO11 weights from training)
3. `best.onnx` (ONNX exported model)
4. `cap_yolo26n_e30-5/weights/best.pt` (Colab output path from `Object_Detection_OpenVINO.ipynb`)

Class mapping (from notebook):
- Class 0: `No cap`
- Class 1: `cap`

When no model file is present, the service runs in OpenCV fallback mode so that the auth module and tool remain functional for demonstration and testing.

