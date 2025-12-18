import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface RefundData extends RowDataPacket {
  id: number;
  user_id: number;
  order_id: number;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "completed";
  admin_notes?: string;
  processed_by?: number;
  processed_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export class Refund {
  // Get refund by ID
  static async findById(id: number): Promise<RefundData | null> {
    const [rows] = await pool.execute<RefundData[]>(
      `SELECT r.*, 
        u.name as user_name, 
        u.email as user_email,
        o.total_amount as order_amount,
        a.name as processed_by_name
       FROM refunds r
       JOIN users u ON r.user_id = u.id
       JOIN orders o ON r.order_id = o.id
       LEFT JOIN users a ON r.processed_by = a.id
       WHERE r.id = ?`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get all refunds with filters
  static async findAll(filters: {
    page?: number;
    limit?: number;
    status?: string;
    user_id?: number;
  }): Promise<{ refunds: RefundData[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    let query = `
      SELECT r.*, 
        u.name as user_name, 
        u.email as user_email,
        o.total_amount as order_amount,
        a.name as processed_by_name
      FROM refunds r
      JOIN users u ON r.user_id = u.id
      JOIN orders o ON r.order_id = o.id
      LEFT JOIN users a ON r.processed_by = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.status) {
      query += " AND r.status = ?";
      params.push(filters.status);
    }

    if (filters.user_id) {
      query += " AND r.user_id = ?";
      params.push(filters.user_id);
    }

    // Count query
    let countQuery = `
      SELECT COUNT(*) as total
      FROM refunds r
      JOIN users u ON r.user_id = u.id
      JOIN orders o ON r.order_id = o.id
      WHERE 1=1
    `;
    const countParams: any[] = [];

    if (filters.status) {
      countQuery += " AND r.status = ?";
      countParams.push(filters.status);
    }

    if (filters.user_id) {
      countQuery += " AND r.user_id = ?";
      countParams.push(filters.user_id);
    }

    const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, countParams);
    const total = countRows[0]?.total || 0;

    query += ` ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [rows] = await pool.execute<RefundData[]>(query, params);

    return { refunds: rows, total };
  }

  // Get refunds by user
  static async findByUserId(userId: number): Promise<RefundData[]> {
    const [rows] = await pool.execute<RefundData[]>(
      `SELECT r.*, 
        o.total_amount as order_amount,
        a.name as processed_by_name
       FROM refunds r
       JOIN orders o ON r.order_id = o.id
       LEFT JOIN users a ON r.processed_by = a.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [userId]
    );
    return rows;
  }

  // Create refund request
  static async create(data: {
    user_id: number;
    order_id: number;
    amount: number;
    reason: string;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO refunds (user_id, order_id, amount, reason, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [
        data.user_id,
        data.order_id,
        data.amount,
        data.reason,
      ]
    );
    return result.insertId;
  }

  // Update refund status
  static async updateStatus(
    id: number,
    status: string,
    processedBy: number,
    adminNote?: string
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE refunds 
       SET status = ?, processed_by = ?, processed_at = NOW(), admin_notes = ?
       WHERE id = ?`,
      [status, processedBy, adminNote, id]
    );
    return result.affectedRows > 0;
  }

  // Check if refund exists for order
  static async existsForOrder(orderId: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM refunds WHERE order_id = ? AND status IN ('pending', 'approved')",
      [orderId]
    );
    return rows.length > 0;
  }

  // Get refund statistics
  static async getStatistics(): Promise<any> {
    const [stats] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        COALESCE(COUNT(*), 0) as total_requests,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_requests,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) as approved_requests,
        COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) as rejected_requests,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed_requests,
        COALESCE(SUM(CASE WHEN status = 'approved' OR status = 'completed' THEN amount ELSE 0 END), 0) as total_refunded_amount
       FROM refunds`
    );
    return stats[0];
  }
}
