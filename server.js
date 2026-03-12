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

const authRoutes = require("./routes/auth");
const faceRoutes = require("./routes/face");
const fitnessRoutes = require("./routes/fitness");
const fashionRoutes = require("./routes/fashion");
const userRoutes = require("./routes/user");
const skinRoutes = require("./routes/skin");
const chatRoutes = require("./routes/chat");

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: "*", credentials: false }));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));


const paymentRoutes = require("./routes/payment");
// routes ke saath add karo:
app.use("/api/payment", paymentRoutes);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Please try again later." },
});
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "AI request limit reached. Please wait a moment." },
});
app.use("/api/", limiter);
app.use("/api/face", aiLimiter);
app.use("/api/fashion", aiLimiter);
app.use("/api/fitness", aiLimiter);
app.use("/api/skin", aiLimiter);
app.use("/api/chat", aiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/face", faceRoutes);
app.use("/api/fitness", fitnessRoutes);
app.use("/api/fashion", fashionRoutes);
app.use("/api/user", userRoutes);
app.use("/api/skin", skinRoutes);
app.use("/api/chat", chatRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), service: "GlowUp AI API" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 GlowUp AI server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

module.exports = app;