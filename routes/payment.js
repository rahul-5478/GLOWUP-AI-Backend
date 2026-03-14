const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { protect } = require("../middleware/auth");

// Create Order
router.post("/create-order", protect, async (req, res) => {
  try {
    // Lazy init — keys route ke andar load hongi
    console.log("💳 Payment create-order called");
    console.log("ENV KEY:", process.env.RAZORPAY_KEY_ID ? "EXISTS" : "MISSING");
    console.log("ENV SECRET:", process.env.RAZORPAY_KEY_SECRET ? "EXISTS" : "MISSING");

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: "Payment configuration missing." });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const { amount, planName } = req.body;
    if (!amount || !planName) {
      return res.status(400).json({ error: "Amount and planName required." });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100, // paise mein
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: { planName, userId: req.user._id.toString() },
    });

    console.log("✅ Order created:", order.id);
    res.json({ success: true, order });
  } catch (err) {
    console.error("❌ Payment error FULL:", JSON.stringify(err?.error || err?.message));
    res.status(500).json({ error: "Could not create order. Please try again." });
  }
});

// Verify Payment
router.post("/verify", protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planName } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment details." });
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed." });
    }

    console.log("✅ Payment verified:", razorpay_payment_id);
    res.json({
      success: true,
      message: "Payment verified!",
      planName,
      paymentId: razorpay_payment_id,
    });
  } catch (err) {
    console.error("❌ Verify error:", err.message);
    res.status(500).json({ error: "Verification failed." });
  }
});

module.exports = router;