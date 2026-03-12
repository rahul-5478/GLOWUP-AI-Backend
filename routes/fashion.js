const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { occasion } = req.body;
    if (!occasion)
      return res.status(400).json({ error: "Occasion is required." });

    const prompt = `You are GlowUp AI's elite personal stylist for a ${occasion} occasion.
Return ONLY valid JSON, no extra text:
{
  "bodyShape": "rectangle",
  "bodyShapeDetails": "Athletic build with balanced proportions.",
  "outfitRecommendations": [
    {"outfit": "Smart Casual", "description": "Navy chinos with white Oxford shirt and sneakers", "why": "Adds dimension to straight body shape", "priceRange": "budget"},
    {"outfit": "Classic Elegant", "description": "Charcoal blazer over light blue shirt with dark jeans", "why": "Creates sharp V-shape silhouette", "priceRange": "mid"},
    {"outfit": "Premium Style", "description": "Tailored navy suit with white shirt and oxford shoes", "why": "Maximizes athletic build for powerful appearance", "priceRange": "premium"}
  ],
  "colorPalette": ["#1B2A4A - Deep Navy", "#F5F0E8 - Ivory White", "#8B6914 - Caramel Brown", "#2C5F2E - Forest Green"],
  "stylesAvoid": ["Baggy clothing - hides athletic build"],
  "accessories": ["Minimalist leather watch", "Simple leather belt", "Small chain necklace"],
  "brands": ["H&M, Zara, Uniqlo (budget)", "Mango, Tommy Hilfiger (mid-range)", "Ralph Lauren, Hugo Boss (premium)"],
  "styleTip": "Invest in well-fitted basics in neutral colors - navy, white, grey, and black form the foundation of every great outfit."
}`;

    const text = await callGroq(prompt);
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