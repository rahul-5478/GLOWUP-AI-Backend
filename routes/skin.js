const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGemini, parseGeminiJSON } = require("../config/gemini"); // ✅ Gemini
const axios = require("axios");
const FormData = require("form-data");

// ── Face++ Scan ───────────────────────────────────────────────────────────────
async function scanWithFacePP(imageBase64) {
  try {
    const form = new FormData();
    form.append("api_key", process.env.FACEPLUSPLUS_API_KEY);
    form.append("api_secret", process.env.FACEPLUSPLUS_API_SECRET);
    form.append("image_base64", imageBase64);
    form.append("return_attributes", "gender,age,skinstatus,beauty,skincolor");

    const r = await axios.post(
      "https://api-us.faceplusplus.com/facepp/v3/detect",
      form,
      { headers: form.getHeaders(), timeout: 15000 }
    );

    if (!r.data.faces?.length) return null;
    const a = r.data.faces[0].attributes;

    return {
      age: a.age?.value || 25,
      gender: a.gender?.value || "Unknown",
      skinColor: a.skincolor?.value || "Medium",
      ss: {
        acne:        Math.round(a.skinstatus?.acne || 0),
        darkCircle:  Math.round(a.skinstatus?.dark_circle || 0),
        skinSpot:    Math.round(a.skinstatus?.skin_spot || 0),
        pores:       Math.round(a.skinstatus?.stain || 0),
        eyePouch:    Math.round(a.skinstatus?.eye_pouch || 0),
        wrinkle:     Math.round(a.skinstatus?.wrinkle || 0),
        blackheads:  Math.round(a.skinstatus?.blackheads || 0),
        whiteheads:  Math.round(a.skinstatus?.whiteheads || 0),
      },
      beauty: Math.round(
        a.gender?.value === "Female"
          ? (a.beauty?.female_score || 70)
          : (a.beauty?.male_score || 70)
      ),
    };
  } catch (e) {
    console.error("Face++ error:", e.message);
    return null;
  }
}

// ── Score + Grade ─────────────────────────────────────────────────────────────
function calcScore(ss) {
  if (!ss) return 72;
  const p =
    (ss.acne / 100) * 22 + (ss.darkCircle / 100) * 15 +
    (ss.skinSpot / 100) * 14 + (ss.pores / 100) * 10 +
    (ss.wrinkle / 100) * 10 + (ss.eyePouch / 100) * 8 +
    (ss.blackheads / 100) * 8 + (ss.whiteheads / 100) * 7;
  return Math.round(Math.max(40, Math.min(97, 97 - p)));
}
const grade = (s) => s >= 85 ? "A" : s >= 70 ? "B" : s >= 55 ? "C" : "D";

// ── Fallback data ─────────────────────────────────────────────────────────────
function getFallback(faceData, skinScore) {
  return {
    skinType: "combination",
    skinTypeSummary: "Your skin shows a combination pattern with oily T-zone and normal cheeks. This is very common for Indian skin types and is manageable with the right routine.",
    overallHealth: skinScore >= 75 ? "Good" : "Fair",
    grade: grade(skinScore),
    detectedProblems: [
      { name: "Acne", severity: "Mild", severityPercent: faceData?.ss?.acne || 30, description: "Excess oil production clogging pores causing mild breakouts.", affectedArea: "T-zone", urgency: "Medium" },
      { name: "Dark Circles", severity: "Mild", severityPercent: faceData?.ss?.darkCircle || 25, description: "Thin skin under eyes showing blood vessels.", affectedArea: "Under eyes", urgency: "Low" },
    ],
    skinStrengths: ["Natural skin elasticity", "Good overall texture", "Healthy skin tone"],
    estimatedResults: "With consistent routine, expect 60-70% improvement in 6-8 weeks",
    dermatologistNote: "Your skin is responding well. Focus on a consistent morning and night routine with proper sun protection.",
    ingredientsToUse: ["Niacinamide 10%", "Salicylic Acid 2%", "Hyaluronic Acid", "Vitamin C", "SPF 50+"],
    ingredientsToAvoid: ["Alcohol denat", "Artificial fragrance", "Mineral oil"],
    dietForSkin: ["Eat amla daily for Vitamin C boost", "Drink haldi milk before sleep", "Avoid excess dairy if acne-prone", "Green tea instead of regular chai"],
    lifestyleTips: ["Change pillowcase every 3 days", "Never skip sunscreen even indoors", "Drink minimum 3 liters water daily"],
    productPlan: [
      { step: 1, timeOfDay: "Morning", category: "Cleanser", productName: "Minimalist Salicylic Acid 2% Face Wash", brand: "Minimalist", price: "₹299", availableAt: "Nykaa", whyThisProduct: "Unclogs pores and reduces acne without over-drying", howToUse: "Apply on wet face, massage 60 seconds, rinse with cold water", targetsProblems: ["acne", "pores"], duration: "Daily" },
      { step: 2, timeOfDay: "Morning", category: "Serum", productName: "Minimalist Niacinamide 10% + Zinc", brand: "Minimalist", price: "₹599", availableAt: "Nykaa, Amazon", whyThisProduct: "Reduces pores, controls oil, fades dark spots", howToUse: "3-4 drops, pat gently, wait 2 minutes", targetsProblems: ["pores", "dark spots"], duration: "Daily" },
      { step: 3, timeOfDay: "Morning", category: "Moisturizer", productName: "Neutrogena Hydro Boost Water Gel", brand: "Neutrogena", price: "₹799", availableAt: "Nykaa, Flipkart", whyThisProduct: "Lightweight non-comedogenic hydration", howToUse: "Pea-sized amount after serum", targetsProblems: ["hydration"], duration: "Daily" },
      { step: 4, timeOfDay: "Morning", category: "Sunscreen", productName: "RE'EQUIL Oxybenzone Free SPF 50 PA+++", brand: "RE'EQUIL", price: "₹595", availableAt: "Nykaa, Amazon", whyThisProduct: "Prevents pigmentation, no white cast", howToUse: "2-finger length, last morning step", targetsProblems: ["UV protection"], duration: "Every morning" },
      { step: 5, timeOfDay: "Night", category: "Cleanser", productName: "Simple Kind to Skin Moisturising Facial Wash", brand: "Simple", price: "₹349", availableAt: "Nykaa, Flipkart", whyThisProduct: "Gentle evening cleanse", howToUse: "Massage 60 seconds, rinse thoroughly", targetsProblems: ["cleansing"], duration: "Every night" },
      { step: 6, timeOfDay: "Night", category: "Serum", productName: "Dot & Key Watermelon Hyaluronic Serum", brand: "Dot & Key", price: "₹545", availableAt: "Nykaa", whyThisProduct: "Deep overnight hydration", howToUse: "4-5 drops, press into skin", targetsProblems: ["hydration"], duration: "Every night" },
    ],
    weeklyTreatments: [
      { day: "Tuesday & Saturday", treatment: "Exfoliation", product: "Mamaearth Ubtan Face Scrub", price: "₹249", instructions: "Use 1-2 times per week. Massage circular motion 2 mins." },
      { day: "Wednesday", treatment: "Clay Mask", product: "Multani Mitti + Rose Water", price: "₹50", instructions: "Mix 2 tbsp multani mitti with rose water. Apply 15 mins. Rinse cold water." },
    ],
    treatmentPlan: {
      week1: { title: "Foundation Week", morning: ["Salicylic face wash", "Niacinamide serum", "Moisturizer", "SPF 50"], night: ["Gentle cleanser", "Hyaluronic serum", "Night cream"], avoid: ["Hot water on face", "Touching face", "Skipping sunscreen"], expectedResult: "Skin feels cleaner, oiliness reduces" },
      week2: { title: "Treatment Week", morning: ["Full morning routine", "Apply sunscreen generously"], night: ["Add retinol 0.1% 2-3 times", "Clay mask Wednesday"], avoid: ["Popping pimples", "Skipping steps"], expectedResult: "New breakouts reduce, slight brightening visible" },
      week3: { title: "Repair Week", morning: ["Full routine", "Exfoliate Tuesday only"], night: ["Retinol 3 times", "Add Vitamin C serum"], avoid: ["Over-exfoliating", "Mixing too many actives"], expectedResult: "Dark spots fading, texture smoother" },
      week4: { title: "Maintenance Week", morning: ["Full routine", "Double sunscreen outdoors"], night: ["Full night routine daily"], avoid: ["Stopping routine", "Staying up late"], expectedResult: "60-70% improvement, glowing skin" },
    },
  };
}

// ── Main Route ────────────────────────────────────────────────────────────────
router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    // Step 1: Face++ scan
    console.log("🔬 Face++ scanning...");
    const faceData = await scanWithFacePP(imageBase64);
    const skinScore = calcScore(faceData?.ss);
    console.log(`✅ Score: ${skinScore}, Face++ data: ${faceData ? "yes" : "no"}`);

    // Step 2: Gemini AI
    let aiResult = null;
    try {
      const ss = faceData?.ss || {};
      const problems = [];
      if (ss.acne > 25)       problems.push(`acne ${ss.acne}%`);
      if (ss.darkCircle > 25) problems.push(`dark circles ${ss.darkCircle}%`);
      if (ss.skinSpot > 20)   problems.push(`dark spots ${ss.skinSpot}%`);
      if (ss.pores > 25)      problems.push(`large pores ${ss.pores}%`);
      if (ss.wrinkle > 20)    problems.push(`wrinkles ${ss.wrinkle}%`);
      if (ss.blackheads > 20) problems.push(`blackheads ${ss.blackheads}%`);
      const problemStr = problems.length ? problems.join(", ") : "generally healthy skin";

      console.log("🤖 Calling Gemini...");

      const prompt = `You are a dermatologist AI. Patient scan: age ${faceData?.age || 25}, ${faceData?.gender || "unknown"}, skin problems: ${problemStr}, skin score: ${skinScore}/100.

Give personalized Indian skincare advice. Use ONLY Indian products from Nykaa/Amazon.
Return ONLY a JSON object. No markdown. No extra text.

Required JSON keys:
- skinType: string (oily/dry/combination/normal/sensitive)
- skinTypeSummary: string (2 sentences)
- overallHealth: string
- grade: string (A/B/C/D)
- detectedProblems: array of {name, severity, severityPercent, description, affectedArea, urgency}
- skinStrengths: array of 3 strings
- estimatedResults: string
- dermatologistNote: string
- ingredientsToUse: array of 5 strings
- ingredientsToAvoid: array of 3 strings
- dietForSkin: array of 4 strings
- lifestyleTips: array of 3 strings
- productPlan: array of 6 objects with {step, timeOfDay, category, productName, brand, price, availableAt, whyThisProduct, howToUse, targetsProblems, duration}
- weeklyTreatments: array of 2 objects with {day, treatment, product, price, instructions}
- treatmentPlan: object with week1, week2, week3, week4 each having {title, morning, night, avoid, expectedResult}`;

      const text = await callGemini(prompt);
      aiResult = parseGeminiJSON(text);
      console.log("✅ Gemini success, keys:", Object.keys(aiResult).join(", "));

      // Validate — use fallback for missing parts
      if (!aiResult.productPlan || aiResult.productPlan.length === 0) {
        console.log("⚠️ productPlan missing, using fallback");
        const fb = getFallback(faceData, skinScore);
        aiResult.productPlan = fb.productPlan;
        aiResult.weeklyTreatments = fb.weeklyTreatments;
        aiResult.treatmentPlan = fb.treatmentPlan;
      }
      if (!aiResult.treatmentPlan?.week1) {
        console.log("⚠️ treatmentPlan missing, using fallback");
        aiResult.treatmentPlan = getFallback(faceData, skinScore).treatmentPlan;
      }
    } catch (geminiErr) {
      console.error("⚠️ Gemini failed, using fallback:", geminiErr.message);
      aiResult = getFallback(faceData, skinScore);
    }

    // Step 3: Final result
    const result = {
      ...aiResult,
      skinScore,
      faceAnalysis: faceData ? {
        age: faceData.age,
        gender: faceData.gender,
        beautyScore: faceData.beauty,
        skinRawData: faceData.ss,
        verifiedByFacePP: true,
      } : null,
      analyzedAt: new Date().toISOString(),
    };

    res.json({ success: true, result });

  } catch (err) {
    console.error("❌ Skin analysis error:", err.message);
    res.status(500).json({ error: "Skin analysis failed. Please try again." });
  }
});

module.exports = router;