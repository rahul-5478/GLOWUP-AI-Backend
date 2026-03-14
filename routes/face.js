const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");
const axios = require("axios");
const FormData = require("form-data");

// ─── Face++ API ───────────────────────────────────────────────────────────────
const analyzeFaceWithFacePlusPlus = async (imageBase64) => {
  try {
    const form = new FormData();
    form.append("api_key", process.env.FACEPLUSPLUS_API_KEY);
    form.append("api_secret", process.env.FACEPLUSPLUS_API_SECRET);
    form.append("image_base64", imageBase64);
    form.append("return_attributes", "gender,age,skinstatus,beauty,ethnicity,emotion,facequality");

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
      skinStatus: {
        health: attrs.skinstatus?.health || 70,
        stain: attrs.skinstatus?.stain || 0,
        dark_circle: attrs.skinstatus?.dark_circle || 0,
        acne: attrs.skinstatus?.acne || 0,
        pore: attrs.skinstatus?.pore || 0,
        wrinkle: attrs.skinstatus?.wrinkle || 0,
        saturation: attrs.skinstatus?.saturation || 0,
      },
      beauty: {
        male_score: attrs.beauty?.male_score || 0,
        female_score: attrs.beauty?.female_score || 0,
      },
      faceQuality: attrs.facequality?.value || 70,
      faceRectangle: face.face_rectangle,
    };
  } catch (err) {
    console.error("Face++ error:", err.response?.data || err.message);
    return null;
  }
};

// ─── Face Shape from rectangle ────────────────────────────────────────────────
const getFaceShape = (rect) => {
  if (!rect) return "oval";
  const ratio = rect.width / rect.height;
  if (ratio > 0.95) return "round";
  if (ratio > 0.85) return "square";
  if (ratio > 0.75) return "oval";
  return "oblong";
};

// ─── Detect Skin Problems ─────────────────────────────────────────────────────
const detectSkinProblems = (skinStatus) => {
  const problems = [];
  if (skinStatus.acne > 20) problems.push({ name: "Acne", severity: skinStatus.acne > 50 ? "High" : "Moderate", score: Math.round(skinStatus.acne) });
  if (skinStatus.dark_circle > 20) problems.push({ name: "Dark Circles", severity: skinStatus.dark_circle > 50 ? "High" : "Moderate", score: Math.round(skinStatus.dark_circle) });
  if (skinStatus.stain > 20) problems.push({ name: "Dark Spots / Pigmentation", severity: skinStatus.stain > 50 ? "High" : "Moderate", score: Math.round(skinStatus.stain) });
  if (skinStatus.pore > 30) problems.push({ name: "Open Pores", severity: skinStatus.pore > 60 ? "High" : "Moderate", score: Math.round(skinStatus.pore) });
  if (skinStatus.wrinkle > 20) problems.push({ name: "Fine Lines / Wrinkles", severity: skinStatus.wrinkle > 50 ? "High" : "Moderate", score: Math.round(skinStatus.wrinkle) });
  if (skinStatus.saturation < 30) problems.push({ name: "Dull Skin / Uneven Tone", severity: "Moderate", score: Math.round(100 - skinStatus.saturation) });
  if (skinStatus.health < 50) problems.push({ name: "Poor Skin Health", severity: "High", score: Math.round(100 - skinStatus.health) });
  return problems;
};

// ─── MAIN ROUTE ───────────────────────────────────────────────────────────────
router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64, mediaType = "image/jpeg" } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    console.log("🔍 Analyzing face with Face++...");

    // Step 1: Face++ real data
    const faceData = await analyzeFaceWithFacePlusPlus(imageBase64);
    console.log("✅ Face++ data:", JSON.stringify(faceData));

    const faceShape = getFaceShape(faceData?.faceRectangle);
    const gender = faceData?.gender || "Unknown";
    const age = faceData?.age || 25;
    const skinStatus = faceData?.skinStatus || { health: 70, acne: 10, dark_circle: 10, stain: 10, pore: 20, wrinkle: 10, saturation: 50 };
    const skinProblems = detectSkinProblems(skinStatus);
    const skinScore = Math.round(skinStatus.health);

    // Step 2: Groq — detailed analysis + products + plan
    const prompt = `You are GlowUp AI's expert dermatologist and skincare specialist.
Based on REAL face scan data, provide comprehensive analysis with products and treatment plan.

REAL DETECTED DATA:
- Face Shape: ${faceShape}
- Gender: ${gender}
- Age: ${age} years
- Skin Health Score: ${skinScore}/100
- Acne Level: ${skinStatus.acne}/100
- Dark Circles: ${skinStatus.dark_circle}/100
- Pigmentation/Stains: ${skinStatus.stain}/100
- Open Pores: ${skinStatus.pore}/100
- Wrinkles: ${skinStatus.wrinkle}/100
- Skin Saturation/Glow: ${skinStatus.saturation}/100
- Detected Problems: ${skinProblems.map(p => p.name).join(", ") || "None major"}
- Timestamp: ${Date.now()}

Give ACCURATE, SPECIFIC recommendations based on these EXACT scores.

Return ONLY valid JSON, no markdown:
{
  "faceShape": "${faceShape}",
  "faceShapeDetails": "2 sentences about this face shape",
  "skinTone": "detected tone (fair/wheatish/medium/dusky/deep)",
  "skinToneHex": "#C68642",
  "jawlineType": "soft/defined/strong",
  "skinScore": ${skinScore},
  "skinGrade": "A/B/C/D/F based on score",
  "detectedProblems": [
    ${skinProblems.map(p => `{
      "name": "${p.name}",
      "severity": "${p.severity}",
      "score": ${p.score},
      "description": "what this means for their skin",
      "cause": "main reason for this problem"
    }`).join(",\n    ")}
  ],
  "topHairstyles": [
    {"name": "hairstyle for ${faceShape}", "reason": "why it suits", "maintenance": "Low/Medium/High"},
    {"name": "hairstyle 2", "reason": "why it suits", "maintenance": "Low/Medium/High"},
    {"name": "hairstyle 3", "reason": "why it suits", "maintenance": "Low/Medium/High"}
  ],
  "skincareProducts": [
    {
      "step": 1,
      "type": "Cleanser",
      "productName": "specific Indian product name",
      "brand": "brand name",
      "price": "₹XXX-XXX",
      "why": "why this product for their specific problems",
      "howToUse": "exact usage instructions",
      "availableAt": "Nykaa/Amazon/local pharmacy"
    },
    {
      "step": 2,
      "type": "Treatment Serum",
      "productName": "specific product for their top problem",
      "brand": "brand name",
      "price": "₹XXX-XXX",
      "why": "targets their specific issue",
      "howToUse": "how many drops, when to apply",
      "availableAt": "where to buy"
    },
    {
      "step": 3,
      "type": "Moisturizer",
      "productName": "specific product",
      "brand": "brand name",
      "price": "₹XXX-XXX",
      "why": "why for their skin type",
      "howToUse": "instructions",
      "availableAt": "where to buy"
    },
    {
      "step": 4,
      "type": "Sunscreen",
      "productName": "specific Indian sunscreen",
      "brand": "brand name",
      "price": "₹XXX-XXX",
      "why": "SPF importance for their skin",
      "howToUse": "how much, when",
      "availableAt": "where to buy"
    },
    {
      "step": 5,
      "type": "Night Treatment",
      "productName": "specific night product for their problems",
      "brand": "brand name",
      "price": "₹XXX-XXX",
      "why": "why night treatment for their issues",
      "howToUse": "how to apply",
      "availableAt": "where to buy"
    }
  ],
  "treatmentPlan": {
    "duration": "X weeks",
    "goal": "what will improve and by how much",
    "week1": {
      "title": "Week 1: Foundation",
      "focus": "main focus this week",
      "morning": ["step 1", "step 2", "step 3", "step 4"],
      "night": ["step 1", "step 2", "step 3"],
      "doNot": ["thing to avoid 1", "thing to avoid 2"],
      "expectedResult": "what they should see"
    },
    "week2": {
      "title": "Week 2: Treatment",
      "focus": "main focus",
      "morning": ["step 1", "step 2", "step 3", "step 4"],
      "night": ["step 1", "step 2", "step 3"],
      "doNot": ["avoid 1", "avoid 2"],
      "expectedResult": "expected change"
    },
    "week3": {
      "title": "Week 3: Boost",
      "focus": "main focus",
      "morning": ["step 1", "step 2", "step 3", "step 4"],
      "night": ["step 1", "step 2", "step 3"],
      "doNot": ["avoid 1", "avoid 2"],
      "expectedResult": "expected change"
    },
    "week4": {
      "title": "Week 4: Results",
      "focus": "maintenance",
      "morning": ["step 1", "step 2", "step 3", "step 4"],
      "night": ["step 1", "step 2", "step 3"],
      "doNot": ["avoid 1", "avoid 2"],
      "expectedResult": "final result"
    }
  },
  "dietForSkin": [
    "specific food for their skin problem 1",
    "specific food for their skin problem 2",
    "specific food to avoid",
    "water intake recommendation",
    "specific Indian food that helps"
  ],
  "lifestyleTips": [
    "specific tip for their detected problem 1",
    "specific tip for their age group",
    "sleep/stress tip",
    "exercise tip for skin"
  ],
  "grooming": ["tip 1", "tip 2", "tip 3"],
  "colorRecommendations": ["color 1", "color 2"],
  "stylesAvoid": ["style 1 with reason", "style 2 with reason"],
  "confidence": 92,
  "nextScanIn": "2 weeks"
}`;

    const text = await callGroq(prompt, { faceShape, gender, age, skinStatus, skinProblems });
    const result = parseGroqJSON(text);

    // Add Face++ raw data
    result.detectedAge = age;
    result.detectedGender = gender;
    result.faceShape = faceShape;
    result.skinScore = skinScore;
    result.rawSkinStatus = skinStatus;
    result.analyzedWith = "Face++ AI";

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