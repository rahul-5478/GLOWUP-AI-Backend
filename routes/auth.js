const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { sendOTP } = require("../config/mailer");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

// In-memory OTP store  { email: { otp, expires, attempts, sentCount, verified } }
const otpStore = new Map();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── POST /api/auth/register ───────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields required." });
    if (await User.findOne({ email }))
      return res.status(409).json({ error: "Email already registered." });

    const user = await User.create({ name, email, password });
    const token = signToken(user._id);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login (password) ──────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required." });

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: "Invalid email or password." });

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get("/me", protect, (req, res) => {
  res.json({ user: req.user });
});

// ── POST /api/auth/send-otp ───────────────────────────────────
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const emailLower = email.toLowerCase().trim();

    // Rate limit: max 3 OTPs per 10 min
    const existing = otpStore.get(emailLower);
    if (existing && existing.expires > Date.now() && (existing.sentCount || 0) >= 3) {
      return res.status(429).json({ error: "Too many requests. Wait 10 minutes." });
    }

    const otp = generateOTP();
    const user = await User.findOne({ email: emailLower });

    otpStore.set(emailLower, {
      otp,
      expires: Date.now() + 10 * 60 * 1000, // 10 min
      attempts: 0,
      sentCount: (existing?.sentCount || 0) + 1,
      verified: false,
    });

    await sendOTP(emailLower, otp, user?.name || "User");
    console.log(`✅ OTP sent to ${emailLower}`);

    res.json({ success: true, message: "OTP sent.", userExists: !!user });
  } catch (err) {
    console.error("Send OTP error:", err.message);
    res.status(500).json({ error: "Failed to send OTP. Check EMAIL_USER and EMAIL_PASS in Render." });
  }
});

// ── POST /api/auth/verify-otp ─────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP required." });

    const emailLower = email.toLowerCase().trim();
    const stored = otpStore.get(emailLower);

    if (!stored) {
      return res.status(400).json({ error: "No OTP found. Request a new one." });
    }
    if (stored.expires < Date.now()) {
      otpStore.delete(emailLower);
      return res.status(400).json({ error: "OTP expired. Request a new one." });
    }
    if (stored.attempts >= 5) {
      otpStore.delete(emailLower);
      return res.status(400).json({ error: "Too many wrong attempts. Request a new OTP." });
    }
    if (stored.otp !== otp.trim()) {
      stored.attempts++;
      return res.status(400).json({ error: `Wrong OTP. ${5 - stored.attempts} attempts left.` });
    }

    // OTP correct
    stored.verified = true;
    res.json({ success: true, message: "OTP verified." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login-otp ──────────────────────────────────
// Call this AFTER /verify-otp succeeds
router.post("/login-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required." });

    const emailLower = email.toLowerCase().trim();
    const stored = otpStore.get(emailLower);

    if (!stored?.verified) {
      return res.status(401).json({ error: "OTP not verified. Please verify first." });
    }
    if (stored.expires < Date.now()) {
      otpStore.delete(emailLower);
      return res.status(401).json({ error: "Session expired. Try again." });
    }

    // Find or auto-create user
    let user = await User.findOne({ email: emailLower });
    if (!user) {
      const name = emailLower.split("@")[0];
      user = await User.create({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: emailLower,
        password: Math.random().toString(36) + Date.now().toString(36),
      });
    }

    otpStore.delete(emailLower);
    const token = signToken(user._id);
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;