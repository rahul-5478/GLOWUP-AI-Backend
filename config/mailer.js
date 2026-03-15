const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  family: 4, // ✅ IPv4 force karo — IPv6 error fix
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((err) => {
  if (err) console.error("❌ Mailer error:", err.message);
  else console.log("✅ Mailer ready");
});

const sendOTP = async (email, otp, name = "User") => {
  await transporter.sendMail({
    from: `"GlowUp AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your GlowUp AI Verification Code",
    html: `<div style="background:#0A0A0F;padding:40px;font-family:Arial,sans-serif;max-width:480px;margin:0 auto;border-radius:20px;">
      <h2 style="color:#FF6B6B;text-align:center;">✨ GlowUp AI</h2>
      <p style="color:#ccc;">Hi ${name}! Your OTP is:</p>
      <div style="background:#1C1C28;border:2px solid #FF6B6B;border-radius:14px;padding:24px;text-align:center;margin:20px 0;">
        <span style="font-size:40px;font-weight:800;color:#FF6B6B;letter-spacing:10px;font-family:monospace;">${otp}</span>
      </div>
      <p style="color:#888;font-size:13px;">Expires in 10 minutes. Don't share this code.</p>
    </div>`,
  });
};

// ✅ Export dono names se
module.exports = { sendOTP, sendOtpEmail: sendOTP };