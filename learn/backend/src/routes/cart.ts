import express from "express";
import { authenticate } from "../middleware/auth.js";
import pool from "../config/db.js";

const router = express.Router();

// Get user's cart
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const [rows] = await pool.query(
      `SELECT 
        c.id,
        c.course_id,
        co.title_en,
        co.title_vi,
        co.thumbnail,
        co.price,
        u.name as instructor_name
      FROM cart c
      JOIN courses co ON c.course_id = co.id
      JOIN users u ON co.instructor_id = u.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Add to cart
router.post("/", authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { courseId, course_id } = req.body;
    const finalCourseId = courseId || course_id;

    console.log(
      `🛒 Add to cart request - User: ${userId}, Course: ${finalCourseId}`
    );

    if (!finalCourseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
      });
    }

    // Check if already in cart
    const [existing] = await pool.query(
      "SELECT * FROM cart WHERE user_id = ? AND course_id = ?",
      [userId, finalCourseId]
    );

    if ((existing as any[]).length > 0) {
      console.log(
        `⚠️  Course ${finalCourseId} already in cart for user ${userId}`
      );
      return res.status(400).json({
        success: false,
        message: "Course already in cart",
      });
    }

    // Check if already enrolled
    const [enrolled] = await pool.query(
      "SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?",
      [userId, finalCourseId]
    );

    if ((enrolled as any[]).length > 0) {
      console.log(
        `⚠️  User ${userId} already enrolled in course ${finalCourseId}`
      );
      return res.status(400).json({
        success: false,
        message: "Already enrolled in this course",
      });
    }

    await pool.query("INSERT INTO cart (user_id, course_id) VALUES (?, ?)", [
      userId,
      finalCourseId,
    ]);

    console.log(`✅ Added course ${finalCourseId} to cart for user ${userId}`);

    res.json({
      success: true,
      message: "Added to cart",
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Remove from cart
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    await pool.query("DELETE FROM cart WHERE id = ? AND user_id = ?", [
      id,
      userId,
    ]);

    res.json({
      success: true,
      message: "Removed from cart",
    });
  } catch (error) {
    console.error("Error removing from cart:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Clear cart
router.delete("/", authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    await pool.query("DELETE FROM cart WHERE user_id = ?", [userId]);

    res.json({
      success: true,
      message: "Cart cleared",
    });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

export default router;
