import pool from "../config/db.js";
import bcrypt from "bcrypt";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export interface User {
  id?: number;
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  location?: string;
  website?: string;
  social_links?: any;
  role: "student" | "instructor" | "admin";
  created_at?: Date;
  updated_at?: Date;
}

export const UserModel = {
  async create(user: User): Promise<number> {
    // Handle users without password (e.g., Google OAuth users)
    let password = null;
    if (user.password && user.password.length > 0) {
      password = await bcrypt.hash(user.password, 10);
    }
    
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO users (name, email, password, avatar, role) VALUES (?, ?, ?, ?, ?)",
      [
        user.name,
        user.email,
        password,
        user.avatar || null,
        user.role || "student",
      ]
    );
    return result.insertId;
  },

  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    return (rows[0] as User) || null;
  },

  async findById(id: number): Promise<User | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, name, email, avatar, bio, phone, location, website, social_links, role, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );
    return (rows[0] as User) || null;
  },

  async update(id: number, data: Partial<User>): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (key !== "id" && key !== "password" && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return false;

    values.push(id);
    await pool.execute(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    return true;
  },

  async verifyPassword(
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  },

  async updatePassword(id: number, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE users SET password = ? WHERE id = ?",
      [hashedPassword, id]
    );
    return result.affectedRows > 0;
  },
};
