const axios = require("axios");

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const callGemini = async (prompt, userContext = {}) => {
  const uniqueId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const systemMessage = `You are GlowUp AI - a personalized beauty and fitness assistant.
Time: ${timestamp} | Session: ${uniqueId}
Context: ${JSON.stringify(userContext)}
Rules: Give UNIQUE recommendations every time. Consider Indian lifestyle. Return ONLY valid JSON when asked. No markdown. No extra text before or after JSON.`;

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: String(prompt) },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        timeout: 30000,
      }
    );

    const text = response.data.choices?.[0]?.message?.content || "";
    console.log("✅ OpenAI OK, length:", text.length);
    console.log("📝 First 200 chars:", text.substring(0, 200));
    return text;

  } catch (err) {
    console.error("❌ OpenAI error:", err.response?.data || err.message);
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
      if (depth === 0 && start !== -1) { end = i; break; }
    }
  }

  if (start !== -1 && end !== -1) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch (_) {}
  }

  console.error("❌ JSON parse failed:", clean.substring(0, 400));
  throw new Error("Invalid JSON from OpenAI");
};

module.exports = { callGemini, parseGeminiJSON };