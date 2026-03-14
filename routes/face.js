const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");
const axios = require("axios");
const FormData = require("form-data");

// Face++ API call
const analyzeFaceWithFacePlusPlus = async (imageBase64) => {
  try {
    const form = new FormData();
    form.append("api_key", process.env.FACEPLUSPLUS_API_KEY);
    form.append("api_secret", process.env.FACEPLUSPLUS_API_SECRET);
    form.append("image_base64", imageBase64);
    form.append("return_attributes", "gender,age,skinstatus,beauty,ethnicity,emotion");

    const response = await axios.post(
      "https://api-us.faceplusplus.com/facepp/v3/detect",
      form,
      { headers: form.getHeaders(), timeout: 15000 }
    );

    const faces = response.data.faces;
    if (!faces || faces.length === 0) return null;

    const face = faces[0];
    const attrs = face.attributes;

    return {
      gender: attrs.gender?.value || "Unknown",
      age: attrs.age?.value || 25,
      emotion: Object.entries(attrs.emotion || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral",
      skinStatus: attrs.skinstatus || {},
      beauty: attrs.beauty || {},
      ethnicity: attrs.ethnicity?.value || "Unknown",
      faceRectangle: face.face_rectangle,
    };
  } catch (err) {
    console.error("Face++ error:", err.response?.data || err.message);
    return null;
  }
};

// Determine face shape from rectangle
const getFaceShape = (rect) => {
  if (!rect) return "oval";
  const ratio = rect.width / rect.height;
  if (ratio > 0.95) return "round";
  if (ratio > 0.85) return "square";
  if (ratio > 0.75) return "oval";
  return "oblong";
};

router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64, mediaType = "image/jpeg" } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    console.log("🔍 Analyzing face with Face++...");

    // Step 1: Face++ se real data lo
    const faceData = await analyzeFaceWithFacePlusPlus(imageBase64);
    console.log("✅ Face++ data:", JSON.stringify(faceData));

    const faceShape = getFaceShape(faceData?.faceRectangle);
    const gender = faceData?.gender || "Unknown";
    const age = faceData?.age || 25;
    const emotion = faceData?.emotion || "neutral";
    const skinHealth = faceData?.skinStatus || {};
    const beautyScore = faceData?.beauty || {};

    // Step 2: Groq se recommendations lo
    const prompt = `You are GlowUp AI's expert stylist and dermatologist.
Based on REAL face analysis data, give personalized recommendations:

DETECTED DATA:
- Face Shape: ${faceShape}
- Gender: ${gender}
- Age: ${age} years
- Current Emotion: ${emotion}
- Skin Health: acne=${skinHealth.acne || 0}, dark_circle=${skinHealth.dark_circle || 0}, stain=${skinHealth.stain || 0}, health=${skinHealth.health || 0}
- Beauty Score: male=${beautyScore.male_score || 0}, female=${beautyScore.female_score || 0}
- Timestamp: ${Date.now()}

Give UNIQUE recommendations based on this EXACT face data.

Return ONLY valid JSON:
{
  "faceShape": "${faceShape}",
  "faceShapeDetails": "2 sentences about ${faceShape} face shape and what suits it",
  "skinTone": "detected skin tone",
  "skinToneHex": "#hex color",
  "jawlineType": "soft/defined/strong",
  "age": ${age},
  "emotion": "${emotion}",
  "topHairstyles": [
    {"name": "hairstyle for ${faceShape} face", "reason": "why it suits", "maintenance": "Low/Medium/High"},
    {"name": "hairstyle for ${gender} ${age}yr", "reason": "why it suits", "maintenance": "Low/Medium/High"},
    {"name": "trendy hairstyle 2024", "reason": "why it suits", "maintenance": "Low/Medium/High"}
  ],
  "stylesAvoid": ["style with reason", "style with reason"],
  "colorRecommendations": ["color idea 1", "color idea 2"],
  "skincare": {
    "type": "skin type based on health data",
    "concerns": ["concern based on acne=${skinHealth.acne || 0}", "concern based on dark_circle=${skinHealth.dark_circle || 0}"],
    "morningRoutine": ["step 1 Indian product", "step 2", "step 3", "step 4"],
    "nightRoutine": ["step 1", "step 2", "step 3", "step 4"]
  },
  "grooming": ["tip 1 for ${gender}", "tip 2", "tip 3"],
  "skinScore": (number based on health score ${skinHealth.health || 70}),
  "confidence": (number 85-97 based on face++ detection)
}`;

    const text = await callGroq(prompt, { faceShape, gender, age, skinHealth });
    const result = parseGroqJSON(text);

    // Face++ data bhi result mein add karo
    result.detectedAge = age;
    result.detectedGender = gender;
    result.detectedEmotion = emotion;
    result.faceAnalyzedBy = "Face++";

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