const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

// Save weekly score
router.post("/score", protect, async (req, res) => {
  try {
    const { skinScore, fitnessScore, fashionScore, notes } = req.body;

    const overallScore = Math.round((skinScore + fitnessScore + fashionScore) / 3);

    const weekData = {
      date: new Date(),
      week: getWeekNumber(new Date()),
      skinScore: skinScore || 0,
      fitnessScore: fitnessScore || 0,
      fashionScore: fashionScore || 0,
      overallScore,
      notes: notes || "",
    };

    await User.findByIdAndUpdate(req.user._id, {
      $push: { glowScores: weekData }
    });

    // AI insight generate karo
    const prompt = `User's weekly glow scores:
Skin: ${skinScore}/100, Fitness: ${fitnessScore}/100, Fashion: ${fashionScore}/100
Overall: ${overallScore}/100
Notes: ${notes || "none"}
Timestamp: ${Date.now()}

Give personalized weekly insight. Be encouraging and specific.

Return ONLY JSON:
{
  "overallScore": ${overallScore},
  "grade": "A/B/C/D based on score",
  "title": "catchy title like 'Glowing Week!' or 'Room to Grow!'",
  "insight": "2-3 sentences personalized insight",
  "skinFeedback": "specific skin feedback",
  "fitnessFeedback": "specific fitness feedback",
  "fashionFeedback": "specific fashion feedback",
  "topWin": "best thing they did this week",
  "focusNext": "one thing to improve next week",
  "motivationalQuote": "short motivational quote",
  "badges": ["badge1 if earned", "badge2 if earned"]
}`;

    const text = await callGroq(prompt, { skinScore, fitnessScore, fashionScore });
    const insight = parseGroqJSON(text);

    res.json({ success: true, weekData: { ...weekData, ...insight } });
  } catch (err) {
    console.error("Glow score error:", err.message);
    res.status(500).json({ error: "Could not save score." });
  }
});

// Get score history
router.get("/history", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("glowScores");
    const scores = (user.glowScores || []).slice(-12).reverse(); // Last 12 weeks
    res.json({ success: true, scores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get latest score
router.get("/latest", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("glowScores");
    const scores = user.glowScores || [];
    const latest = scores[scores.length - 1] || null;
    const previous = scores[scores.length - 2] || null;

    let trend = 0;
    if (latest && previous) {
      trend = latest.overallScore - previous.overallScore;
    }

    res.json({ success: true, latest, trend });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = router;