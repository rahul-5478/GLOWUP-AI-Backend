// ═══════════════════════════════════════════════════════════════
// FILE 2: backend/routes/otp.js
// ═══════════════════════════════════════════════════════════════

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { sendOTP } = require("../config/mailer");
const User = require("../models/User");

// In-memory OTP store (works fine for small apps)
// Format: { "email@test.com": { otp: "123456", expires: Date, attempts: 0 } }
const otpStore = new Map();

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── POST /api/otp/send ─────────────────────────────────────────
// Send OTP to email (for login or register)
router.post("/send", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const emailLower = email.toLowerCase().trim();

    // Check if user exists
    const user = await User.findOne({ email: emailLower });

    // Rate limiting — max 3 OTPs per 10 minutes per email
    const existing = otpStore.get(emailLower);
    if (existing && existing.expires > Date.now() && existing.sentCount >= 3) {
      return res.status(429).json({
        error: "Too many OTP requests. Please wait 10 minutes.",
      });
    }

    const otp = generateOTP();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(emailLower, {
      otp,
      expires,
      attempts: 0,
      sentCount: (existing?.sentCount || 0) + 1,
      verified: false,
    });

    // Send email
    const name = user?.name || "User";
    await sendOTP(emailLower, otp, name);

    console.log(`✅ OTP sent to ${emailLower}`);

    res.json({
      success: true,
      message: "OTP sent to your email.",
      userExists: !!user,
    });
  } catch (err) {
    console.error("OTP send error:", err.message);
    res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
});

// ── POST /api/otp/verify ───────────────────────────────────────
// Verify OTP (just verify, don't login yet)
router.post("/verify", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required." });
    }

    const emailLower = email.toLowerCase().trim();
    const stored = otpStore.get(emailLower);

    // Check if OTP exists
    if (!stored) {
      return res.status(400).json({ error: "No OTP found. Please request a new one." });
    }

    // Check expiry
    if (stored.expires < Date.now()) {
      otpStore.delete(emailLower);
      return res.status(400).json({ error: "OTP expired. Please request a new one." });
    }

    // Max 5 wrong attempts
    if (stored.attempts >= 5) {
      otpStore.delete(emailLower);
      return res.status(400).json({ error: "Too many wrong attempts. Please request a new OTP." });
    }

    // Verify OTP
    if (stored.otp !== otp.trim()) {
      stored.attempts += 1;
      const remaining = 5 - stored.attempts;
      return res.status(400).json({
        error: `Wrong OTP. ${remaining} attempts remaining.`,
      });
    }

    // OTP correct — mark as verified
    stored.verified = true;

    res.json({ success: true, message: "OTP verified successfully." });
  } catch (err) {
    console.error("OTP verify error:", err.message);
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

// Export otpStore so auth.js can use it for OTP-based login
module.exports = { router, otpStore };