// backend/geminiService.js
import fetch from "node-fetch";

export async function analyzeWithGemini(base64Image, location) {
  if (!base64Image) {
    throw new Error("No image data provided to Gemini");
  }

  const prompt = `
You are an AI Environmental and Traffic Compliance Analyst for ${location}, India.

CRITICAL INSTRUCTIONS:
- Analyze ONLY what is VISIBLE in the image
- Do NOT assume facts that cannot be seen
- If a violation is visible → report it
- If NOT clearly visible → say "Insufficient visual evidence"
- Do NOT default to "No Violation" unless image is clearly compliant

CHECK STRICTLY FOR:

1. Traffic Violations:
   - Rider without helmet
   - Driver without seatbelt
   - Obscured / missing number plate

2. Environmental Violations:
   - Open burning of waste
   - Thick black smoke
   - Burning of tires, plastic, chemical containers

3. Industrial Violations:
   - Illegal waste dumping
   - Uncontrolled emissions

RETURN JSON ONLY (NO MARKDOWN, NO EXTRA TEXT):

{
  "violation_detected": true | false,
  "category": "Traffic | Environmental | Industrial | None",
  "summary": "One-line decision",
  "detailed_observation": "What is clearly visible in the image",
  "applicable_law": "Relevant Indian law or N/A",
  "explanation": "Why this is or is not a violation",
  "prevention_advice": "Corrective action",
  "estimated_fine": "₹ amount or N/A"
}
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image
                }
              }
            ]
          }
        ]
      })
    }
  );

  const result = await response.json();

  const rawText =
    result?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Gemini returned empty response");
  }

  const cleaned = rawText.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("❌ Gemini JSON Parse Error:", cleaned);
    throw new Error("Invalid JSON returned by Gemini");
  }
}
