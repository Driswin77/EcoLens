#!/usr/bin/env python3
import sys
import json
from ultralytics import YOLO

# Load your newly trained helmet model
model = YOLO('helmet_model.pt')

def detect_helmet(image_path):
    # Run inference with a confidence threshold of 0.5
    results = model(image_path, conf=0.5, iou=0.45, verbose=False)

    with_helmet = 0
    without_helmet = 0

    for r in results:
        boxes = r.boxes
        for box in boxes:
            conf = float(box.conf[0])
            cls = int(box.cls[0])
            # Assuming class 0 = with_helmet, class 1 = without_helmet
            if cls == 0:
                with_helmet += 1
            elif cls == 1:
                without_helmet += 1

    # Output a simple string that your Node.js can parse
    if without_helmet > 0:
        print(f"Detection: {without_helmet} Without Helmet")
    elif with_helmet > 0:
        print(f"Detection: {with_helmet} With Helmet")
    else:
        print("No Violation")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        detect_helmet(sys.argv[1])
    else:
        print("No image path provided")