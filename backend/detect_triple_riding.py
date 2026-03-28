#!/usr/bin/env python3
import sys
import json
import os
import cv2
from ultralytics import YOLO

model = YOLO('triple_model.pt', verbose=False)

def detect_triple_riding(image_path):
    if not os.path.exists(image_path):
        print(json.dumps({'error': 'File not found', 'triple_count': 0, 'confidence': 0}))
        return
    if os.path.getsize(image_path) == 0:
        print(json.dumps({'error': 'File empty', 'triple_count': 0, 'confidence': 0}))
        return

    img = cv2.imread(image_path)
    if img is None:
        print(json.dumps({'error': 'Could not read image', 'triple_count': 0, 'confidence': 0}))
        return

    results = model(image_path, conf=0.3, iou=0.45, verbose=False)
    if len(results[0].boxes) == 0:
        print(json.dumps({'triple_count': 0, 'confidence': 0}))
        return

    triple_count = 0
    best_conf = 0
    for box in results[0].boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        name = model.names[cls]
        if 'triple' in name.lower() or 'more-than-2-person' in name.lower():
            triple_count += 1
            if conf > best_conf:
                best_conf = conf

    print(json.dumps({'triple_count': triple_count, 'confidence': round(best_conf, 3)}))

if __name__ == '__main__':
    if len(sys.argv) > 1:
        detect_triple_riding(sys.argv[1])
    else:
        print(json.dumps({'error': 'No image path', 'triple_count': 0, 'confidence': 0}))