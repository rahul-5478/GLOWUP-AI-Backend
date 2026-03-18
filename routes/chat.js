const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGemini } = require("../config/gemini"); // ✅ Use shared gemini config

router.post("/message", protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required." });

    const prompt = `You are GlowUp AI's friendly personal style and beauty coach.
Reply in plain conversational text like a friend — NO JSON, NO bullet points unless asked.
Keep replies under 100 words. Be warm, encouraging, specific. Use emojis naturally.
Consider Indian context — Indian foods, brands, climate, culture.

User message: ${message}`;

    const reply = await callGemini(prompt);

    res.json({ success: true, reply });

  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Chat failed. Please try again." });
  }
});

module.exports = router;