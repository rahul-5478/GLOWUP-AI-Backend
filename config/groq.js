const axios = require("axios");

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const callGroq = async (prompt, userContext = {}) => {
  const uniqueId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const systemPrompt = `You are GlowUp AI - expert dermatologist and beauty assistant.
Time: ${timestamp} | ID: ${uniqueId}
CRITICAL RULES:
1. Return ONLY raw JSON - no markdown, no backticks, no explanation
2. Start your response with { and end with }
3. All strings must use double quotes
4. No trailing commas
5. Give unique personalized advice every time`;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_tokens: 4000,
        temperature: 0.9,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.2,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        timeout: 45000,
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
  if (!text) throw new Error("Empty response from AI");

  // Remove markdown code blocks if present
  let clean = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  // Try direct parse first
  try {
    return JSON.parse(clean);
  } catch (e1) {
    // Extract JSON object using regex
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        // Try to fix common JSON issues
        let fixed = match[0]
          .replace(/,\s*}/g, "}")      // trailing comma before }
          .replace(/,\s*]/g, "]")      // trailing comma before ]
          .replace(/\n/g, " ")         // newlines
          .replace(/\t/g, " ");        // tabs
        try {
          return JSON.parse(fixed);
        } catch (e3) {
          console.error("❌ JSON parse failed. Raw text:", text.substring(0, 500));
          throw new Error("Could not parse AI response as JSON");
        }
      }
    }
    throw new Error("No JSON object found in AI response");
  }
};

module.exports = { callGroq, parseGroqJSON };