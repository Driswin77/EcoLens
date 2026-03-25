import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import https from "https";
import mongoose from "mongoose"; 
import fs from "fs"; 
import path from "path";
import nodemailer from "nodemailer"; 
import bcrypt from "bcryptjs"; 
import cron from "node-cron"; 
import { exec } from "child_process";
import { promisify } from "util";

import { fileURLToPath } from 'url';
// --- At the top of index.js (after other imports) ---
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// --- The multer configuration (unchanged) ---
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

// Promisify exec for cleaner async/await
const execAsync = promisify(exec);

// ✅ FIX __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const httpsAgent = new https.Agent({ keepAlive: true });

// =========================================================
// 1. EMAIL CONFIGURATION (Google SMTP)
// =========================================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'driswin092@gmail.com',
    pass: process.env.EMAIL_PASS || 'znsrxofufivsbcsd'
  }
});

// --- HELPER: WELCOME EMAIL FUNCTION ---
const sendWelcomeEmail = async (email, name) => {
  const mailOptions = {
    from: '"EcoLens Team" <no-reply@ecolens.gov>',
    to: email,
    subject: `Welcome to EcoLens, ${name}! 🌿`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
        <h2 style="color: #2e7d32; text-align: center;">Welcome to the Eco Enforcement Network!</h2>
        <p>Dear ${name},</p>
        <p>Thank you for registering with <strong>EcoLens</strong>. You are now part of a community dedicated to smarter, cleaner cities.</p>
        
        <h3 style="color: #1b5e20;">🚀 What you can do with this app:</h3>
        <ul>
          <li><strong>📸 Visual Scanner:</strong> Instantly detect traffic & environmental violations using AI with real-time fine updates and automatic number plate recognition.</li>
          <li><strong>📍 Smart Routing:</strong> Reports are automatically sent to the nearest Police Station or Municipality based on your GPS.</li>
          <li><strong>🗺️ Eco Map:</strong> Find fuel-efficient routes to reduce carbon emissions.</li>
          <li><strong>📂 Digital Glovebox:</strong> Securely store your RC, License, and Insurance.</li>
        </ul>

        <p>Log in now to start making a difference!</p>
        <br/>
        <p style="font-size: 12px; color: #666;">This is an automated message. Please do not reply.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 WELCOME EMAIL SENT to ${email}`);
  } catch (error) {
    console.error("❌ WELCOME EMAIL FAILED:", error);
  }
};

// --- HELPER: OFFICIAL ALERT EMAIL (UPDATED WITH NUMBER PLATES) ---
const sendOfficialAlert = async (report, authorityName) => {
  // Format number plates for email
  const platesHtml = report.number_plates && report.number_plates.length > 0 
    ? `<div style="background-color: #e3f2fd; padding: 15px; margin: 15px 0; border-left: 4px solid #2196f3; border-radius: 4px;">
        <h3 style="margin: 0 0 10px 0; color: #1976d2; font-size: 16px;">📋 VEHICLE NUMBER PLATES DETECTED</h3>
        ${report.number_plates.map(plate => `
          <p style="margin: 8px 0; font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; background: #f5f5f5; padding: 8px; border-radius: 4px;">
            <span style="color: #0d47a1;">${plate.plate_number || 'Not readable'}</span> 
            <span style="color: #666; font-size: 12px; margin-left: 10px;">(Confidence: ${Math.round(plate.ocr_confidence * 100)}%)</span>
          </p>
        `).join('')}
      </div>`
    : '<p style="color: #666; font-style: italic;">No number plates detected in the evidence image.</p>';

  const mailOptions = {
    from: '"EcoLens Enforcer" <no-reply@ecopenalty.gov>',
    to: 'recipient_email@gmail.com',
    subject: `⚡ OFFICIAL ALERT: ${report.category} Detected - ${authorityName}`,
    html: `
      <div style="font-family: Arial, sans-serif; border: 1px solid #333; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px;">
          ⚠️ VIOLATION REPORT #${report._id.toString().slice(-6).toUpperCase()}
        </h2>
        
        <table style="width: 100%; margin: 15px 0; border-collapse: collapse;">
           <tr>
            <td style="padding: 8px; background: #f5f5f5;"><strong>To:</strong></td>
            <td style="padding: 8px;">${authorityName}</td>
           </tr>
           <tr>
            <td style="padding: 8px; background: #f5f5f5;"><strong>Reporter:</strong></td>
            <td style="padding: 8px;">${report.userEmail}</td>
           </tr>
           <tr>
            <td style="padding: 8px; background: #f5f5f5;"><strong>Date/Time:</strong></td>
            <td style="padding: 8px;">${report.offenseDate || new Date().toLocaleDateString()} at ${report.offenseTime || new Date().toLocaleTimeString()}</td>
           </tr>
         </table>
        
        ${platesHtml}
        
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #d32f2f; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #d32f2f;">🚨 OFFENSE DETAILS</h3>
          <ul style="line-height: 1.8; padding-left: 20px;">
            <li><strong>Violation:</strong> ${report.title}</li>
            <li><strong>Category:</strong> ${report.category}</li>
            <li><strong>Severity:</strong> <span style="color: ${report.severity === 'High' ? '#d32f2f' : '#ed6c02'}; font-weight: bold;">${report.severity}</span></li>
            <li><strong>Location:</strong> ${report.location}</li>
          </ul>
        </div>

        <div style="background-color: #fff3e0; padding: 15px; margin: 20px 0; border-left: 4px solid #ed6c02; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #ed6c02;">📝 OFFICER OBSERVATION</h3>
          <p style="line-height: 1.6;">${report.description}</p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center;">
          <p>⚡ This is an automated dispatch from the EcoLens Enforcement System.</p>
          <p>📸 Evidence photo is attached below. Please take necessary action as per law.</p>
          <p style="margin-top: 15px;">🔔 This is a system generated report. Do not reply to this email.</p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: 'evidence_photo.jpg',
        content: report.image.split("base64,")[1], 
        encoding: 'base64'
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 OFFICIAL ALERT EMAIL SENT to Authority`);
  } catch (error) {
    console.error("❌ OFFICIAL ALERT EMAIL FAILED:", error);
  }
};

// =========================================================
// 2. CLOUD DATABASE CONNECTION
// =========================================================
const MONGO_URI = process.env.MONGO_URI;
let isCloudConnected = false;

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => {
            console.log("✅ CONNECTED TO MongoDB");
            isCloudConnected = true;
        })
        .catch(err => console.error("⚠️ Cloud Connection Error:", err.message));
} else {
    console.log("⚠️ No MONGO_URI. Using Local Mode (DB features may fail).");
}

// --- SCHEMAS (UPDATED WITH NUMBER PLATES) ---
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, 
  joinedDate: { type: Date, default: Date.now }
});
const User = mongoose.model("EcoUser", UserSchema);

const DocSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  name: String,
  type: String,
  plate: String,
  expiry: String,
  image: String, 
  uploadDate: { type: Date, default: Date.now }
});
const Document = mongoose.model("EcoGloveboxFinal", DocSchema);

const IssueSchema = new mongoose.Schema({
  userEmail: String,
  title: String,
  category: String,
  severity: String,
  description: String,
  location: String,
  image: String,
  number_plates: [{
    plate_number: String,
    detection_confidence: Number,
    ocr_confidence: Number
  }],
  status: { type: String, default: "Forwarded" }, 
  forwardedTo: String, 
  offenseDate: String, 
  offenseTime: String, 
  date: { type: Date, default: Date.now }
});
const IssueReport = mongoose.model("IssueReport", IssueSchema);

const IndustryHistorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: {
    lat: Number,
    lon: Number,
    address: String
  },
  email: { type: String },
  violationCount: { type: Number, default: 0 },
  history: [
    {
      reportId: String,
      date: { type: Date, default: Date.now },
      violationType: String,
      evidenceUrl: String,
      actionTaken: { 
        type: String, 
        enum: ['WARNING_SENT', 'ESCALATED_TO_PCB', 'ESCALATED_TO_DM'] 
      }
    }
  ],
  lastWarningDate: Date
});
const IndustryHistory = mongoose.model("IndustryHistory", IndustryHistorySchema);

const legalAdvisorSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  language: { type: String, default: 'English' },
  analysis: {
    penalty: String,
    law: String,
    resolution: String,
    appealDraft: String
  },
  status: { type: String, default: 'Active' },
  createdAt: { type: Date, default: Date.now }
});

const LegalAdvisor = mongoose.model('LegalAdvisor', legalAdvisorSchema, 'LegalAdvisor');

// =========================================================
// 3. AI HELPERS (Gemini)
// =========================================================

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Safe JSON parser
function safeJSONParse(text, defaultValue = {}) {
  try {
    // Remove markdown code blocks
    let cleanText = text.replace(/```json|```/g, "").trim();
    
    // Find first { and last }
    const firstBrace = cleanText.indexOf("{");
    const lastBrace = cleanText.lastIndexOf("}");
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }
    
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("JSON Parse Error:", error.message);
    console.error("Raw text:", text.substring(0, 200) + "...");
    return defaultValue;
  }
}

async function callGeminiAI(prompt, base64Image = null, mimeType = "image/jpeg") {
    const API_KEY = process.env.GEMINI_API_KEY;
    
    const modelsToTry = [
        "gemini-2.5-flash",
        "gemini-2.0-flash", 
        "gemini-1.5-flash", 
        "gemini-1.5-pro"
    ];

    for (const model of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
            
            const requestBody = {
                contents: [{ 
                    parts: [
                        { text: prompt },
                        ...(base64Image ? [{ inline_data: { mime_type: mimeType, data: base64Image } }] : [])
                    ] 
                }]
            };

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                agent: httpsAgent,
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (data.error) {
                console.warn(`⚠️ Error with ${model}: ${data.error.message}`);
                if (data.error.code === 429) await delay(1500); 
                continue; 
            }

            return data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        } catch (e) {
            console.error(`❌ Network error with ${model}:`, e.message);
        }
    }

    throw new Error("All AI models failed or are busy. Please try again later.");
}

// Traffic Classification Prompt
const TRAFFIC_CLASSIFICATION_PROMPT = `You are an AI traffic image classifier. Analyze this image carefully.

TASK: Determine if this image is TRAFFIC-RELATED or NOT.

Traffic-related images include:
- Vehicles on roads (cars, bikes, trucks, buses)
- Traffic violations (triple riding, wrong side, etc.)
- Traffic signals, signs, or road infrastructure
- Accidents or traffic jams
- Parking violations

Non-traffic images include:
- Garbage dumps, waste, litter (unless directly blocking traffic)
- Environmental issues (burning waste, pollution) - these are separate
- Buildings, landscapes, nature
- People not on roads
- Animals (unless causing traffic obstruction)

CRITICAL: Return ONLY valid JSON in this exact format:
{
  "isTraffic": true/false,
  "confidence": "High/Medium/Low",
  "reason": "Brief explanation of classification"
}`;

// Enhanced Violation Detection Prompt with REAL-TIME fine calculation
const VIOLATION_DETECTION_PROMPT = `You are an AI enforcement officer for India with REAL-TIME access to current laws and fines. Analyze this image and identify ALL violations present.

CRITICAL INSTRUCTIONS:
1. First, identify the type of vehicle(s) present (car, motorcycle, truck, bus, bicycle, etc.)
2. For motorcycle/scooter, check for helmet violations
3. For cars and other four-wheelers, DO NOT report helmet violations
4. For EVERY violation detected, determine the CURRENT fine amount based on LATEST laws
5. Consider recent amendments and notifications (including December 2023 updates)
6. Fines should be specific to Kerala state regulations
7. Include the legal source for each fine

FINE REFERENCE GUIDE:
- Waste dumping spot fines: ₹5,000 (Kerala Municipality Amendment Dec 2023)
- Plastic ban violations: ₹25,000 first offense (Kerala Plastic Ban Rules)
- Industrial waste: ₹50,000 - ₹5,00,000 (Water/Environment Protection Act)
- Traffic violations: Refer to Motor Vehicles (Kerala Amendment) Act, 2023
- Burning waste: ₹10,000 (NGT guidelines)
- No helmet for two-wheeler: ₹500-1000 (Section 129 MV Act)
- HSRP violation: ₹5,000-10,000 (Central Motor Vehicles Rules)

Return STRICT JSON in this format:
{
  "violationsFound": true/false,
  "vehicleType": "car/motorcycle/truck/bus/auto/unknown",
  "violations": [
    {
      "category": "Traffic Violation" or "Environmental Violation" or "Civic Issue",
      "title": "Specific Violation Name",
      "description": "Brief description of what you observed",
      "law": "Specific Act and Section",
      "fineAmount": number,
      "fineReference": "Source of fine with date",
      "severity": "High/Medium/Low"
    }
  ]
}

If no violations found, return: { "violationsFound": false, "vehicleType": "unknown", "violations": [] }`;

// REAL-TIME RULES GENERATOR
async function getLocalRulesWithAI(location) {
    try {
        console.log(`🤖 Fetching laws for: ${location}`);
        const prompt = `
        You are a legal expert for ${location} with access to current laws and fines.
        List 4 specific TRAFFIC rules and 4 ENVIRONMENTAL rules enforced in ${location}.
        For each rule, include:
        - The exact title
        - Brief description
        - CURRENT fine amount (as per latest amendments)
        - Legal reference with date

        Output STRICT JSON format only:
        {
          "traffic": [ 
            { 
              "title": "Rule Name", 
              "desc": "Brief description with CURRENT Fine amount and legal reference.",
              "fine": number,
              "law": "Specific section"
            } 
          ],
          "eco": [ 
            { 
              "title": "Rule Name", 
              "desc": "Brief description with CURRENT Fine amount and legal reference.",
              "fine": number,
              "law": "Specific section" 
            } 
          ]
        }
        `;

        const text = await callGeminiAI(prompt);
        return safeJSONParse(text, { traffic: [], eco: [] });
    } catch (e) {
        console.error("Rules Fetch Failed:", e.message);
        return null; 
    }
}

// DOCUMENT SCANNER
async function scanDocumentWithAI(base64Image, mimeType) {
  try {
    const prompt = `
    Analyze this vehicle document image. 
    Extract details. If not found, use "Unknown".
    1. "type": "RC" (Registration), "PUC" (Pollution), or "Insurance"
    2. "plate_number": Vehicle Registration Number (e.g., KL-01-AB-1234)
    3. "expiry_date": Valid Until Date (Format YYYY-MM-DD). If missing, return today's date.

    Output STRICT JSON:
    { "type": "String", "plate_number": "String", "expiry_date": "YYYY-MM-DD" }
    `;

    const text = await callGeminiAI(prompt, base64Image, mimeType);
    const result = safeJSONParse(text, { 
      type: "Document", 
      plate_number: "Unknown", 
      expiry_date: new Date().toISOString().split('T')[0] 
    });
    
    console.log("📄 AI Scan Result:", result);
    return result;
  } catch (e) {
    console.error("❌ Critical Scan Error:", e.message);
    return { 
      type: "Document", 
      plate_number: "Manual Check", 
      expiry_date: new Date().toISOString().split('T')[0] 
    };
  }
}

// =========================================================
// 4. SMART ROUTING LOGIC
// =========================================================
const determineRealAuthority = (category, locationString) => {
    const lowerLoc = locationString ? locationString.toLowerCase() : "local jurisdiction";
    let localBodyType = "Gram Panchayat"; 
    
    if (lowerLoc.includes("corporation") || lowerLoc.includes("metropolitan") || lowerLoc.includes("mumbai") || lowerLoc.includes("delhi")) {
        localBodyType = "Municipal Corporation";
    } else if (lowerLoc.includes("municipality") || lowerLoc.includes("town")) { 
        localBodyType = "Municipal Council";
    }

    switch (category) {
        case 'Traffic Violation':
            return `Station House Officer (SHO), Traffic Police Station - ${locationString} Div.`;
        case 'Road Damage':
        case 'Infrastructure':
            if (lowerLoc.includes("highway") || lowerLoc.includes("nh")) {
                return `Project Director, National Highways Authority of India (NHAI) - Regional Office`;
            } else {
                return `Secretary, ${localBodyType} (Engineering Wing) - ${locationString}`;
            }
        case 'Environmental':
        case 'Industrial':
            return `Environmental Engineer, State Pollution Control Board (District Office) - ${locationString}`;
        case 'Garbage / Waste':
            return `Health Inspector, ${localBodyType} - ${locationString} Circle`;
        default:
            return `Public Grievance Cell, ${localBodyType} - ${locationString}`;
    }
};

// =========================================================
// 5. AUTOMATED 3-DAY EXPIRY REMINDER
// =========================================================
cron.schedule('0 9 * * *', async () => {
    console.log("⏰ Running Daily 3-Day Expiry Check...");

    if (!isCloudConnected) {
        console.log("⚠️ Database not connected, skipping check.");
        return;
    }

    try {
        const today = new Date();
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + 3);
        const targetStr = targetDate.toISOString().split('T')[0];

        console.log(`🔍 Looking for documents expiring on: ${targetStr}`);

        const expiringDocs = await Document.find({ expiry: targetStr });

        if (expiringDocs.length === 0) {
            console.log("✅ No documents expiring in 3 days.");
            return;
        }

        console.log(`⚠️ Found ${expiringDocs.length} documents expiring in 3 days.`);

        for (const doc of expiringDocs) {
            const mailOptions = {
                from: '"Eco Glovebox" <no-reply@ecopenalty.gov>',
                to: doc.userEmail,
                subject: `⏳ URGENT: ${doc.type} Expires in 3 Days`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
                        <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px;">
                            Action Required: Renewal Due
                        </h2>
                        <p>Hello,</p>
                        <p>This is an automated alert that your document is expiring very soon.</p>
                        
                        <div style="background-color: #fff3cd; padding: 15px; border-left: 5px solid #ffc107; margin: 20px 0;">
                            <p><strong>Document:</strong> ${doc.type}</p>
                            <p><strong>Vehicle/ID:</strong> ${doc.plate}</p>
                            <p><strong>Expiry Date:</strong> ${doc.expiry} (3 Days Left)</p>
                        </div>

                        <p><strong>Please renew immediately to avoid fines.</strong></p>
                        <p>Once renewed, upload the new document to your Digital Glovebox.</p>
                        <br/>
                        <p style="font-size: 12px; color: #666;">EcoLens</p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log(`📨 3-Day Reminder sent to ${doc.userEmail}`);
        }

    } catch (error) {
        console.error("❌ Expiry Check Failed:", error.message);
    }
});

// =========================================================
// 6. YOLO HELMET DETECTION (IMPROVED)
// =========================================================
async function detectHelmet(imagePath) {
  try {
    console.log(" Running YOLO for helmet detection...");
    
    const { stdout, stderr } = await execAsync(`python detect.py "${imagePath}"`);
    
    if (stderr) {
      console.warn("YOLO Stderr:", stderr);
    }
    
    const output = stdout.trim();
    console.log("YOLO Output:", output);
    
    // Parse the output to determine helmet status
    if (output.includes("With Helmet") || output.includes("Helmet Detected")) {
      return "with_helmet";
    } else if (output.includes("No Helmet") || output.includes("Without Helmet")) {
      return "no_helmet";
    } else {
      return "unknown";
    }
  } catch (error) {
    console.error("YOLO Error:", error);
    return "error";
  }
}

// YOLO SEAT BELT DETECTION (NEW)
async function detectSeatbelt(imagePath) {
  try {
    const { stdout, stderr } = await execAsync(`python detect_seatbelt.py "${imagePath}"`);
    if (stderr) console.warn("Seatbelt detection stderr:", stderr);
    const result = JSON.parse(stdout.trim());
    return result; // { seatbelt_worn: true/false/null, confidence: 0.xx }
  } catch (error) {
    console.error("Seatbelt detection error:", error);
    return { seatbelt_worn: null, confidence: 0 };
  }
}

// =========================================================
// 7. NUMBER PLATE DETECTION (IMPROVED)
// =========================================================
async function detectNumberPlate(imagePath) {
  try {
    console.log(" Running number plate detection...");
    
    const { stdout, stderr } = await execAsync(`python detect_plate.py "${imagePath}"`);
    
    if (stderr) {
      console.warn("Number Plate Stderr:", stderr);
    }
    
    // Try to parse the JSON output
    try {
      const result = JSON.parse(stdout.trim());
      console.log("📸 Number plate result:", result);
      return result;
    } catch (parseError) {
      console.error("Failed to parse number plate output:", parseError);
      console.log("Raw output:", stdout);
      return { plates_found: 0, plates: [] };
    }
  } catch (error) {
    console.error("Number Plate Error:", error);
    return { plates_found: 0, plates: [] };
  }
}

// =========================================================
// 8. VEHICLE TYPE DETECTION (NEW)
// =========================================================
async function detectVehicleType(imagePath) {
  try {
    console.log(" Running vehicle type detection...");
    
    const { stdout, stderr } = await execAsync(`python detect_vehicle.py "${imagePath}"`);
    
    if (stderr) {
      console.warn("Vehicle Detection Stderr:", stderr);
    }
    
    try {
      const result = JSON.parse(stdout.trim());
      console.log("🚙 Vehicle type result:", result);
      return result;
    } catch (parseError) {
      console.error("Failed to parse vehicle detection output:", parseError);
      return { vehicleType: 'unknown', confidence: 0 };
    }
  } catch (error) {
    console.error("Vehicle Detection Error:", error);
    return { vehicleType: 'unknown', confidence: 0 };
  }
}

// =========================================================
// 9. API ROUTES
// =========================================================

app.post("/get-local-laws", async (req, res) => {
    const { location } = req.body;
    const rules = await getLocalRulesWithAI(location);
    if (rules) res.json({ success: true, ...rules }); 
    else res.status(500).json({ success: false });
});

// --- SIGNUP ROUTE ---
app.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!isCloudConnected) return res.status(503).json({ error: "Cloud offline" });
        
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: "Email already registered." });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        
        sendWelcomeEmail(email, name);

        res.json({ success: true, user: { name: newUser.name, email: newUser.email } });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// --- LOGIN ROUTE ---
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!isCloudConnected) return res.status(503).json({ error: "Cloud offline" });
        
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid Credentials" });

        res.json({ success: true, user: { name: user.name, email: user.email } });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// --- UPLOAD DOCUMENT ---
app.post("/upload-doc", async (req, res) => {
  try {
    const { image, name, userEmail } = req.body;
    if (!userEmail) return res.status(401).json({ error: "Unauthorized" });

    const parts = image.split(",");
    const cleanBase64 = parts.length > 1 ? parts[1] : parts[0];
    const mimeMatch = image.match(/^data:(.*);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    console.log(`📄 Processing ${name}...`);

    let aiData = await scanDocumentWithAI(cleanBase64, mimeType);

    const newDoc = new Document({ 
      userEmail, 
      name, 
      type: aiData.type, 
      plate: aiData.plate_number, 
      expiry: aiData.expiry_date, 
      image 
    });
    
    if (isCloudConnected) { 
      await newDoc.save(); 
      res.json({ success: true, doc: newDoc }); 
    } else { 
      res.status(503).json({ error: "Cloud offline" }); 
    }
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// --- GET USER DOCUMENTS ---
app.get("/my-docs", async (req, res) => {
  try {
      const { userEmail } = req.query;
      if (isCloudConnected) {
          const docs = await Document.find({ userEmail }); 
          res.json(docs.map(d => ({ ...d._doc, id: d._id.toString() })).sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)));
      } else { 
        res.json([]); 
      }
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

// --- DELETE DOCUMENT ---
app.delete("/delete-doc/:id", async (req, res) => {
  if (isCloudConnected) { 
    await Document.findByIdAndDelete(req.params.id); 
    res.json({ success: true }); 
  } else { 
    res.status(503).json({ error: "Cloud offline" }); 
  }
});

// --- SUBMIT REPORT ROUTE (UPDATED WITH NUMBER PLATES) ---
app.post("/submit-report", async (req, res) => {
    try {
        const { 
            title, category, severity, description, location, image, 
            userEmail, dateOfOffense, timeOfOffense, authorityName,
            number_plates 
        } = req.body;
        
        if (!userEmail) return res.status(401).json({ error: "Unauthorized: No User ID" });

        const officialAuthority = authorityName || determineRealAuthority(category, location);

        if(isCloudConnected) {
            const issue = new IssueReport({ 
                userEmail, 
                title, 
                category, 
                severity, 
                description, 
                location, 
                image,
                number_plates: number_plates || [],
                status: "Forwarded",
                forwardedTo: officialAuthority,
                offenseDate: dateOfOffense || new Date().toLocaleDateString('en-IN'),
                offenseTime: timeOfOffense || new Date().toLocaleTimeString('en-IN')
            });
            await issue.save();

            sendOfficialAlert(issue, officialAuthority);

            console.log(`📨 OFFICIAL DISPATCH: Report #${issue._id}`);
            console.log(`   ► ROUTED TO: ${officialAuthority}`);
            if (number_plates && number_plates.length > 0) {
                console.log(`   ► PLATES: ${number_plates.map(p => p.plate_number).join(', ')}`);
            }

            res.json({ success: true, report: issue, forwardedTo: officialAuthority });
        } else { 
            res.json({ success: true, forwardedTo: officialAuthority }); 
        }
    } catch(e) { 
        res.status(500).json({error: e.message}); 
    }
});

// --- GET USER REPORTS ---
app.get("/my-reports", async (req, res) => {
    try {
        const { userEmail } = req.query;
        if (!userEmail) return res.json([]);

        if(isCloudConnected) { 
            const reports = await IssueReport.find({ userEmail }).sort({ date: -1 }); 
            res.json(reports); 
        } else { 
          res.json([]); 
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- The updated route ---
app.post("/api/legal/analyze", upload.single('file'), async (req, res) => {
  try {
    const { description, userId, language } = req.body;
    const file = req.file;

    const finalUserId = userId?.trim() ? userId : "Guest";

    const languageMap = {
      'en-IN': 'English',
      'hi-IN': 'Hindi',
      'ml-IN': 'Malayalam',
      'ta-IN': 'Tamil',
      'kn-IN': 'Kannada'
    };
    const targetLang = languageMap[language] || 'English';

    let combinedDescription = description || "";
    let imageBase64 = null;

    if (file) {
      if (file.mimetype.startsWith('image/')) {
        imageBase64 = file.buffer.toString('base64');
        combinedDescription += "\n\n[Image attached for visual analysis]";
      } else if (file.mimetype === 'application/pdf') {
        const pdfData = await pdfParse(file.buffer);
        combinedDescription += `\n\n--- PDF Content ---\n${pdfData.text}\n--- End PDF ---`;
      } else {
        return res.status(400).json({ error: "Unsupported file type. Only images (JPEG, PNG) and PDFs are allowed." });
      }
    }

    const prompt = `You are an Indian Traffic and Environmental Legal Expert with access to current laws and fines. 
    Analyze: "${combinedDescription}". 
    
    Provide CURRENT penalty amounts based on latest amendments (including post-December 2023 updates).
    
    CRITICAL: Provide the entire response strictly in formal ${targetLang}.
    Return STRICT JSON: 
    { 
      "penalty": "Fine/penalty summary with CURRENT amount and legal reference.", 
      "law": "Specific Section and Act with amendment date.", 
      "resolution": "Step 1; Step 2; Step 3", 
      "appealDraft": "Detailed formal appeal body for a legal document." 
    }`;

    const text = await callGeminiAI(prompt, imageBase64, 'image/jpeg');
    const aiResponse = safeJSONParse(text, {
      penalty: "Unable to determine current penalty - consult local authorities",
      law: "Consult local authorities for latest amendments",
      resolution: "Contact legal advisor",
      appealDraft: "Please consult a lawyer"
    });

    const newRecord = new LegalAdvisor({
      userId: finalUserId,
      description: combinedDescription,
      language: targetLang,
      analysis: aiResponse
    });

    if (isCloudConnected) {
      await newRecord.save();
      console.log(`Record saved for ${finalUserId}`);
    }

    res.json(aiResponse);

  } catch (error) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: "Legal analysis failed. Please try again." });
  }
});

// --- GET LEGAL HISTORY ---
app.get("/api/legal/history/:userId", async (req, res) => {
  try {
    if (!isCloudConnected) return res.json([]);
    const history = await LegalAdvisor.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(5);
    res.json(history);
  } catch (error) { 
    res.status(500).json({ error: "Failed to fetch history" }); 
  }
});

// =========================================================
// 10. MAIN ANALYZE ENDPOINT (Seatbelt YOLO with dynamic fine)
// =========================================================
app.post("/analyze", async (req, res) => {
  try {
    const { base64 } = req.body;

    if (!base64) return res.status(400).json({ error: "No image received" });

    // Extract MIME type and save as PNG (lossless)
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
    const imagePath = path.join(__dirname, "temp.png");
    fs.writeFileSync(imagePath, Buffer.from(cleanBase64, "base64"));
    console.log("✅ Image saved as PNG");

    // Short delay to ensure file is flushed (Windows)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify file
    try {
      const stats = fs.statSync(imagePath);
      if (stats.size === 0) {
        console.error("❌ Saved image is empty!");
        return res.status(500).json({ error: "Image file is empty" });
      }
      console.log(`📁 Image size: ${stats.size} bytes`);
    } catch (err) {
      console.error("❌ Error checking file:", err);
      return res.status(500).json({ error: "Failed to write image" });
    }

    // STEP 1: Classify if traffic-related using Gemini
    console.log("🔍 Classifying image type...");
    const classificationText = await callGeminiAI(TRAFFIC_CLASSIFICATION_PROMPT, cleanBase64);
    const classification = safeJSONParse(classificationText, { 
      isTraffic: false, 
      confidence: "Low", 
      reason: "Parse failed" 
    });
    console.log("📊 Classification:", classification);

    let violations = [];
    let plateResult = { plates_found: 0, plates: [] };
    let vehicleType = "unknown";

    // STEP 2: Number plate detection
    console.log("🔍 Running number plate detection...");
    try {
      plateResult = await detectNumberPlate(imagePath);
    } catch (plateError) {
      console.error("Number plate detection failed:", plateError);
      plateResult = { plates_found: 0, plates: [] };
    }

    // STEP 3: If traffic, run Gemini to get vehicle type and violations (but we'll filter later)
    if (classification.isTraffic === true) {
      console.log("🚦 Traffic image detected – getting vehicle type and violations from Gemini...");
      const geminiText = await callGeminiAI(VIOLATION_DETECTION_PROMPT, cleanBase64);
      const geminiResult = safeJSONParse(geminiText, { violationsFound: false, vehicleType: "unknown", violations: [] });

      // Update vehicle type from Gemini
      vehicleType = geminiResult.vehicleType || "unknown";
      console.log("🚗 Vehicle type (Gemini):", vehicleType);

      // Determine vehicle type
      const isTwoWheeler = ['motorcycle', 'scooter', 'bike', 'two-wheeler', 'two_wheeler'].some(t => vehicleType.toLowerCase().includes(t));
      const isFourWheeler = ['car', 'truck', 'bus', 'van', 'suv', 'sedan', 'hatchback'].some(t => vehicleType.toLowerCase().includes(t));

      let seatbeltViolationAdded = false; // flag for filtering Gemini

      // Run YOLO based on vehicle type
      if (isTwoWheeler) {
        console.log("🛵 Two‑wheeler – running helmet detection");
        const helmetResult = await detectHelmet(imagePath);
        if (helmetResult === "no_helmet") {
          // Fetch helmet fine dynamically
          const helmetFinePrompt = `What is the current fine for "No Helmet" violation for two-wheeler riders in Kerala as per the latest Motor Vehicles Act amendments? Return ONLY a JSON with fine amount and legal reference.`;
          const helmetFineText = await callGeminiAI(helmetFinePrompt);
          const helmetFineData = safeJSONParse(helmetFineText, { fine: 500, law: "Section 129 MV Act", reference: "Standard fine" });
          violations.push({
            category: "Traffic Violation",
            title: "No Helmet",
            description: "Rider is not wearing a helmet",
            law: helmetFineData.law,
            fineAmount: helmetFineData.fine,
            fineReference: helmetFineData.reference,
            severity: "High"
          });
          console.log(`💰 Helmet violation added: ₹${helmetFineData.fine}`);
        } else if (helmetResult === "with_helmet") {
          console.log("✅ Helmet detected – no violation");
        } else {
          console.log("⚠️ Helmet detection unclear – skipping");
        }
      } 
      else if (isFourWheeler) {
        console.log("🚗 Four‑wheeler – running seatbelt detection");
        const seatbeltResult = await detectSeatbelt(imagePath);
        if (seatbeltResult.seatbelt_worn === false) {
          // Fetch seatbelt fine dynamically
          console.log("🤖 Getting current seatbelt fine from Gemini...");
          const seatbeltFinePrompt = `What is the current fine for "No Seatbelt" violation for four-wheeler drivers in Kerala as per the latest Motor Vehicles Act amendments? Return ONLY a JSON with fine amount and legal reference.`;
          const seatbeltFineText = await callGeminiAI(seatbeltFinePrompt);
          const seatbeltFineData = safeJSONParse(seatbeltFineText, { fine: 1000, law: "Section 138(3) MV Act", reference: "Standard fine" });
          violations.push({
            category: "Traffic Violation",
            title: "No Seatbelt",
            description: "Driver not wearing seatbelt",
            law: seatbeltFineData.law,
            fineAmount: seatbeltFineData.fine,
            fineReference: seatbeltFineData.reference,
            severity: "Medium"
          });
          console.log(`💰 Seatbelt violation added: ₹${seatbeltFineData.fine}`);
          seatbeltViolationAdded = true;
        } else if (seatbeltResult.seatbelt_worn === true) {
          console.log("✅ Seatbelt detected – no violation");
        } else {
          console.log("⚠️ Seatbelt detection unclear – skipping");
        }
      }
      else {
        console.log("⚠️ Unknown vehicle type – skipping YOLO detections");
      }

      // Filter Gemini violations: remove helmet always, remove seatbelt only if YOLO added one
      if (geminiResult.violations && Array.isArray(geminiResult.violations)) {
        geminiResult.violations = geminiResult.violations.filter(v => {
          const title = v.title.toLowerCase();
          // Helmet: always remove
          const isHelmet = title.includes('helmet') && (title.includes('no') || title.includes('without'));
          if (isHelmet) return false;
          // Seatbelt: remove only if YOLO added a violation
          const isSeatbelt = title.includes('seatbelt') && (
            title.includes('no') || title.includes('not') || title.includes('without') ||
            title.includes('failure') || title.includes('missing') || title.includes('unbuckled')
          );
          if (isSeatbelt && seatbeltViolationAdded) return false;
          return true;
        });
      }

      // Remove other unwanted fines (HSRP, footwear, etc.)
      const excludedKeywords = ['footwear', 'hsrp', 'registration plate', 'non-compliance'];
      if (geminiResult.violations && Array.isArray(geminiResult.violations)) {
        geminiResult.violations = geminiResult.violations.filter(v => {
          const title = v.title.toLowerCase();
          return !excludedKeywords.some(keyword => title.includes(keyword));
        });
      }

      // Merge with YOLO violations
      geminiResult.violations.forEach(geminiViolation => {
        const isDuplicate = violations.some(v => v.title.toLowerCase() === geminiViolation.title.toLowerCase());
        if (!isDuplicate) {
          violations.push({
            category: geminiViolation.category || "Traffic Violation",
            title: geminiViolation.title,
            description: geminiViolation.description,
            law: geminiViolation.law,
            fineAmount: geminiViolation.fineAmount || 1000,
            fineReference: geminiViolation.fineReference || "Current Kerala regulations",
            severity: geminiViolation.severity || "Medium"
          });
          console.log(`💰 Fine for "${geminiViolation.title}": ₹${geminiViolation.fineAmount || 1000}`);
        }
      });

    } else {
      // Non‑traffic image: only Gemini violations (no YOLO)
      console.log("🌍 Non-traffic image – running Gemini for violations...");
      const geminiText = await callGeminiAI(VIOLATION_DETECTION_PROMPT, cleanBase64);
      const geminiResult = safeJSONParse(geminiText, { violationsFound: false, vehicleType: "unknown", violations: [] });

      // Filter out unwanted keywords
      const excludedKeywords = ['footwear', 'hsrp', 'registration plate', 'non-compliance'];
      if (geminiResult.violations && Array.isArray(geminiResult.violations)) {
        geminiResult.violations = geminiResult.violations.filter(v => {
          const title = v.title.toLowerCase();
          return !excludedKeywords.some(keyword => title.includes(keyword));
        });
      }

      violations = geminiResult.violations.map(v => ({
        category: v.category || "Environmental Violation",
        title: v.title,
        description: v.description,
        law: v.law,
        fineAmount: v.fineAmount || 1000,
        fineReference: v.fineReference || "Current Kerala regulations",
        severity: v.severity || "Medium"
      }));
    }

    // Calculate total fine
    const totalFine = violations.reduce((sum, v) => sum + (v.fineAmount || 0), 0);

    // Clean up temp file
    try {
      fs.unlinkSync(imagePath);
      console.log("🗑️ Temp file deleted");
    } catch (e) { /* ignore */ }

    // Send response
    res.json({
      violationsFound: violations.length > 0,
      violations: violations.map(v => ({
        category: v.category,
        title: v.title,
        description: v.description,
        law: v.law,
        fineAmount: `₹${v.fineAmount}`,
        fineReference: v.fineReference,
        severity: v.severity
      })),
      vehicleType: vehicleType,
      number_plates: plateResult.plates || [],
      plates_found: plateResult.plates_found || 0,
      totalEstimatedFine: `₹${totalFine}`,
      classification: {
        isTraffic: classification.isTraffic,
        confidence: classification.confidence
      },
      fineDisclaimer: "Fines are based on current Kerala regulations as known to Gemini AI."
    });

  } catch (err) {
    console.error("❌ ANALYZE ERROR:", err);
    try { fs.unlinkSync(path.join(__dirname, "temp.png")); } catch (e) {}
    res.status(500).json({ 
      error: "Analysis failed",
      violationsFound: false,
      violations: [],
      number_plates: [],
      plates_found: 0,
      totalEstimatedFine: "₹0"
    });
  }
});

// =========================================================
// 11. START SERVER
// =========================================================
app.listen(5000, () => console.log("🚀 Backend Running on Port 5000"));