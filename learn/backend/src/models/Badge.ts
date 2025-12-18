import pool from "../config/db.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

interface BadgeData extends RowDataPacket {
  id: number;
  name_en: string;
  name_vi: string;
  description_en: string;
  description_vi: string;
  icon: string;
  trigger_type: string;
  trigger_value: number;
  created_at: string;
}

interface UserBadgeData extends RowDataPacket {
  id: number;
  user_id: number;
  badge_id: number;
  earned_at: string;
}

class Badge {
  // Get all badges
  static async findAll(): Promise<BadgeData[]> {
    const [rows] = await pool.query<BadgeData[]>(
      "SELECT * FROM badges ORDER BY trigger_value ASC"
    );
    return rows;
  }

  // Get badge by ID
  static async findById(badgeId: number): Promise<BadgeData | null> {
    const [rows] = await pool.query<BadgeData[]>(
      "SELECT * FROM badges WHERE id = ?",
      [badgeId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get user's earned badges
  static async getUserBadges(userId: number): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT b.*, ub.earned_at 
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = ?
       ORDER BY ub.earned_at DESC`,
      [userId]
    );
    return rows;
  }

  // Check if user has badge
  static async hasUserEarnedBadge(
    userId: number,
    badgeId: number
  ): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?",
      [userId, badgeId]
    );
    return rows.length > 0;
  }

  // Award badge to user
  static async awardBadge(
    userId: number,
    badgeId: number
  ): Promise<number | null> {
    try {
      // Check if already earned
      const alreadyEarned = await this.hasUserEarnedBadge(userId, badgeId);
      if (alreadyEarned) {
        return null;
      }

      const [result] = await pool.query<ResultSetHeader>(
        "INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)",
        [userId, badgeId]
      );

      // Create notification
      const badge = await this.findById(badgeId);
      if (badge) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, reference_id) 
           VALUES (?, 'badge_earned', ?, ?, ?)`,
          [
            userId,
            "New Badge Earned!",
            `You've earned the "${badge.name_en}" badge!`,
            badgeId,
          ]
        );
      }

      return result.insertId;
    } catch (error) {
      console.error("Error awarding badge:", error);
      return null;
    }
  }

  // Check and award badges based on user activity
  static async checkAndAwardBadges(userId: number): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get all badges
      const [badges] = await connection.query<BadgeData[]>(
        "SELECT * FROM badges"
      );

      for (const badge of badges) {
        // Skip if already earned
        const alreadyEarned = await this.hasUserEarnedBadge(userId, badge.id);
        if (alreadyEarned) continue;

        let shouldAward = false;

        switch (badge.trigger_type) {
          case "complete_first_lesson":
            const [lessonProgress] = await connection.query<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM lesson_progress WHERE user_id = ? AND completed = TRUE",
              [userId]
            );
            shouldAward = lessonProgress[0].count >= badge.trigger_value;
            break;

          case "complete_course":
            const [courseComplete] = await connection.query<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM enrollments WHERE user_id = ? AND completed = TRUE",
              [userId]
            );
            shouldAward = courseComplete[0].count >= badge.trigger_value;
            break;

          case "courses_completed":
            const [coursesCount] = await connection.query<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM enrollments WHERE user_id = ? AND completed = TRUE",
              [userId]
            );
            shouldAward = coursesCount[0].count >= badge.trigger_value;
            break;

          case "streak_days":
            const [userPoints] = await connection.query<RowDataPacket[]>(
              "SELECT current_streak FROM user_points WHERE user_id = ?",
              [userId]
            );
            shouldAward =
              userPoints.length > 0 &&
              userPoints[0].current_streak >= badge.trigger_value;
            break;

          case "perfect_quiz":
            const [quizCount] = await connection.query<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = ? AND score = 100",
              [userId]
            );
            shouldAward = quizCount[0].count >= badge.trigger_value;
            break;

          case "total_points":
            const [points] = await connection.query<RowDataPacket[]>(
              "SELECT total_points FROM user_points WHERE user_id = ?",
              [userId]
            );
            shouldAward =
              points.length > 0 &&
              points[0].total_points >= badge.trigger_value;
            break;
        }

        if (shouldAward) {
          await this.awardBadge(userId, badge.id);
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error("Error checking badges:", error);
    } finally {
      connection.release();
    }
  }

  // Get badges progress for user (how close they are to earning each badge)
  static async getBadgesProgress(userId: number): Promise<any[]> {
    const [badges] = await pool.query<BadgeData[]>("SELECT * FROM badges");

    const progress = [];

    for (const badge of badges) {
      const earned = await this.hasUserEarnedBadge(userId, badge.id);
      let currentValue = 0;

      if (!earned) {
        switch (badge.trigger_type) {
          case "complete_first_lesson":
          case "complete_course":
          case "courses_completed":
            const [courseCount] = await pool.query<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM enrollments WHERE user_id = ? AND completed = TRUE",
              [userId]
            );
            currentValue = courseCount[0].count;
            break;

          case "streak_days":
            const [userPoints] = await pool.query<RowDataPacket[]>(
              "SELECT current_streak FROM user_points WHERE user_id = ?",
              [userId]
            );
            currentValue =
              userPoints.length > 0 ? userPoints[0].current_streak : 0;
            break;

          case "perfect_quiz":
            const [quizCount] = await pool.query<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = ? AND score = 100",
              [userId]
            );
            currentValue = quizCount[0].count;
            break;

          case "total_points":
            const [points] = await pool.query<RowDataPacket[]>(
              "SELECT total_points FROM user_points WHERE user_id = ?",
              [userId]
            );
            currentValue = points.length > 0 ? points[0].total_points : 0;
            break;
        }
      }

      progress.push({
        ...badge,
        earned,
        currentValue,
        progressPercentage: earned
          ? 100
          : Math.min(100, (currentValue / badge.trigger_value) * 100),
      });
    }

    return progress;
  }
}

export default Badge;


