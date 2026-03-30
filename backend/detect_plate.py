#!/usr/bin/env python3
import sys
import json
import cv2
from ultralytics import YOLO
import logging

logging.getLogger('ultralytics').setLevel(logging.ERROR)

plate_model = YOLO('number_plate.pt', verbose=False)

def is_valid_plate_bbox(x1, y1, x2, y2, img_width, img_height):
    w = x2 - x1
    h = y2 - y1
    if w <= 0 or h <= 0:
        return False
    area = w * h
    img_area = img_width * img_height
    aspect = w / h
    if aspect < 1.5 or aspect > 6.0:
        return False
    if area < 200 or area > 0.2 * img_area:
        return False
    return True

def detect_number_plate(image_path, debug=False):
    try:
        img = cv2.imread(image_path)
        if img is None:
            print(json.dumps({'success': False, 'error': 'Could not read image'}))
            return

        h_img, w_img = img.shape[:2]
        best_raw = None
        best_conf = 0

        # Try multiple confidence thresholds
        for conf in [0.2, 0.15, 0.1, 0.05]:
            results = plate_model(image_path, conf=conf, iou=0.45, verbose=False)
            if len(results[0].boxes) == 0:
                continue
            # Keep best raw box
            for box in results[0].boxes:
                bc = float(box.conf[0])
                if bc > best_conf:
                    best_conf = bc
                    best_raw = box
            # Filter boxes
            valid_boxes = []
            for box in results[0].boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                if is_valid_plate_bbox(x1, y1, x2, y2, w_img, h_img):
                    valid_boxes.append(box)
            if valid_boxes:
                results[0].boxes = valid_boxes
                if debug:
                    print(f"Plate detected with conf={conf} (filtered)", file=sys.stderr)
                break
        else:
            if best_raw is not None:
                results = plate_model(image_path, conf=best_conf, iou=0.45, verbose=False)
                if debug:
                    print(f"Using raw detection (confidence {best_conf:.2f})", file=sys.stderr)
            else:
                results = None

        if results is None or len(results[0].boxes) == 0:
            print(json.dumps({'success': True, 'plates_found': 0, 'plates': []}))
            return

        plates = []
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                conf = float(box.conf[0])

                # Expand crop slightly (15%)
                pad_x = int((x2 - x1) * 0.15)
                pad_y = int((y2 - y1) * 0.15)
                x1 = max(0, x1 - pad_x)
                y1 = max(0, y1 - pad_y)
                x2 = min(w_img, x2 + pad_x)
                y2 = min(h_img, y2 + pad_y)

                plates.append({
                    'detection_confidence': round(conf, 3),
                    'bbox': [x1, y1, x2, y2]
                })

        result = {'success': True, 'plates_found': len(plates), 'plates': plates}
        print(json.dumps(result))
        return result

    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == '__main__':
    if len(sys.argv) > 1:
        debug = len(sys.argv) > 2 and sys.argv[2].lower() == 'debug'
        detect_number_plate(sys.argv[1], debug=debug)
    else:
        print(json.dumps({'success': False, 'error': 'No image path'}))