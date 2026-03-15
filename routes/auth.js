const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { sendOtpEmail } = require("../config/mailer");
const { verifyFirebaseToken } = require("../config/firebaseAdmin");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

// In-memory OTP store (use Redis in production)
const otpStore = new Map();

// ─── Register ───────────────────────────────────────────
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

// ─── Password Login ──────────────────────────────────────
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

// ─── Send Email OTP ──────────────────────────────────────
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required." });

    // Rate limit: max 3 OTPs per 10 min
    const key = `otp_${email}`;
    const existing = otpStore.get(key);
    if (existing && existing.attempts >= 3 && Date.now() - existing.createdAt < 10 * 60 * 1000) {
      return res.status(429).json({ error: "Too many OTP requests. Wait 10 minutes." });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min

    otpStore.set(key, {
      otp,
      expiresAt,
      wrongAttempts: 0,
      attempts: (existing?.attempts || 0) + 1,
      createdAt: existing?.createdAt || Date.now(),
    });

    await sendOtpEmail(email, otp);
    res.json({ message: "OTP sent!" });
  } catch (err) {
    console.error("OTP send error:", err.message);
    res.status(500).json({ error: "Failed to send OTP. Check email config." });
  }
});

// ─── Verify Email OTP & Login ────────────────────────────
router.post("/login-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP required." });

    const key = `otp_${email}`;
    const record = otpStore.get(key);

    if (!record) return res.status(400).json({ error: "OTP not found. Request a new one." });
    if (Date.now() > record.expiresAt) {
      otpStore.delete(key);
      return res.status(400).json({ error: "OTP expired. Request a new one." });
    }
    if (record.wrongAttempts >= 5) {
      otpStore.delete(key);
      return res.status(400).json({ error: "Too many wrong attempts. Request a new OTP." });
    }
    if (record.otp !== otp.toString()) {
      record.wrongAttempts++;
      return res.status(400).json({ error: `Wrong OTP. ${5 - record.wrongAttempts} attempts left.` });
    }

    otpStore.delete(key);

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: email.split("@")[0],
        email,
        password: crypto.randomBytes(20).toString("hex"),
      });
    }

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Mobile OTP Login (Firebase) ────────────────────────
router.post("/mobile-login", async (req, res) => {
  try {
    const { firebaseToken, mobile } = req.body;
    if (!firebaseToken) return res.status(400).json({ error: "Firebase token required." });

    // Verify Firebase token
    const decoded = await verifyFirebaseToken(firebaseToken);
    const phoneNumber = decoded.phone_number || mobile;

    if (!phoneNumber) return res.status(400).json({ error: "Phone number not found in token." });

    // Find or create user by phone number
    let user = await User.findOne({ mobile: phoneNumber });
    if (!user) {
      // Also check if there's a user with same mobile stored differently
      user = await User.create({
        name: `User${phoneNumber.slice(-4)}`,
        email: `${phoneNumber.replace(/\+/g, "")}@mobile.glowup.ai`,
        mobile: phoneNumber,
        password: crypto.randomBytes(20).toString("hex"),
      });
    }

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    console.error("Mobile login error:", err.message);
    if (err.message.includes("Firebase not configured")) {
      return res.status(503).json({ error: "Mobile login not configured yet." });
    }
    res.status(401).json({ error: "Invalid Firebase token." });
  }
});

// ─── Get Current User ────────────────────────────────────
router.get("/me", protect, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;