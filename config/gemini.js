const axios = require("axios");

const callGemini = async (prompt, userContext = {}) => {
  const uniqueId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const systemMessage = "You are GlowUp AI - a personalized beauty and fitness assistant. Time: " + timestamp + " | Session: " + uniqueId + ". Give UNIQUE recommendations. Consider Indian lifestyle. Return ONLY valid JSON when asked. No markdown.";
  try {
    const response = await axios.post("https://api.x.ai/v1/chat/completions", {
      model: "grok-beta",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: String(prompt) }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }, {
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.GROK_API_KEY },
      timeout: 30000,
    });
    const text = response.data.choices?.[0]?.message?.content || "";
    console.log("? Grok OK, length:", text.length);
    return text;
  } catch (err) {
    console.error("? Grok error:", err.response?.data || err.message);
    throw err;
  }
};

const parseGeminiJSON = (text) => {
  let clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(clean); } catch (_) {}
  let depth = 0, start = -1, end = -1;
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === "{") { if (start === -1) start = i; depth++; }
    else if (clean[i] === "}") { depth--; if (depth === 0 && start !== -1) { end = i; break; } }
  }
  if (start !== -1 && end !== -1) { try { return JSON.parse(clean.slice(start, end + 1)); } catch (_) {} }
  throw new Error("Invalid JSON from Grok");
};

module.exports = { callGemini, parseGeminiJSON };
