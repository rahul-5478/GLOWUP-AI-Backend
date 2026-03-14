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
    const seed = Math.random().toFixed(8);

    const prompt = `Create a UNIQUE 7-day Indian fitness and diet plan. Seed:${seed}
Person: Weight=${weight}kg Height=${height}cm Age=${age}yrs Goal=${goal} BMI=${bmi}

Rules:
- Calculate real daily calories for this exact person
- Use ONLY Indian foods, vary every day, no repetition
- Workouts specific to goal: ${goal}
- Return ONLY raw JSON, no markdown, no explanation

{"bmi":"${bmi} (category)","dailyCalories":2200,"macros":{"protein":"150g (30%)","carbs":"220g (40%)","fat":"73g (30%)"},"weeklyPlan":[{"day":"Monday","meals":["Breakfast: Poha with peanuts (350 kcal)","Lunch: Dal chawal sabzi (600 kcal)","Dinner: Roti paneer sabzi (500 kcal)","Snack: Banana almonds (200 kcal)"],"workout":"Chest and Triceps","workoutDetails":["Push-ups 3x15","Bench Press 3x10","Tricep dips 3x12"]},{"day":"Tuesday","meals":["Breakfast: Egg bhurji toast (400 kcal)","Lunch: Chicken curry rice (650 kcal)","Dinner: Moong dal khichdi (450 kcal)","Snack: Protein shake (200 kcal)"],"workout":"Back and Biceps","workoutDetails":["Pull-ups 3x8","Dumbbell rows 3x10","Bicep curls 3x12"]},{"day":"Wednesday","meals":["Breakfast: Smoothie bowl (300 kcal)","Lunch: Rajma chawal (600 kcal)","Dinner: Grilled fish veggies (500 kcal)","Snack: Fruit chaat (150 kcal)"],"workout":"REST DAY","workoutDetails":["30 min walk","Stretching 10 min"]},{"day":"Thursday","meals":["Breakfast: Aloo paratha curd (450 kcal)","Lunch: Chole rice (620 kcal)","Dinner: Grilled chicken salad (480 kcal)","Snack: Mixed nuts (200 kcal)"],"workout":"Legs","workoutDetails":["Squats 4x15","Lunges 3x12","Leg press 3x10"]},{"day":"Friday","meals":["Breakfast: Upma coconut chutney (350 kcal)","Lunch: Palak paneer roti (580 kcal)","Dinner: Dal makhani tandoori roti (520 kcal)","Snack: Roasted chana (180 kcal)"],"workout":"Shoulders and Abs","workoutDetails":["Shoulder press 3x10","Lateral raises 3x12","Planks 3x60sec"]},{"day":"Saturday","meals":["Breakfast: Idli sambar (300 kcal)","Lunch: Chicken biryani (700 kcal)","Dinner: Vegetable soup bread (400 kcal)","Snack: Protein bar (200 kcal)"],"workout":"Cardio","workoutDetails":["Running 30 mins","Jump rope 10 mins","Cycling 20 mins"]},{"day":"Sunday","meals":["Breakfast: Besan chilla mint chutney (380 kcal)","Lunch: Home cooked thali (650 kcal)","Dinner: Light khichdi (380 kcal)","Snack: Fresh fruit (150 kcal)"],"workout":"REST DAY","workoutDetails":["Yoga 30 mins","Meditation 10 mins"]}],"topTips":["tip specific to ${goal}","tip2","tip3"],"estimatedTimeline":"realistic for ${goal}","waterIntake":"based on ${weight}kg","sleepRecommendation":"7-8 hours"}

Replace ALL values with FRESH Indian food and exercise names specific to ${goal}.`;

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