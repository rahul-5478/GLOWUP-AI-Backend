const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const User = require("../models/User");

// GET /api/user/profile
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/user/profile
router.put("/profile", protect, async (req, res) => {
  try {
    const { name, profile } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (profile) updates.profile = { ...req.user.profile, ...profile };

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/user/analyses
router.get("/analyses", protect, async (req, res) => {
  try {
    const { type, limit = 10 } = req.query;
    const user = await User.findById(req.user._id).select("analyses");
    let analyses = user.analyses.reverse();
    if (type) analyses = analyses.filter((a) => a.type === type);
    res.json({ analyses: analyses.slice(0, parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/user/analyses/:id
router.delete("/analyses/:id", protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { analyses: { _id: req.params.id } },
    });
    res.json({ message: "Analysis deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
