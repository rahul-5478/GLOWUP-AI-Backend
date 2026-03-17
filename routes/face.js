const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGemini, parseGeminiJSON } = require("../config/gemini"); // ✅ Gemini
const User = require("../models/User");
const axios = require("axios");
const FormData = require("form-data");
const { attachImagesToHairstyles } = require("../utils/imageSearch");

// ─── Face++ API ───────────────────────────────────────────────────────────────
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
    console.error("Face++ error:", err.response?.data || err.message);
    return null;
  }
};

const getFaceShapeFromRect = (rect) => {
  if (!rect) return "oval";
  const ratio = rect.width / rect.height;
  if (ratio > 0.95) return "round";
  if (ratio > 0.85) return "square";
  if (ratio > 0.75) return "oval";
  return "oblong";
};

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

    const user = await User.findById(req.user._id).select("profile");
    const userProfile = user?.profile || {};

    // MediaPipe data from frontend
    const mediapipeFaceShape = mediapipe?.faceShape || null;
    const mediapipeJawline = mediapipe?.jawlineType || null;
    console.log("📐 MediaPipe face shape:", mediapipeFaceShape || "not available");

    // Face++ for skin data
    console.log("🔍 Calling Face++...");
    const faceData = await analyzeFaceWithFacePlusPlus(imageBase64);
    console.log("✅ Face++:", faceData ? "success" : "failed");

    // Face shape priority: MediaPipe > Face++ > default
    const faceShape = mediapipeFaceShape || getFaceShapeFromRect(faceData?.faceRectangle) || "oval";
    const jawlineType = mediapipeJawline || "defined";

    const gender = userProfile.gender
      ? userProfile.gender.charAt(0).toUpperCase() + userProfile.gender.slice(1)
      : faceData?.gender || "Unknown";
    const age = userProfile.age || faceData?.age || 25;
    const skinType = userProfile.skinType || "normal";
    const userGoal = userProfile.goal || "maintenance";
    const height = userProfile.height || null;
    const weight = userProfile.weight || null;
    const bmi = height && weight ? (weight / ((height / 100) ** 2)).toFixed(1) : null;

    const skinStatus = faceData?.skinStatus || {
      health: 70, acne: 10, dark_circle: 10,
      stain: 10, pore: 20, wrinkle: 10, saturation: 50,
    };
    const skinScore = Math.round(skinStatus.health);
    const skinProblems = detectSkinProblems(skinStatus);
    const problemsList = skinProblems.length > 0
      ? skinProblems.map(p => `${p.name} (severity: ${p.severity}, score: ${p.score})`).join(", ")
      : "None detected";

    const analysisSource = mediapipeFaceShape
      ? "MediaPipe AI (468 facial landmarks)"
      : "Face++ API";

    const prompt = `You are GlowUp AI expert beauty advisor. Return ONLY valid JSON. No markdown. No extra text.

ANALYSIS SOURCE: ${analysisSource}
GENDER: ${gender} | AGE: ${age} | SKIN TYPE: ${skinType} | GOAL: ${userGoal}
HEIGHT: ${height || "unknown"} cm | WEIGHT: ${weight || "unknown"} kg | BMI: ${bmi || "unknown"}
FACE SHAPE: ${faceShape} | JAWLINE: ${jawlineType}
SKIN SCORE: ${skinScore}/100
SKIN PROBLEMS: ${problemsList}

Return this exact JSON structure:
{
  "faceShape": "${faceShape}",
  "faceShapeDetails": "2 sentences about ${faceShape} face shape for ${gender}",
  "skinTone": "fair/wheatish/medium/dusky/deep",
  "skinToneHex": "#hexcode",
  "jawlineType": "${jawlineType}",
  "skinScore": ${skinScore},
  "skinGrade": "A/B/C/D",
  "detectedProblems": [
    {"name": "problem name", "severity": "High/Moderate/Low", "score": 0, "description": "description", "cause": "cause"}
  ],
  "topHairstyles": [
    {"name": "hairstyle name for ${faceShape} ${gender}", "reason": "why it suits ${faceShape} face", "maintenance": "Low/Medium/High"},
    {"name": "", "reason": "", "maintenance": ""},
    {"name": "", "reason": "", "maintenance": ""},
    {"name": "", "reason": "", "maintenance": ""},
    {"name": "", "reason": "", "maintenance": ""}
  ],
  "skincareProducts": [
    {"step": 1, "type": "Cleanser", "productName": "", "brand": "Indian brand", "price": "₹XXX", "why": "", "howToUse": "", "availableAt": "Nykaa/Amazon"},
    {"step": 2, "type": "Serum", "productName": "", "brand": "Indian brand", "price": "₹XXX", "why": "", "howToUse": "", "availableAt": ""},
    {"step": 3, "type": "Moisturizer", "productName": "", "brand": "Indian brand", "price": "₹XXX", "why": "", "howToUse": "", "availableAt": ""},
    {"step": 4, "type": "Sunscreen", "productName": "", "brand": "Indian brand", "price": "₹XXX", "why": "", "howToUse": "", "availableAt": ""},
    {"step": 5, "type": "Night Treatment", "productName": "", "brand": "Indian brand", "price": "₹XXX", "why": "", "howToUse": "", "availableAt": ""}
  ],
  "treatmentPlan": {
    "duration": "4 weeks",
    "goal": "goal based on problems",
    "weeklyFocus": ["week1 focus", "week2 focus", "week3 focus", "week4 focus"],
    "morningRoutine": ["step1", "step2", "step3", "step4"],
    "nightRoutine": ["step1", "step2", "step3"],
    "doNot": ["avoid1", "avoid2", "avoid3"]
  },
  "dietForSkin": ["tip1", "tip2", "tip3", "tip4", "tip5"],
  "lifestyleTips": ["tip1", "tip2", "tip3", "tip4"],
  "grooming": ["tip1 for ${gender}", "tip2", "tip3"],
  "colorRecommendations": ["color1", "color2", "color3"],
  "stylesAvoid": ["style1", "style2"],
  "confidence": ${mediapipeFaceShape ? 97 : 85},
  "nextScanIn": "2 weeks",
  "analysisSource": "${analysisSource}"
}`;

    // ── Call Gemini ──
    console.log("🤖 Calling Gemini...");
    const text = await callGemini(prompt, { faceShape, gender, age, skinScore, skinType });
    const result = parseGeminiJSON(text);
    console.log("✅ Gemini success, keys:", Object.keys(result).join(", "));

    if (!result || typeof result !== "object") {
      throw new Error("Gemini returned invalid structure");
    }

    // Override with accurate data
    result.faceShape = faceShape;
    result.jawlineType = jawlineType;
    result.detectedAge = age;
    result.detectedGender = gender;
    result.skinScore = skinScore;
    result.rawSkinStatus = skinStatus;
    result.userProfile = { age, gender, height, weight, bmi, skinType, goal: userGoal };
    result.analyzedWith = mediapipeFaceShape
      ? "MediaPipe + Face++ + Gemini AI"
      : "Face++ + Gemini AI";

    if (result.detectedProblems && skinProblems.length > 0) {
      result.detectedProblems = result.detectedProblems.map((p, i) => ({
        ...skinProblems[i],
        ...p,
      }));
    }

    // Attach Pexels hairstyle images
    if (result.topHairstyles?.length > 0) {
      console.log("🖼️ Fetching hairstyle images...");
      result.topHairstyles = await attachImagesToHairstyles(result.topHairstyles, gender);
      console.log("✅ Hairstyle images attached");
    }

    await User.findByIdAndUpdate(req.user._id, {
      $push: { analyses: { type: "face", result, createdAt: new Date() } },
    });

    res.json({ success: true, result });

  } catch (err) {
    console.error("=== FACE ANALYSIS ERROR ===", err.message);
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
    const faceHistory = user.analyses.filter(a => a.type === "face").reverse().slice(0, 10);
    res.json({ history: faceHistory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;