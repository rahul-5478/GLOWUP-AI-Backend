const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    avatar: { type: String, default: "" },
    profile: {
      age: Number,
      weight: Number,
      height: Number,
      weightUnit: { type: String, enum: ["kg", "lbs"], default: "kg" },
      goal: { type: String, enum: ["weight_loss", "muscle_building", "weight_gain", "maintenance"], default: "maintenance" },
    },
    analyses: [
      {
        type: { type: String, enum: ["face", "fitness", "fashion", "skin"] },
        result: mongoose.Schema.Types.Mixed,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    glowScores: [
      {
        date: { type: Date, default: Date.now },
        week: Number,
        skinScore: { type: Number, default: 0 },
        fitnessScore: { type: Number, default: 0 },
        fashionScore: { type: Number, default: 0 },
        overallScore: { type: Number, default: 0 },
        notes: { type: String, default: "" },
        grade: String,
        title: String,
        insight: String,
        skinFeedback: String,
        fitnessFeedback: String,
        fashionFeedback: String,
        topWin: String,
        focusNext: String,
        motivationalQuote: String,
        badges: [String],
      },
    ],
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);