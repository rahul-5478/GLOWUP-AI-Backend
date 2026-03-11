const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    const prompt = `You are GlowUp AI's expert dermatologist. Analyze this person's skin.
Return ONLY valid JSON:
{
  "score": 78,
  "skinType": "oily",
  "skinTone": "medium",
  "skinToneHex": "#C68642",
  "concerns": ["Mild acne on forehead", "Dark circles under eyes", "Slight hyperpigmentation"],
  "morningRoutine": ["Gentle foaming cleanser", "Vitamin C serum", "Oil-free moisturizer SPF 50", "Lip balm"],
  "nightRoutine": ["Micellar water to remove makeup", "Retinol serum (2-3x/week)", "Heavy night cream", "Eye cream"],
  "products": [
    {"name": "CeraVe Foaming Cleanser", "reason": "Perfect for oily skin", "price": "₹800-1200"},
    {"name": "Minimalist Niacinamide 10%", "reason": "Reduces pores and acne", "price": "₹599"},
    {"name": "Neutrogena Hydro Boost", "reason": "Lightweight hydration", "price": "₹1200"}
  ],
  "dietTips": ["Reduce dairy intake", "Eat more antioxidants", "Stay hydrated 3L/day"],
  "lifestyle": ["Change pillowcase weekly", "Never sleep with makeup", "Use clean brushes"]
}`;

    const text = await callGroq(prompt);
    const result = parseGroqJSON(text);
    res.json({ success: true, result });
  } catch (err) {
    console.error("Skin analysis error:", err.message);
    res.status(500).json({ error: "Skin analysis failed. Please try again." });
  }
});

module.exports = router;