import express from "express";
import {
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  getAvailableCoupons,
  getCouponUsage,
  getMyCouponUsage,
} from "../controllers/couponController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.get("/available", getAvailableCoupons);

// User routes (authenticated)
router.post("/validate", authenticate, validateCoupon);
router.get("/my-usage", authenticate, getMyCouponUsage);

// Admin routes
router.get("/", authenticate, authorize(["admin"]), getAllCoupons);
router.get("/:id", authenticate, authorize(["admin"]), getCouponById);
router.post("/", authenticate, authorize(["admin"]), createCoupon);
router.put("/:id", authenticate, authorize(["admin"]), updateCoupon);
router.delete("/:id", authenticate, authorize(["admin"]), deleteCoupon);
router.get("/:id/usage", authenticate, authorize(["admin"]), getCouponUsage);

export default router;
