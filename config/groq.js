const axios = require("axios");

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const callGroq = async (prompt, userContext = {}) => {
  const uniqueId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // System prompt as plain string
  const systemContent = `You are GlowUp AI - a personalized beauty and fitness assistant.
Time: ${timestamp} | Session: ${uniqueId}
Context: ${JSON.stringify(userContext)}
Rules: Give UNIQUE recommendations every time. Consider Indian lifestyle. Return ONLY valid JSON when asked. No markdown.`;

  // User content must be plain string
  const userContent = String(prompt);

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent }
        ],
        max_tokens: 1500,
        temperature: 1.0,
        top_p: 0.9,
        frequency_penalty: 0.5,
        presence_penalty: 0.3,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        },
        timeout: 30000,
      }
    );

    const text = response.data.choices[0].message.content;
    console.log("✅ Groq OK, length:", text.length);
    console.log("📝 First 200 chars:", text.substring(0, 200));
    return text;

  } catch (err) {
    console.error("❌ Groq error:", err.response?.data || err.message);
    throw err;
  }
};

const parseGroqJSON = (text) => {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        console.error("❌ JSON parse failed:", text.substring(0, 300));
        throw new Error("Invalid JSON from AI");
      }
    }
    throw new Error("Invalid JSON from AI");
  }
};

module.exports = { callGroq, parseGroqJSON };