const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
require("dotenv").config();

const authRoutes    = require("./routes/auth");
const faceRoutes    = require("./routes/face");
const fitnessRoutes = require("./routes/fitness");
const fashionRoutes = require("./routes/fashion");
const userRoutes    = require("./routes/user");
const skinRoutes    = require("./routes/skin");
const paymentRoutes = require("./routes/payment");

const { callGemini }  = require("./config/gemini");
const { protect }     = require("./middleware/auth");
const User            = require("./models/User");

const app = express();
app.set("trust proxy", 1);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: function (origin, callback) { callback(null, true); },
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Rate Limiters ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests." },
});
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "AI request limit reached." },
});

app.use("/api/", limiter);
app.use("/api/face",    aiLimiter);
app.use("/api/fashion", aiLimiter);
app.use("/api/fitness", aiLimiter);
app.use("/api/skin",    aiLimiter);
app.use("/api/chat",    aiLimiter);

// ─── Standard Routes ─────────────────────────────────────────────────────────
app.use("/api/auth",    authRoutes);
app.use("/api/face",    faceRoutes);
app.use("/api/fitness", fitnessRoutes);
app.use("/api/fashion", fashionRoutes);
app.use("/api/user",    userRoutes);
app.use("/api/skin",    skinRoutes);
app.use("/api/payment", paymentRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), service: "GlowUp AI API" });
});

// ─── CHAT ROUTES (inline — no separate file needed) ──────────────────────────
app.post("/api/chat/message", protect, async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const conversationHistory = history
      .slice(-10)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const prompt = `You are GlowUp AI — a friendly expert beauty, fitness, and style assistant for Indian users.

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n` : ""}
User: ${message}

Reply helpfully and conversationally. Keep response under 200 words unless asked for detail.
For product recommendations, prefer Indian brands available on Nykaa/Amazon.
Return ONLY plain text — no JSON, no markdown headers.`;

    const text = await callGemini(prompt, { message });

    // Non-fatal DB save
    try {
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          analyses: {
            type: "chat",
            result: {
              userMessage: message,
              aiReply: text,
              timestamp: new Date(),
            },
          },
        },
      });
    } catch (dbErr) {
      console.log("Chat DB save non-fatal:", dbErr.message);
    }

    return res.json({ success: true, reply: text });

  } catch (err) {
    console.error("Chat error:", err.message);
    return res.status(500).json({ error: "Chat failed. Please try again." });
  }
});

app.get("/api/chat/history", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("analyses");
    const chatHistory = (user.analyses || [])
      .filter((a) => a.type === "chat")
      .reverse()
      .slice(0, 50);
    return res.json({ success: true, history: chatHistory });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── 404 + Error Handlers ─────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ─── MongoDB + Server Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 20000,
  maxPoolSize: 10,
  family: 4,
}).then(() => {
  console.log("✅ MongoDB connected");
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 GlowUp AI server running on port ${PORT}`);
    console.log("✅ Chat route active: POST /api/chat/message");

    // Keep Render free tier alive
    if (process.env.NODE_ENV === "production") {
      setInterval(() => {
        fetch(`https://glowup-ai-backend-1.onrender.com/api/health`)
          .then(() => console.log("🏓 Keep alive ping sent"))
          .catch(() => {});
      }, 10 * 60 * 1000);
    }
  });
}).catch((err) => {
  console.error("❌ MongoDB connection failed:", err.message);
  process.exit(1);
});

module.exports = app;
