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

    const bmi = (weight / ((height/100) ** 2)).toFixed(1);

    const prompt = `Create a UNIQUE 7-day Indian fitness and diet plan for:
Weight: ${weight}kg, Height: ${height}cm, Age: ${age} years, Goal: ${goal}
Calculated BMI: ${bmi}
Timestamp: ${Date.now()}

STRICT RULES:
- Calculate real daily calories for this person
- Use ONLY Indian foods - vary every single day
- Workouts must match the goal: ${goal}
- NO generic or repeated meals

Return JSON with EXACTLY these keys:
{
  "bmi": "(calculate based on ${weight} and ${height})",
  "dailyCalories": (calculate real number),
  "macros": {"protein": "Xg (X%)", "carbs": "Xg (X%)", "fat": "Xg (X%)"},
  "weeklyPlan": [7 objects each with "day", "meals" (4 items with kcal), "workout", "workoutDetails" (3-4 exercises)],
  "topTips": [3 specific tips for ${goal}],
  "estimatedTimeline": "realistic timeline for ${goal}",
  "waterIntake": "amount based on ${weight}kg",
  "sleepRecommendation": "hours"
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