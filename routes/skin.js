const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { skinType, skinConcerns, age, gender, lifestyle } = req.body;

    const prompt = `You are GlowUp AI's expert dermatologist for Indian skin.
Analyze and give personalized skincare recommendations for:
- Skin Type: ${skinType || "unknown"}
- Concerns: ${skinConcerns || "general"}
- Age: ${age || "unknown"}
- Gender: ${gender || "unknown"}
- Lifestyle: ${lifestyle || "normal"}
- Timestamp: ${Date.now()}
- Random: ${Math.random()}

Give COMPLETELY UNIQUE recommendations. Use Indian brands and products.
Consider Indian climate, pollution, and lifestyle.

Return JSON with EXACTLY these keys, no example data:
{
  "score": (number between 60-95 based on concerns),
  "skinType": (detected type),
  "skinTone": (fair/wheatish/medium/dusky/deep),
  "skinToneHex": (matching hex color),
  "concerns": (array of 3 specific real concerns based on input),
  "morningRoutine": (array of 4 specific steps with Indian affordable products),
  "nightRoutine": (array of 4 specific steps),
  "products": (array of 3 objects with name, reason, price in rupees - use real Indian products),
  "dietTips": (array of 3 specific Indian diet tips for their skin),
  "lifestyle": (array of 3 specific lifestyle tips)
}`;

    const text = await callGroq(prompt, { skinType, skinConcerns, age, gender });
    const result = parseGroqJSON(text);
    res.json({ success: true, result });
  } catch (err) {
    console.error("Skin analysis error:", err.message);
    res.status(500).json({ error: "Skin analysis failed. Please try again." });
  }
});

module.exports = router;