const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { callGroq, parseGroqJSON } = require("../config/groq");
const User = require("../models/User");

router.post("/analyze", protect, async (req, res) => {
  try {
    const { occasion, imageBase64, mediaType, uploadMode } = req.body;

    if (!occasion) {
      return res.status(400).json({ error: "Occasion is required." });
    }

    const user = await User.findById(req.user._id);

    let prompt = "";
    let groqMessages;

    if ((uploadMode === "outfit" || uploadMode === "selfie") && imageBase64) {

      if (uploadMode === "outfit") {
        prompt = `You are GlowUp AI fashion stylist. Analyze the outfit in this image for ${occasion} occasion.

Return ONLY valid JSON, no markdown no backticks:
{"outfitAnalysis":"honest 2-3 sentence review","outfitScore":7,"outfitRecommendations":[{"outfit":"name","description":"how to improve","why":"why for ${occasion}","items":["item1","item2","item3"],"priceRange":"budget"},{"outfit":"name2","description":"desc","why":"why","items":["i1","i2"],"priceRange":"mid"}],"colorPalette":["#E8D5B7 - Warm Beige","#2C3E50 - Navy","#8B4513 - Brown"],"accessories":["Belt","Watch","Shoes"],"brands":["H&M - affordable","Zara - trendy","Mango - premium"],"styleTip":"one actionable tip"}`;
      } else {
        prompt = `You are GlowUp AI fashion stylist. Look at this person face shape and skin tone. Recommend perfect ${occasion} style.

Return ONLY valid JSON, no markdown no backticks:
{"faceAnalysis":"face shape and skin tone observed","bodyShape":"Rectangle","bodyShapeDetails":"style tips","outfitRecommendations":[{"outfit":"outfit for their features","description":"why suits them","why":"why for ${occasion}","items":["item1","item2","item3"],"priceRange":"mid"},{"outfit":"second option","description":"desc","why":"why","items":["i1","i2","i3"],"priceRange":"budget"}],"colorPalette":["#F5DEB3 - Wheat","#556B2F - Olive","#800020 - Burgundy"],"accessories":["Earrings","Bag","Footwear"],"brands":["Fabindia - ethnic","Zara - western","W - fusion"],"styleTip":"personalized tip for their features"}`;
      }

      groqMessages = [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mediaType || "image/jpeg"};base64,${imageBase64}`,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ];

      const raw = await callGroq(groqMessages, {
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens: 1200,
      });

      const result = parseGroqJSON(raw);
      return res.json({ success: true, result });

    } else {
      prompt = `You are GlowUp AI fashion stylist. Best outfit for ${occasion} in India.

Return ONLY valid JSON, no markdown no backticks:
{"bodyShape":"Versatile","bodyShapeDetails":"style tips for ${occasion}","outfitRecommendations":[{"outfit":"Complete outfit","description":"full look description","why":"perfect for ${occasion}","items":["item1","item2","item3","item4"],"priceRange":"budget"},{"outfit":"Second option","description":"desc","why":"why works","items":["i1","i2","i3"],"priceRange":"mid"},{"outfit":"Premium option","description":"desc","why":"premium reason","items":["i1","i2","i3"],"priceRange":"premium"}],"colorPalette":["#C9A96E - Gold","#1B2A4A - Midnight Blue","#8B0000 - Deep Red","#F5F5DC - Cream"],"accessories":["accessory1","accessory2","accessory3"],"brands":["Brand1 - reason","Brand2 - reason","Brand3 - reason"],"styleTip":"powerful tip for ${occasion}"}`;

      groqMessages = [{ role: "user", content: prompt }];
      const raw = await callGroq(groqMessages, { max_tokens: 1200 });
      const result = parseGroqJSON(raw);
      return res.json({ success: true, result });
    }

  } catch (err) {
    console.error("❌ Fashion error:", err.message);
    res.status(500).json({ error: "Fashion analysis failed. Please try again." });
  }
});

module.exports = router;