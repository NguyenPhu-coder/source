import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface UserBadgeData extends RowDataPacket {
  id: number;
  user_id: number;
  badge_id: number;
  earned_at?: Date;
}

export class UserBadge {
  // Get user badge by ID
  static async findById(id: number): Promise<UserBadgeData | null> {
    const [rows] = await pool.execute<UserBadgeData[]>(
      "SELECT * FROM user_badges WHERE id = ?",
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get all badges for a user
  static async findByUserId(userId: number): Promise<UserBadgeData[]> {
    const [rows] = await pool.execute<UserBadgeData[]>(
      "SELECT * FROM user_badges WHERE user_id = ? ORDER BY earned_at DESC",
      [userId]
    );
    return rows;
  }

  // Get user badges with badge details
  static async findByUserIdWithDetails(userId: number): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        ub.*,
        b.name as badge_name,
        b.description,
        b.icon,
        b.points_required,
        b.badge_type
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = ?
       ORDER BY ub.earned_at DESC`,
      [userId]
    );
    return rows;
  }

  // Check if user has badge
  static async hasUserBadge(userId: number, badgeId: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?",
      [userId, badgeId]
    );
    return rows.length > 0;
  }

  // Award badge to user
  static async create(data: {
    user_id: number;
    badge_id: number;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)",
      [data.user_id, data.badge_id]
    );
    return result.insertId;
  }

  // Count badges by user
  static async countByUserId(userId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM user_badges WHERE user_id = ?",
      [userId]
    );
    return rows[0].count;
  }

  // Get users who have a specific badge
  static async findByBadgeId(badgeId: number): Promise<UserBadgeData[]> {
    const [rows] = await pool.execute<UserBadgeData[]>(
      "SELECT * FROM user_badges WHERE badge_id = ? ORDER BY earned_at DESC",
      [badgeId]
    );
    return rows;
  }

  // Get recent badge earnings
  static async getRecentBadges(limit: number = 10): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        ub.*,
        u.name as user_name,
        u.email as user_email,
        b.name as badge_name,
        b.icon
       FROM user_badges ub
       JOIN users u ON ub.user_id = u.id
       JOIN badges b ON ub.badge_id = b.id
       ORDER BY ub.earned_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  }

  // Delete user badge
  static async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM user_badges WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Count total badge earners
  static async countBadgeEarners(badgeId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(DISTINCT user_id) as count FROM user_badges WHERE badge_id = ?",
      [badgeId]
    );
    return rows[0].count;
  }
}
