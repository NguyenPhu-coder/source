import pool from "../config/db.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export interface LessonProgress {
  id?: number;
  user_id: number;
  lesson_id: number;
  completed: boolean;
  completed_at?: Date;
}

export const LessonProgressModel = {
  async markCompleted(userId: number, lessonId: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO lesson_progress (user_id, lesson_id, completed, completed_at) 
       VALUES (?, ?, TRUE, NOW())
       ON DUPLICATE KEY UPDATE completed = TRUE, completed_at = NOW()`,
      [userId, lessonId]
    );
    return result.insertId || result.affectedRows;
  },

  async markIncomplete(userId: number, lessonId: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE lesson_progress 
       SET completed = FALSE, completed_at = NULL
       WHERE user_id = ? AND lesson_id = ?`,
      [userId, lessonId]
    );
    return result.affectedRows > 0;
  },

  async getUserProgress(userId: number, courseId: number): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT lp.*, l.title_en, l.title_vi, l.order_index
       FROM lesson_progress lp
       JOIN lessons l ON lp.lesson_id = l.id
       WHERE lp.user_id = ? AND l.course_id = ?
       ORDER BY l.order_index`,
      [userId, courseId]
    );
    return rows;
  },

  async getCourseProgress(userId: number, courseId: number): Promise<any> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        c.total_lessons,
        COALESCE(COUNT(lp.id), 0) as completed_lessons,
        CASE 
          WHEN c.total_lessons > 0 THEN ROUND((COUNT(lp.id) * 100.0 / c.total_lessons), 2)
          ELSE 0 
        END as progress
       FROM courses c
       LEFT JOIN lessons l ON c.id = l.course_id
       LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = ? AND lp.completed = TRUE
       WHERE c.id = ?
       GROUP BY c.id, c.total_lessons`,
      [userId, courseId]
    );
    return rows[0] || { total_lessons: 0, completed_lessons: 0, progress: 0 };
  },

  async updateEnrollmentProgress(
    userId: number,
    courseId: number
  ): Promise<void> {
    // Get calculated progress
    const progressData = await this.getCourseProgress(userId, courseId);

    // Update enrollment
    await pool.execute(
      `UPDATE enrollments 
       SET progress = ?, 
           completed = ?, 
           completed_at = CASE WHEN ? >= 100 THEN NOW() ELSE NULL END
       WHERE user_id = ? AND course_id = ?`,
      [
        progressData.progress,
        progressData.progress >= 100,
        progressData.progress,
        userId,
        courseId,
      ]
    );
  },
};


