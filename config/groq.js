const axios = require("axios");

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const callGroq = async (prompt, userContext = {}) => {
  // Har request unique banane ke liye random seed add karo
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
- Give fresh, different recommendations each session`;

  const response = await axios.post(
    GROQ_API_URL,
    {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: 1000,
      temperature: 1.1,       // High = more creative/varied
      top_p: 0.9,
      frequency_penalty: 0.8, // Repeat words avoid karega
      presence_penalty: 0.6,  // Naye topics encourage karega
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      timeout: 30000,
    }
  );
  return response.data.choices[0].message.content;
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