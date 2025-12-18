import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface PointsHistoryData extends RowDataPacket {
  id: number;
  user_id: number;
  points: number;
  activity_type: string;
  reference_id?: number;
  description?: string;
  created_at?: Date;
}

export class PointsHistory {
  // Get history by ID
  static async findById(id: number): Promise<PointsHistoryData | null> {
    const [rows] = await pool.execute<PointsHistoryData[]>(
      "SELECT * FROM points_history WHERE id = ?",
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get history by user
  static async findByUserId(
    userId: number,
    limit: number = 50
  ): Promise<PointsHistoryData[]> {
    const [rows] = await pool.execute<PointsHistoryData[]>(
      "SELECT * FROM points_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
      [userId, limit]
    );
    return rows;
  }

  // Get history by activity type
  static async findByUserIdAndType(
    userId: number,
    activityType: string
  ): Promise<PointsHistoryData[]> {
    const [rows] = await pool.execute<PointsHistoryData[]>(
      "SELECT * FROM points_history WHERE user_id = ? AND activity_type = ? ORDER BY created_at DESC",
      [userId, activityType]
    );
    return rows;
  }

  // Create history record
  static async create(data: {
    user_id: number;
    points: number;
    activity_type: string;
    reference_id?: number;
    description?: string;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO points_history (user_id, points, activity_type, reference_id, description) VALUES (?, ?, ?, ?, ?)",
      [
        data.user_id,
        data.points,
        data.activity_type,
        data.reference_id,
        data.description,
      ]
    );
    return result.insertId;
  }

  // Get total points by user
  static async getTotalPointsByUserId(userId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT SUM(points) as total FROM points_history WHERE user_id = ?",
      [userId]
    );
    return rows[0].total || 0;
  }

  // Get points by activity type
  static async getPointsByActivityType(
    userId: number,
    activityType: string
  ): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT SUM(points) as total FROM points_history WHERE user_id = ? AND activity_type = ?",
      [userId, activityType]
    );
    return rows[0].total || 0;
  }

  // Get recent activities
  static async getRecentActivities(
    userId: number,
    days: number = 7
  ): Promise<PointsHistoryData[]> {
    const [rows] = await pool.execute<PointsHistoryData[]>(
      "SELECT * FROM points_history WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) ORDER BY created_at DESC",
      [userId, days]
    );
    return rows;
  }

  // Get points summary by activity type
  static async getPointsSummaryByType(userId: number): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        activity_type,
        SUM(points) as total_points,
        COUNT(*) as activity_count
       FROM points_history 
       WHERE user_id = ?
       GROUP BY activity_type
       ORDER BY total_points DESC`,
      [userId]
    );
    return rows;
  }

  // Delete old history
  static async deleteOldHistory(months: number = 12): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM points_history WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MONTH)",
      [months]
    );
    return result.affectedRows;
  }
}
