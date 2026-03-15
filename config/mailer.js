// ═══════════════════════════════════════════════════════════════
// FILE 1: backend/config/mailer.js
// ═══════════════════════════════════════════════════════════════

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password (not your actual password)
  },
});

// Verify connection
transporter.verify((err, success) => {
  if (err) console.error("❌ Mailer error:", err.message);
  else console.log("✅ Mailer ready");
});

const sendOTP = async (email, otp, name = "User") => {
  const mailOptions = {
    from: `"GlowUp AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your GlowUp AI Verification Code",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background:#0A0A0F;font-family:'Segoe UI',Arial,sans-serif;">
        <div style="max-width:480px;margin:0 auto;padding:40px 20px;">
          
          <!-- Logo -->
          <div style="text-align:center;margin-bottom:32px;">
            <div style="display:inline-block;background:linear-gradient(135deg,#FF6B6B,#FF8E53);border-radius:16px;padding:16px 24px;">
              <span style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
                Glow<span style="color:#FFD93D;">Up</span> AI
              </span>
            </div>
          </div>

          <!-- Card -->
          <div style="background:#1C1C28;border-radius:24px;padding:40px 32px;border:1px solid #2A2A3A;">
            
            <h2 style="color:#F0F0FF;font-size:22px;font-weight:700;margin:0 0 8px 0;">
              Hi ${name}! 👋
            </h2>
            <p style="color:#8888AA;font-size:15px;line-height:1.6;margin:0 0 32px 0;">
              Here's your verification code to complete your GlowUp AI login.
            </p>

            <!-- OTP Box -->
            <div style="background:linear-gradient(135deg,rgba(255,107,107,0.15),rgba(255,142,83,0.15));border:1.5px solid rgba(255,107,107,0.4);border-radius:16px;padding:28px;text-align:center;margin-bottom:28px;">
              <p style="color:#8888AA;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px 0;">
                Verification Code
              </p>
              <div style="font-size:42px;font-weight:800;letter-spacing:12px;color:#FF6B6B;font-family:'Courier New',monospace;">
                ${otp}
              </div>
            </div>

            <!-- Timer -->
            <div style="background:#13131A;border-radius:12px;padding:14px 20px;display:flex;align-items:center;margin-bottom:28px;">
              <span style="font-size:18px;margin-right:10px;">⏱️</span>
              <span style="color:#8888AA;font-size:13px;">This code expires in <strong style="color:#F0F0FF;">10 minutes</strong></span>
            </div>

            <p style="color:#8888AA;font-size:13px;line-height:1.6;margin:0;">
              If you didn't request this code, please ignore this email. Your account is safe.
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align:center;margin-top:24px;">
            <p style="color:#555577;font-size:12px;margin:0;">
              © 2025 GlowUp AI · Made with ✨ for you
            </p>
          </div>

        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOTP, sendOtpEmail: sendOTP };