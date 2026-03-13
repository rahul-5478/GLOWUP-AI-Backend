const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64, skinConcerns, hairType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    const prompt = `Analyze this person's face and give UNIQUE personalized recommendations.
Skin concerns: ${skinConcerns || "none mentioned"}
Hair type: ${hairType || "unknown"}
Timestamp: ${Date.now()}

Give CREATIVE, VARIED advice. Consider Indian hair types, skin tones, climate.

Return JSON with EXACTLY these keys:
{
  "faceShape": (one of: oval/round/square/heart/diamond/oblong),
  "faceShapeDetails": (2 sentences specific to their shape),
  "skinTone": (fair/wheatish/medium/dusky/deep),
  "skinToneHex": (actual hex color),
  "jawlineType": (soft/defined/strong),
  "topHairstyles": [3 objects with "name", "reason", "maintenance"],
  "stylesAvoid": [2-3 specific styles to avoid with reasons],
  "colorRecommendations": [2-3 hair color ideas],
  "skincare": {
    "type": (skin type),
    "concerns": [actual concerns],
    "morningRoutine": [4 steps with Indian/affordable products],
    "nightRoutine": [4 steps]
  },
  "grooming": [3-4 specific grooming tips],
  "confidence": (number between 75-95)
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