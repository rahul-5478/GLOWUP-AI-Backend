const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64, skinConcerns, hairType, gender, mediaType = "image/jpeg" } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    const seed = Math.random().toFixed(6);
    const ts = Date.now();

    const prompt = `Act as a professional face analyst. Give unique personalized advice.
Seed:${seed} Time:${ts}
Gender:${gender || "unknown"} Concerns:${skinConcerns || "general"} Hair:${hairType || "any"}

Respond with ONLY a JSON object. No text before or after. No markdown. No code blocks.
Use this exact structure:

{"faceShape":"oval","faceShapeDetails":"Balanced proportions suit most styles.","skinTone":"medium","skinToneHex":"#C68642","jawlineType":"defined","topHairstyles":[{"name":"Layered Cut","reason":"Adds movement","maintenance":"Low"},{"name":"Side Part","reason":"Sharp look","maintenance":"Medium"},{"name":"Textured Crop","reason":"Modern style","maintenance":"Low"}],"stylesAvoid":["Very long flat hair","Extreme volume on sides"],"colorRecommendations":["Dark Brown with highlights","Natural Black"],"skincare":{"type":"combination","concerns":["mild acne","uneven tone"],"morningRoutine":["Gentle cleanser","Niacinamide serum","SPF 50 moisturizer","Lip balm"],"nightRoutine":["Micellar water","Retinol serum","Night cream","Eye cream"]},"grooming":["Trim every 5 weeks","Use light styling product","Scalp massage daily"],"confidence":87}

Replace ALL values with fresh unique content. Make it different every time.`;

    const text = await callGroq(prompt, { gender, skinConcerns, hairType });
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