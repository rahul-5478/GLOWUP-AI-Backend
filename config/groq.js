const axios = require("axios");

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const callGroq = async (prompt, userContext = {}) => {
  const uniqueId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const systemPrompt = `You are GlowUp AI - a real-time personalized beauty and fitness assistant.
Current time: ${timestamp}
Session ID: ${uniqueId}
User context: ${JSON.stringify(userContext)}

IMPORTANT RULES:
- Give UNIQUE, PERSONALIZED recommendations every time
- Never repeat the same advice twice
- Base advice on user's specific inputs
- Be creative and vary your suggestions
- Consider Indian lifestyle, climate, and food habits
- Give fresh, different recommendations each session
- Return ONLY valid JSON. No markdown. No explanation. Start with { end with }`;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: 1200,
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
    console.log("✅ Groq response received, length:", text.length);
    console.log("📝 Groq raw (first 300):", text.substring(0, 300));
    return text;

  } catch (err) {
    console.error("❌ Groq API error:", err.response?.data || err.message);
    throw err;
  }
};

const parseGroqJSON = (text) => {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    console.log("✅ JSON parsed successfully");
    return parsed;
  } catch (e) {
    console.log("⚠️ Direct parse failed, trying regex extract...");
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        console.log("✅ JSON extracted via regex");
        return parsed;
      } catch (e2) {
        console.error("❌ JSON parse failed:", text.substring(0, 500));
        throw new Error("Invalid JSON from AI");
      }
    }
    throw new Error("Invalid JSON from AI");
  }
};

module.exports = { callGroq, parseGroqJSON };