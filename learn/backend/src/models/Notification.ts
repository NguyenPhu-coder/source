import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface NotificationData extends RowDataPacket {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  related_id?: number;
  related_type?: string;
  created_at?: Date;
  read_at?: Date;
}

export class Notification {
  // Get notification by ID
  static async findById(id: number): Promise<NotificationData | null> {
    const [rows] = await pool.execute<NotificationData[]>(
      "SELECT * FROM notifications WHERE id = ?",
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get notifications by user
  static async findByUserId(
    userId: number,
    limit: number = 20
  ): Promise<NotificationData[]> {
    const [rows] = await pool.execute<NotificationData[]>(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
      [userId, limit]
    );
    return rows;
  }

  // Get unread notifications
  static async findUnreadByUserId(userId: number): Promise<NotificationData[]> {
    const [rows] = await pool.execute<NotificationData[]>(
      "SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC",
      [userId]
    );
    return rows;
  }

  // Count unread notifications
  static async countUnreadByUserId(userId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
      [userId]
    );
    return rows[0].count;
  }

  // Create notification
  static async create(data: {
    user_id: number;
    title: string;
    message: string;
    type: string;
    related_id?: number;
    related_type?: string;
  }): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.user_id,
        data.title,
        data.message,
        data.type,
        data.related_id,
        data.related_type,
      ]
    );
    return result.insertId;
  }

  // Mark as read
  static async markAsRead(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Mark all as read for user
  static async markAllAsReadByUserId(userId: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0",
      [userId]
    );
    return result.affectedRows > 0;
  }

  // Delete notification
  static async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM notifications WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Delete old read notifications
  static async deleteOldReadNotifications(days: number = 30): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM notifications WHERE is_read = 1 AND read_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
      [days]
    );
    return result.affectedRows;
  }

  // Create notification for multiple users
  static async createForMultipleUsers(
    userIds: number[],
    data: {
      title: string;
      message: string;
      type: string;
      related_id?: number;
      related_type?: string;
    }
  ): Promise<number> {
    if (userIds.length === 0) return 0;

    const values = userIds.map((userId) => [
      userId,
      data.title,
      data.message,
      data.type,
      data.related_id,
      data.related_type,
    ]);

    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
    const flatValues = values.flat();

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
       VALUES ${placeholders}`,
      flatValues
    );

    return result.affectedRows;
  }
}
