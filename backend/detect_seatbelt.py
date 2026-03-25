#!/usr/bin/env python3
import sys
import json
import os
import cv2
from ultralytics import YOLO

def detect_seatbelt(image_path):
    # File checks
    if not os.path.exists(image_path):
        print(json.dumps({'error': f'File not found: {image_path}', 'seatbelt_worn': None, 'confidence': 0}))
        return
    if os.path.getsize(image_path) == 0:
        print(json.dumps({'error': f'File is empty: {image_path}', 'seatbelt_worn': None, 'confidence': 0}))
        return

    img = cv2.imread(image_path)
    if img is None:
        print(json.dumps({'error': f'Could not read image: {image_path}', 'seatbelt_worn': None, 'confidence': 0}))
        return
    print(f"DEBUG: Image read, shape: {img.shape}", file=sys.stderr)

    # Load model
    try:
        model = YOLO('seatbelt_model.pt', verbose=False)
        print("DEBUG: Model loaded successfully", file=sys.stderr)
    except Exception as e:
        print(json.dumps({'error': f'Failed to load model: {e}', 'seatbelt_worn': None, 'confidence': 0}))
        return

    # Very low threshold for debugging
    results = model(image_path, conf=0.1, iou=0.45, verbose=False)
    print(f"DEBUG: Number of detections: {len(results[0].boxes)}", file=sys.stderr)

    # Print all detections
    for box in results[0].boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        print(f"DEBUG: Detection class {cls} with confidence {conf:.3f}", file=sys.stderr)

    if len(results[0].boxes) == 0:
        print(json.dumps({'seatbelt_worn': None, 'confidence': 0}))
        return

    # Use the highest confidence detection
    best = max(results[0].boxes, key=lambda box: box.conf[0])
    cls = int(best.cls[0])
    conf = float(best.conf[0])
    worn = (cls == 1)   # class 1 = seatbelt, class 0 = no_seatbelt
    print(json.dumps({'seatbelt_worn': worn, 'confidence': round(conf, 3)}))

if __name__ == '__main__':
    if len(sys.argv) > 1:
        detect_seatbelt(sys.argv[1])
    else:
        print(json.dumps({'error': 'No image path provided', 'seatbelt_worn': None, 'confidence': 0}))