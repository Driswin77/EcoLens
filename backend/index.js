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
    user: process.env.EMAIL_USER || 'driswin092@gmail.com', // 🔴 YOUR GMAIL
    pass: process.env.EMAIL_PASS || 'znsrxofufivsbcsd'      // 🔴 YOUR APP PASSWORD
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
          <li><strong>📸 Visual Scanner:</strong> Instantly detect traffic & environmental violations using AI.</li>
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

// --- HELPER: OFFICIAL ALERT EMAIL ---
const sendOfficialAlert = async (report, authorityName) => {
  const mailOptions = {
    from: '"EcoLens Enforcer" <no-reply@ecopenalty.gov>',
    to: 'recipient_email@gmail.com', // 🔴 RECIPIENT EMAIL (Replace with authority email logic if needed)
    subject: ` OFFICIAL ALERT: ${report.category} Detected - ${authorityName}`,
    html: `
      <div style="font-family: Arial, sans-serif; border: 1px solid #333; padding: 20px; max-width: 600px;">
        <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px;">
          ⚠️ Violation Report #${report._id.toString().slice(-6).toUpperCase()}
        </h2>
        
        <p><strong>To:</strong> ${authorityName}</p>
        <p><strong>Reporter Email:</strong> ${report.userEmail}</p>
        <p><strong>Date:</strong> ${report.offenseDate || new Date().toLocaleDateString()} | 
           <strong>Time:</strong> ${report.offenseTime || new Date().toLocaleTimeString()}</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #d32f2f;">
          <h3 style="margin-top: 0;">Offense Details</h3>
          <ul style="line-height: 1.6;">
            <li><strong>Violation:</strong> ${report.title}</li>
            <li><strong>Category:</strong> ${report.category}</li>
            <li><strong>Severity:</strong> <span style="color: red; font-weight: bold;">${report.severity}</span></li>
            <li><strong>Location:</strong> ${report.location}</li>
          </ul>
        </div>

        <p><strong>Officer Observation:</strong><br/>${report.description}</p>

        <div style="margin-top: 20px; font-size: 12px; color: #666; text-align: center;">
          <p>Automated dispatch via EcoLens System.<br/>
          Evidence attached below.</p>
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
    console.log(`📧 EMAIL SENT SUCCESSFULLY to Authority`);
  } catch (error) {
    console.error("❌ EMAIL FAILED:", error);
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
            console.log("CONNECTED TO DB....");
            isCloudConnected = true;
        })
        .catch(err => console.error("⚠️ Cloud Connection Error:", err.message));
} else {
    console.log("⚠️ No MONGO_URI. Using Local Mode (DB features may fail).");
}

// --- SCHEMAS ---
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
  status: { type: String, default: "Forwarded" }, 
  forwardedTo: String, 
  offenseDate: String, 
  offenseTime: String, 
  date: { type: Date, default: Date.now }
});
const IssueReport = mongoose.model("IssueReport", IssueSchema);

// --- INDUSTRY ENFORCEMENT SCHEMA (PRESERVED FOR STRUCTURE ONLY) ---
const IndustryHistorySchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Apex Chemicals"
  location: {
    lat: Number,
    lon: Number,
    address: String
  },
  email: { type: String }, // Contact email of the industry
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

// --- LEGAL ADVISOR SCHEMA (UPDATED) ---
const legalAdvisorSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  language: { type: String, default: 'English' }, // New field to track the selected language
  analysis: {
    penalty: String,
    law: String,
    resolution: String,
    appealDraft: String // Added to match your latest backend prompt
  },
  status: { type: String, default: 'Active' },
  createdAt: { type: Date, default: Date.now }
});

const LegalAdvisor = mongoose.model('LegalAdvisor', legalAdvisorSchema, 'LegalAdvisor');
// =========================================================
// 3. AI HELPERS (Gemini)
// =========================================================

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callGeminiAI(prompt, base64Image = null, mimeType = "image/jpeg") {
    const API_KEY = process.env.GEMINI_API_KEY;
    
    // Priority is Gemini 2.5 Flash
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

// B. REAL-TIME RULES GENERATOR
async function getLocalRulesWithAI(location) {
    try {
        console.log(`🤖 Fetching laws for: ${location}`);
        const prompt = `
        You are a legal expert for ${location}.
        List 4 specific TRAFFIC rules and 4 ENVIRONMENTAL rules enforced in ${location}.
        Include the typical Fine Amount in the description.

        Output STRICT JSON format only:
        {
          "traffic": [ { "title": "Rule Name", "desc": "Brief description with Fine amount." } ],
          "eco": [ { "title": "Rule Name", "desc": "Brief description with Fine amount." } ]
        }
        `;

        const text = await callGeminiAI(prompt);
        const cleanJson = text.replace(/```json|```/g, "").trim();
        const firstBrace = cleanJson.indexOf("{");
        const lastBrace = cleanJson.lastIndexOf("}");
        const finalJson = (firstBrace !== -1 && lastBrace !== -1) ? cleanJson.substring(firstBrace, lastBrace + 1) : "{}";
        return JSON.parse(finalJson);
    } catch (e) {
        console.error("Rules Fetch Failed:", e.message);
        return null; 
    }
}

// C. DOCUMENT SCANNER
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
    
    const cleanJson = text.replace(/```json|```/g, "").trim();
    const firstBrace = cleanJson.indexOf("{");
    const lastBrace = cleanJson.lastIndexOf("}");
    const finalJson = (firstBrace !== -1 && lastBrace !== -1) ? cleanJson.substring(firstBrace, lastBrace + 1) : "{}";
    
    console.log("📄 AI Scan Result:", finalJson);
    return JSON.parse(finalJson);
  } catch (e) {
    console.error("❌ Critical Scan Error:", e.message);
    return { type: "Document", plate_number: "Manual Check", expiry_date: new Date().toISOString().split('T')[0] };
  }
}

// D. VISUAL SCANNER (UPGRADED FOR MULTIPLE VIOLATIONS)
async function analyzeTrafficWithAI(base64Image, contextOrPrompt) {
    let finalPrompt = `
    Analyze traffic/environmental image. 
    Strictly Output JSON (No markdown): 
    { 
      "violationsFound": boolean,
      "totalEstimatedFine": "Total amount in ₹",
      "overallSeverity": "High/Medium/Low",
      "violations": [
          {
            "category": "Traffic" or "Environmental", 
            "title": "Short Title", 
            "description": "Brief description", 
            "law": "Indian Law Section", 
            "fineAmount": "Estimated Fine in ₹",
            "severity": "High/Medium/Low"
          }
      ]
    }`;
    
    if (typeof contextOrPrompt === 'string' && contextOrPrompt.length > 10) {
        finalPrompt = contextOrPrompt;
    } else if (contextOrPrompt && contextOrPrompt.prompt) {
        finalPrompt = contextOrPrompt.prompt;
    }

    try {
        const text = await callGeminiAI(finalPrompt, base64Image, "image/jpeg");
        let cleanJson = text.replace(/```json|```/g, "").trim();
        const firstBrace = cleanJson.indexOf("{");
        const lastBrace = cleanJson.lastIndexOf("}");
        
        if (firstBrace !== -1 && lastBrace !== -1) {
            cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
        }
        
        return JSON.parse(cleanJson);
    } catch (e) {
        console.error("AI Analysis Error:", e);
        return { 
            violationsFound: false, 
            totalEstimatedFine: "₹0",
            overallSeverity: "Low",
            violations: [{ category: "Error", title: "Analysis Failed", description: e.message, law: "N/A", fineAmount: "₹0", severity: "Low" }] 
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
        case 'Industrial': // DIRECT ROUTING FOR INDUSTRIAL VIOLATIONS
            return `Environmental Engineer, State Pollution Control Board (District Office) - ${locationString}`;
        case 'Garbage / Waste':
            return `Health Inspector, ${localBodyType} - ${locationString} Circle`;
        default:
            return `Public Grievance Cell, ${localBodyType} - ${locationString}`;
    }
};

// =========================================================
// 5. AUTOMATED 3-DAY EXPIRY REMINDER (Runs Daily at 9 AM)
// =========================================================
cron.schedule('0 9 * * *', async () => {
    console.log("⏰ Running Daily 3-Day Expiry Check...");

    // Check Cloud Connection
    if (!isCloudConnected) {
        console.log("⚠️ Database not connected, skipping check.");
        return;
    }

    try {
        // 1. Calculate the Target Date (Today + 3 Days)
        const today = new Date();
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + 3);

        // Format to YYYY-MM-DD to match your DB string format
        const targetStr = targetDate.toISOString().split('T')[0];

        console.log(`🔍 Looking for documents expiring on: ${targetStr}`);

        // 2. Find documents matching this expiry date
        const expiringDocs = await Document.find({ expiry: targetStr });

        if (expiringDocs.length === 0) {
            console.log("✅ No documents expiring in 3 days.");
            return;
        }

        console.log(`⚠️ Found ${expiringDocs.length} documents expiring in 3 days.`);

        // 3. Loop through and send emails
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
// 6. API ROUTES
// =========================================================

app.post("/get-local-laws", async (req, res) => {
    const { location } = req.body;
    const rules = await getLocalRulesWithAI(location);
    if (rules) res.json({ success: true, ...rules }); 
    else res.status(500).json({ success: false });
});

// --- SIGNUP ROUTE (EMAIL + WELCOME MAIL) ---
app.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!isCloudConnected) return res.status(503).json({ error: "Cloud offline" });
        
        // Check existing by Email
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: "Email already registered." });

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        
        // 📨 TRIGGER WELCOME EMAIL
        sendWelcomeEmail(email, name);

        res.json({ success: true, user: { name: newUser.name, email: newUser.email } });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- LOGIN ROUTE ---
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!isCloudConnected) return res.status(503).json({ error: "Cloud offline" });
        
        // Find User by Email
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found." });

        // Verify Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid Credentials" });

        res.json({ success: true, user: { name: user.name, email: user.email } });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

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

    if (!aiData || aiData.type === "Error") {
        aiData = { type: "Document", plate_number: "Manual Check", expiry_date: new Date().toISOString().split('T')[0] };
    }

    // Save with userEmail
    const newDoc = new Document({ userEmail, name, type: aiData.type, plate: aiData.plate_number, expiry: aiData.expiry_date, image });
    if (isCloudConnected) { await newDoc.save(); res.json({ success: true, doc: newDoc }); } 
    else { res.status(503).json({ error: "Cloud offline" }); }
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/my-docs", async (req, res) => {
  try {
      const { userEmail } = req.query;
      if (isCloudConnected) {
          const docs = await Document.find({ userEmail }); 
          res.json(docs.map(d => ({ ...d._doc, id: d._id.toString() })).sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)));
      } else { res.json([]); }
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete("/delete-doc/:id", async (req, res) => {
  if (isCloudConnected) { await Document.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  else { res.status(503).json({ error: "Cloud offline" }); }
});

// --- SUBMIT REPORT ROUTE (Original) ---
app.post("/submit-report", async (req, res) => {
    try {
        const { title, category, severity, description, location, image, userEmail, dateOfOffense, timeOfOffense, authorityName } = req.body;
        
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
                status: "Forwarded",
                forwardedTo: officialAuthority,
                offenseDate: dateOfOffense || new Date().toLocaleDateString('en-IN'),
                offenseTime: timeOfOffense || new Date().toLocaleTimeString('en-IN')
            });
            await issue.save();

            // 📨 TRIGGER EMAIL
            sendOfficialAlert(issue, officialAuthority);

            console.log(`📨 OFFICIAL DISPATCH: Report #${issue._id}`);
            console.log(`   ► ROUTED TO: ${officialAuthority}`);

            res.json({ success: true, report: issue, forwardedTo: officialAuthority });
        } else { 
            res.json({ success: true, forwardedTo: officialAuthority }); 
        }
    } catch(e) { 
        res.status(500).json({error: e.message}); 
    }
});

// --- PADDED SPACE TO MAINTAIN LINE COUNT ---
// This section previously contained the /report-industry logic.
// It has been removed to disable the tiered warning system.
// The code will now fall back to the standard submit-report logic
// for all industrial and environmental violations.
// --- END PADDED SPACE ---

app.get("/my-reports", async (req, res) => {
    try {
        const { userEmail } = req.query;
        if (!userEmail) return res.json([]);

        if(isCloudConnected) { 
            const reports = await IssueReport.find({ userEmail }).sort({ date: -1 }); 
            res.json(reports); 
        } 
        else { res.json([]); }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/legal/analyze", async (req, res) => {
  try {
    const { description, userId, language } = req.body;
    const finalUserId = userId?.trim() ? userId : "Guest";

    const languageMap = {
      'en-IN': 'English',
      'hi-IN': 'Hindi',
      'ml-IN': 'Malayalam',
      'ta-IN': 'Tamil',
      'kn-IN': 'Kannada'
    };
    const targetLang = languageMap[language] || 'English';

    const prompt = `You are an Indian Traffic and Environmental Legal Expert. 
    Analyze: "${description}". 
    CRITICAL: Provide the entire response strictly in formal ${targetLang}.
    Return STRICT JSON: 
    { 
      "penalty": "Fine/penalty summary.", 
      "law": "Specific Section and Act.", 
      "resolution": "Step 1; Step 2; Step 3", 
      "appealDraft": "Detailed formal appeal body for a legal document." 
    }`;

    const text = await callGeminiAI(prompt);
    
    // Robust JSON extraction
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid AI response format");
    const aiResponse = JSON.parse(jsonMatch[0]);

    const newRecord = new LegalAdvisor({
      userId: finalUserId,
      description,
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

app.get("/api/legal/history/:userId", async (req, res) => {
  try {
    if (!isCloudConnected) return res.json([]);
    // Fetch history for the specific user
    const history = await LegalAdvisor.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(5);
    res.json(history);
  } catch (error) { 
    res.status(500).json({ error: "Failed to fetch history" }); 
  }
});

app.post("/analyze", async (req, res) => {
  try {
    const { base64, prompt, context } = req.body;
    const parts = base64.split(",");
    const cleanBase64 = parts.length > 1 ? parts[1] : parts[0];
    
    const analysisData = await analyzeTrafficWithAI(cleanBase64, prompt || context);
    res.json(analysisData);
  } catch (err) { res.status(500).json({ violation: false, title: "Error", description: err.message }); }
});

app.listen(5000, () => console.log("Backend Running on Port 5000"));