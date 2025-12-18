import pool from "../config/db.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export interface Enrollment {
  id?: number;
  user_id: number;
  course_id: number;
  progress: number;
  completed: boolean;
  enrolled_at?: Date;
  completed_at?: Date;
}

export const EnrollmentModel = {
  async create(userId: number, courseId: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)",
      [userId, courseId]
    );
    return result.insertId;
  },

  async findByUserId(userId: number): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT e.*, 
        c.title_en, c.title_vi, c.thumbnail,
        (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as total_lessons,
        u.name as instructor_name,
        COALESCE(
          (SELECT COUNT(*) FROM lesson_progress lp 
           JOIN lessons l ON lp.lesson_id = l.id 
           WHERE lp.user_id = e.user_id AND l.course_id = e.course_id AND lp.completed = TRUE),
          0
        ) as completed_lessons,
        CASE 
          WHEN (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) > 0 THEN 
            ROUND((COALESCE(
              (SELECT COUNT(*) FROM lesson_progress lp 
               JOIN lessons l ON lp.lesson_id = l.id 
               WHERE lp.user_id = e.user_id AND l.course_id = e.course_id AND lp.completed = TRUE),
              0
            ) * 100.0 / (SELECT COUNT(*) FROM lessons WHERE course_id = c.id)), 2)
          ELSE 0 
        END as calculated_progress
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN users u ON c.instructor_id = u.id
       WHERE e.user_id = ?
       ORDER BY e.enrolled_at DESC`,
      [userId]
    );
    return rows;
  },

  async findOne(userId: number, courseId: number): Promise<Enrollment | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );
    return (rows[0] as Enrollment) || null;
  },

  async updateProgress(
    enrollmentId: number,
    progress: number
  ): Promise<boolean> {
    const completed = progress >= 100;
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE enrollments 
       SET progress = ?, completed = ?, completed_at = ${completed ? "NOW()" : "NULL"
      }
       WHERE id = ?`,
      [progress, completed, enrollmentId]
    );
    return result.affectedRows > 0;
  },

  async checkEnrollment(userId: number, courseId: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );
    return rows.length > 0;
  },

  async getEnrollmentStatus(
    userId: number,
    courseId: number
  ): Promise<{ isEnrolled: boolean; isCompleted: boolean }> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, completed FROM enrollments WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );
    if (rows.length === 0) {
      return { isEnrolled: false, isCompleted: false };
    }
    const enrollment = rows[0] as Enrollment;
    return {
      isEnrolled: true,
      isCompleted: enrollment.completed || false,
    };
  },

  async delete(userId: number, courseId: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM enrollments WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );
    return result.affectedRows > 0;
  },
};
