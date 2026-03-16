const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");
const axios = require("axios");
const FormData = require("form-data");

// ─── Face++ API (backup — skin data ke liye) ──────────────────────────────────
const analyzeFaceWithFacePlusPlus = async (imageBase64) => {
  try {
    const form = new FormData();
    form.append("api_key", process.env.FACEPLUSPLUS_API_KEY);
    form.append("api_secret", process.env.FACEPLUSPLUS_API_SECRET);
    form.append("image_base64", imageBase64);
    form.append("return_attributes", "gender,age,skinstatus,beauty,facequality");

    const response = await axios.post(
      "https://api-us.faceplusplus.com/facepp/v3/detect",
      form,
      { headers: form.getHeaders(), timeout: 15000 }
    );

    const faces = response.data.faces;
    if (!faces || faces.length === 0) return null;

    const attrs = faces[0].attributes;
    return {
      gender: attrs.gender?.value || "Unknown",
      age: attrs.age?.value || 25,
      skinStatus: {
        health: attrs.skinstatus?.health || 70,
        stain: attrs.skinstatus?.stain || 0,
        dark_circle: attrs.skinstatus?.dark_circle || 0,
        acne: attrs.skinstatus?.acne || 0,
        pore: attrs.skinstatus?.pore || 0,
        wrinkle: attrs.skinstatus?.wrinkle || 0,
        saturation: attrs.skinstatus?.saturation || 50,
      },
      beauty: {
        male_score: attrs.beauty?.male_score || 0,
        female_score: attrs.beauty?.female_score || 0,
      },
      faceRectangle: faces[0].face_rectangle,
    };
  } catch (err) {
    console.error("Face++ error (non-critical):", err.response?.data || err.message);
    return null; // ✅ null return karo — backup hai, crash nahi hoga
  }
};

// ─── Face Shape from rectangle (fallback) ────────────────────────────────────
const getFaceShapeFromRect = (rect) => {
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
  return problems;
};

// ─── MAIN ROUTE ───────────────────────────────────────────────────────────────
router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64, mediapipe } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    // ── User profile se data lo ──
    const user = await User.findById(req.user._id).select("profile");
    const userProfile = user?.profile || {};

    // ── Step 1: MediaPipe data (frontend se aaya) ──
    const mediapipeFaceShape = mediapipe?.faceShape || null;
    const mediapipeJawline = mediapipe?.jawlineType || null;

    console.log("📐 MediaPipe face shape:", mediapipeFaceShape || "not available");

    // ── Step 2: Face++ (backup — skin data ke liye) ──
    console.log("🔍 Calling Face++ for skin data...");
    const faceData = await analyzeFaceWithFacePlusPlus(imageBase64);
    console.log("✅ Face++ result:", faceData ? "success" : "failed (using defaults)");

    // ── Step 3: Face shape priority ──
    // 1st: MediaPipe (most accurate — 468 landmarks)
    // 2nd: Face++ rectangle ratio (fallback)
    // 3rd: "oval" (default)
    const faceShape = mediapipeFaceShape
      || getFaceShapeFromRect(faceData?.faceRectangle)
      || "oval";

    const jawlineType = mediapipeJawline || "defined";

    // ── Step 4: User profile priority for gender/age ──
    const gender = userProfile.gender
      ? userProfile.gender.charAt(0).toUpperCase() + userProfile.gender.slice(1)
      : faceData?.gender || "Unknown";

    const age = userProfile.age || faceData?.age || 25;
    const skinType = userProfile.skinType || "normal";
    const userGoal = userProfile.goal || "maintenance";
    const height = userProfile.height || null;
    const weight = userProfile.weight || null;
    const bmi = height && weight
      ? (weight / ((height / 100) ** 2)).toFixed(1)
      : null;

    // ── Step 5: Skin status ──
    const skinStatus = faceData?.skinStatus || {
      health: 70, acne: 10, dark_circle: 10,
      stain: 10, pore: 20, wrinkle: 10, saturation: 50,
    };
    const skinScore = Math.round(skinStatus.health);
    const skinProblems = detectSkinProblems(skinStatus);

    const problemsList = skinProblems.length > 0
      ? skinProblems.map(p => `${p.name} (severity: ${p.severity}, score: ${p.score})`).join(", ")
      : "None detected";

    // ── Step 6: Groq prompt ──
    const analysisSource = mediapipeFaceShape
      ? "MediaPipe AI (468 facial landmarks — highly accurate)"
      : "Face++ API (face rectangle ratio)";

    const prompt = `You are GlowUp AI's expert beauty advisor. Return ONLY valid JSON. No markdown.

FACE ANALYSIS SOURCE: ${analysisSource}

USER PROFILE (100% accurate — from registration):
- Gender: ${gender}
- Age: ${age} years
- Height: ${height ? height + " cm" : "unknown"}
- Weight: ${weight ? weight + " kg" : "unknown"}
- BMI: ${bmi || "unknown"}
- Skin Type: ${skinType}
- Goal: ${userGoal}

FACE DATA:
- Face Shape: ${faceShape} (detected by ${mediapipeFaceShape ? "MediaPipe" : "Face++"})
- Jawline: ${jawlineType}
- Skin Score: ${skinScore}/100
- Acne: ${skinStatus.acne}, Dark Circles: ${skinStatus.dark_circle}
- Pores: ${skinStatus.pore}, Wrinkles: ${skinStatus.wrinkle}
- Skin Problems: ${problemsList}

Return this JSON:
{
  "faceShape": "${faceShape}",
  "faceShapeDetails": "2 specific sentences about ${faceShape} face for ${gender} age ${age}",
  "skinTone": "fair/wheatish/medium/dusky/deep",
  "skinToneHex": "#hex",
  "jawlineType": "${jawlineType}",
  "skinScore": ${skinScore},
  "skinGrade": "A/B/C/D/F",
  "detectedProblems": [
    {"name": "", "severity": "High/Moderate/Low", "score": 0, "description": "", "cause": ""}
  ],
  "topHairstyles": [
    {"name": "${gender}-specific style for ${faceShape}", "reason": "", "maintenance": "Low/Medium/High"},
    {"name": "", "reason": "", "maintenance": "Low/Medium/High"},
    {"name": "", "reason": "", "maintenance": "Low/Medium/High"}
  ],
  "skincareProducts": [
    {"step":1,"type":"Cleanser","productName":"","brand":"","price":"₹","why":"for ${skinType} skin","howToUse":"","availableAt":"Nykaa"},
    {"step":2,"type":"Serum","productName":"","brand":"","price":"₹","why":"","howToUse":"","availableAt":"Amazon"},
    {"step":3,"type":"Moisturizer","productName":"","brand":"","price":"₹","why":"","howToUse":"","availableAt":"Nykaa"},
    {"step":4,"type":"Sunscreen","productName":"","brand":"","price":"₹","why":"","howToUse":"","availableAt":"Amazon"},
    {"step":5,"type":"Night Treatment","productName":"","brand":"","price":"₹","why":"","howToUse":"","availableAt":"Nykaa"}
  ],
  "treatmentPlan": {
    "duration": "4 weeks",
    "goal": "",
    "weeklyFocus": ["", "", "", ""],
    "morningRoutine": ["", "", "", ""],
    "nightRoutine": ["", "", ""],
    "doNot": ["", "", ""]
  },
  "dietForSkin": ["", "", "", "", ""],
  "lifestyleTips": ["", "", "", ""],
  "grooming": ["specific for ${gender}", "", ""],
  "colorRecommendations": ["", "", ""],
  "stylesAvoid": ["", ""],
  "confidence": ${mediapipeFaceShape ? 97 : 85},
  "nextScanIn": "2 weeks",
  "analysisSource": "${analysisSource}"
}`;

    console.log("🤖 Calling Groq...");
    const text = await callGroq(prompt, { faceShape, gender, age, skinScore, skinType });
    const result = parseGroqJSON(text);

    if (!result || typeof result !== "object") {
      throw new Error("AI returned invalid structure");
    }

    // ── Override with accurate data ──
    result.faceShape = faceShape;
    result.jawlineType = jawlineType;
    result.detectedAge = age;
    result.detectedGender = gender;
    result.skinScore = skinScore;
    result.rawSkinStatus = skinStatus;
    result.userProfile = { age, gender, height, weight, bmi, skinType, goal: userGoal };

    // ✅ Analysis source track karo
    result.analyzedWith = mediapipeFaceShape
      ? "MediaPipe + Face++ + Groq AI"
      : "Face++ + Groq AI";

    // Merge skin problems
    if (result.detectedProblems && skinProblems.length > 0) {
      result.detectedProblems = result.detectedProblems.map((p, i) => ({
        ...skinProblems[i],
        ...p,
      }));
    }

    await User.findByIdAndUpdate(req.user._id, {
      $push: { analyses: { type: "face", result, createdAt: new Date() } },
    });

    res.json({ success: true, result });

  } catch (err) {
    console.error("=== FACE ANALYSIS ERROR ===");
    console.error("Message:", err.message);
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
      .filter(a => a.type === "face")
      .reverse()
      .slice(0, 10);
    res.json({ history: faceHistory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;