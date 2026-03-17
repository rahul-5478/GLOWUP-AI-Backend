const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const User = require("../models/User");

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post("/analyze", protect, async (req, res) => {
  try {
    const { occasion, style, bodyType, budget } = req.body;
    console.log("Fashion analyze called, occasion:", occasion);

    if (!occasion) {
      return res.status(400).json({ error: "Occasion is required." });
    }

    let result;

    try {
      const model = genai.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: "You are a fashion stylist. Always respond with valid JSON only. No markdown, no explanation.",
        generationConfig: { maxOutputTokens: 1200, temperature: 0.8 },
      });

      const geminiResponse = await model.generateContent(
        `Give outfit recommendations for occasion: ${occasion}. Style: ${style || "casual"}. Budget: ${budget || "mixed"}. Respond with JSON containing: bodyShape, bodyShapeDetails, outfitRecommendations (array of 3 with outfit, description, why, priceRange, items array), colorPalette (array of 4 hex-name strings), stylesAvoid (array), accessories (array), brands (array), styleTip, seasonalTip.`
      );

      const text = geminiResponse.response.text();
      console.log("Fashion Gemini response:", text.substring(0, 200));

      const clean = text.replace(/```json|```/g, "").trim();
      try {
        result = JSON.parse(clean);
      } catch (e) {
        const match = text.match(/\{[\s\S]*\}/);
        result = match ? JSON.parse(match[0]) : null;
      }

      if (!result) throw new Error("Could not parse JSON");
      console.log("Fashion JSON parsed OK");

    } catch (geminiErr) {
      console.log("Gemini failed, using fallback. Error:", geminiErr.message);
      result = {
        bodyShape: "rectangle",
        bodyShapeDetails: "Balanced proportions that suit most silhouettes and styles well.",
        outfitRecommendations: [
          {
            outfit: "Smart Casual",
            description: "Navy chinos with white Oxford shirt and white sneakers",
            why: `Clean and put-together look perfect for ${occasion}`,
            priceRange: "budget",
            items: ["Navy Chinos", "White Oxford Shirt", "White Sneakers", "Minimal Watch"]
          },
          {
            outfit: "Classic Elegant",
            description: "Dark slim jeans with structured blazer over light blue shirt",
            why: "Sharp silhouette that elevates any setting",
            priceRange: "mid",
            items: ["Dark Slim Jeans", "Structured Blazer", "Light Blue Shirt", "Leather Belt"]
          },
          {
            outfit: "Premium Style",
            description: "Tailored trousers with premium linen shirt and suede loafers",
            why: "Sophisticated and effortlessly stylish",
            priceRange: "premium",
            items: ["Tailored Trousers", "Premium Linen Shirt", "Suede Loafers", "Pocket Square"]
          }
        ],
        colorPalette: [
          "#1B2A4A - Deep Navy",
          "#F5F0E8 - Ivory White",
          "#8B6914 - Caramel Brown",
          "#2C5F2E - Forest Green"
        ],
        stylesAvoid: ["Overly baggy silhouettes", "Too many competing patterns"],
        accessories: ["Minimalist leather watch", "Simple leather belt", "Clean white sneakers"],
        brands: ["H&M India", "Zara India", "Van Heusen", "Raymond", "Marks and Spencer"],
        styleTip: "Invest in well-fitted basics in neutral colors — they work for every occasion.",
        seasonalTip: "For Indian climate, choose breathable cotton and linen fabrics."
      };
    }

    try {
      await User.findByIdAndUpdate(req.user._id, {
        $push: { analyses: { type: "fashion", result } }
      });
    } catch (dbErr) {
      console.log("DB save error (non-fatal):", dbErr.message);
    }

    return res.json({ success: true, result });

  } catch (err) {
    console.error("Fashion OUTER error:", err.message);
    return res.status(500).json({ error: "Fashion analysis failed. Please try again." });
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