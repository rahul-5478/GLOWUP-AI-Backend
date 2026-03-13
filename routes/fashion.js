const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { occasion, style, bodyType, budget } = req.body;
    if (!occasion) return res.status(400).json({ error: "Occasion is required." });

    const prompt = `You are GlowUp AI's elite personal stylist.
Create UNIQUE, CREATIVE outfit recommendations for this specific person:
- Occasion: ${occasion}
- Preferred style: ${style || "not specified"}
- Body type: ${bodyType || "not specified"}
- Budget: ${budget || "mixed"}
- Random variation: ${Math.random()}

Give DIFFERENT outfit ideas every time. Consider Indian fashion trends and brands too.

Return ONLY valid JSON:
{
  "bodyShape": "rectangle",
  "bodyShapeDetails": "Athletic build with balanced proportions — very versatile for styling.",
  "outfitRecommendations": [
    {
      "outfit": "Smart Casual",
      "description": "Navy chinos with white Oxford shirt and white sneakers",
      "why": "Adds dimension and keeps it relaxed yet put-together",
      "priceRange": "budget",
      "indianBrands": ["H&M", "Zara India", "Marks & Spencer"]
    },
    {
      "outfit": "Classic Elegant",
      "description": "Charcoal blazer over light blue shirt with dark slim jeans",
      "why": "Creates sharp V-shape silhouette, perfect for ${occasion}",
      "priceRange": "mid",
      "indianBrands": ["Mango", "Tommy Hilfiger", "Van Heusen"]
    },
    {
      "outfit": "Premium Style",
      "description": "Tailored navy suit with white shirt and leather oxford shoes",
      "why": "Maximizes athletic build for a powerful, confident appearance",
      "priceRange": "premium",
      "indianBrands": ["Raymond", "Louis Philippe", "Peter England"]
    }
  ],
  "colorPalette": ["#1B2A4A - Deep Navy", "#F5F0E8 - Ivory White", "#8B6914 - Caramel Brown", "#2C5F2E - Forest Green"],
  "stylesAvoid": ["Baggy clothing - hides your build", "Too many patterns together"],
  "accessories": ["Minimalist leather watch", "Simple leather belt", "Small chain necklace"],
  "brands": {
    "budget": ["H&M", "Zara", "Uniqlo", "Myntra brands"],
    "mid": ["Mango", "Tommy Hilfiger", "Arrow", "Van Heusen"],
    "premium": ["Raymond", "Hugo Boss", "Ralph Lauren", "Louis Philippe"]
  },
  "styleTip": "Invest in well-fitted basics in neutral colors — they work for every occasion.",
  "seasonalTip": "For Indian climate, choose breathable fabrics like cotton and linen."
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