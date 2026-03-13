const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64, skinConcerns, hairType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    const prompt = `You are GlowUp AI's expert face analyst and stylist.
Analyze this person and give UNIQUE, CREATIVE, PERSONALIZED recommendations.
Random seed: ${Math.random()}
User concerns: ${skinConcerns || "general"}, Hair type: ${hairType || "unknown"}

Give DIFFERENT hairstyle and skincare advice each time — be creative!

Return ONLY valid JSON:
{
  "faceShape": "oval",
  "faceShapeDetails": "Your face has balanced proportions making it very versatile for hairstyles.",
  "skinTone": "medium",
  "skinToneHex": "#C68642",
  "jawlineType": "defined",
  "topHairstyles": [
    {"name": "Layered Cut", "reason": "Adds movement and volume to your face shape", "maintenance": "Low"},
    {"name": "Side Part", "reason": "Creates a sharp, professional look", "maintenance": "Medium"},
    {"name": "Textured Quiff", "reason": "Adds height and modern touch", "maintenance": "Medium"}
  ],
  "stylesAvoid": ["Very flat styles - make face look longer", "Too much volume on sides"],
  "colorRecommendations": ["Dark Brown with caramel highlights", "Natural Black with subtle lowlights"],
  "skincare": {
    "type": "combination",
    "concerns": ["mild acne", "uneven tone"],
    "morningRoutine": ["Gentle cleanser", "Vitamin C serum", "SPF 50 moisturizer"],
    "nightRoutine": ["Micellar water", "Retinol serum", "Night cream"]
  },
  "grooming": ["Trim every 4-6 weeks", "Use light pomade for styling", "Massage scalp daily"],
  "confidence": 88
}`;

    const text = await callGroq(prompt, { skinConcerns, hairType, userId: req.user._id });
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