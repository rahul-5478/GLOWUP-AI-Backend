const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { parseGroqJSON } = require("../config/groq");
const User = require("../models/User");
const axios = require("axios");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64, mediaType = "image/jpeg", skinConcerns, gender, hairType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${imageBase64}`,
                  detail: "low"
                }
              },
              {
                type: "text",
                text: `You are GlowUp AI's expert face analyst. Look at this person's ACTUAL face carefully.
Gender: ${gender || "male"}
Hair type: ${hairType || "straight"}
Skin concern: ${skinConcerns || "none"}

Analyze the REAL face — jawline, forehead, cheekbones, face length.
Give recommendations based on what you ACTUALLY see.

Return ONLY valid JSON, no markdown:
{
  "faceShape": "actual shape you see: oval/round/square/heart/diamond/oblong",
  "faceShapeDetails": "2 sentences about what you observe in this specific face",
  "skinTone": "fair/wheatish/medium/dusky",
  "skinToneHex": "#C68642",
  "jawlineType": "soft/defined/strong",
  "topHairstyles": [
    {"name": "specific hairstyle", "reason": "why it suits this face", "maintenance": "Low"},
    {"name": "hairstyle 2", "reason": "reason", "maintenance": "Medium"},
    {"name": "hairstyle 3", "reason": "reason", "maintenance": "High"}
  ],
  "stylesAvoid": ["style with reason", "another style"],
  "colorRecommendations": ["color idea 1", "color idea 2"],
  "skincare": {
    "type": "oily/dry/combination",
    "concerns": ["concern based on skin visible"],
    "morningRoutine": ["Gentle cleanser", "Vitamin C serum", "SPF 50", "Moisturizer"],
    "nightRoutine": ["Micellar water", "Retinol serum", "Night cream", "Eye cream"]
  },
  "grooming": ["tip 1", "tip 2", "tip 3"],
  "confidence": 85
}`
              }
            ]
          }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        timeout: 30000,
      }
    );

    const text = response.data.choices[0].message.content;
    const result = parseGroqJSON(text);
    await User.findByIdAndUpdate(req.user._id, { $push: { analyses: { type: "face", result } } });
    res.json({ success: true, result });

  } catch (err) {
    console.error("Face analysis error:", err.response?.data || err.message);
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