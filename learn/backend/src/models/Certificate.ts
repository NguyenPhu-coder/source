import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface CertificateData extends RowDataPacket {
  id: number;
  user_id: number;
  course_id: number;
  certificate_code: string;
  issued_at?: Date;
  created_at?: Date;
}

export class Certificate {
  // Get certificate by ID
  static async findById(id: number): Promise<CertificateData | null> {
    const [rows] = await pool.execute<CertificateData[]>(
      "SELECT * FROM certificates WHERE id = ?",
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get certificate by code
  static async findByCode(code: string): Promise<CertificateData | null> {
    const [rows] = await pool.execute<CertificateData[]>(
      "SELECT * FROM certificates WHERE certificate_code = ?",
      [code]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get certificates by user
  static async findByUserId(userId: number): Promise<CertificateData[]> {
    const [rows] = await pool.execute<CertificateData[]>(
      "SELECT * FROM certificates WHERE user_id = ? ORDER BY issued_at DESC",
      [userId]
    );
    return rows;
  }

  // Get certificate by user and course
  static async findByUserAndCourse(
    userId: number,
    courseId: number
  ): Promise<CertificateData | null> {
    const [rows] = await pool.execute<CertificateData[]>(
      "SELECT * FROM certificates WHERE user_id = ? AND course_id = ?",
      [userId, courseId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Create certificate
  static async create(data: {
    user_id: number;
    course_id: number;
    certificate_code: string;
    issued_at?: Date;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO certificates (user_id, course_id, certificate_code, issued_at)
       VALUES (?, ?, ?, ?)`,
      [
        data.user_id,
        data.course_id,
        data.certificate_code,
        data.issued_at || new Date(),
      ]
    );
    return result.insertId;
  }

  // Generate certificate code
  static generateCertificateCode(userId: number, courseId: number): string {
    const timestamp = Date.now();
    return `CERT-${courseId}-${userId}-${timestamp}`;
  }

  // Check if user has certificate for course
  static async hasCertificate(
    userId: number,
    courseId: number
  ): Promise<boolean> {
    const cert = await this.findByUserAndCourse(userId, courseId);
    return cert !== null;
  }

  // Get certificate with course and user info
  static async findByIdWithDetails(id: number): Promise<any> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        c.*,
        u.name as user_name,
        u.email as user_email,
        co.title_en as course_title_en,
        co.title_vi as course_title_vi
       FROM certificates c
       JOIN users u ON c.user_id = u.id
       JOIN courses co ON c.course_id = co.id
       WHERE c.id = ?`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get certificate by code with details
  static async findByCodeWithDetails(code: string): Promise<any> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        c.*,
        u.name as user_name,
        u.email as user_email,
        co.title_en as course_title_en,
        co.title_vi as course_title_vi
       FROM certificates c
       JOIN users u ON c.user_id = u.id
       JOIN courses co ON c.course_id = co.id
       WHERE c.certificate_code = ?`,
      [code]
    );
    return rows.length > 0 ? rows[0] : null;
  }
}
