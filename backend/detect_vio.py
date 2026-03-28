#!/usr/bin/env python3
import sys
import json
import os
import cv2
from ultralytics import YOLO

def detect_vtype(image_path):
    # File checks
    if not os.path.exists(image_path):
        print(json.dumps({'error': 'File not found', 'class': 'unknown', 'confidence': 0}))
        return
    if os.path.getsize(image_path) == 0:
        print(json.dumps({'error': 'File empty', 'class': 'unknown', 'confidence': 0}))
        return

    img = cv2.imread(image_path)
    if img is None:
        print(json.dumps({'error': 'Could not read image', 'class': 'unknown', 'confidence': 0}))
        return

    # Load model
    try:
        model = YOLO('detect_vtype.pt', verbose=False)
    except Exception as e:
        print(json.dumps({'error': f'Model load error: {e}', 'class': 'unknown', 'confidence': 0}))
        return

    # Run inference
    results = model(image_path, verbose=False)

    # Determine if it's classification or detection
    if hasattr(results[0], 'probs') and results[0].probs is not None:
        # Classification model
        probs = results[0].probs
        top1 = probs.top1
        conf = probs.top1conf
        class_name = model.names[top1] if top1 in model.names else 'unknown'
        print(json.dumps({'class': class_name, 'confidence': round(float(conf), 3)}))
        return
    else:
        # Detection model: assume classes are traffic and environmental
        # Count detections per class and take class with highest confidence
        class_counts = {}
        best_conf = 0
        best_class = 'unknown'
        for r in results:
            boxes = r.boxes
            if boxes is None:
                continue
            for box in boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                name = model.names[cls] if cls in model.names else 'unknown'
                class_counts[name] = class_counts.get(name, 0) + 1
                if conf > best_conf:
                    best_conf = conf
                    best_class = name
        if class_counts:
            # If only one class, return that
            if len(class_counts) == 1:
                best_class = list(class_counts.keys())[0]
            # Otherwise, take class with highest confidence (already set)
            print(json.dumps({'class': best_class, 'confidence': round(best_conf, 3)}))
        else:
            print(json.dumps({'class': 'unknown', 'confidence': 0}))
        return

if __name__ == '__main__':
    if len(sys.argv) > 1:
        detect_vtype(sys.argv[1])
    else:
        print(json.dumps({'error': 'No image path', 'class': 'unknown', 'confidence': 0}))