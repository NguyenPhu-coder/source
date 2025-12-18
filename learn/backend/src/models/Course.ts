import pool from "../config/db.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export interface Course {
  id?: number;
  title_en: string;
  title_vi?: string;
  description_en?: string;
  description_vi?: string;
  thumbnail?: string;
  category_id?: number;
  instructor_id: number;
  price: number;
  level: "beginner" | "intermediate" | "advanced";
  language: string;
  rating?: number;
  total_reviews?: number;
  total_students?: number;
  total_lessons?: number;
  duration?: number;
  is_published?: boolean;
  approval_status?: "pending" | "approved" | "rejected";
  approved_by?: number;
  approved_at?: Date;
  rejection_reason?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface CourseFilters {
  category?: string;
  level?: string;
  search?: string;
  language?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export const CourseModel = {
  async create(course: Course): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO courses (title_en, title_vi, description_en, description_vi, 
       thumbnail, category_id, instructor_id, price, level, language, approval_status, is_published) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        course.title_en,
        course.title_vi,
        course.description_en,
        course.description_vi,
        course.thumbnail,
        course.category_id,
        course.instructor_id,
        course.price,
        course.level,
        course.language,
        course.approval_status || "pending",
        false, // is_published = FALSE for new courses
      ]
    );
    return result.insertId;
  },

  async findAll(
    filters: CourseFilters = {}
  ): Promise<{ courses: any[]; total: number }> {
    let query = `
      SELECT c.*, 
        cat.name_en as category_name_en,
        cat.name_vi as category_name_vi,
        u.name as instructor_name,
        u.email as instructor_email
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE c.is_published = TRUE 
        AND c.approval_status = 'approved'
    `;

    const params: any[] = [];

    if (filters.category) {
      query += " AND c.category_id = ?";
      params.push(filters.category);
    }

    if (filters.level) {
      query += " AND c.level = ?";
      params.push(filters.level);
    }

    if (filters.search) {
      query += " AND (c.title_en LIKE ? OR c.title_vi LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    // Count total - build count query separately
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM courses c
      WHERE c.is_published = TRUE 
        AND c.approval_status = 'approved'
    `;
    const countParams: any[] = [];

    if (filters.category) {
      countQuery += " AND c.category_id = ?";
      countParams.push(filters.category);
    }
    if (filters.level) {
      countQuery += " AND c.level = ?";
      countParams.push(filters.level);
    }
    if (filters.search) {
      countQuery += " AND (c.title_en LIKE ? OR c.title_vi LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      countParams.push(searchTerm, searchTerm);
    }

    const [countRows] = await pool.execute<RowDataPacket[]>(
      countQuery,
      countParams
    );
    const total = countRows[0]?.total || 0;

    // Apply sorting
    const sortOrder =
      filters.sort === "price_asc"
        ? "c.price ASC"
        : filters.sort === "price_desc"
          ? "c.price DESC"
          : filters.sort === "rating"
            ? "c.rating DESC"
            : "c.created_at DESC";
    query += ` ORDER BY ${sortOrder}`;

    // Apply pagination
    const page = filters.page || 1;
    const limit = filters.limit || 12;
    const offset = (page - 1) * limit;
    query += ` LIMIT ${parseInt(String(limit))} OFFSET ${parseInt(String(offset))}`;

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return { courses: rows, total };
  },

  async findById(id: number, lang: string = "en"): Promise<any | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.*, 
        cat.name_en as category_name_en,
        cat.name_vi as category_name_vi,
        u.name as instructor_name,
        u.email as instructor_email
       FROM courses c
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN users u ON c.instructor_id = u.id
       WHERE c.id = ?`,
      [id]
    );

    if (rows.length === 0) return null;

    const course = rows[0];

    // Get lessons with all fields including new ones
    const [lessons] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        id, course_id, title_en, title_vi, 
        description_en, description_vi, 
        video_url, duration, order_index, is_free, 
        lesson_type, content_text, document_url, 
        created_at
      FROM lessons 
      WHERE course_id = ? 
      ORDER BY order_index`,
      [id]
    );

    // Get reviews summary
    const [reviewStats] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as total, AVG(rating) as average FROM reviews WHERE course_id = ?",
      [id]
    );

    return {
      ...course,
      lessons,
      reviewStats: reviewStats[0],
    };
  },

  async update(id: number, data: Partial<Course>): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (key !== "id" && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return false;

    values.push(id);
    await pool.execute(
      `UPDATE courses SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    return true;
  },

  async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM courses WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  },

  async updateStats(courseId: number): Promise<void> {
    // Update total students
    await pool.execute(
      `UPDATE courses c 
       SET total_students = (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id)
       WHERE c.id = ?`,
      [courseId]
    );

    // Update rating and total reviews
    await pool.execute(
      `UPDATE courses c 
       SET rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE course_id = c.id),
           total_reviews = (SELECT COUNT(*) FROM reviews WHERE course_id = c.id)
       WHERE c.id = ?`,
      [courseId]
    );
  },

  async findByInstructor(instructorId: number): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.*, 
              COUNT(DISTINCT e.id) as total_students,
              COUNT(DISTINCT l.id) as total_lessons,
              COALESCE(AVG(r.rating), 0) as rating,
              COUNT(DISTINCT r.id) as total_reviews
       FROM courses c
       LEFT JOIN enrollments e ON c.id = e.course_id
       LEFT JOIN lessons l ON c.id = l.course_id
       LEFT JOIN reviews r ON c.id = r.course_id
       WHERE c.instructor_id = ?
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [instructorId]
    );
    return rows;
  },
};
