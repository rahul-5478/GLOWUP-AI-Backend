const axios = require("axios");

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const callGroq = async (prompt) => {
  const response = await axios.post(
    GROQ_API_URL,
    {
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.7,
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
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
};

module.exports = { callGroq, parseGroqJSON };
