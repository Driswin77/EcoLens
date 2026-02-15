/**
 * Analyzer.js
 * Frontend utility – ONLY talks to backend
 * No Gemini SDK here ❌
 */

export async function analyzeMedia(base64Image, context) {
  const response = await fetch("http://localhost:5000/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base64: base64Image,
      context, // { administrativeArea }
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error("Backend analysis failed: " + err);
  }

  const data = await response.json();
  return data;
}
