import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

interface CouponData extends RowDataPacket {
  id: number;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  used_count: number;
  start_date: Date;
  end_date: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CouponUsageData extends RowDataPacket {
  id: number;
  coupon_id: number;
  user_id: number;
  order_id: number;
  discount_amount: number;
  used_at: Date;
}

class Coupon {
  // Get all coupons with filters
  static async findAll(filters: {
    isActive?: boolean;
    search?: string;
  }): Promise<CouponData[]> {
    let query = "SELECT * FROM coupons WHERE 1=1";
    const params: any[] = [];

    if (filters.isActive !== undefined) {
      query += " AND is_active = ?";
      params.push(filters.isActive);
    }

    if (filters.search) {
      query += " AND code LIKE ?";
      params.push(`%${filters.search}%`);
    }

    query += " ORDER BY created_at DESC";

    const [rows] = await pool.execute<CouponData[]>(query, params);
    return rows;
  }

  // Get coupon by ID
  static async findById(id: number): Promise<CouponData | null> {
    const [rows] = await pool.execute<CouponData[]>(
      "SELECT * FROM coupons WHERE id = ?",
      [id]
    );
    return rows[0] || null;
  }

  // Get coupon by code
  static async findByCode(code: string): Promise<CouponData | null> {
    const [rows] = await pool.execute<CouponData[]>(
      "SELECT * FROM coupons WHERE code = ?",
      [code]
    );
    return rows[0] || null;
  }

  // Validate coupon for use
  static async validateCoupon(
    code: string,
    userId: number,
    orderAmount: number
  ): Promise<{ valid: boolean; message?: string; coupon?: CouponData }> {
    const coupon = await this.findByCode(code);

    if (!coupon) {
      return { valid: false, message: "Coupon not found" };
    }

    if (!coupon.is_active) {
      return { valid: false, message: "Coupon is inactive" };
    }

    const now = new Date();
    if (now < new Date(coupon.start_date)) {
      return { valid: false, message: "Coupon not yet valid" };
    }

    if (now > new Date(coupon.end_date)) {
      return { valid: false, message: "Coupon has expired" };
    }

    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return { valid: false, message: "Coupon usage limit reached" };
    }

    if (
      coupon.min_purchase_amount &&
      orderAmount < coupon.min_purchase_amount
    ) {
      return {
        valid: false,
        message: `Minimum purchase amount is ${coupon.min_purchase_amount}`,
      };
    }

    // Check if user already used this coupon
    const [usageRows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM coupon_usage WHERE coupon_id = ? AND user_id = ?",
      [coupon.id, userId]
    );

    if (usageRows.length > 0) {
      return { valid: false, message: "You have already used this coupon" };
    }

    return { valid: true, coupon };
  }

  // Calculate discount amount
  static calculateDiscount(coupon: CouponData, orderAmount: number): number {
    let discount = 0;

    if (coupon.discount_type === "percentage") {
      discount = (orderAmount * coupon.discount_value) / 100;
      if (coupon.max_discount_amount) {
        discount = Math.min(discount, coupon.max_discount_amount);
      }
    } else {
      discount = coupon.discount_value;
    }

    return Math.min(discount, orderAmount);
  }

  // Create coupon
  static async create(data: {
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    min_purchase_amount?: number;
    max_discount_amount?: number;
    usage_limit?: number;
    start_date: Date;
    end_date: Date;
    is_active?: boolean;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO coupons 
       (code, discount_type, discount_value, min_purchase_amount, 
        max_discount_amount, usage_limit, start_date, end_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.code,
        data.discount_type,
        data.discount_value,
        data.min_purchase_amount || null,
        data.max_discount_amount || null,
        data.usage_limit || null,
        data.start_date,
        data.end_date,
        data.is_active !== undefined ? data.is_active : true,
      ]
    );
    return result.insertId;
  }

  // Update coupon
  static async update(
    id: number,
    data: Partial<{
      code: string;
      discount_type: "percentage" | "fixed";
      discount_value: number;
      min_purchase_amount: number;
      max_discount_amount: number;
      usage_limit: number;
      start_date: Date;
      end_date: Date;
      is_active: boolean;
    }>
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    if (fields.length === 0) return false;

    values.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE coupons SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  // Delete coupon
  static async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM coupons WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Record coupon usage
  static async recordUsage(data: {
    coupon_id: number;
    user_id: number;
    order_id: number;
    discount_amount: number;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO coupon_usage 
       (coupon_id, user_id, order_id, discount_amount)
       VALUES (?, ?, ?, ?)`,
      [data.coupon_id, data.user_id, data.order_id, data.discount_amount]
    );

    // Increment used_count
    await pool.execute(
      "UPDATE coupons SET used_count = used_count + 1 WHERE id = ?",
      [data.coupon_id]
    );

    return result.insertId;
  }

  // Get usage history for a coupon
  static async getUsageHistory(couponId: number): Promise<CouponUsageData[]> {
    const [rows] = await pool.execute<CouponUsageData[]>(
      `SELECT cu.*, u.name as user_name, u.email as user_email
       FROM coupon_usage cu
       JOIN users u ON cu.user_id = u.id
       WHERE cu.coupon_id = ?
       ORDER BY cu.used_at DESC`,
      [couponId]
    );
    return rows;
  }

  // Get user's coupon usage
  static async getUserUsage(userId: number): Promise<CouponUsageData[]> {
    const [rows] = await pool.execute<CouponUsageData[]>(
      `SELECT cu.*, c.code as coupon_code
       FROM coupon_usage cu
       JOIN coupons c ON cu.coupon_id = c.id
       WHERE cu.user_id = ?
       ORDER BY cu.used_at DESC`,
      [userId]
    );
    return rows;
  }
}

export default Coupon;
