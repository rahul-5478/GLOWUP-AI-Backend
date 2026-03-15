const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

// ─── FOOD SEARCH ──────────────────────────────────────────────────────────────
router.post("/search-food", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query required" });

    const prompt = `You are a nutrition database. User searched: "${query}"

Return ONLY this JSON array with 8 Indian food items matching the search:
[
  {"name": "food name", "cal": 150, "protein": 5, "carbs": 25, "fat": 3, "serving": "1 bowl (200g)"},
  {"name": "food name 2", "cal": 200, "protein": 8, "carbs": 30, "fat": 5, "serving": "1 plate"}
]

Rules:
- Include exact match + similar/related items
- All values must be realistic Indian food nutrition
- Return ONLY the JSON array, no other text`;

    const text = await callGroq(prompt, { query });
    let clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) return res.json({ results: [] });
    const results = JSON.parse(match[0]);
    res.json({ results });
  } catch (err) {
    console.error("Food search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// ─── SCAN FOOD ────────────────────────────────────────────────────────────────
router.post("/scan-food", protect, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required" });

    const prompt = `You are a food calorie scanner. Analyze this food image and return ONLY this JSON:
{
  "foodName": "name of food",
  "calories": 350,
  "protein": 12,
  "carbs": 48,
  "fat": 10,
  "serving": "1 plate (estimated)",
  "tip": "one short health tip"
}
No markdown, no extra text.`;

    const text = await callGroq(prompt, { task: "scan-food" });
    const result = parseGroqJSON(text);
    res.json({ success: true, result });
  } catch (err) {
    console.error("Scan food error:", err.message);
    res.status(500).json({ error: "Scan failed" });
  }
});

// ─── FITNESS PLAN ─────────────────────────────────────────────────────────────
router.post("/plan", protect, async (req, res) => {
  try {
    const { weight, height, age, goal, lifestyle, stomachIssue, targetDays } = req.body;
    if (!weight || !height || !age || !goal)
      return res.status(400).json({ error: "weight, height, age, and goal are required." });

    const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
    const seed = Math.random().toFixed(4);

    const prompt = `Fitness plan for: ${weight}kg, ${height}cm, ${age}yrs, goal=${goal}, lifestyle=${lifestyle || "moderate"}, stomach=${stomachIssue || "none"}, days=${targetDays || 30}, BMI=${bmi}, seed=${seed}

Return ONLY this JSON (keep meals SHORT, max 40 chars each):
{
  "bmi": "${bmi}",
  "dailyCalories": 2000,
  "macros": {"protein": "150g", "carbs": "200g", "fat": "65g"},
  "weeklyPlan": [
    {"day": "Monday", "meals": ["Breakfast: Poha (350)", "Lunch: Dal rice (600)", "Dinner: Roti sabzi (500)", "Snack: Banana (150)"], "workout": "Chest", "workoutDetails": ["Push-ups 3x15", "Bench 3x10", "Dips 3x12"]},
    {"day": "Tuesday", "meals": ["Breakfast: Egg toast (380)", "Lunch: Chicken rice (620)", "Dinner: Khichdi (450)", "Snack: Shake (200)"], "workout": "Back", "workoutDetails": ["Pull-ups 3x8", "Rows 3x10", "Curls 3x12"]},
    {"day": "Wednesday", "meals": ["Breakfast: Smoothie (300)", "Lunch: Rajma rice (580)", "Dinner: Fish salad (480)", "Snack: Fruit (150)"], "workout": "REST", "workoutDetails": ["Walk 30min", "Stretch 10min"]},
    {"day": "Thursday", "meals": ["Breakfast: Paratha (420)", "Lunch: Chole rice (600)", "Dinner: Grilled chicken (460)", "Snack: Nuts (180)"], "workout": "Legs", "workoutDetails": ["Squats 4x15", "Lunges 3x12", "Calf raise 3x15"]},
    {"day": "Friday", "meals": ["Breakfast: Upma (350)", "Lunch: Palak paneer (570)", "Dinner: Dal makhani (510)", "Snack: Chana (170)"], "workout": "Shoulders", "workoutDetails": ["Press 3x10", "Laterals 3x12", "Plank 3x60s"]},
    {"day": "Saturday", "meals": ["Breakfast: Idli (300)", "Lunch: Biryani (680)", "Dinner: Veg soup (380)", "Snack: Bar (200)"], "workout": "Cardio", "workoutDetails": ["Run 30min", "Rope 10min", "Cycle 15min"]},
    {"day": "Sunday", "meals": ["Breakfast: Chilla (360)", "Lunch: Home thali (640)", "Dinner: Khichdi (370)", "Snack: Fruits (150)"], "workout": "REST", "workoutDetails": ["Yoga 20min", "Walk 20min"]}
  ],
  "topTips": ["tip for ${goal}", "stay hydrated", "sleep 8hrs"],
  "estimatedTimeline": "8-12 weeks",
  "waterIntake": "3-4 liters daily",
  "sleepRecommendation": "7-8 hours"
}

IMPORTANT: Replace ALL placeholder values with real content for goal=${goal}.`;

    const text = await callGroq(prompt, { weight, height, age, goal });
    const result = parseGroqJSON(text);

    if (!result || typeof result !== "object") {
      throw new Error("AI returned invalid structure");
    }

    await User.findByIdAndUpdate(req.user._id, {
      "profile.weight": weight,
      "profile.height": height,
      "profile.age": age,
      "profile.goal": goal,
      $push: { analyses: { type: "fitness", result } },
    });

    res.json({ success: true, result });
  } catch (err) {
    console.error("Fitness plan error:", err.message);
    res.status(500).json({ error: "Could not generate fitness plan. Please try again." });
  }
});

// ─── HISTORY ──────────────────────────────────────────────────────────────────
router.get("/history", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("analyses");
    const history = user.analyses.filter((a) => a.type === "fitness").reverse();
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;