import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface CouponUsageData extends RowDataPacket {
  id: number;
  coupon_id: number;
  user_id: number;
  order_id: number;
  discount_amount: number;
  used_at?: Date;
}

export class CouponUsage {
  // Get usage by ID
  static async findById(id: number): Promise<CouponUsageData | null> {
    const [rows] = await pool.execute<CouponUsageData[]>(
      "SELECT * FROM coupon_usage WHERE id = ?",
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Check if user used coupon
  static async hasUserUsedCoupon(
    userId: number,
    couponId: number
  ): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM coupon_usage WHERE coupon_id = ? AND user_id = ?",
      [couponId, userId]
    );
    return rows.length > 0;
  }

  // Get usage by coupon
  static async findByCouponId(couponId: number): Promise<CouponUsageData[]> {
    const [rows] = await pool.execute<CouponUsageData[]>(
      "SELECT * FROM coupon_usage WHERE coupon_id = ? ORDER BY used_at DESC",
      [couponId]
    );
    return rows;
  }

  // Get usage by user
  static async findByUserId(userId: number): Promise<CouponUsageData[]> {
    const [rows] = await pool.execute<CouponUsageData[]>(
      "SELECT * FROM coupon_usage WHERE user_id = ? ORDER BY used_at DESC",
      [userId]
    );
    return rows;
  }

  // Create coupon usage
  static async create(data: {
    coupon_id: number;
    user_id: number;
    order_id: number;
    discount_amount: number;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_amount)
       VALUES (?, ?, ?, ?)`,
      [data.coupon_id, data.user_id, data.order_id, data.discount_amount]
    );
    return result.insertId;
  }

  // Count usage by coupon
  static async countByCouponId(couponId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = ?",
      [couponId]
    );
    return rows[0].count;
  }

  // Count usage by user
  static async countByUserId(userId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM coupon_usage WHERE user_id = ?",
      [userId]
    );
    return rows[0].count;
  }

  // Get usage with details
  static async findByIdWithDetails(id: number): Promise<any> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        cu.*,
        c.code as coupon_code,
        c.discount_type,
        c.discount_value,
        u.name as user_name,
        u.email as user_email,
        o.total_amount,
        o.final_amount
       FROM coupon_usage cu
       JOIN coupons c ON cu.coupon_id = c.id
       JOIN users u ON cu.user_id = u.id
       JOIN orders o ON cu.order_id = o.id
       WHERE cu.id = ?`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get usage statistics for coupon
  static async getCouponStatistics(couponId: number): Promise<any> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        COUNT(*) as total_usage,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(discount_amount) as total_discount
       FROM coupon_usage 
       WHERE coupon_id = ?`,
      [couponId]
    );
    return rows[0];
  }
}
