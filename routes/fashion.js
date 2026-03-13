const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { occasion, style, bodyType, budget } = req.body;
    if (!occasion) return res.status(400).json({ error: "Occasion is required." });

    const prompt = `Give UNIQUE outfit recommendations for:
Occasion: ${occasion}
Style: ${style || "any"}
Body type: ${bodyType || "any"}
Budget: ${budget || "mixed"}
Timestamp: ${Date.now()}

RULES:
- Suggest outfits specifically for ${occasion}
- Include real Indian brands available on Myntra/Ajio
- Consider Indian weather and culture
- Be CREATIVE — different suggestions every time

Return JSON with EXACTLY these keys:
{
  "bodyShape": (actual body shape),
  "bodyShapeDetails": (2 sentences specific to their shape),
  "outfitRecommendations": [3 objects each with "outfit", "description", "why", "priceRange", "indianBrands"],
  "colorPalette": [4 hex colors with names suited for ${occasion}],
  "stylesAvoid": [2-3 specific styles to avoid],
  "accessories": [3-4 specific accessories for ${occasion}],
  "brands": {
    "budget": [3 Indian budget brands],
    "mid": [3 Indian mid-range brands],
    "premium": [3 Indian premium brands]
  },
  "styleTip": (specific tip for ${occasion}),
  "seasonalTip": (India-specific seasonal tip)
}`;

    const text = await callGroq(prompt, { occasion, style, bodyType, budget, userId: req.user._id });
    const result = parseGroqJSON(text);
    await User.findByIdAndUpdate(req.user._id, { $push: { analyses: { type: "fashion", result } } });
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