const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callAI, parseAIJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64, skinConcerns, hairType, gender, mediaType = "image/jpeg" } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    const prompt = `Analyze this person's face in the image carefully and give REAL, ACCURATE, PERSONALIZED recommendations.
Gender: ${gender || "not specified"}
Skin concerns mentioned: ${skinConcerns || "none"}
Hair type: ${hairType || "unknown"}
Timestamp: ${Date.now()}

Look at the ACTUAL face in the image — detect real face shape, skin tone, hair, etc.

Return ONLY this JSON, no markdown:
{
  "faceShape": "actual shape from image (oval/round/square/heart/diamond/oblong)",
  "faceShapeDetails": "2 sentences about their specific face shape",
  "skinTone": "actual tone (fair/wheatish/medium/dusky/deep)",
  "skinToneHex": "actual hex color matching their skin",
  "jawlineType": "soft/defined/strong based on image",
  "topHairstyles": [
    {"name": "hairstyle name", "reason": "why it suits their face", "maintenance": "Low/Medium/High"},
    {"name": "hairstyle name", "reason": "why it suits their face", "maintenance": "Low/Medium/High"},
    {"name": "hairstyle name", "reason": "why it suits their face", "maintenance": "Low/Medium/High"}
  ],
  "stylesAvoid": ["style to avoid with reason", "style to avoid with reason"],
  "colorRecommendations": ["color idea 1", "color idea 2"],
  "skincare": {
    "type": "detected skin type",
    "concerns": ["concern 1", "concern 2"],
    "morningRoutine": ["step 1 with Indian product", "step 2", "step 3", "step 4"],
    "nightRoutine": ["step 1", "step 2", "step 3", "step 4"]
  },
  "grooming": ["tip 1", "tip 2", "tip 3", "tip 4"],
  "confidence": 92
}`;

    const text = await callAI(prompt, { skinConcerns, hairType, gender, userId: req.user._id }, imageBase64, mediaType);
    const result = parseAIJSON(text);

    await User.findByIdAndUpdate(req.user._id, {
      $push: { analyses: { type: "face", result } }
    });

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