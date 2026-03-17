const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post("/message", protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required." });

    const model = genai.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `You are GlowUp AI's friendly personal style and beauty coach.
You reply in plain conversational text like a friend — NO JSON, NO bullet points unless asked, NO formatting.
Keep replies under 100 words. Be warm, encouraging, specific. Use emojis naturally.
Consider Indian context — Indian foods, brands, climate, culture.`,
      generationConfig: { maxOutputTokens: 200, temperature: 0.9 },
    });

    const result = await model.generateContent(message);
    const reply = result.response.text();

    res.json({ success: true, reply });

  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Chat failed. Please try again." });
  }
});

module.exports = router;