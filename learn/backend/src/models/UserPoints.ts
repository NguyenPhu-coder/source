import pool from "../config/db.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

interface UserPointsData extends RowDataPacket {
  id: number;
  user_id: number;
  total_points: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
  level: number;
  level_name: string;
  created_at: string;
  updated_at: string;
}

class UserPoints {
  // Get user points by user_id
  static async findByUserId(userId: number): Promise<UserPointsData | null> {
    const [rows] = await pool.query<UserPointsData[]>(
      "SELECT * FROM user_points WHERE user_id = ?",
      [userId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Initialize points for new user
  static async initialize(userId: number): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO user_points (user_id, total_points, current_streak, longest_streak, last_activity_date, level, level_name) 
       VALUES (?, 0, 0, 0, CURDATE(), 1, 'Beginner')`,
      [userId]
    );
    return result.insertId;
  }

  // Add points to user
  static async addPoints(
    userId: number,
    points: number,
    activityType: string,
    referenceId?: number
  ): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Ensure user_points record exists
      const [existing] = await connection.query<UserPointsData[]>(
        "SELECT id FROM user_points WHERE user_id = ?",
        [userId]
      );

      if (existing.length === 0) {
        await this.initialize(userId);
      }

      // Add points
      await connection.query(
        "UPDATE user_points SET total_points = total_points + ? WHERE user_id = ?",
        [points, userId]
      );

      // Record in points history
      await connection.query(
        "INSERT INTO points_history (user_id, points, activity_type, reference_id) VALUES (?, ?, ?, ?)",
        [userId, points, activityType, referenceId || null]
      );

      // Update level based on total points
      const [userPoints] = await connection.query<UserPointsData[]>(
        "SELECT total_points FROM user_points WHERE user_id = ?",
        [userId]
      );

      if (userPoints.length > 0) {
        const totalPoints = userPoints[0].total_points;
        const levelInfo = this.calculateLevel(totalPoints);

        await connection.query(
          "UPDATE user_points SET level = ?, level_name = ? WHERE user_id = ?",
          [levelInfo.level, levelInfo.levelName, userId]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Calculate level based on total points
  static calculateLevel(totalPoints: number): {
    level: number;
    levelName: string;
  } {
    if (totalPoints >= 50000) return { level: 5, levelName: "Master" };
    if (totalPoints >= 15000) return { level: 4, levelName: "Expert" };
    if (totalPoints >= 5000) return { level: 3, levelName: "Scholar" };
    if (totalPoints >= 1000) return { level: 2, levelName: "Learner" };
    return { level: 1, levelName: "Beginner" };
  }

  // Update streak
  static async updateStreak(userId: number): Promise<void> {
    const [userPoints] = await pool.query<UserPointsData[]>(
      "SELECT current_streak, longest_streak, last_activity_date FROM user_points WHERE user_id = ?",
      [userId]
    );

    if (userPoints.length === 0) {
      await this.initialize(userId);
      return;
    }

    const lastActivityDate = new Date(userPoints[0].last_activity_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastActivityDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor(
      (today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let newStreak = userPoints[0].current_streak;
    let newLongestStreak = userPoints[0].longest_streak;

    if (daysDiff === 0) {
      // Same day, no change
      return;
    } else if (daysDiff === 1) {
      // Consecutive day
      newStreak += 1;
      newLongestStreak = Math.max(newStreak, newLongestStreak);

      // Award daily login points
      await this.addPoints(userId, 25, "daily_login");
    } else {
      // Streak broken
      newStreak = 1;
    }

    await pool.query(
      "UPDATE user_points SET current_streak = ?, longest_streak = ?, last_activity_date = CURDATE() WHERE user_id = ?",
      [newStreak, newLongestStreak, userId]
    );
  }

  // Get leaderboard
  static async getLeaderboard(limit: number = 100): Promise<UserPointsData[]> {
    const [rows] = await pool.query<UserPointsData[]>(
      `SELECT up.*, u.name, u.email 
       FROM user_points up
       JOIN users u ON up.user_id = u.id
       ORDER BY up.total_points DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  }

  // Get user rank
  static async getUserRank(userId: number): Promise<number> {
    const [result] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) + 1 as user_rank
       FROM user_points
       WHERE total_points > (SELECT total_points FROM user_points WHERE user_id = ?)`,
      [userId]
    );
    return result[0]?.user_rank || 0;
  }

  // Get points history
  static async getPointsHistory(
    userId: number,
    limit: number = 50
  ): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM points_history 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, limit]
    );
    return rows;
  }
}

export default UserPoints;
