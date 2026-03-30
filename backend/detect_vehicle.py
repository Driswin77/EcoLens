#!/usr/bin/env python3
import sys
import json
import os
import cv2
from ultralytics import YOLO

model = YOLO('vehicle_type.pt', verbose=False)

def detect_vehicle(image_path):
    if not os.path.exists(image_path):
        print(json.dumps({'error': 'File not found', 'detections': []}))
        return
    if os.path.getsize(image_path) == 0:
        print(json.dumps({'error': 'File empty', 'detections': []}))
        return

    img = cv2.imread(image_path)
    if img is None:
        print(json.dumps({'error': 'Could not read image', 'detections': []}))
        return

    results = model(image_path, conf=0.3, iou=0.45, verbose=False)
    detections = []
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            conf = float(box.conf[0])
            cls = int(box.cls[0])
            name = model.names[cls]

            # Map to standard names (already correct for our model)
            # But we keep a mapping for clarity and future expansion.
            mapping = {
                'auto': 'auto',
                'bus': 'bus',
                'car': 'car',
                'motorcycle': 'motorcycle'
            }
            vehicle = mapping.get(name, name.lower())
            detections.append({'vehicle_type': vehicle, 'confidence': round(conf, 3), 'bbox': [x1, y1, x2, y2]})

    print(json.dumps({'detections': detections}))

if __name__ == '__main__':
    if len(sys.argv) > 1:
        detect_vehicle(sys.argv[1])
    else:
        print(json.dumps({'error': 'No image path', 'detections': []}))