import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface CartData extends RowDataPacket {
  id: number;
  user_id: number;
  course_id: number;
  created_at: Date;
  course_title_en?: string;
  course_title_vi?: string;
  course_price?: number;
  course_thumbnail?: string;
  instructor_name?: string;
}

class Cart {
  // Get cart items by user
  static async getByUserId(userId: number): Promise<CartData[]> {
    const [rows] = await pool.query<CartData[]>(
      `SELECT c.*, 
        co.title_en as course_title_en,
        co.title_vi as course_title_vi,
        co.price as course_price,
        co.thumbnail as course_thumbnail,
        u.name as instructor_name
       FROM cart c
       JOIN courses co ON c.course_id = co.id
       JOIN users u ON co.instructor_id = u.id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [userId]
    );
    return rows;
  }

  // Add item to cart
  static async add(userId: number, courseId: number): Promise<number> {
    // Check if already in cart
    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM cart WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );

    if (existing.length > 0) {
      return existing[0].id;
    }

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO cart (user_id, course_id) VALUES (?, ?)",
      [userId, courseId]
    );
    return result.insertId;
  }

  // Remove item from cart
  static async remove(userId: number, courseId: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM cart WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );
    return result.affectedRows > 0;
  }

  // Clear cart
  static async clear(userId: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM cart WHERE user_id = ?",
      [userId]
    );
    return result.affectedRows > 0;
  }

  // Get cart count
  static async getCount(userId: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM cart WHERE user_id = ?",
      [userId]
    );
    return rows[0].count;
  }
}

export default Cart;
