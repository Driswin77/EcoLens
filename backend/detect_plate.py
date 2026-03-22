#!/usr/bin/env python3
import sys
import json
import cv2
import numpy as np
from ultralytics import YOLO
import easyocr
import pytesseract
import re
import logging

logging.getLogger('ultralytics').setLevel(logging.ERROR)

# Set Tesseract path (adjust if yours is different)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Initialize EasyOCR (English only)
reader = easyocr.Reader(['en'], gpu=False, verbose=False)

# Load YOLO model
model = YOLO('number_plate.pt', verbose=False)

def preprocess(plate_img):
    """Convert to grayscale, enlarge, and apply Otsu threshold."""
    gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
    # Resize to a standard width (e.g., 500px) for better OCR
    h, w = gray.shape
    if w < 500:
        scale = 500 / w
        new_h = int(h * scale)
        gray = cv2.resize(gray, (500, new_h), interpolation=cv2.INTER_CUBIC)
    # Otsu threshold
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Ensure text is black on white
    if np.mean(thresh) > 127:
        thresh = cv2.bitwise_not(thresh)
    return thresh

def clean_plate_text(text):
    """Keep only alphanumeric, uppercase, and remove common false positives."""
    text = re.sub(r'[^A-Z0-9]', '', text.upper())
    # Remove isolated 'IND' (often the country code)
    text = re.sub(r'\bIND\b', '', text)
    # Remove extra spaces
    text = ' '.join(text.split())
    return text

def score_candidate(text):
    """Score a candidate based on how well it matches Indian plate pattern."""
    # Perfect: 2 letters + 2 digits + 2 letters + 4 digits (e.g., KL02BM4659)
    if re.match(r'^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$', text):
        return 100
    # Good: 2 letters + 2 digits + 1-2 letters + 1-4 digits (any length)
    if re.match(r'^[A-Z]{2}\d{2}[A-Z]{1,2}\d{1,4}$', text):
        return 80
    # Acceptable: any alphanumeric of length 8-12
    if 8 <= len(text) <= 12 and text.isalnum():
        return 50
    return 0

def detect_number_plate(image_path, debug=False):
    try:
        img = cv2.imread(image_path)
        if img is None:
            print(json.dumps({"success": False, "error": "Could not read image"}))
            return

        # YOLO detection
        results = model(image_path, conf=0.25, iou=0.45, verbose=False)

        plates = []
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                conf = float(box.conf[0])

                # Expand box slightly
                pad_x = int((x2 - x1) * 0.1)
                pad_y = int((y2 - y1) * 0.1)
                x1 = max(0, x1 - pad_x)
                y1 = max(0, y1 - pad_y)
                x2 = min(img.shape[1], x2 + pad_x)
                y2 = min(img.shape[0], y2 + pad_y)

                plate_img = img[y1:y2, x1:x2]
                if plate_img.size == 0:
                    continue

                if debug:
                    cv2.imwrite("debug_cropped.png", plate_img)

                # Preprocess
                processed = preprocess(plate_img)
                if debug:
                    cv2.imwrite("debug_processed.png", processed)

                # Try all combinations
                candidates = []

                # 1. EasyOCR on raw
                ocr_raw = reader.readtext(plate_img)
                if ocr_raw:
                    raw_text = ' '.join([det[1] for det in ocr_raw])
                    candidates.append(clean_plate_text(raw_text))

                # 2. EasyOCR on processed
                ocr_proc = reader.readtext(processed)
                if ocr_proc:
                    proc_text = ' '.join([det[1] for det in ocr_proc])
                    candidates.append(clean_plate_text(proc_text))

                # 3. Tesseract on raw (with custom config)
                tesseract_raw = pytesseract.image_to_string(
                    plate_img, config='--psm 7 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
                )
                candidates.append(clean_plate_text(tesseract_raw))

                # 4. Tesseract on processed
                tesseract_proc = pytesseract.image_to_string(
                    processed, config='--psm 7 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
                )
                candidates.append(clean_plate_text(tesseract_proc))

                # Score each candidate
                best_text = ""
                best_score = -1
                for cand in candidates:
                    if not cand:
                        continue
                    score = score_candidate(cand)
                    if score > best_score:
                        best_score = score
                        best_text = cand

                # Fallback: if no candidate, try raw image with default Tesseract
                if not best_text:
                    raw_default = pytesseract.image_to_string(plate_img)
                    cand = clean_plate_text(raw_default)
                    if cand and score_candidate(cand) > 0:
                        best_text = cand

                plates.append({
                    'plate_number': best_text,
                    'detection_confidence': round(conf, 3),
                    'bbox': [x1, y1, x2, y2]
                })

        print(json.dumps({'success': True, 'plates_found': len(plates), 'plates': plates}))

    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        debug = len(sys.argv) > 2 and sys.argv[2].lower() == 'debug'
        detect_number_plate(sys.argv[1], debug=debug)
    else:
        print(json.dumps({'success': False, 'error': 'No image path'}))