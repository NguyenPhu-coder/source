import { Request, Response } from "express";
import db from "../config/db.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const notificationController = {
  // Get user notifications
  async getNotifications(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const unreadOnly = req.query.unread === "true";

      let query = `
        SELECT * FROM notifications 
        WHERE user_id = ?
      `;

      if (unreadOnly) {
        query += " AND is_read = FALSE";
      }

      query += " ORDER BY created_at DESC LIMIT ?";

      const [notifications] = await db.query(query, [userId, limit]);

      res.json(successResponse(notifications));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Mark notification as read
  async markAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      await db.query(
        "UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?",
        [id, userId]
      );

      res.json(successResponse(null, "Notification marked as read"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Mark all notifications as read
  async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;

      await db.query(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE",
        [userId]
      );

      res.json(successResponse(null, "All notifications marked as read"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Get unread count
  async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;

      const [result]: any = await db.query(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE",
        [userId]
      );

      res.json(successResponse({ count: result[0].count }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Delete notification
  async deleteNotification(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { id } = req.params;

      await db.query("DELETE FROM notifications WHERE id = ? AND user_id = ?", [
        id,
        userId,
      ]);

      res.json(successResponse(null, "Notification deleted"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Create notification (internal use)
  async createNotification(
    userId: number,
    type: string,
    title: string,
    message: string,
    referenceId?: number
  ) {
    try {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, reference_id) 
         VALUES (?, ?, ?, ?, ?)`,
        [userId, type, title, message, referenceId || null]
      );
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  },
};


