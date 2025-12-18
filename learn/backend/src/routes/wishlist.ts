import express from "express";
import { authenticate } from "../middleware/auth.js";
import pool from "../config/db.js";
import logger from "../services/logger.js";

const router = express.Router();

// Add course to wishlist
router.post("/", authenticate, async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { courseId } = req.body;

        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: "Course ID is required",
            });
        }

        // Check if course exists
        const [courses] = await connection.query(
            "SELECT id, title_en FROM courses WHERE id = ?",
            [courseId]
        );

        if (courses.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            });
        }

        // Check if already in wishlist
        const [existing] = await connection.query(
            "SELECT id FROM wishlists WHERE user_id = ? AND course_id = ?",
            [userId, courseId]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Course already in wishlist",
            });
        }

        // Check if already enrolled
        const [enrolled] = await connection.query(
            "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?",
            [userId, courseId]
        );

        if (enrolled.length > 0) {
            return res.status(400).json({
                success: false,
                message: "You are already enrolled in this course",
            });
        }

        // Add to wishlist
        await connection.query(
            "INSERT INTO wishlists (user_id, course_id) VALUES (?, ?)",
            [userId, courseId]
        );

        // Get wishlist count
        const [countResult] = await connection.query(
            "SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?",
            [userId]
        );

        logger.info(`User ${userId} added course ${courseId} to wishlist`);

        res.status(201).json({
            success: true,
            message: "Course added to wishlist",
            wishlistCount: countResult[0].count,
        });
    } catch (error) {
        logger.error("Error adding to wishlist:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add course to wishlist",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Remove course from wishlist
router.delete("/:courseId", authenticate, async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { courseId } = req.params;

        const [result] = await connection.query(
            "DELETE FROM wishlists WHERE user_id = ? AND course_id = ?",
            [userId, courseId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Course not found in wishlist",
            });
        }

        // Get updated wishlist count
        const [countResult] = await connection.query(
            "SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?",
            [userId]
        );

        logger.info(`User ${userId} removed course ${courseId} from wishlist`);

        res.json({
            success: true,
            message: "Course removed from wishlist",
            wishlistCount: countResult[0].count,
        });
    } catch (error) {
        logger.error("Error removing from wishlist:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove course from wishlist",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Get user's wishlist
router.get("/", authenticate, async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;

        const [wishlistItems] = await connection.query(
            `SELECT 
        w.id as wishlist_id,
        w.added_at,
        c.id as course_id,
        c.title_en as title,
        c.title_vi,
        c.description_en as description,
        c.thumbnail,
        c.price,
        c.rating,
        c.total_students,
        c.total_lessons,
        c.level,
        c.duration,
        u.id as instructor_id,
        u.name as instructor_name,
        u.avatar as instructor_avatar,
        cat.id as category_id,
        cat.name_en as category_name,
        cat.name_vi as category_name_vi
      FROM wishlists w
      JOIN courses c ON w.course_id = c.id
      JOIN users u ON c.instructor_id = u.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE w.user_id = ?
      ORDER BY w.added_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            courses: wishlistItems,
            total: wishlistItems.length,
        });
    } catch (error) {
        logger.error("Error getting wishlist:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get wishlist",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Check if course is in wishlist
router.get("/check/:courseId", authenticate, async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;
        const { courseId } = req.params;

        const [result] = await connection.query(
            "SELECT id FROM wishlists WHERE user_id = ? AND course_id = ?",
            [userId, courseId]
        );

        res.json({
            success: true,
            inWishlist: result.length > 0,
        });
    } catch (error) {
        logger.error("Error checking wishlist:", error);
        res.status(500).json({
            success: false,
            message: "Failed to check wishlist",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

// Get wishlist count
router.get("/count", authenticate, async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const userId = req.user?.id;

        const [result] = await connection.query(
            "SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?",
            [userId]
        );

        res.json({
            success: true,
            count: result[0].count,
        });
    } catch (error) {
        logger.error("Error getting wishlist count:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get wishlist count",
            error: error.message,
        });
    } finally {
        connection.release();
    }
});

export default router;
