const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGemini, parseGeminiJSON } = require("../config/gemini");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { occasion, style, budget } = req.body;
    if (!occasion) return res.status(400).json({ error: "Occasion is required." });

    const prompt = `Give outfit recommendations for occasion: ${occasion}. Style: ${style || "casual"}. Budget: ${budget || "mixed"}. Respond with JSON containing: bodyShape, bodyShapeDetails, outfitRecommendations (array of 3 with outfit, description, why, priceRange, items array), colorPalette (array of 4 hex-name strings), stylesAvoid (array), accessories (array), brands (array), styleTip, seasonalTip. Indian brands preferred.`;

    let result;
    try {
      const text = await callGemini(prompt, { occasion, style, budget });
      result = parseGeminiJSON(text);
      if (!result) throw new Error("Parse failed");
    } catch (e) {
      result = {
        bodyShape: "rectangle",
        bodyShapeDetails: "Balanced proportions that suit most silhouettes.",
        outfitRecommendations: [
          { outfit: "Smart Casual", description: "Navy chinos with white Oxford shirt", why: `Perfect for ${occasion}`, priceRange: "budget", items: ["Navy Chinos", "White Oxford Shirt", "White Sneakers"] },
          { outfit: "Classic Elegant", description: "Dark slim jeans with structured blazer", why: "Sharp silhouette", priceRange: "mid", items: ["Dark Slim Jeans", "Structured Blazer", "Leather Belt"] },
          { outfit: "Premium Style", description: "Tailored trousers with linen shirt", why: "Sophisticated look", priceRange: "premium", items: ["Tailored Trousers", "Linen Shirt", "Suede Loafers"] }
        ],
        colorPalette: ["#1B2A4A - Deep Navy", "#F5F0E8 - Ivory", "#8B6914 - Caramel", "#2C5F2E - Forest Green"],
        stylesAvoid: ["Overly baggy silhouettes", "Too many competing patterns"],
        accessories: ["Minimalist watch", "Simple leather belt"],
        brands: ["H&M India", "Zara India", "Van Heusen", "Raymond"],
        styleTip: "Invest in well-fitted basics in neutral colors.",
        seasonalTip: "Choose breathable cotton and linen for Indian climate."
      };
    }

    try {
      await User.findByIdAndUpdate(req.user._id, { $push: { analyses: { type: "fashion", result } } });
    } catch (dbErr) {
      console.log("DB save error (non-fatal):", dbErr.message);
    }

    return res.json({ success: true, result });
  } catch (err) {
    console.error("Fashion error:", err.message);
    return res.status(500).json({ error: "Fashion analysis failed." });
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
