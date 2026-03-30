import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = promisify(exec);

const imagePath = path.join(__dirname, 'WhatsApp Image 2026-03-29 at 10.39.13 AM.jpeg'); // change to your test image

async function testCrop() {
  try {
    // Step 1: Run detect_plate.py to get bounding box
    const { stdout, stderr } = await execPromise(`python detect_plate.py "${imagePath}"`);
    if (stderr) console.warn('stderr:', stderr);
    const result = JSON.parse(stdout);
    if (result.plates_found === 0) {
      console.log('No plate detected.');
      return;
    }
    const bbox = result.plates[0].bbox; // [x1, y1, x2, y2]
    console.log('Detected plate bbox:', bbox);
    const [x1, y1, x2, y2] = bbox;
    const left = Math.max(0, x1);
    const top = Math.max(0, y1);
    const width = Math.max(1, x2 - left);
    const height = Math.max(1, y2 - top);
    await sharp(imagePath)
      .extract({ left, top, width, height })
      .toFile('cropped_plate.png');
    console.log('Cropped plate saved as cropped_plate.png');
  } catch (error) {
    console.error('Error:', error);
  }
}

testCrop();