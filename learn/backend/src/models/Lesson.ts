import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface LessonData extends RowDataPacket {
  id: number;
  course_id: number;
  title_en: string;
  title_vi?: string;
  description_en?: string;
  description_vi?: string;
  video_url: string;
  duration: number;
  order_index: number;
  created_at?: Date;
  updated_at?: Date;
}

export class Lesson {
  // Get all lessons for a course
  static async findByCourseId(courseId: number): Promise<LessonData[]> {
    const [rows] = await pool.execute<LessonData[]>(
      "SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC",
      [courseId]
    );
    return rows;
  }

  // Get lesson by ID
  static async findById(id: number): Promise<LessonData | null> {
    const [rows] = await pool.execute<LessonData[]>(
      "SELECT * FROM lessons WHERE id = ?",
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Create lesson
  static async create(data: {
    course_id: number;
    title_en: string;
    title_vi?: string;
    description_en?: string;
    description_vi?: string;
    video_url: string;
    duration: number;
    order_index: number;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO lessons (course_id, title_en, title_vi, description_en, description_vi, video_url, duration, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.course_id,
        data.title_en,
        data.title_vi,
        data.description_en,
        data.description_vi,
        data.video_url,
        data.duration,
        data.order_index,
      ]
    );
    return result.insertId;
  }

  // Update lesson
  static async update(
    id: number,
    data: Partial<{
      title_en: string;
      title_vi: string;
      description_en: string;
      description_vi: string;
      video_url: string;
      duration: number;
      order_index: number;
    }>
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title_en !== undefined) {
      fields.push("title_en = ?");
      values.push(data.title_en);
    }
    if (data.title_vi !== undefined) {
      fields.push("title_vi = ?");
      values.push(data.title_vi);
    }
    if (data.description_en !== undefined) {
      fields.push("description_en = ?");
      values.push(data.description_en);
    }
    if (data.description_vi !== undefined) {
      fields.push("description_vi = ?");
      values.push(data.description_vi);
    }
    if (data.video_url !== undefined) {
      fields.push("video_url = ?");
      values.push(data.video_url);
    }
    if (data.duration !== undefined) {
      fields.push("duration = ?");
      values.push(data.duration);
    }
    if (data.order_index !== undefined) {
      fields.push("order_index = ?");
      values.push(data.order_index);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE lessons SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  // Delete lesson
  static async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM lessons WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Count lessons by course
  static async countByCourseId(courseId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM lessons WHERE course_id = ?",
      [courseId]
    );
    return rows[0].total;
  }
}
