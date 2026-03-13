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

    const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
    const bmiStatus = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";

    const prompt = `Create a UNIQUE 7-day Indian fitness and diet plan for:
Weight: ${weight}kg, Height: ${height}cm, Age: ${age} years, Goal: ${goal}
BMI: ${bmi} (${bmiStatus})
Timestamp: ${Date.now()}

RULES:
- Use ONLY Indian foods (poha, upma, paratha, dal, sabzi, roti, khichdi, biryani, idli, dosa etc)
- Vary every single day - no repeated meals
- Workouts specifically for goal: ${goal}
- Calculate real calories for ${weight}kg ${age}yr person

Return ONLY this JSON, no markdown, no explanation:
{"bmi":"${bmi} (${bmiStatus})","dailyCalories":2000,"macros":{"protein":"120g (25%)","carbs":"225g (45%)","fat":"67g (30%)"},"weeklyPlan":[{"day":"Monday","meals":["Breakfast: Poha with peanuts (350 kcal)","Lunch: Dal chawal sabzi (600 kcal)","Dinner: Roti paneer sabzi (500 kcal)","Snack: Banana almonds (200 kcal)"],"workout":"Chest Triceps","workoutDetails":["Push-ups 3x15","Dumbbell press 3x10","Tricep dips 3x12"]},{"day":"Tuesday","meals":["Breakfast: X","Lunch: X","Dinner: X","Snack: X"],"workout":"Back Biceps","workoutDetails":["X","X","X"]},{"day":"Wednesday","meals":["Breakfast: X","Lunch: X","Dinner: X","Snack: X"],"workout":"REST DAY","workoutDetails":["30 min walk","Stretching"]},{"day":"Thursday","meals":["Breakfast: X","Lunch: X","Dinner: X","Snack: X"],"workout":"Legs","workoutDetails":["X","X","X"]},{"day":"Friday","meals":["Breakfast: X","Lunch: X","Dinner: X","Snack: X"],"workout":"Shoulders Abs","workoutDetails":["X","X","X"]},{"day":"Saturday","meals":["Breakfast: X","Lunch: X","Dinner: X","Snack: X"],"workout":"Cardio","workoutDetails":["X","X","X"]},{"day":"Sunday","meals":["Breakfast: X","Lunch: X","Dinner: X","Snack: X"],"workout":"REST DAY","workoutDetails":["Yoga 30 mins","Meditation"]}],"topTips":["tip1 for ${goal}","tip2","tip3"],"estimatedTimeline":"realistic for ${goal}","waterIntake":"${Math.round(weight * 0.033)} liters per day","sleepRecommendation":"7-8 hours per night"}

Replace ALL X with real varied Indian food and exercise names specific to ${goal}.`;

    const text = await callGroq(prompt, { weight, height, age, goal, userId: req.user._id });
    const result = parseGroqJSON(text);

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