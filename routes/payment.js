const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create order
router.post("/create-order", protect, async (req, res) => {
  try {
    const { amount, plan } = req.body;
    const order = await razorpay.orders.create({
      amount: amount * 100, // paise mein
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: { plan, userId: req.user._id.toString() },
    });
    res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("Payment error FULL:", JSON.stringify(err));
    console.error("ENV KEY:", process.env.RAZORPAY_KEY_ID ? "EXISTS" : "MISSING");
    res.status(500).json({ error: "Could not create payment order." });
  }
});

// Verify payment
router.post("/verify", protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign !== razorpay_signature)
      return res.status(400).json({ error: "Payment verification failed." });

    res.json({ success: true, message: "Payment verified!", plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
