import express from "express";
import { authenticate } from "../middleware/auth.js";
import pool from "../config/db.js";
import crypto from "crypto";
import {
  verifyMoMoSignature,
  parseMoMoResultCode,
} from "../utils/momo.js";
import { WalletModel } from "../models/Wallet.js";

const router = express.Router();

// Validate and apply coupon
router.post("/validate-coupon", authenticate, async (req, res) => {
  try {
    const { code, orderAmount } = req.body;
    const userId = (req as any).user.id;

    if (!code || orderAmount === undefined) {
      return res.status(400).json({
        success: false,
        message: "Coupon code and order amount are required",
      });
    }

    // Get coupon details
    const [coupons] = await pool.query(
      `SELECT * FROM coupons 
       WHERE code = ? 
       AND is_active = true 
       AND (valid_until IS NULL OR valid_until > NOW())
       AND valid_from <= NOW()`,
      [code.toUpperCase()]
    );

    if ((coupons as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: "Mã giảm giá không tồn tại hoặc đã hết hạn",
      });
    }

    const coupon = (coupons as any[])[0];

    // Check usage limit (using max_uses from database)
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return res.status(400).json({
        success: false,
        message: "Mã giảm giá đã hết lượt sử dụng",
      });
    }

    // Check minimum order amount (using min_purchase from database)
    if (orderAmount < coupon.min_purchase) {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng tối thiểu ${coupon.min_purchase.toLocaleString(
          "vi-VN"
        )}đ để sử dụng mã này`,
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discount_type === "percentage") {
      discountAmount = (orderAmount * coupon.discount_value) / 100;
      if (
        coupon.max_discount &&
        discountAmount > coupon.max_discount
      ) {
        discountAmount = coupon.max_discount;
      }
    } else {
      discountAmount = coupon.discount_value;
    }

    // Ensure discount doesn't exceed order amount
    if (discountAmount > orderAmount) {
      discountAmount = orderAmount;
    }

    res.json({
      success: true,
      data: {
        couponId: coupon.id,
        code: coupon.code,
        description: `Giảm ${coupon.discount_type === 'percentage' ? coupon.discount_value + '%' : coupon.discount_value.toLocaleString('vi-VN') + 'đ'}`,
        discountAmount: Math.round(discountAmount),
        finalAmount: Math.round(orderAmount - discountAmount),
      },
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    console.error("Error details:", {
      message: (error as any).message,
      code: (error as any).code,
      sqlMessage: (error as any).sqlMessage,
    });
    res.status(500).json({
      success: false,
      message: "Server error: " + ((error as any).message || "Unknown error"),
    });
  }
});

// Create order
router.post("/create", authenticate, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const userId = (req as any).user.id;
    const { paymentMethod, customerInfo, couponCode, courseIds } = req.body;

    console.log("📝 Creating order for user:", userId);
    console.log("💳 Payment method:", paymentMethod);
    console.log("👤 Customer info:", customerInfo);
    console.log("🎟️ Coupon code:", couponCode);
    console.log("📚 Course IDs:", courseIds);

    // Validate customer info
    if (
      !customerInfo ||
      !customerInfo.fullName ||
      !customerInfo.email ||
      !customerInfo.phone
    ) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Vui lòng điền đầy đủ thông tin khách hàng",
      });
    }

    let cartItems: any[];

    // Check if courseIds are provided (direct purchase)
    if (courseIds && Array.isArray(courseIds) && courseIds.length > 0) {
      // Direct purchase - get courses by IDs
      const [courses] = await connection.query(
        `SELECT id as course_id, price, title_vi
         FROM courses
         WHERE id IN (?)`,
        [courseIds]
      );
      cartItems = courses as any[];
      console.log("🛍️ Direct purchase - Courses:", cartItems);
    } else {
      // Cart purchase - get items from cart
      const [items] = await connection.query(
        `SELECT c.course_id, co.price, co.title_vi
         FROM cart c
         JOIN courses co ON c.course_id = co.id
         WHERE c.user_id = ?`,
        [userId]
      );
      cartItems = items as any[];
      console.log("🛒 Cart purchase - Items:", cartItems);
    }

    if ((cartItems as any[]).length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message:
          courseIds && courseIds.length > 0
            ? "Không tìm thấy khóa học"
            : "Cart is empty",
      });
    }

    // Calculate total
    const totalAmount = (cartItems as any[]).reduce(
      (sum, item) => sum + item.price,
      0
    );

    let discountAmount = 0;
    let couponId = null;

    // Apply coupon if provided
    if (couponCode) {
      const [coupons] = await connection.query(
        `SELECT * FROM coupons 
         WHERE code = ? 
         AND is_active = true 
         AND (valid_until IS NULL OR valid_until > NOW())
         AND valid_from <= NOW()`,
        [couponCode.toUpperCase()]
      );

      if ((coupons as any[]).length > 0) {
        const coupon = (coupons as any[])[0];

        // Check usage limit
        if (!coupon.usage_limit || coupon.used_count < coupon.usage_limit) {
          // Check minimum order amount
          if (totalAmount >= coupon.min_order_amount) {
            // Calculate discount
            if (coupon.discount_type === "percentage") {
              discountAmount = (totalAmount * coupon.discount_value) / 100;
              if (
                coupon.max_discount_amount &&
                discountAmount > coupon.max_discount_amount
              ) {
                discountAmount = coupon.max_discount_amount;
              }
            } else {
              discountAmount = coupon.discount_value;
            }

            // Ensure discount doesn't exceed total
            if (discountAmount > totalAmount) {
              discountAmount = totalAmount;
            }

            couponId = coupon.id;

            // Update coupon used count
            await connection.query(
              "UPDATE coupons SET used_count = used_count + 1 WHERE id = ?",
              [couponId]
            );
          }
        }
      }
    }

    const finalAmount = totalAmount - discountAmount;

    // Generate order code
    const orderCode = `ORD${Date.now()}`;

    // Create order (order_number, order_code, customer_info removed from schema)
    const [orderResult] = await connection.query(
      `INSERT INTO orders 
       (user_id, total_amount, coupon_id, discount_amount, final_amount, payment_method, payment_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        totalAmount,
        couponId,
        discountAmount,
        finalAmount,
        paymentMethod,
        "pending",
      ]
    );

    const orderId = (orderResult as any).insertId;

    // Create order items
    for (const item of cartItems as any[]) {
      await connection.query(
        `INSERT INTO order_items (order_id, course_id, price) 
         VALUES (?, ?, ?)`,
        [orderId, item.course_id, item.price]
      );
    }

    // Record coupon usage
    if (couponId && discountAmount > 0) {
      await connection.query(
        `INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_amount)
         VALUES (?, ?, ?, ?)`,
        [couponId, userId, orderId, discountAmount]
      );
    }

    await connection.commit();

    // Generate payment URL
    let paymentUrl = "";

    if (finalAmount > 0) {
      try {
        if (paymentMethod === "vnpay") {
          paymentUrl = generateVNPayUrl(orderId, finalAmount, orderCode);
        } else if (paymentMethod === "momo") {
          console.log(
            `🔐 Generating MoMo payment URL for order ${orderCode}, amount: ${finalAmount}`
          );
          paymentUrl = await generateMomoUrl(orderId, finalAmount, orderCode);
          console.log(`✅ MoMo payment URL generated successfully`);
        } else if (paymentMethod === "stripe") {
          paymentUrl = generateStripeUrl(orderId, finalAmount, orderCode);
        } else if (paymentMethod === "wallet") {
          // Wallet Payment
          const wallet = await WalletModel.findByUserId(userId);
          if (!wallet) {
            throw new Error("Ví chưa được kích hoạt");
          }
          if (wallet.balance < finalAmount) {
            throw new Error(`Số dư không đủ. Bạn cần thêm ${(finalAmount - wallet.balance).toLocaleString("vi-VN")}đ`);
          }

          // Deduct from wallet
          await WalletModel.updateBalance(
            userId,
            finalAmount,
            "purchase",
            orderId.toString(),
            `Thanh toán đơn hàng #${orderId} - ${orderCode}`
          );

          // Mark order as completed immediately
          await connection.query(
            "UPDATE orders SET payment_status = ?, paid_at = NOW() WHERE id = ?",
            ["completed", orderId]
          );

          // Process delivery (enroll courses)
          await processPaymentSuccess(orderId, userId);

          console.log(`✅ Wallet payment successful for order ${orderId}, user ${userId}`);

          // No payment URL needed, success immediately
          paymentUrl = `/orders?payment=success`;
        } else if (paymentMethod === "bank_transfer") {
          // Bank transfer - no payment URL, just instructions
          paymentUrl = "";
        }
      } catch (paymentError: any) {
        console.error("❌ Error generating payment URL:", paymentError);
        await connection.query(
          "UPDATE orders SET payment_status = ? WHERE id = ?",
          ["failed", orderId]
        );
        throw new Error(paymentError.message || "Lỗi thanh toán");
      }
    } else {
      // Free courses - auto complete
      await processPaymentSuccess(orderId, userId);
    }

    res.json({
      success: true,
      data: {
        orderId,
        orderCode,
        totalAmount,
        discountAmount,
        finalAmount,
        paymentUrl,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error("❌ Error creating order:", error);
    console.error("Error details:", {
      message: (error as any).message,
      code: (error as any).code,
      sqlMessage: (error as any).sqlMessage,
      stack: (error as any).stack,
    });
    res.status(500).json({
      success: false,
      message: "Server error: " + ((error as any).message || "Unknown error"),
    });
  } finally {
    connection.release();
  }
});

// Get user's orders
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { status } = req.query;

    let query = `
      SELECT 
        o.id,
        o.total_amount,
        o.payment_method,
        o.payment_status,
        o.created_at
      FROM orders o
      WHERE o.user_id = ?
    `;

    const params: any[] = [userId];

    if (status && status !== "all") {
      query += " AND o.payment_status = ?";
      params.push(status);
    }

    query += " ORDER BY o.created_at DESC";

    const [rows] = await pool.query(query, params);

    // Get order items for each order
    const orders = await Promise.all(
      (rows as any[]).map(async (order) => {
        const [items] = await pool.query(
          `SELECT oi.course_id, c.title_vi, c.title_en, oi.price
           FROM order_items oi
           LEFT JOIN courses c ON oi.course_id = c.id
           WHERE oi.order_id = ?`,
          [order.id]
        );

        return {
          ...order,
          items: items || [],
        };
      })
    );

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    console.error("Error details:", {
      message: (error as any).message,
      code: (error as any).code,
      sqlMessage: (error as any).sqlMessage,
    });
    res.status(500).json({
      success: false,
      message: "Server error: " + ((error as any).message || "Unknown error"),
    });
  }
});

// Payment callbacks
router.get("/vnpay/callback", async (req, res) => {
  try {
    const { orderId, status } = req.query;

    if (status === "success") {
      const [orders] = await pool.query(
        "SELECT user_id FROM orders WHERE id = ?",
        [orderId]
      );

      if ((orders as any[]).length > 0) {
        await processPaymentSuccess(
          Number(orderId),
          (orders as any[])[0].user_id
        );
      }

      res.redirect(`http://localhost:5174/orders?payment=success`);
    } else {
      await pool.query("UPDATE orders SET payment_status = ? WHERE id = ?", [
        "failed",
        orderId,
      ]);
      res.redirect(`http://localhost:5174/orders?payment=failed`);
    }
  } catch (error) {
    console.error("Error processing callback:", error);
    res.redirect("http://localhost:5174/orders?payment=error");
  }
});

router.get("/momo/callback", async (req, res) => {
  try {
    const { orderId, status } = req.query;

    if (status === "success") {
      const [orders] = await pool.query(
        "SELECT user_id FROM orders WHERE id = ?",
        [orderId]
      );

      if ((orders as any[]).length > 0) {
        await processPaymentSuccess(
          Number(orderId),
          (orders as any[])[0].user_id
        );
      }

      res.redirect(`http://localhost:5174/orders?payment=success`);
    } else {
      await pool.query("UPDATE orders SET payment_status = ? WHERE id = ?", [
        "failed",
        orderId,
      ]);
      res.redirect(`http://localhost:5174/orders?payment=failed`);
    }
  } catch (error) {
    console.error("Error processing MoMo callback:", error);
    res.redirect("http://localhost:5174/orders?payment=error");
  }
});

router.get("/stripe/callback", async (req, res) => {
  try {
    const { orderId, status } = req.query;

    if (status === "success") {
      const [orders] = await pool.query(
        "SELECT user_id FROM orders WHERE id = ?",
        [orderId]
      );

      if ((orders as any[]).length > 0) {
        await processPaymentSuccess(
          Number(orderId),
          (orders as any[])[0].user_id
        );
      }

      res.redirect(`http://localhost:5174/orders?payment=success`);
    } else {
      await pool.query("UPDATE orders SET payment_status = ? WHERE id = ?", [
        "failed",
        orderId,
      ]);
      res.redirect(`http://localhost:5174/orders?payment=failed`);
    }
  } catch (error) {
    console.error("Error processing callback:", error);
    res.redirect("http://localhost:5174/orders?payment=error");
  }
});

// MoMo IPN (Instant Payment Notification) - Async notification from MoMo server
router.post("/momo/ipn", async (req, res) => {
  try {
    const ipnData = req.body;

    // Verify MoMo signature
    if (!verifyMoMoSignature(ipnData)) {
      console.error("Invalid MoMo IPN signature:", ipnData);
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    const { resultCode, orderId, transId, amount, message } = ipnData;

    if (resultCode === 0) {
      // Payment successful
      const [orders] = await pool.query(
        "SELECT user_id, payment_status FROM orders WHERE id = ?",
        [orderId]
      );

      if ((orders as any[]).length > 0) {
        const order = (orders as any[])[0];

        // Only process if not already completed
        if (order.payment_status !== "completed") {
          await processPaymentSuccess(Number(orderId), order.user_id);

          // Log transaction
          await pool.query(
            `INSERT INTO transactions (order_id, gateway, transaction_id, amount, status, gateway_response) 
             VALUES (?, 'momo', ?, ?, 'completed', ?)
             ON DUPLICATE KEY UPDATE status = 'completed', gateway_response = ?`,
            [
              orderId,
              transId,
              amount,
              JSON.stringify(ipnData),
              JSON.stringify(ipnData),
            ]
          );

          console.log(`MoMo IPN: Order ${orderId} payment successful`);
        }
      }
    } else {
      // Payment failed
      await pool.query("UPDATE orders SET payment_status = ? WHERE id = ?", [
        "failed",
        orderId,
      ]);

      console.log(`MoMo IPN: Order ${orderId} payment failed - ${message}`);
    }

    // Respond to MoMo to confirm IPN received
    res.status(200).json({
      success: true,
      message: "IPN processed successfully",
    });
  } catch (error) {
    console.error("Error processing MoMo IPN:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Helper functions
function generateVNPayUrl(
  orderId: number,
  amount: number,
  orderCode: string
): string {
  // VNPay integration - For now, redirect to frontend with COD
  // To implement real VNPay, need to register at vnpay.vn and get credentials
  console.log("⚠️ VNPay not configured, using COD fallback");
  return `http://localhost:5173/orders?payment=cod&orderId=${orderId}`;
}

async function generateMomoUrl(
  orderId: number,
  amount: number,
  orderCode: string
): Promise<string> {
  // Real MoMo integration
  const returnUrl = `http://localhost:5173/orders?payment=success&orderId=${orderId}`;
  const ipnUrl = `http://localhost:3000/api/orders/momo/ipn`;
  const orderInfo = `Thanh toán khóa học - ${orderCode}`;

  try {
    const { createMoMoPayment } = await import("../utils/momo.js");

    const momoResponse = await createMoMoPayment({
      orderId: orderCode,
      orderCode: orderCode,
      amount,
      orderInfo,
      returnUrl,
      ipnUrl,
      extraData: Buffer.from(JSON.stringify({ orderId, orderCode })).toString('base64'),
    });

    if (momoResponse.resultCode === 0) {
      console.log("✅ MoMo payment URL generated:", momoResponse.payUrl);
      return momoResponse.payUrl;
    } else {
      throw new Error(parseMoMoResultCode(momoResponse.resultCode));
    }
  } catch (error: any) {
    console.error("MoMo payment creation error:", error);
    throw new Error("Không thể tạo thanh toán MoMo: " + error.message);
  }
}

function generateStripeUrl(
  orderId: number,
  amount: number,
  orderCode: string
): string {
  // Stripe integration - For now, redirect to frontend with COD
  // To implement real Stripe, need Stripe account and API keys
  console.log("⚠️ Stripe not configured, using COD fallback");
  return `http://localhost:5173/orders?payment=cod&orderId=${orderId}`;
}

async function processPaymentSuccess(orderId: number, userId: number) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Update order status
    await connection.query(
      "UPDATE orders SET payment_status = ?, paid_at = NOW() WHERE id = ?",
      ["completed", orderId]
    );

    // Get order items
    const [items] = await connection.query(
      "SELECT course_id FROM order_items WHERE order_id = ?",
      [orderId]
    );

    // Create enrollments
    for (const item of items as any[]) {
      await connection.query(
        `INSERT IGNORE INTO enrollments (user_id, course_id, enrolled_at) 
         VALUES (?, ?, NOW())`,
        [userId, item.course_id]
      );
    }

    // Clear cart
    await connection.query("DELETE FROM cart WHERE user_id = ?", [userId]);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default router;
