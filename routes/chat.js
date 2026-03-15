const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const axios = require("axios");

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

router.post("/message", protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required." });

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are GlowUp AI's friendly personal style and beauty coach. 
You reply in plain conversational text like a friend — NO JSON, NO bullet points unless asked, NO formatting.
Keep replies under 100 words. Be warm, encouraging, specific. Use emojis naturally.
Consider Indian context — Indian foods, brands, climate, culture.`
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 200,
        temperature: 0.9,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        },
        timeout: 20000,
      }
    );

    const reply = response.data.choices[0].message.content;
    res.json({ success: true, reply });

  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Chat failed. Please try again." });
  }
});

module.exports = router;