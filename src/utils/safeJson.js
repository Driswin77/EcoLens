// backend/utils/safeJson.js
export function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {
      violation_detected: false,
      category: "None",
      summary: "Unable to parse AI response",
      explanation: "Gemini returned an invalid response",
    };
  }
}
