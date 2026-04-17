const axios = require("axios");

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const callGemini = async (prompt, userContext = {}) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: `You are GlowUp AI - a beauty and fitness assistant for Indian users. Return ONLY valid JSON when asked. No markdown.\n\n${String(prompt)}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("✅ Gemini OK, length:", text.length);
    return text;
  } catch (err) {
    console.error("❌ Gemini error:", err.response?.data || err.message);
    throw err;
  }
};

const parseGeminiJSON = (text) => {
  let clean = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch (_) {}

  let depth = 0,
    start = -1,
    end = -1;
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
    try {
      return JSON.parse(clean.slice(start, end + 1));
    } catch (_) {}
  }

  throw new Error("Invalid JSON from Gemini");
};

module.exports = { callGemini, parseGeminiJSON };