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

    const prompt = `You are GlowUp AI's fitness coach. Create a plan for Weight: ${weight}, Height: ${height}, Age: ${age}, Goal: ${goal}.
Return ONLY valid JSON, no extra text:
{
  "bmi": "22.5 (Normal)",
  "dailyCalories": 2200,
  "macros": {"protein": "150g (30%)", "carbs": "220g (40%)", "fat": "73g (30%)"},
  "weeklyPlan": [
    {"day": "Monday", "meals": ["Breakfast: Oats with milk", "Lunch: Rice and chicken", "Dinner: Dal roti", "Snack: Banana"], "workout": "Chest and Triceps", "workoutDetails": ["Push-ups 3x15", "Bench Press 3x10"]},
    {"day": "Tuesday", "meals": ["Breakfast: Eggs toast", "Lunch: Quinoa vegetables", "Dinner: Chicken curry", "Snack: Protein shake"], "workout": "Back and Biceps", "workoutDetails": ["Pull-ups 3x8", "Rows 3x10"]},
    {"day": "Wednesday", "meals": ["Breakfast: Smoothie", "Lunch: Sandwich", "Dinner: Fish salad", "Snack: Fruit"], "workout": "REST DAY", "workoutDetails": ["30 min walk", "Stretching"]},
    {"day": "Thursday", "meals": ["Breakfast: Paratha yogurt", "Lunch: Dal rice", "Dinner: Grilled chicken", "Snack: Nuts"], "workout": "Legs", "workoutDetails": ["Squats 4x15", "Lunges 3x12"]},
    {"day": "Friday", "meals": ["Breakfast: Protein pancakes", "Lunch: Chicken wrap", "Dinner: Dal makhani", "Snack: Banana"], "workout": "Shoulders and Abs", "workoutDetails": ["Shoulder Press 3x10", "Planks 3x60sec"]},
    {"day": "Saturday", "meals": ["Breakfast: Avocado toast", "Lunch: Biryani", "Dinner: Soup", "Snack: Protein bar"], "workout": "Cardio", "workoutDetails": ["Running 30 mins", "Jump rope 10 mins"]},
    {"day": "Sunday", "meals": ["Breakfast: French toast", "Lunch: Home food", "Dinner: Light salad", "Snack: Fruit"], "workout": "REST DAY", "workoutDetails": ["Foam rolling", "Yoga 20 mins"]}
  ],
  "topTips": ["Stay consistent every day", "Track weekly progress", "Sleep 7-8 hours"],
  "estimatedTimeline": "8-12 weeks to see results",
  "waterIntake": "3-4 liters per day",
  "sleepRecommendation": "7-8 hours per night"
}`;

    const text = await callGroq(prompt);
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
