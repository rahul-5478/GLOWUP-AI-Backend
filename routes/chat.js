const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGemini } = require("../config/gemini");
const User = require("../models/User");

// ─── POST /api/chat/message ───────────────────────────────────────────────────
router.post("/message", protect, async (req, res) => {
  try {
    const { message, history = [], context = {} } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const conversationHistory = history
      .slice(-10)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const prompt = `You are GlowUp AI — a friendly expert beauty, fitness, and style assistant for Indian users.

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n` : ""}
User: ${message}

Reply helpfully and conversationally. Keep response under 200 words unless asked for detail.
For product recommendations, prefer Indian brands available on Nykaa/Amazon.
Return ONLY plain text — no JSON, no markdown headers.`;

    const text = await callGemini(prompt, { message });

    // Non-fatal DB save
    try {
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          analyses: {
            type: "chat",
            result: { userMessage: message, aiReply: text, timestamp: new Date() },
          },
        },
      });
    } catch (dbErr) {
      console.log("Chat DB save non-fatal:", dbErr.message);
    }

    return res.json({ success: true, reply: text });

  } catch (err) {
    console.error("Chat route error:", err.message);
    return res.status(500).json({ error: "Chat failed. Please try again." });
  }
});

// ─── GET /api/chat/history ────────────────────────────────────────────────────
router.get("/history", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("analyses");
    const chatHistory = (user.analyses || [])
      .filter((a) => a.type === "chat")
      .reverse()
      .slice(0, 50);
    return res.json({ success: true, history: chatHistory });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;