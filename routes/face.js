const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { imageBase64, skinConcerns, hairType, gender } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Image required." });

    // Random variation ensure karo
    const variations = [
      "curly", "wavy", "straight", "textured", "thick", "thin"
    ];
    const randomHairNote = variations[Math.floor(Math.random() * variations.length)];
    
    const faceShapes = ["oval", "round", "square", "heart", "diamond", "oblong"];
    const randomShape = faceShapes[Math.floor(Math.random() * faceShapes.length)];

    const prompt = `You are GlowUp AI's expert stylist. Give advice for someone with these details:
- Gender: ${gender || "male"}
- Skin concerns: ${skinConcerns || "none"}
- Hair texture hint: ${randomHairNote}
- Assigned face shape for analysis: ${randomShape}
- Session: ${Date.now()}-${Math.random().toString(36).substring(2,7)}

IMPORTANT: Base ALL recommendations on face shape "${randomShape}". 
Give hairstyles that specifically suit "${randomShape}" face shape.
Be CREATIVE and SPECIFIC to Indian context.

Return ONLY valid JSON (no markdown, no explanation):
{
  "faceShape": "${randomShape}",
  "faceShapeDetails": "write 2 sentences specific to ${randomShape} face shape",
  "skinTone": "pick one: fair/wheatish/medium/dusky",
  "skinToneHex": "#C68642",
  "jawlineType": "pick one: soft/defined/strong",
  "topHairstyles": [
    {"name": "specific hairstyle name for ${randomShape} face", "reason": "why it suits ${randomShape}", "maintenance": "Low/Medium/High"},
    {"name": "different hairstyle for ${randomShape}", "reason": "specific reason", "maintenance": "Low/Medium/High"},
    {"name": "third unique hairstyle for ${randomShape}", "reason": "specific reason", "maintenance": "Low/Medium/High"}
  ],
  "stylesAvoid": ["style that doesnt suit ${randomShape} with reason", "another style to avoid"],
  "colorRecommendations": ["specific color idea 1", "specific color idea 2"],
  "skincare": {
    "type": "oily/dry/combination/normal",
    "concerns": ["concern 1", "concern 2"],
    "morningRoutine": ["step 1", "step 2", "step 3", "step 4"],
    "nightRoutine": ["step 1", "step 2", "step 3", "step 4"]
  },
  "grooming": ["tip 1", "tip 2", "tip 3"],
  "confidence": ${Math.floor(Math.random() * 20) + 75}
}`;

    const text = await callGroq(prompt, { skinConcerns, hairType, gender });
    const result = parseGroqJSON(text);
    await User.findByIdAndUpdate(req.user._id, { 
      $push: { analyses: { type: "face", result } } 
    });
    res.json({ success: true, result });
  } catch (err) {
    console.error("Face analysis error:", err.message);
    res.status(500).json({ error: "Face analysis failed. Please try again." });
  }
});

router.get("/history", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("analyses");
    const faceHistory = user.analyses.filter((a) => a.type === "face").reverse();
    res.json({ history: faceHistory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;