#!/usr/bin/env python3
import sys
import json
import os
import cv2
from ultralytics import YOLO

model = YOLO('vehicle_type.pt', verbose=False)

def detect_vehicle_type(image_path):
    if not os.path.exists(image_path):
        print(json.dumps({'error': 'File not found', 'vehicle_type': 'unknown', 'confidence': 0}))
        return
    if os.path.getsize(image_path) == 0:
        print(json.dumps({'error': 'File empty', 'vehicle_type': 'unknown', 'confidence': 0}))
        return

    img = cv2.imread(image_path)
    if img is None:
        print(json.dumps({'error': 'Could not read image', 'vehicle_type': 'unknown', 'confidence': 0}))
        return

    results = model(image_path, conf=0.3, iou=0.45, verbose=False)
    if len(results[0].boxes) == 0:
        print(json.dumps({'vehicle_type': 'unknown', 'confidence': 0}))
        return

    best = max(results[0].boxes, key=lambda box: box.conf[0])
    cls = int(best.cls[0])
    conf = float(best.conf[0])
    name = model.names[cls]

    # Map to standard names
    mapping = {
        'car': 'car',
        'Motor cycle': 'motorcycle',
        'Auto': 'auto',
        'Bus': 'bus',
        'Truck': 'truck'
    }
    vehicle = mapping.get(name, name.lower())
    print(json.dumps({'vehicle_type': vehicle, 'confidence': round(conf, 3)}))

if __name__ == '__main__':
    if len(sys.argv) > 1:
        detect_vehicle_type(sys.argv[1])
    else:
        print(json.dumps({'error': 'No image path', 'vehicle_type': 'unknown', 'confidence': 0}))