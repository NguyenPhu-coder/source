import pool from "../config/db.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export interface Blog {
  id?: number;
  author_id: number;
  title: string;
  content: string;
  thumbnail?: string;
  status: "draft" | "published";
  created_at?: Date;
  updated_at?: Date;
  user_name?: string;
  user_email?: string;
  is_saved?: boolean;
}

export const BlogModel = {
  async create(blogData: Omit<Blog, "id">): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO blogs (author_id, title, content, thumbnail, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        blogData.author_id,
        blogData.title,
        blogData.content,
        blogData.thumbnail || null,
        blogData.status,
      ]
    );
    return result.insertId;
  },

  async findAll(userId?: number): Promise<Blog[]> {
    const query = `
      SELECT b.*, u.name as user_name, u.email as user_email
      ${userId
        ? ", EXISTS(SELECT 1 FROM saved_blogs sb WHERE sb.blog_id = b.id AND sb.user_id = ?) as is_saved"
        : ""
      }
      FROM blogs b
      JOIN users u ON b.user_id = u.id
      WHERE b.status = 'published'
      ORDER BY b.created_at DESC
    `;

    const params = userId ? [userId] : [];
    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return rows as Blog[];
  },

  async findById(id: number, userId?: number): Promise<Blog | null> {
    const query = `
      SELECT b.*, u.name as user_name, u.email as user_email
      ${userId
        ? ", EXISTS(SELECT 1 FROM saved_blogs sb WHERE sb.blog_id = b.id AND sb.user_id = ?) as is_saved"
        : ""
      }
      FROM blogs b
      JOIN users u ON b.user_id = u.id
      WHERE b.id = ?
    `;

    const params = userId ? [userId, id] : [id];
    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return (rows[0] as Blog) || null;
  },

  async findByUserId(userId: number): Promise<Blog[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT b.*, u.name as author_name, u.email as author_email
       FROM blogs b
       JOIN users u ON b.author_id = u.id
       WHERE b.author_id = ?
       ORDER BY b.created_at DESC`,
      [userId]
    );
    return rows as Blog[];
  },

  async update(
    id: number,
    blogData: Partial<Omit<Blog, "id" | "author_id">>
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (blogData.title !== undefined) {
      fields.push("title = ?");
      values.push(blogData.title);
    }
    if (blogData.content !== undefined) {
      fields.push("content = ?");
      values.push(blogData.content);
    }
    if (blogData.thumbnail !== undefined) {
      fields.push("thumbnail = ?");
      values.push(blogData.thumbnail);
    }
    if (blogData.status !== undefined) {
      fields.push("status = ?");
      values.push(blogData.status);
    }

    if (fields.length === 0) return false;

    values.push(id);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE blogs SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    return result.affectedRows > 0;
  },

  async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM blogs WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  },

  async saveBlog(userId: number, blogId: number): Promise<boolean> {
    try {
      await pool.execute<ResultSetHeader>(
        "INSERT INTO saved_blogs (user_id, blog_id) VALUES (?, ?)",
        [userId, blogId]
      );
      return true;
    } catch (error: any) {
      if (error.code === "ER_DUP_ENTRY") {
        return false; // Already saved
      }
      throw error;
    }
  },

  async unsaveBlog(userId: number, blogId: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM saved_blogs WHERE user_id = ? AND blog_id = ?",
      [userId, blogId]
    );
    return result.affectedRows > 0;
  },

  async getSavedBlogs(userId: number): Promise<Blog[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT b.*, u.name as user_name, u.email as user_email, TRUE as is_saved
       FROM blogs b
       JOIN users u ON b.user_id = u.id
       JOIN saved_blogs sb ON b.id = sb.blog_id
       WHERE sb.user_id = ?
       ORDER BY sb.saved_at DESC`,
      [userId]
    );
    return rows as Blog[];
  },
};
