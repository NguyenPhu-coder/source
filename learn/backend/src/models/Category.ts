import pool from "../config/db.js";
import { RowDataPacket } from "mysql2";

export const CategoryModel = {
  async findAll(lang: string = "en"): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        c.*,
        COUNT(DISTINCT co.id) as course_count
      FROM categories c
      LEFT JOIN courses co ON co.category_id = c.id AND co.is_published = 1
      GROUP BY c.id
      ORDER BY c.id`,
    );
    return rows;
  },

  async findById(id: number): Promise<any | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM categories WHERE id = ?",
      [id],
    );
    return rows[0] || null;
  },
};


