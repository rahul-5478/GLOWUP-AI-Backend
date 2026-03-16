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

// ─── Face Shape ───────────────────────────────────────────────────────────────
const getFaceShape = (rect) => {
  if (!rect) return "oval";
  const ratio = rect.width / rect.height;
  if (ratio > 0.95) return "round";
  if (ratio > 0.85) return "square";
  if (ratio > 0.75) return "oval";
  return "oblong";
};

// ─── Skin Problems ────────────────────────────────────────────────────────────
const detectSkinProblems = (skinStatus) => {
  const problems = [];
  if (skinStatus.acne > 20) problems.push({ name: "Acne", severity: skinStatus.acne > 50 ? "High" : "Moderate", score: Math.round(skinStatus.acne) });
  if (skinStatus.dark_circle > 20) problems.push({ name: "Dark Circles", severity: skinStatus.dark_circle > 50 ? "High" : "Moderate", score: Math.round(skinStatus.dark_circle) });
  if (skinStatus.stain > 20) problems.push({ name: "Dark Spots", severity: skinStatus.stain > 50 ? "High" : "Moderate", score: Math.round(skinStatus.stain) });
  if (skinStatus.pore > 30) problems.push({ name: "Open Pores", severity: skinStatus.pore > 60 ? "High" : "Moderate", score: Math.round(skinStatus.pore) });
  if (skinStatus.wrinkle > 20) problems.push({ name: "Fine Lines", severity: skinStatus.wrinkle > 50 ? "High" : "Moderate", score: Math.round(skinStatus.wrinkle) });
  if (skinStatus.saturation < 30) problems.push({ name: "Dull Skin", severity: "Moderate", score: Math.round(100 - skinStatus.saturation) });
  if (skinStatus.health < 50) problems.push({ name: "Poor Skin Health", severity: "High", score: Math.round(100 - skinStatus.health) });
  return problems;
};

// ─── MAIN ROUTE ───────────────────────────────────────────────────────────────
router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    // ── User profile se data lo ──
    const user = await User.findById(req.user._id).select("profile");
    const userProfile = user?.profile || {};

    console.log("🔍 Analyzing face with Face++...");
    const faceData = await analyzeFaceWithFacePlusPlus(imageBase64);
    console.log("✅ Face++ data:", JSON.stringify(faceData));

    const faceShape = getFaceShape(faceData?.faceRectangle);

    // ── Profile data Face++ se zyada accurate hai ──
    const gender = userProfile.gender
      ? userProfile.gender.charAt(0).toUpperCase() + userProfile.gender.slice(1)
      : faceData?.gender || "Unknown";

    const age = userProfile.age || faceData?.age || 25;
    const height = userProfile.height || null;
    const weight = userProfile.weight || null;
    const skinType = userProfile.skinType || "normal";
    const userGoal = userProfile.goal || "maintenance";

    const skinStatus = faceData?.skinStatus || {
      health: 70, acne: 10, dark_circle: 10,
      stain: 10, pore: 20, wrinkle: 10, saturation: 50,
    };
    const skinProblems = detectSkinProblems(skinStatus);
    const skinScore = Math.round(skinStatus.health);

    const problemsList = skinProblems.length > 0
      ? skinProblems.map(p => `${p.name} (severity: ${p.severity}, score: ${p.score})`).join(", ")
      : "None detected";

    // BMI calculate karo agar height/weight available hai
    const bmi = height && weight
      ? (weight / ((height / 100) ** 2)).toFixed(1)
      : null;

    const prompt = `You are GlowUp AI's expert dermatologist and beauty advisor. Return ONLY valid JSON. No markdown, no text outside the JSON object.

USER PROFILE (from registration — 100% accurate):
- Gender: ${gender}
- Age: ${age} years
- Height: ${height ? height + " cm" : "unknown"}
- Weight: ${weight ? weight + " kg" : "unknown"}
- BMI: ${bmi || "unknown"}
- Skin Type: ${skinType}
- Goal: ${userGoal}

FACE SCAN DATA (from Face++ AI):
- Face Shape: ${faceShape}
- Skin Score: ${skinScore}/100
- Acne: ${skinStatus.acne}, Dark Circles: ${skinStatus.dark_circle}, Stains: ${skinStatus.stain}
- Pores: ${skinStatus.pore}, Wrinkles: ${skinStatus.wrinkle}, Glow: ${skinStatus.saturation}
- Detected Problems: ${problemsList}

IMPORTANT: Use Gender="${gender}" and Age=${age} from USER PROFILE for all recommendations. Give ${gender}-specific hairstyles only.

Return this exact JSON structure with all fields filled:
{
  "faceShape": "${faceShape}",
  "faceShapeDetails": "2 specific sentences about ${faceShape} face shape for ${gender}",
  "skinTone": "fair/wheatish/medium/dusky/deep",
  "skinToneHex": "#hex",
  "jawlineType": "soft/defined/strong",
  "skinScore": ${skinScore},
  "skinGrade": "A/B/C/D/F",
  "detectedProblems": [
    { "name": "problem name", "severity": "High/Moderate/Low", "score": 0, "description": "what it is", "cause": "why it happens" }
  ],
  "topHairstyles": [
    {"name": "${gender}-specific hairstyle 1 for ${faceShape} face", "reason": "why this works", "maintenance": "Low/Medium/High"},
    {"name": "${gender}-specific hairstyle 2 for ${faceShape} face", "reason": "why this works", "maintenance": "Low/Medium/High"},
    {"name": "${gender}-specific hairstyle 3 for ${faceShape} face", "reason": "why this works", "maintenance": "Low/Medium/High"}
  ],
  "skincareProducts": [
    {"step":1,"type":"Cleanser","productName":"","brand":"","price":"₹","why":"specific to ${skinType} skin","howToUse":"","availableAt":"Nykaa"},
    {"step":2,"type":"Serum","productName":"","brand":"","price":"₹","why":"","howToUse":"","availableAt":"Amazon"},
    {"step":3,"type":"Moisturizer","productName":"","brand":"","price":"₹","why":"","howToUse":"","availableAt":"Nykaa"},
    {"step":4,"type":"Sunscreen","productName":"","brand":"","price":"₹","why":"","howToUse":"","availableAt":"Amazon"},
    {"step":5,"type":"Night Treatment","productName":"","brand":"","price":"₹","why":"","howToUse":"","availableAt":"Nykaa"}
  ],
  "treatmentPlan": {
    "duration": "4 weeks",
    "goal": "specific goal for ${skinType} skin with score ${skinScore}",
    "weeklyFocus": ["Week 1 focus", "Week 2 focus", "Week 3 focus", "Week 4 focus"],
    "morningRoutine": ["step1", "step2", "step3", "step4"],
    "nightRoutine": ["step1", "step2", "step3"],
    "doNot": ["avoid1 for ${skinType} skin", "avoid2", "avoid3"]
  },
  "dietForSkin": ["food1", "food2", "food3", "water tip", "Indian food tip"],
  "lifestyleTips": ["tip1 for ${userGoal}", "tip2", "tip3", "tip4"],
  "grooming": ["tip1 specific to ${gender}", "tip2", "tip3"],
  "colorRecommendations": ["color1", "color2", "color3"],
  "stylesAvoid": ["style1 reason for ${faceShape}", "style2 reason"],
  "confidence": 95,
  "nextScanIn": "2 weeks"
}`;

    console.log("🤖 Calling Groq...");
    const text = await callGroq(prompt, { faceShape, gender, age, skinScore, skinType });
    console.log("📝 Groq response length:", text.length);

    const result = parseGroqJSON(text);

    if (!result || typeof result !== "object") {
      throw new Error("AI returned invalid structure");
    }

    // Merge skin problems
    if (result.detectedProblems && skinProblems.length > 0) {
      result.detectedProblems = result.detectedProblems.map((p, i) => ({
        ...skinProblems[i],
        ...p,
      }));
    }

    // Attach all data
    result.detectedAge = age;
    result.detectedGender = gender;
    result.faceShape = faceShape;
    result.skinScore = skinScore;
    result.rawSkinStatus = skinStatus;
    result.userProfile = { age, gender, height, weight, bmi, skinType, goal: userGoal };
    result.analyzedWith = "Face++ + Groq AI + User Profile";

    await User.findByIdAndUpdate(req.user._id, {
      $push: { analyses: { type: "face", result, createdAt: new Date() } },
    });

    res.json({ success: true, result });

  } catch (err) {
    console.error("=== FACE ANALYSIS ERROR ===");
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({
      error: "Face analysis failed. Please try again.",
      detail: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// ─── History ──────────────────────────────────────────────────────────────────
router.get("/history", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("analyses");
    const faceHistory = user.analyses
      .filter((a) => a.type === "face")
      .reverse()
      .slice(0, 10);
    res.json({ history: faceHistory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;