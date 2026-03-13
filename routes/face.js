const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { parseGroqJSON } = require("../config/groq");
const User = require("../models/User");
const axios = require("axios");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64, mediaType = "image/jpeg", gender } = req.body;
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
                  detail: "low",
                },
              },
              {
                type: "text",
                text: `You are GlowUp AI's expert face analyst. Carefully look at this ${gender || "person"}'s face in the image.

Detect everything from the image:
1. Face shape — look at jawline width, forehead width, cheekbone width, face length
2. Hair type — look at actual hair texture visible
3. Skin tone — look at actual skin color
4. Skin type — look at skin texture (oily shine, dry patches, etc.)
5. Jawline shape — observe the jaw structure

Give hairstyle recommendations based on the ACTUAL face shape you detect.

Return ONLY valid JSON, no markdown, no extra text:
{
  "faceShape": "oval/round/square/heart/diamond/oblong — what you actually see",
  "faceShapeDetails": "2 specific sentences about what you observe in THIS face",
  "skinTone": "fair/wheatish/medium/dusky",
  "skinToneHex": "#hex color code",
  "jawlineType": "soft/defined/strong",
  "hairType": "straight/wavy/curly/coily/thin/thick — what you see in image",
  "topHairstyles": [
    {"name": "hairstyle name", "reason": "why it suits this specific face shape", "maintenance": "Low/Medium/High"},
    {"name": "hairstyle 2", "reason": "why it suits", "maintenance": "Low/Medium/High"},
    {"name": "hairstyle 3", "reason": "why it suits", "maintenance": "Low/Medium/High"}
  ],
  "stylesAvoid": ["style to avoid + reason", "another style to avoid + reason"],
  "colorRecommendations": ["color recommendation 1", "color recommendation 2"],
  "skincare": {
    "type": "oily/dry/combination/normal — detected from image",
    "concerns": ["skin concern you can see", "another concern if visible"],
    "morningRoutine": ["step 1", "step 2", "step 3", "step 4"],
    "nightRoutine": ["step 1", "step 2", "step 3", "step 4"]
  },
  "grooming": ["grooming tip 1", "grooming tip 2", "grooming tip 3"],
  "confidence": 87
}`,
              },
            ],
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        timeout: 30000,
      }
    );

    const text = response.data.choices[0].message.content;
    const result = parseGroqJSON(text);

    await User.findByIdAndUpdate(req.user._id, {
      $push: { analyses: { type: "face", result } },
    });

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