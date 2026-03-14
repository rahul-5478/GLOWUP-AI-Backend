const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
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

// ── Fallback data if AI fails ─────────────────────────────────────────────────
function getFallback(faceData, skinScore) {
  return {
    skinType: "combination",
    skinTypeSummary: "Your skin shows a combination pattern with oily T-zone and normal cheeks. This is very common for Indian skin types and is manageable with the right routine.",
    overallHealth: skinScore >= 75 ? "Good" : "Fair",
    grade: grade(skinScore),
    detectedProblems: [
      { name: "Acne", severity: "Mild", severityPercent: faceData?.ss?.acne || 30, description: "Excess oil production clogging pores causing mild breakouts.", affectedArea: "T-zone", urgency: "Medium" },
      { name: "Dark Circles", severity: "Mild", severityPercent: faceData?.ss?.darkCircle || 25, description: "Thin skin under eyes showing blood vessels causing discoloration.", affectedArea: "Under eyes", urgency: "Low" },
    ],
    skinStrengths: ["Natural skin elasticity", "Good overall texture", "Healthy skin tone"],
    estimatedResults: "With consistent routine, expect 60-70% improvement in 6-8 weeks",
    dermatologistNote: "Your skin is responding well. Focus on a consistent morning and night routine with proper sun protection.",
    ingredientsToUse: ["Niacinamide 10%", "Salicylic Acid 2%", "Hyaluronic Acid", "Vitamin C", "SPF 50+"],
    ingredientsToAvoid: ["Alcohol denat", "Artificial fragrance", "Mineral oil"],
    dietForSkin: ["Eat amla daily for Vitamin C boost", "Drink haldi milk before sleep", "Avoid excess dairy if acne-prone", "Green tea instead of regular chai"],
    lifestyleTips: ["Change pillowcase every 3 days", "Never skip sunscreen even indoors", "Drink minimum 3 liters water daily"],
    productPlan: [
      { step: 1, timeOfDay: "Morning", category: "Cleanser", productName: "Minimalist Salicylic Acid 2% Face Wash", brand: "Minimalist", price: "₹299", availableAt: "Nykaa", whyThisProduct: "Salicylic acid unclogs pores and reduces acne without over-drying", howToUse: "Apply on wet face, massage 60 seconds, rinse with cold water", targetsProblems: ["acne", "pores"], duration: "Daily" },
      { step: 2, timeOfDay: "Morning", category: "Serum", productName: "Minimalist Niacinamide 10% + Zinc", brand: "Minimalist", price: "₹599", availableAt: "Nykaa, Amazon", whyThisProduct: "Reduces enlarged pores, controls oil, fades dark spots and acne marks", howToUse: "3-4 drops on clean skin, pat gently, wait 2 minutes before next step", targetsProblems: ["pores", "dark spots", "oil control"], duration: "Daily" },
      { step: 3, timeOfDay: "Morning", category: "Moisturizer", productName: "Neutrogena Hydro Boost Water Gel", brand: "Neutrogena", price: "₹799", availableAt: "Nykaa, Flipkart", whyThisProduct: "Lightweight, non-comedogenic hydration that won't clog pores", howToUse: "Pea-sized amount, press gently into skin after serum", targetsProblems: ["hydration", "barrier repair"], duration: "Daily" },
      { step: 4, timeOfDay: "Morning", category: "Sunscreen", productName: "RE'EQUIL Oxybenzone Free Sunscreen SPF 50 PA+++", brand: "RE'EQUIL", price: "₹595", availableAt: "Nykaa, Amazon", whyThisProduct: "Prevents pigmentation worsening, no white cast, gentle formula", howToUse: "2-finger length amount, last step of morning routine, 20 mins before sun", targetsProblems: ["pigmentation", "UV protection"], duration: "Every morning without fail" },
      { step: 5, timeOfDay: "Night", category: "Cleanser", productName: "Simple Kind to Skin Moisturising Facial Wash", brand: "Simple", price: "₹349", availableAt: "Nykaa, Flipkart", whyThisProduct: "Gentle evening cleanse removes sunscreen, makeup and pollution", howToUse: "Massage on wet face for 60 seconds, rinse thoroughly", targetsProblems: ["cleansing", "gentle care"], duration: "Every night" },
      { step: 6, timeOfDay: "Night", category: "Serum", productName: "Dot & Key Watermelon Hyaluronic Cooling Serum", brand: "Dot & Key", price: "₹545", availableAt: "Nykaa", whyThisProduct: "Deep overnight hydration, plumps skin and reduces fine lines", howToUse: "4-5 drops, press into skin gently after cleansing", targetsProblems: ["hydration", "anti-aging"], duration: "Every night" },
    ],
    weeklyTreatments: [
      { day: "Tuesday & Saturday", treatment: "Exfoliation", product: "Mamaearth Ubtan Face Scrub", price: "₹249", instructions: "Use only 1-2 times per week. Massage in circular motion 2 mins. Skip if active breakouts." },
      { day: "Wednesday", treatment: "Clay Mask", product: "Multani Mitti + Rose Water", price: "₹50", instructions: "Mix 2 tbsp multani mitti with rose water to paste. Apply 15 mins. Rinse with cold water. Excellent for oily skin." },
    ],
    treatmentPlan: {
      week1: { title: "Foundation Week - Cleanse & Start", morning: ["Salicylic acid face wash", "Niacinamide serum", "Lightweight moisturizer", "SPF 50 sunscreen"], night: ["Gentle cleanser", "Hyaluronic acid serum", "Night moisturizer"], avoid: ["Hot water on face", "Touching face frequently", "Skipping sunscreen"], expectedResult: "Skin feels cleaner, less congested, oiliness reduces by day 5-7" },
      week2: { title: "Treatment Week - Target Problems", morning: ["Continue full morning routine", "Apply sunscreen generously before going out"], night: ["Add retinol 0.1% serum 2-3 times this week", "Use clay mask on Wednesday"], avoid: ["Popping pimples", "Skipping steps thinking skin looks better"], expectedResult: "New breakouts reduce significantly, slight overall brightening visible" },
      week3: { title: "Repair Week - Heal & Brighten", morning: ["Full routine consistently", "Exfoliate Tuesday only with gentle scrub"], night: ["Retinol 3 times this week", "Add Vitamin C serum before moisturizer"], avoid: ["Over-exfoliating", "Mixing too many active ingredients at once"], expectedResult: "Dark spots starting to fade, skin texture becomes noticeably smoother" },
      week4: { title: "Maintenance Week - Protect & Glow", morning: ["Full routine", "Double sunscreen if spending 2+ hours outdoors"], night: ["Full night routine consistently every single day"], avoid: ["Stopping routine thinking skin is cured", "Staying up late - sleep is skincare"], expectedResult: "60-70% visible improvement, glowing clear skin, compliments incoming!" },
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

    // Step 2: Try Groq AI — if it fails, use fallback
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

      console.log("🤖 Calling Groq...");

      const prompt = `You are a dermatologist AI. Patient scan: age ${faceData?.age || 25}, ${faceData?.gender || "unknown"}, skin problems: ${problemStr}, skin score: ${skinScore}/100.
Seed:${Math.random()}

Give personalized Indian skincare advice. Use ONLY Indian products from Nykaa/Amazon.
Return ONLY a JSON object starting with { and ending with }. No markdown. No extra text.

The JSON must have these exact keys:
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
- productPlan: array of 6 objects each with {step, timeOfDay, category, productName, brand, price, availableAt, whyThisProduct, howToUse, targetsProblems, duration}
- weeklyTreatments: array of 2 objects with {day, treatment, product, price, instructions}
- treatmentPlan: object with week1, week2, week3, week4 each having {title, morning, night, avoid, expectedResult}`;

      const text = await callGroq(prompt);
      aiResult = parseGroqJSON(text);
      console.log("✅ Groq success, keys:", Object.keys(aiResult).join(", "));

      // Validate critical keys exist — if not, use fallback for missing parts
      if (!aiResult.productPlan || aiResult.productPlan.length === 0) {
        console.log("⚠️ productPlan missing, using fallback");
        const fb = getFallback(faceData, skinScore);
        aiResult.productPlan = fb.productPlan;
        aiResult.weeklyTreatments = fb.weeklyTreatments;
        aiResult.treatmentPlan = fb.treatmentPlan;
      }
      if (!aiResult.treatmentPlan || !aiResult.treatmentPlan.week1) {
        console.log("⚠️ treatmentPlan missing, using fallback");
        const fb = getFallback(faceData, skinScore);
        aiResult.treatmentPlan = fb.treatmentPlan;
      }
    } catch (groqErr) {
      console.error("⚠️ Groq failed, using fallback:", groqErr.message);
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