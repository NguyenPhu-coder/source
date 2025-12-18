import express from "express";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import pool from "../config/db.js";
import logger from "../services/logger.js";

const router = express.Router();

// Create note for a lesson
router.post("/lessons/:lessonId/notes", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { lessonId } = req.params;
        const { content, timestamp, is_public } = req.body;

        if (!content || content.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Note content is required",
            });
        }

        // Get course_id from lesson
        const [lessons] = await connection.query(
            "SELECT course_id FROM lessons WHERE id = ?",
            [lessonId]
        );

        if (lessons.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Lesson not found",
            });
        }

        const courseId = lessons[0].course_id;

        // Check if user is enrolled
        const [enrollments] = await connection.query(
            "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?",
            [userId, courseId]
        );

        if (enrollments.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You must be enrolled in this course to create notes",
            });
        }

        // Create note
        const [result] = await connection.query(
            `INSERT INTO lesson_notes 
            (user_id, lesson_id, course_id, content, timestamp, is_public) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, lessonId, courseId, content, timestamp || null, is_public || false]
        );

        logger.info(`User ${userId} created note for lesson ${lessonId}`);

        res.status(201).json({
            success: true,
            message: "Note created successfully",
            noteId: result.insertId,
        });
    } catch (error) {
        logger.error("Error creating note:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create note",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Get all notes for a lesson
router.get("/lessons/:lessonId/notes", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { lessonId } = req.params;

        const [notes] = await connection.query(
            `SELECT 
                id,
                content,
                timestamp,
                is_public,
                created_at,
                updated_at
            FROM lesson_notes
            WHERE lesson_id = ? AND user_id = ?
            ORDER BY timestamp ASC, created_at ASC`,
            [lessonId, userId]
        );

        res.json({
            success: true,
            notes,
            total: notes.length,
        });
    } catch (error) {
        logger.error("Error getting notes:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get notes",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Get all notes for a course
router.get("/courses/:courseId/notes", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { courseId } = req.params;

        const [notes] = await connection.query(
            `SELECT 
                n.id,
                n.content,
                n.timestamp,
                n.is_public,
                n.created_at,
                n.updated_at,
                n.lesson_id,
                l.title_en as lesson_title,
                l.order_index as lesson_order
            FROM lesson_notes n
            JOIN lessons l ON n.lesson_id = l.id
            WHERE n.course_id = ? AND n.user_id = ?
            ORDER BY l.order_index ASC, n.timestamp ASC, n.created_at ASC`,
            [courseId, userId]
        );

        res.json({
            success: true,
            notes,
            total: notes.length,
        });
    } catch (error) {
        logger.error("Error getting course notes:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get course notes",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Update a note
router.put("/notes/:noteId", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { noteId } = req.params;
        const { content, timestamp, is_public } = req.body;

        if (!content || content.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Note content is required",
            });
        }

        // Check if note belongs to user
        const [notes] = await connection.query(
            "SELECT id FROM lesson_notes WHERE id = ? AND user_id = ?",
            [noteId, userId]
        );

        if (notes.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Note not found or you don't have permission to edit it",
            });
        }

        // Update note
        await connection.query(
            `UPDATE lesson_notes 
            SET content = ?, timestamp = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?`,
            [content, timestamp !== undefined ? timestamp : null, is_public, noteId, userId]
        );

        logger.info(`User ${userId} updated note ${noteId}`);

        res.json({
            success: true,
            message: "Note updated successfully",
        });
    } catch (error) {
        logger.error("Error updating note:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update note",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Delete a note
router.delete("/notes/:noteId", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { noteId } = req.params;

        const [result] = await connection.query(
            "DELETE FROM lesson_notes WHERE id = ? AND user_id = ?",
            [noteId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Note not found or you don't have permission to delete it",
            });
        }

        logger.info(`User ${userId} deleted note ${noteId}`);

        res.json({
            success: true,
            message: "Note deleted successfully",
        });
    } catch (error) {
        logger.error("Error deleting note:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete note",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Search notes
router.get("/courses/:courseId/notes/search", authenticate, async (req: AuthRequest, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { courseId } = req.params;
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                message: "Search query is required",
            });
        }

        const [notes] = await connection.query(
            `SELECT 
                n.id,
                n.content,
                n.timestamp,
                n.created_at,
                n.lesson_id,
                l.title_en as lesson_title
            FROM lesson_notes n
            JOIN lessons l ON n.lesson_id = l.id
            WHERE n.course_id = ? AND n.user_id = ? AND n.content LIKE ?
            ORDER BY n.created_at DESC`,
            [courseId, userId, `%${q}%`]
        );

        res.json({
            success: true,
            notes,
            total: notes.length,
        });
    } catch (error) {
        logger.error("Error searching notes:", error);
        res.status(500).json({
            success: false,
            message: "Failed to search notes",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

export default router;
