const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq } = require("../config/groq");

router.post("/message", protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required." });

    const prompt = `You are GlowUp AI's personal style coach — expert in fashion, skincare, fitness, and beauty. You give practical, personalized advice. Be friendly, concise, and helpful. Use emojis occasionally.

User asks: "${message}"

Give a helpful response in 2-4 sentences maximum.`;

    const reply = await callGroq(prompt);
    res.json({ success: true, reply });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Could not get response." });
  }
});

module.exports = router;