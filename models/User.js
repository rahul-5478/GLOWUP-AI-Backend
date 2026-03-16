const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    avatar: { type: String, default: "" },
    profile: {
      age: { type: Number, default: null },
      weight: { type: Number, default: null },
      height: { type: Number, default: null },
      // ✅ enum hataya — koi bhi string save ho sakti hai
      gender: { type: String, default: "" },
      skinType: { type: String, default: "" },
      weightUnit: { type: String, default: "kg" },
      goal: { type: String, default: "" },
    },
    analyses: [
      {
        type: { type: String, enum: ["face", "fitness", "fashion"] },
        result: mongoose.Schema.Types.Mixed,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);