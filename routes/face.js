const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    const prompt = `You are GlowUp AI's expert face analyst. Provide personalized hairstyle recommendations.
Return ONLY valid JSON, no extra text:
{
  "faceShape": "oval",
  "faceShapeDetails": "Your face has balanced proportions making it very versatile for hairstyles.",
  "skinTone": "medium",
  "jawlineType": "defined",
  "topHairstyles": ["Layered Cut - adds movement", "Side Part - sharp look", "Textured Quiff - adds height"],
  "stylesAvoid": ["Very flat styles - make face look longer"],
  "colorRecommendations": ["Dark Brown with highlights", "Natural Black"],
  "grooming": ["Trim every 4-6 weeks", "Use light pomade for styling"],
  "confidence": 88
}`;

    const text = await callGroq(prompt);
    const result = parseGroqJSON(text);
    await User.findByIdAndUpdate(req.user._id, { $push: { analyses: { type: "face", result } } });
    res.json({ success: true, result });
  } catch (err) {
    console.error("Face analysis error:", err.message);
    res.status(500).json({ error: "Face analysis failed. Please try again." });
  }
});

router.get("/history", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("analyses");
    const faceHistory = user.analyses.filter((a) => a.type === "face").reverse();
    res.json({ history: faceHistory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


