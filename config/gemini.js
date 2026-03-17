const { GoogleGenerativeAI } = require("@google/generative-ai");

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const callGemini = async (prompt, userContext = {}) => {
  const uniqueId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const systemContent = `You are GlowUp AI - a personalized beauty and fitness assistant.
Time: ${timestamp} | Session: ${uniqueId}
Context: ${JSON.stringify(userContext)}
Rules: Give UNIQUE recommendations every time. Consider Indian lifestyle. Return ONLY valid JSON when asked. No markdown. No extra text before or after JSON.`;

  try {
    const model = genai.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemContent,
      generationConfig: {
        maxOutputTokens: 8000,
        temperature: 0.7,
        topP: 0.9,
      },
    });

    const result = await model.generateContent(String(prompt));
    const text = result.response.text();

    console.log("✅ Gemini OK, length:", text.length);
    console.log("📝 First 200 chars:", text.substring(0, 200));
    return text;

  } catch (err) {
    console.error("❌ Gemini error:", err.message);
    throw err;
  }
};

const parseGeminiJSON = (text) => {
  let clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  try { return JSON.parse(clean); } catch (_) {}

  let depth = 0, start = -1, end = -1;
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === "{") {
      if (start === -1) start = i;
      depth++;
    } else if (clean[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        end = i;
        break;
      }
    }
  }

  if (start !== -1 && end !== -1) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch (_) {}
  }

  console.error("❌ JSON parse failed:", clean.substring(0, 400));
  throw new Error("Invalid JSON from AI");
};

module.exports = { callGemini, parseGeminiJSON };