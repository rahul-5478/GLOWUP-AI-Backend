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
    const seed = Math.random().toFixed(8);

    const prompt = `Create a 7-day Indian fitness plan. Seed:${seed}
Person: ${weight}kg, ${height}cm, ${age}yrs, Goal:${goal}, BMI:${bmi}(${bmiStatus})

Rules:
- Only Indian foods, vary every day
- Workouts for goal: ${goal}
- No repeated meals across days
- Return ONLY JSON, no markdown, no explanation

{"bmi":"${bmi} (${bmiStatus})","dailyCalories":2000,"macros":{"protein":"120g (25%)","carbs":"225g (45%)","fat":"67g (30%)"},"weeklyPlan":[{"day":"Monday","meals":["Breakfast: Poha peanuts 350kcal","Lunch: Dal chawal sabzi 600kcal","Dinner: Roti paneer 500kcal","Snack: Banana almonds 200kcal"],"workout":"Chest Triceps","workoutDetails":["Pushups 3x15","Dumbbell press 3x10","Tricep dips 3x12"]},{"day":"Tuesday","meals":["Breakfast: X","Lunch: X","Dinner: X","Snack: X"],"workout":"Back Biceps","workoutDetails":["X","X","X"]},{"day":"Wednesday","meals":["Breakfast: X","Lunch: X","Dinner: X","Snack: X"],"workout":"REST DAY","workoutDetails":["Walk 30min","Stretching"]},{"day":"Thursday","meals":["Breakfast: X","Lunch: X","Dinner: X","Snack: X"],"workout":"Legs","workoutDetails":["X","X","X"]},{"day":"Friday","meals":["Breakfast: X","Lunch: X","Dinner: X","Snack: X"],"workout":"Shoulders Abs","workoutDetails":["X","X","X"]},{"day":"Saturday","meals":["Breakfast: X","Lunch: X","Dinner: X","Snack: X"],"workout":"Cardio","workoutDetails":["X","X","X"]},{"day":"Sunday","meals":["Breakfast: X","Lunch: X","Dinner: X","Snack: X"],"workout":"REST DAY","workoutDetails":["Yoga 30min","Meditation"]}],"topTips":["tip1","tip2","tip3"],"estimatedTimeline":"realistic","waterIntake":"${Math.round(weight * 0.033)}L daily","sleepRecommendation":"7-8 hours"}

Replace ALL X with unique Indian food and exercise names for ${goal}.`;

    const text = await callGroq(prompt, { weight, height, age, goal });
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