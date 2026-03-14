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

  const response = await axios.post(
    GROQ_API_URL,
    {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: 4000,       // Increased to avoid truncation
      temperature: 1.1,
      top_p: 0.9,
      frequency_penalty: 0.8,
      presence_penalty: 0.6,
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
};

const parseGroqJSON = (text) => {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    // JSON extract karne ki koshish
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Invalid JSON from AI");
  }
};

module.exports = { callGroq, parseGroqJSON };