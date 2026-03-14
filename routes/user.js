const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const User = require("../models/User");

// Get user profile
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user profile
router.put("/profile", protect, async (req, res) => {
  try {
    const { name, avatar, profile } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, avatar, profile },
      { new: true, runValidators: true }
    ).select("-password");
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all analyses
router.get("/analyses", protect, async (req, res) => {
  try {
    const { type } = req.query;
    const user = await User.findById(req.user._id).select("analyses");
    let analyses = user.analyses || [];
    if (type) analyses = analyses.filter(a => a.type === type);
    res.json({ success: true, analyses: analyses.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an analysis
router.delete("/analyses/:id", protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { analyses: { _id: req.params.id } }
    });
    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;