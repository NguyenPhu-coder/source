import { Request, Response } from "express";
import db from "../config/db.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { notificationController } from "./notificationController.js";

export const contactController = {
  // Submit contact form
  async submitContact(req: Request, res: Response) {
    try {
      const { name, email, subject, message } = req.body;

      // Validate input
      if (!name || !email || !subject || !message) {
        return res
          .status(400)
          .json(errorResponse("All fields are required", 400));
      }

      // Save contact message to database
      const [result]: any = await db.query(
        `INSERT INTO contact_messages (name, email, subject, message, status) 
         VALUES (?, ?, ?, ?, 'pending')`,
        [name, email, subject, message]
      );

      // Notify admins about new contact message
      const [admins]: any = await db.query(
        "SELECT id FROM users WHERE role = 'admin'"
      );

      for (const admin of admins) {
        await notificationController.createNotification(
          admin.id,
          "course_update",
          "Tin nhắn liên hệ mới",
          `${name} đã gửi tin nhắn liên hệ: ${subject}`,
          result.insertId
        );
      }

      res.json(
        successResponse(
          { id: result.insertId },
          "Message sent successfully. We'll get back to you soon!"
        )
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Get all contact messages (Admin only)
  async getAllMessages(req: Request, res: Response) {
    try {
      const status = req.query.status as string;
      let query = "SELECT * FROM contact_messages";
      const params: any[] = [];

      if (status) {
        query += " WHERE status = ?";
        params.push(status);
      }

      query += " ORDER BY created_at DESC";

      const [messages] = await db.query(query, params);

      res.json(successResponse(messages));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Update message status (Admin only)
  async updateMessageStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!["pending", "in_progress", "resolved"].includes(status)) {
        return res.status(400).json(errorResponse("Invalid status", 400));
      }

      await db.query("UPDATE contact_messages SET status = ? WHERE id = ?", [
        status,
        id,
      ]);

      res.json(successResponse(null, "Status updated successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Delete contact message (Admin only)
  async deleteMessage(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await db.query("DELETE FROM contact_messages WHERE id = ?", [id]);

      res.json(successResponse(null, "Message deleted successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },
};


