const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { protect } = require("../middleware/auth");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Order
router.post("/create-order", protect, async (req, res) => {
  try {
    const { amount, planName } = req.body;
    const order = await razorpay.orders.create({
      amount: amount * 100, // paise mein
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: { planName, userId: req.user._id.toString() },
    });
    res.json({ success: true, order });
  } catch (err) {
    console.error("Payment error:", err.message);
    res.status(500).json({ error: "Could not create order." });
  }
});

// Verify Payment
router.post("/verify", protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planName } = req.body;
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed." });
    }

    res.json({ success: true, message: "Payment verified!", planName, paymentId: razorpay_payment_id });
  } catch (err) {
    console.error("Verify error:", err.message);
    res.status(500).json({ error: "Verification failed." });
  }
});

module.exports = router;