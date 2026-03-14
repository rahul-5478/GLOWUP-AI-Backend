const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callAI, parseAIJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { occasion, style, bodyType, budget, imageBase64, mediaType = "image/jpeg" } = req.body;
    if (!occasion) return res.status(400).json({ error: "Occasion is required." });

    const prompt = `Give UNIQUE outfit recommendations for:
Occasion: ${occasion}
Style: ${style || "any"}
Body type: ${bodyType || "any"}
Budget: ${budget || "mixed"}
Timestamp: ${Date.now()}

${imageBase64 ? "Look at the person in the image to give more accurate recommendations based on their actual body type and style." : ""}

Return ONLY this JSON:
{
  "bodyShape": "actual body shape",
  "bodyShapeDetails": "2 sentences about their shape",
  "outfitRecommendations": [
    {"outfit": "outfit name", "description": "detailed description", "why": "why it suits them", "priceRange": "budget", "indianBrands": ["brand1", "brand2"]},
    {"outfit": "outfit name", "description": "detailed description", "why": "why it suits them", "priceRange": "mid", "indianBrands": ["brand1", "brand2"]},
    {"outfit": "outfit name", "description": "detailed description", "why": "why it suits them", "priceRange": "premium", "indianBrands": ["brand1", "brand2"]}
  ],
  "colorPalette": ["#hex - Color Name", "#hex - Color Name", "#hex - Color Name", "#hex - Color Name"],
  "stylesAvoid": ["style 1 with reason", "style 2 with reason"],
  "accessories": ["accessory 1", "accessory 2", "accessory 3"],
  "brands": {
    "budget": ["H&M", "Zara", "Uniqlo"],
    "mid": ["Mango", "Tommy Hilfiger", "Van Heusen"],
    "premium": ["Raymond", "Hugo Boss", "Louis Philippe"]
  },
  "styleTip": "specific tip for ${occasion}",
  "seasonalTip": "India-specific seasonal tip"
}`;

    const text = await callAI(
      prompt,
      { occasion, style, bodyType, budget, userId: req.user._id },
      imageBase64 || null,
      mediaType
    );
    const result = parseAIJSON(text);

    await User.findByIdAndUpdate(req.user._id, {
      $push: { analyses: { type: "fashion", result } }
    });

    res.json({ success: true, result });
  } catch (err) {
    console.error("Fashion analysis error:", err.message);
    res.status(500).json({ error: "Fashion analysis failed. Please try again." });
  }
});

router.get("/history", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("analyses");
    const history = user.analyses.filter((a) => a.type === "fashion").reverse();
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;