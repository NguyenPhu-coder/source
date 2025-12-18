import { Request, Response } from "express";
import Coupon from "../models/Coupon.js";
import { successResponse, errorResponse } from "../utils/response.js";

// Admin: Get all coupons
export const getAllCoupons = async (req: Request, res: Response) => {
  try {
    const { isActive, search } = req.query;

    const filters: any = {};
    if (isActive !== undefined) {
      filters.isActive = isActive === "true";
    }
    if (search) {
      filters.search = search as string;
    }

    const coupons = await Coupon.findAll(filters);
    successResponse(res, coupons, "Coupons retrieved successfully");
  } catch (error) {
    console.error("Error getting coupons:", error);
    errorResponse(res, "Failed to get coupons", 500);
  }
};

// Admin: Get coupon by ID
export const getCouponById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(parseInt(id));

    if (!coupon) {
      return errorResponse(res, "Coupon not found", 404);
    }

    successResponse(res, coupon, "Coupon retrieved successfully");
  } catch (error) {
    console.error("Error getting coupon:", error);
    errorResponse(res, "Failed to get coupon", 500);
  }
};

// Admin: Create coupon
export const createCoupon = async (req: Request, res: Response) => {
  try {
    const {
      code,
      discount_type,
      discount_value,
      min_purchase_amount,
      max_discount_amount,
      usage_limit,
      start_date,
      end_date,
      is_active,
    } = req.body;

    // Validate required fields
    if (
      !code ||
      !discount_type ||
      !discount_value ||
      !start_date ||
      !end_date
    ) {
      return errorResponse(res, "Missing required fields", 400);
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findByCode(code);
    if (existingCoupon) {
      return errorResponse(res, "Coupon code already exists", 400);
    }

    const couponId = await Coupon.create({
      code,
      discount_type,
      discount_value,
      min_purchase_amount,
      max_discount_amount,
      usage_limit,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      is_active,
    });

    successResponse(res, { id: couponId }, "Coupon created successfully", 201);
  } catch (error) {
    console.error("Error creating coupon:", error);
    errorResponse(res, "Failed to create coupon", 500);
  }
};

// Admin: Update coupon
export const updateCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if coupon exists
    const coupon = await Coupon.findById(parseInt(id));
    if (!coupon) {
      return errorResponse(res, "Coupon not found", 404);
    }

    // If updating code, check if new code already exists
    if (updateData.code && updateData.code !== coupon.code) {
      const existingCoupon = await Coupon.findByCode(updateData.code);
      if (existingCoupon) {
        return errorResponse(res, "Coupon code already exists", 400);
      }
    }

    // Convert date strings to Date objects
    if (updateData.start_date) {
      updateData.start_date = new Date(updateData.start_date);
    }
    if (updateData.end_date) {
      updateData.end_date = new Date(updateData.end_date);
    }

    const updated = await Coupon.update(parseInt(id), updateData);

    if (!updated) {
      return errorResponse(res, "No changes made", 400);
    }

    successResponse(res, null, "Coupon updated successfully");
  } catch (error) {
    console.error("Error updating coupon:", error);
    errorResponse(res, "Failed to update coupon", 500);
  }
};

// Admin: Delete coupon
export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = await Coupon.delete(parseInt(id));

    if (!deleted) {
      return errorResponse(res, "Coupon not found", 404);
    }

    successResponse(res, null, "Coupon deleted successfully");
  } catch (error) {
    console.error("Error deleting coupon:", error);
    errorResponse(res, "Failed to delete coupon", 500);
  }
};

// User: Validate coupon
export const validateCoupon = async (req: Request, res: Response) => {
  try {
    const { code, orderAmount } = req.body;
    const userId = (req as any).user.id;

    if (!code || !orderAmount) {
      return errorResponse(res, "Missing required fields", 400);
    }

    const validation = await Coupon.validateCoupon(
      code,
      userId,
      parseFloat(orderAmount)
    );

    if (!validation.valid) {
      return errorResponse(res, validation.message || "Invalid coupon", 400);
    }

    const discountAmount = Coupon.calculateDiscount(
      validation.coupon!,
      parseFloat(orderAmount)
    );

    successResponse(
      res,
      {
        coupon: validation.coupon,
        discount_amount: discountAmount,
        final_amount: parseFloat(orderAmount) - discountAmount,
      },
      "Coupon is valid"
    );
  } catch (error) {
    console.error("Error validating coupon:", error);
    errorResponse(res, "Failed to validate coupon", 500);
  }
};

// User: Get available coupons
export const getAvailableCoupons = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const coupons = await Coupon.findAll({ isActive: true });

    // Filter out coupons that are not yet valid or have expired
    const now = new Date();
    const availableCoupons = coupons.filter(
      (coupon) =>
        now >= new Date(coupon.start_date) &&
        now <= new Date(coupon.end_date) &&
        (!coupon.usage_limit || coupon.used_count < coupon.usage_limit)
    );

    // If user is logged in, exclude coupons they've already used
    if (userId) {
      const userUsage = await Coupon.getUserUsage(userId);
      const usedCouponIds = userUsage.map((usage) => usage.coupon_id);
      const filteredCoupons = availableCoupons.filter(
        (coupon) => !usedCouponIds.includes(coupon.id)
      );
      return successResponse(
        res,
        filteredCoupons,
        "Available coupons retrieved successfully"
      );
    }

    successResponse(
      res,
      availableCoupons,
      "Available coupons retrieved successfully"
    );
  } catch (error) {
    console.error("Error getting available coupons:", error);
    errorResponse(res, "Failed to get available coupons", 500);
  }
};

// Admin: Get coupon usage history
export const getCouponUsage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const usage = await Coupon.getUsageHistory(parseInt(id));

    successResponse(res, usage, "Coupon usage retrieved successfully");
  } catch (error) {
    console.error("Error getting coupon usage:", error);
    errorResponse(res, "Failed to get coupon usage", 500);
  }
};

// User: Get my coupon usage
export const getMyCouponUsage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const usage = await Coupon.getUserUsage(userId);

    successResponse(res, usage, "Your coupon usage retrieved successfully");
  } catch (error) {
    console.error("Error getting user coupon usage:", error);
    errorResponse(res, "Failed to get coupon usage", 500);
  }
};
