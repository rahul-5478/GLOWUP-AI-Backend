const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64, skinConcerns, hairType, gender } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    const prompt = `You are GlowUp AI's expert face analyst. Give personalized recommendations.
Gender: ${gender || "not specified"}
Skin concerns: ${skinConcerns || "none"}
Hair type: ${hairType || "unknown"}
Timestamp: ${Date.now()}

Return ONLY this JSON, no markdown, no explanation, start with { end with }:
{"faceShape":"oval","faceShapeDetails":"Your face has balanced proportions making most hairstyles work well for you.","skinTone":"medium","skinToneHex":"#C68642","jawlineType":"defined","topHairstyles":[{"name":"Layered Cut","reason":"Adds movement and volume","maintenance":"Low"},{"name":"Side Part","reason":"Creates sharp professional look","maintenance":"Medium"},{"name":"Textured Quiff","reason":"Modern trendy style","maintenance":"Medium"}],"stylesAvoid":["Very flat styles","Extremely short sides"],"colorRecommendations":["Dark Brown with highlights","Natural Black"],"skincare":{"type":"combination","concerns":["mild acne","uneven tone"],"morningRoutine":["Gentle foaming cleanser","Niacinamide 10% serum","Oil-free SPF 50 moisturizer","Lip balm"],"nightRoutine":["Micellar water","Gentle cleanser","Retinol serum","Night cream"]},"grooming":["Trim every 4-6 weeks","Use light pomade","Massage scalp daily","Stay hydrated"],"confidence":85}

Replace ALL values with real personalized analysis. Vary the response every time.`;

    const text = await callGroq(prompt, { skinConcerns, hairType, gender, userId: req.user._id });
    const result = parseGroqJSON(text);

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