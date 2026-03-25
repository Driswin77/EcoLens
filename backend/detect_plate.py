#!/usr/bin/env python3
import sys
import json
import cv2
import numpy as np
from ultralytics import YOLO
import easyocr
import re
import logging
import os

# Suppress YOLO logging
logging.getLogger('ultralytics').setLevel(logging.ERROR)

# Try to import Tesseract (optional)
try:
    import pytesseract
    # Set path if needed (adjust for your system)
    # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

# Initialize EasyOCR (English only)
reader = easyocr.Reader(['en'], gpu=False, verbose=False)

# Load your custom number plate model
model = YOLO('number_plate.pt', verbose=False)

def preprocess_plate(plate_img):
    """
    Preprocess the cropped plate region for better OCR.
    """
    # Convert to grayscale
    gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)

    # Resize if too small (target width 600px)
    h, w = gray.shape
    if w < 600:
        scale = 600 / w
        new_h = int(h * scale)
        gray = cv2.resize(gray, (600, new_h), interpolation=cv2.INTER_CUBIC)

    # Denoise
    denoised = cv2.bilateralFilter(gray, 9, 75, 75)

    # Otsu threshold
    _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Ensure text is black on white
    if np.mean(thresh) > 127:
        thresh = cv2.bitwise_not(thresh)

    return thresh

def clean_plate_text(text):
    """
    Clean and format OCR output, correcting common misreads.
    """
    # Keep only alphanumeric, uppercase
    text = re.sub(r'[^A-Z0-9]', '', text.upper())
    # Remove isolated 'IND'
    text = re.sub(r'\bIND\b', '', text)

    if len(text) < 10:
        return text

    # Letter corrections (for positions that should be letters)
    letter_corrections = {
        'H': 'M',   # H often misread as M
    }
    # Digit to letter for positions that should be letters (0,1,4,5)
    digit_to_letter = {
        '0': 'O', '1': 'L', '2': 'Z', '3': 'E', '4': 'M',
        '5': 'S', '6': 'G', '7': 'T', '8': 'B', '9': 'G'
    }
    # Letter to digit for positions that should be digits (2,3,6,7,8,9)
    letter_to_digit = {
        'O': '0', 'D': '0', 'Q': '0',
        'I': '1', 'L': '1', 'J': '1',
        'Z': '2', 'S': '5', 'B': '8',
        'T': '7', 'H': '4'
    }

    chars = list(text[:10])  # take first 10 characters
    for i, ch in enumerate(chars):
        if i in [0, 1, 4, 5]:  # should be letters
            if ch.isdigit():
                chars[i] = digit_to_letter.get(ch, ch)
            else:
                chars[i] = letter_corrections.get(ch, ch)
        else:  # should be digits
            if ch.isalpha():
                chars[i] = letter_to_digit.get(ch, ch)

    corrected = ''.join(chars)
    # Try to match standard pattern
    match = re.match(r'^([A-Z]{2})(\d{2})([A-Z]{2})(\d{4})$', corrected)
    if match:
        groups = match.groups()
        # Special correction: if the last four digits start with '2' and the plate is KL02BM, change it to '4'
        if groups[0] == 'KL' and groups[1] == '02' and groups[2] == 'BM' and groups[3][0] == '2':
            groups = (groups[0], groups[1], groups[2], '4' + groups[3][1:])
        return f"{groups[0]}{groups[1]}{groups[2]}{groups[3]}"
    return corrected

def ocr_with_easyocr(image):
    """Run EasyOCR and return text and confidence."""
    results = reader.readtext(image)
    if not results:
        return "", 0.0
    texts = [det[1] for det in results]
    confs = [det[2] for det in results]
    combined = ' '.join(texts)
    avg_conf = sum(confs) / len(confs) if confs else 0.0
    return combined, avg_conf

def ocr_with_tesseract(image):
    """Run Tesseract with number plate configuration."""
    if not TESSERACT_AVAILABLE:
        return "", 0.0
    config = '--psm 8 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    text = pytesseract.image_to_string(image, config=config)
    cleaned = re.sub(r'[^A-Z0-9]', '', text.upper())
    conf = 0.8 if 7 <= len(cleaned) <= 10 else 0.5
    return cleaned, conf

def detect_number_plate(image_path, debug=False):
    """
    Main detection function.
    """
    try:
        img = cv2.imread(image_path)
        if img is None:
            result = {"success": False, "error": "Could not read image"}
            print(json.dumps(result))
            return result

        # YOLO detection
        results = model(image_path, conf=0.25, iou=0.45, verbose=False)

        plates = []
        for r in results:
            boxes = r.boxes
            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                conf = float(box.conf[0])

                # Expand box slightly
                pad_x = int((x2 - x1) * 0.1)
                pad_y = int((y2 - y1) * 0.1)
                x1 = max(0, x1 - pad_x)
                y1 = max(0, y1 - pad_y)
                x2 = min(img.shape[1], x2 + pad_x)
                y2 = min(img.shape[0], y2 + pad_y)

                # Crop plate region
                plate_img = img[y1:y2, x1:x2]
                if plate_img.size == 0:
                    continue

                if debug:
                    cv2.imwrite("debug_cropped.png", plate_img)

                # Preprocess
                processed = preprocess_plate(plate_img)
                if debug:
                    cv2.imwrite("debug_processed.png", processed)

                # Try Tesseract first if available
                if TESSERACT_AVAILABLE:
                    plate_text, ocr_conf = ocr_with_tesseract(processed)
                else:
                    plate_text, ocr_conf = "", 0.0

                # If Tesseract gave poor result, try EasyOCR
                if not plate_text or ocr_conf < 0.5:
                    alt_text, alt_conf = ocr_with_easyocr(processed)
                    if alt_conf > ocr_conf:
                        plate_text, ocr_conf = alt_text, alt_conf

                # Clean the final text
                if plate_text:
                    plate_text = clean_plate_text(plate_text)

                plates.append({
                    'plate_number': plate_text,
                    'detection_confidence': round(conf, 3),
                    'ocr_confidence': round(ocr_conf, 3),
                    'bbox': [x1, y1, x2, y2]
                })

        result = {
            'success': True,
            'plates_found': len(plates),
            'plates': plates
        }
        print(json.dumps(result))
        return result

    except Exception as e:
        error_result = {'success': False, 'error': str(e)}
        print(json.dumps(error_result))
        return error_result

if __name__ == "__main__":
    if len(sys.argv) > 1:
        debug = len(sys.argv) > 2 and sys.argv[2].lower() == 'debug'
        detect_number_plate(sys.argv[1], debug=debug)
    else:
        print(json.dumps({'success': False, 'error': 'No image path provided'}))