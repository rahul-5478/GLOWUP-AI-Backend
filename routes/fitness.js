const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/plan", protect, async (req, res) => {
  try {
    const { weight, height, age, goal, unit = "metric" } = req.body;
    if (!weight || !height || !age || !goal)
      return res.status(400).json({ error: "weight, height, age, and goal are required." });

    const prompt = `Create a UNIQUE and PERSONALIZED 7-day fitness and diet plan for this specific person:
- Weight: ${weight}kg, Height: ${height}cm, Age: ${age} years
- Goal: ${goal}
- Random variation seed: ${Math.random()}

Use INDIAN foods (roti, dal, sabzi, paneer, biryani, poha, upma etc).
Vary the meals and workouts creatively. Do NOT use generic plans.

Return ONLY valid JSON:
{
  "bmi": "22.5 (Normal)",
  "dailyCalories": 2200,
  "macros": {"protein": "150g (30%)", "carbs": "220g (40%)", "fat": "73g (30%)"},
  "weeklyPlan": [
    {"day": "Monday", "meals": ["Breakfast: Poha with peanuts (350 kcal)", "Lunch: Dal chawal with salad (600 kcal)", "Dinner: Roti sabzi paneer (500 kcal)", "Snack: Banana + almonds (200 kcal)"], "workout": "Chest and Triceps", "workoutDetails": ["Push-ups 3x15", "Bench Press 3x10", "Tricep dips 3x12"]},
    {"day": "Tuesday", "meals": ["Breakfast: Egg bhurji with toast (400 kcal)", "Lunch: Chicken curry rice (650 kcal)", "Dinner: Moong dal khichdi (450 kcal)", "Snack: Protein shake (200 kcal)"], "workout": "Back and Biceps", "workoutDetails": ["Pull-ups 3x8", "Dumbbell rows 3x10", "Bicep curls 3x12"]},
    {"day": "Wednesday", "meals": ["Breakfast: Smoothie bowl (300 kcal)", "Lunch: Rajma chawal (600 kcal)", "Dinner: Grilled fish with veggies (500 kcal)", "Snack: Fruit chaat (150 kcal)"], "workout": "REST DAY", "workoutDetails": ["30 min walk", "10 min stretching", "Foam rolling"]},
    {"day": "Thursday", "meals": ["Breakfast: Aloo paratha with curd (450 kcal)", "Lunch: Chole with rice (620 kcal)", "Dinner: Grilled chicken with salad (480 kcal)", "Snack: Mixed nuts (200 kcal)"], "workout": "Legs", "workoutDetails": ["Squats 4x15", "Lunges 3x12", "Leg press 3x10"]},
    {"day": "Friday", "meals": ["Breakfast: Upma with coconut chutney (350 kcal)", "Lunch: Palak paneer roti (580 kcal)", "Dinner: Dal makhani with tandoori roti (520 kcal)", "Snack: Roasted chana (180 kcal)"], "workout": "Shoulders and Abs", "workoutDetails": ["Shoulder press 3x10", "Lateral raises 3x12", "Planks 3x60sec"]},
    {"day": "Saturday", "meals": ["Breakfast: Idli sambar (300 kcal)", "Lunch: Chicken biryani (700 kcal)", "Dinner: Vegetable soup with bread (400 kcal)", "Snack: Protein bar (200 kcal)"], "workout": "Cardio", "workoutDetails": ["Running 30 mins", "Jump rope 10 mins", "Cycling 20 mins"]},
    {"day": "Sunday", "meals": ["Breakfast: Besan chilla with mint chutney (380 kcal)", "Lunch: Home cooked thali (650 kcal)", "Dinner: Light khichdi (380 kcal)", "Snack: Fresh fruit (150 kcal)"], "workout": "REST DAY", "workoutDetails": ["Yoga 30 mins", "Meditation 10 mins", "Light walk"]}
  ],
  "topTips": ["Stay consistent every day", "Track weekly progress", "Sleep 7-8 hours"],
  "estimatedTimeline": "8-12 weeks to see results",
  "waterIntake": "3-4 liters per day",
  "sleepRecommendation": "7-8 hours per night"
}`;

    const text = await callGroq(prompt, { weight, height, age, goal, userId: req.user._id });
    const result = parseGroqJSON(text);
    await User.findByIdAndUpdate(req.user._id, {
      "profile.weight": weight, "profile.height": height,
      "profile.age": age, "profile.goal": goal,
      $push: { analyses: { type: "fitness", result } },
    });
    res.json({ success: true, result });
  } catch (err) {
    console.error("Fitness plan error:", err.message);
    res.status(500).json({ error: "Could not generate fitness plan. Please try again." });
  }
});

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