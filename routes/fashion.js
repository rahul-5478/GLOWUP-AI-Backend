const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { occasion, style, bodyType, budget } = req.body;
    if (!occasion) return res.status(400).json({ error: "Occasion is required." });

    const seed = Math.random().toFixed(8);

    const prompt = `Give UNIQUE outfit recommendations. Seed:${seed}
Occasion: ${occasion}
Style: ${style || "any"}
Body type: ${bodyType || "any"}
Budget: ${budget || "mixed"}

Rules:
- Specific to ${occasion} occasion
- Include real Indian brands on Myntra/Ajio
- Consider Indian weather and culture
- Return ONLY raw JSON, no markdown

{"bodyShape":"rectangle","bodyShapeDetails":"Athletic build with balanced proportions, versatile for styling.","outfitRecommendations":[{"outfit":"Smart Casual","description":"Navy chinos with white Oxford shirt white sneakers","why":"Adds dimension, relaxed yet put-together for ${occasion}","priceRange":"budget","indianBrands":["H&M","Zara India","Marks Spencer"]},{"outfit":"Classic Elegant","description":"Charcoal blazer light blue shirt dark slim jeans","why":"Sharp V-shape silhouette perfect for ${occasion}","priceRange":"mid","indianBrands":["Mango","Tommy Hilfiger","Van Heusen"]},{"outfit":"Premium Style","description":"Tailored navy suit white shirt leather oxford shoes","why":"Powerful confident appearance for ${occasion}","priceRange":"premium","indianBrands":["Raymond","Louis Philippe","Peter England"]}],"colorPalette":["#1B2A4A - Deep Navy","#F5F0E8 - Ivory White","#8B6914 - Caramel Brown","#2C5F2E - Forest Green"],"stylesAvoid":["Baggy clothing hides build","Too many patterns together"],"accessories":["Minimalist leather watch","Simple leather belt","Small chain necklace"],"brands":{"budget":["H&M","Zara","Uniqlo"],"mid":["Mango","Tommy Hilfiger","Arrow"],"premium":["Raymond","Hugo Boss","Louis Philippe"]},"styleTip":"specific tip for ${occasion}","seasonalTip":"India-specific seasonal tip"}

Replace ALL values with FRESH creative content specific to ${occasion}.`;

    const text = await callGroq(prompt, { occasion, style, bodyType, budget, userId: req.user._id });
    const result = parseGroqJSON(text);

    await User.findByIdAndUpdate(req.user._id, {
      $push: { analyses: { type: "fashion", result } },
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