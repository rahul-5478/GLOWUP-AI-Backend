const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTP = async (email, otp, name = "User") => {
  try {
    await resend.emails.send({
      from: "GlowUp AI <onboarding@resend.dev>",
      to: email,
      subject: "Your GlowUp AI Verification Code",
      html: `<div style="background:#0A0A0F;padding:40px;font-family:Arial;border-radius:20px;max-width:480px;margin:0 auto;">
        <h2 style="color:#FF6B6B;text-align:center;">✨ GlowUp AI</h2>
        <p style="color:#ccc;">Hi ${name}! Your verification code:</p>
        <div style="background:#1C1C28;border:2px solid #FF6B6B;border-radius:14px;padding:24px;text-align:center;margin:20px 0;">
          <span style="font-size:40px;font-weight:800;color:#FF6B6B;letter-spacing:10px;font-family:monospace;">${otp}</span>
        </div>
        <p style="color:#888;font-size:13px;">Expires in 10 minutes. Don't share this code.</p>
      </div>`,
    });
    console.log("✅ OTP sent via Resend to:", email);
  } catch (err) {
    console.error("❌ Resend error:", err.message);
    throw err;
  }
};

module.exports = { sendOTP, sendOtpEmail: sendOTP };