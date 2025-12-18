import pool from "../config/db.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export interface Review {
  id?: number;
  user_id: number;
  course_id: number;
  rating: number;
  comment?: string;
  created_at?: Date;
  updated_at?: Date;
}

export const ReviewModel = {
  async create(review: Review): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO reviews (user_id, course_id, rating, comment) VALUES (?, ?, ?, ?)",
      [review.user_id, review.course_id, review.rating, review.comment || null]
    );
    return result.insertId;
  },

  async findByCourseId(courseId: number): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT r.*, u.name as user_name, u.email as user_email
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.course_id = ?
       ORDER BY r.created_at DESC`,
      [courseId]
    );
    return rows;
  },

  async findOne(userId: number, courseId: number): Promise<Review | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM reviews WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );
    return (rows[0] as Review) || null;
  },

  async update(id: number, rating: number, comment?: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE reviews SET rating = ?, comment = ? WHERE id = ?",
      [rating, comment, id]
    );
    return result.affectedRows > 0;
  },

  async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM reviews WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  },
};
