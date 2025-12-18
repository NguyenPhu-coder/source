import { Request, Response } from "express";
import pool from "../config/db.js";
import {
  successResponse,
  errorResponse,
  paginationResponse,
} from "../utils/response.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { Refund } from "../models/Refund.js";
import os from "os";

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

export const adminController = {
  // Get all users with pagination and filters
  async getAllUsers(req: any, res: Response) {
    try {
      console.log("📋 Admin getAllUsers called by:", req.user?.email);
      const { page = 1, limit = 10, role, search } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      let query =
        "SELECT id, name, email, role, created_at FROM users WHERE 1=1";
      const params: any[] = [];

      if (role) {
        query += " AND role = ?";
        params.push(role);
      }

      if (search) {
        query += " AND (name LIKE ? OR email LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ` ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

      const [users] = await pool.execute<RowDataPacket[]>(query, params);

      // Get total count
      let countQuery = "SELECT COUNT(*) as total FROM users WHERE 1=1";
      const countParams: any[] = [];

      if (role) {
        countQuery += " AND role = ?";
        countParams.push(role);
      }

      if (search) {
        countQuery += " AND (name LIKE ? OR email LIKE ?)";
        countParams.push(`%${search}%`, `%${search}%`);
      }

      const [countResult] = await pool.execute<RowDataPacket[]>(
        countQuery,
        countParams
      );
      const total = countResult[0].total;

      res.json(
        successResponse({
          users,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        })
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Get user by ID
  async getUserById(req: any, res: Response) {
    try {
      const { id } = req.params;

      const [users] = await pool.execute<RowDataPacket[]>(
        "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
        [id]
      );

      if (users.length === 0) {
        return res.status(404).json(errorResponse("User not found", 404));
      }

      res.json(successResponse(users[0]));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Update user role
  async updateUserRole(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!["student", "instructor", "admin"].includes(role)) {
        return res.status(400).json(errorResponse("Invalid role", 400));
      }

      await pool.execute("UPDATE users SET role = ? WHERE id = ?", [role, id]);

      res.json(successResponse({ message: "User role updated successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Delete user
  async deleteUser(req: any, res: Response) {
    try {
      const { id } = req.params;

      // Don't allow deleting yourself
      if (req.user.id === Number(id)) {
        return res
          .status(400)
          .json(errorResponse("Cannot delete your own account", 400));
      }

      await pool.execute("DELETE FROM users WHERE id = ?", [id]);

      res.json(successResponse({ message: "User deleted successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Get all courses with pagination
  async getAllCourses(req: any, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        category_id,
        is_published,
        search,
      } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT c.*, 
               u.name as instructor_name,
               cat.name_en as category_name,
               COUNT(DISTINCT e.id) as total_enrollments
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.id
        LEFT JOIN categories cat ON c.category_id = cat.id
        LEFT JOIN enrollments e ON c.id = e.course_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (category_id) {
        query += " AND c.category_id = ?";
        params.push(category_id);
      }

      if (is_published !== undefined) {
        query += " AND c.is_published = ?";
        params.push(is_published === "true" ? 1 : 0);
      }

      if (search) {
        query += " AND (c.title_en LIKE ? OR c.title_vi LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ` GROUP BY c.id ORDER BY c.created_at DESC LIMIT ${Number(limit)} OFFSET ${offset}`;

      const [courses] = await pool.execute<RowDataPacket[]>(query, params);

      // Get total count
      let countQuery = "SELECT COUNT(*) as total FROM courses WHERE 1=1";
      const countParams: any[] = [];

      if (category_id) {
        countQuery += " AND category_id = ?";
        countParams.push(category_id);
      }

      if (is_published !== undefined) {
        countQuery += " AND is_published = ?";
        countParams.push(is_published === "true" ? 1 : 0);
      }

      if (search) {
        countQuery += " AND (title_en LIKE ? OR title_vi LIKE ?)";
        countParams.push(`%${search}%`, `%${search}%`);
      }

      const [countResult] = await pool.execute<RowDataPacket[]>(
        countQuery,
        countParams
      );
      const total = countResult[0].total;

      res.json(
        successResponse({
          courses,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        })
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Toggle course publish status
  async toggleCoursePublish(req: any, res: Response) {
    try {
      const { id } = req.params;

      await pool.execute(
        "UPDATE courses SET is_published = NOT is_published WHERE id = ?",
        [id]
      );

      res.json(successResponse({ message: "Course publish status updated" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Delete course
  async deleteCourse(req: any, res: Response) {
    try {
      const { id } = req.params;

      await pool.execute("DELETE FROM courses WHERE id = ?", [id]);

      res.json(successResponse({ message: "Course deleted successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Get admin statistics
  async getStatistics(req: any, res: Response) {
    try {
      // Total users by role
      const [usersStats] = await pool.execute<RowDataPacket[]>(
        "SELECT role, COUNT(*) as count FROM users GROUP BY role"
      );

      // Total courses
      const [coursesStats] = await pool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) as total_courses, SUM(is_published) as published_courses FROM courses"
      );

      // Total enrollments
      const [enrollmentsStats] = await pool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) as total_enrollments, SUM(completed) as completed_enrollments FROM enrollments"
      );

      // Recent users (last 30 days)
      const [recentUsers] = await pool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
      );

      // Top courses by enrollment
      const [topCourses] = await pool.execute<RowDataPacket[]>(
        `SELECT c.id, c.title_en, COUNT(e.id) as enrollments, c.rating
         FROM courses c
         LEFT JOIN enrollments e ON c.id = e.course_id
         GROUP BY c.id
         ORDER BY enrollments DESC
         LIMIT 5`
      );

      // Growth data (last 7 days)
      const [growthData] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          DATE(created_at) as date,
          COUNT(*) as users
         FROM users
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         GROUP BY DATE(created_at)
         ORDER BY date ASC`
      );

      res.json(
        successResponse({
          users: usersStats,
          courses: coursesStats[0],
          enrollments: enrollmentsStats[0],
          recentUsers: recentUsers[0].count,
          topCourses,
          growthData,
        })
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Lessons Management
  async getAllLessons(req: any, res: Response) {
    try {
      const { page = 1, limit = 10, course_id, search } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT l.*, c.title_en as course_title
        FROM lessons l
        LEFT JOIN courses c ON l.course_id = c.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (course_id) {
        query += " AND l.course_id = ?";
        params.push(course_id);
      }

      if (search) {
        query += " AND l.title LIKE ?";
        params.push(`%${search}%`);
      }

      query += ` ORDER BY l.course_id, l.order_index LIMIT ${Number(limit)} OFFSET ${offset}`;

      const [lessons] = await pool.execute<RowDataPacket[]>(query, params);

      // Get total count
      let countQuery = "SELECT COUNT(*) as total FROM lessons WHERE 1=1";
      const countParams: any[] = [];
      if (course_id) {
        countQuery += " AND course_id = ?";
        countParams.push(course_id);
      }
      if (search) {
        countQuery += " AND title LIKE ?";
        countParams.push(`%${search}%`);
      }

      const [countResult] = await pool.execute<RowDataPacket[]>(
        countQuery,
        countParams
      );
      const total = countResult[0].total;

      res.json({
        success: true,
        data: lessons,
        total,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async createLesson(req: any, res: Response) {
    try {
      const { course_id, title, content, video_url, duration, order_index } =
        req.body;

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO lessons (course_id, title_en, video_url, duration, order_index)
         VALUES (?, ?, ?, ?, ?)`,
        [course_id, title, video_url || null, duration, order_index || 0]
      );

      res.status(201).json(
        successResponse({
          message: "Lesson created successfully",
          lesson_id: result.insertId,
        })
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async updateLesson(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { title, video_url, duration, order_index } = req.body;

      await pool.execute(
        `UPDATE lessons SET title_en = ?, video_url = ?, duration = ?, order_index = ?
         WHERE id = ?`,
        [title, video_url || null, duration, order_index || 0, id]
      );

      res.json(successResponse({ message: "Lesson updated successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async deleteLesson(req: any, res: Response) {
    try {
      const { id } = req.params;

      await pool.execute("DELETE FROM lessons WHERE id = ?", [id]);

      res.json(successResponse({ message: "Lesson deleted successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Categories Management
  async getAllCategories(req: any, res: Response) {
    try {
      const { search } = req.query;

      let query = `
        SELECT c.*, COUNT(co.id) as course_count
        FROM categories c
        LEFT JOIN courses co ON c.id = co.category_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (search) {
        query += " AND (c.name_en LIKE ? OR c.name_vi LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }

      query += " GROUP BY c.id ORDER BY c.created_at DESC";

      const [categories] = await pool.execute<RowDataPacket[]>(query, params);

      res.json(successResponse({ categories }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async createCategory(req: any, res: Response) {
    try {
      const { name_en, name_vi } = req.body;

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO categories (name_en, name_vi)
         VALUES (?, ?)`,
        [name_en, name_vi]
      );

      res.status(201).json(
        successResponse({
          message: "Category created successfully",
          category_id: result.insertId,
        })
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async updateCategory(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { name_en, name_vi } = req.body;

      await pool.execute(
        `UPDATE categories SET name_en = ?, name_vi = ?
         WHERE id = ?`,
        [name_en, name_vi, id]
      );

      res.json(successResponse({ message: "Category updated successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async deleteCategory(req: any, res: Response) {
    try {
      const { id } = req.params;

      // Check if category has courses
      const [courses] = await pool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM courses WHERE category_id = ?",
        [id]
      );

      if (courses[0].count > 0) {
        return res
          .status(400)
          .json(
            errorResponse("Cannot delete category with existing courses", 400)
          );
      }

      await pool.execute("DELETE FROM categories WHERE id = ?", [id]);

      res.json(successResponse({ message: "Category deleted successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Enrollments Management
  async getAllEnrollments(req: any, res: Response) {
    try {
      const { page = 1, limit = 10, course_id, search } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      let query = `
        SELECT 
          e.id as enrollment_id,
          e.user_id,
          u.name as user_name,
          u.email as user_email,
          e.course_id,
          c.title_en as course_title,
          c.title_vi as course_title_vi,
          e.enrolled_at,
          e.progress,
          e.completed,
          c.total_lessons,
          COALESCE(
            (SELECT COUNT(*) FROM lesson_progress lp 
             JOIN lessons l ON lp.lesson_id = l.id 
             WHERE lp.user_id = e.user_id AND l.course_id = e.course_id AND lp.completed = TRUE),
            0
          ) as completed_lessons
        FROM enrollments e
        JOIN users u ON e.user_id = u.id
        JOIN courses c ON e.course_id = c.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (course_id) {
        query += " AND e.course_id = ?";
        params.push(Number(course_id));
      }

      if (search) {
        query += " AND (u.name LIKE ? OR u.email LIKE ? OR c.title_en LIKE ?)";
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += ` ORDER BY e.enrolled_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

      const [enrollments] = await pool.execute<RowDataPacket[]>(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total FROM enrollments e
        JOIN users u ON e.user_id = u.id
        JOIN courses c ON e.course_id = c.id
        WHERE 1=1
      `;
      const countParams: any[] = [];
      if (course_id) {
        countQuery += " AND e.course_id = ?";
        countParams.push(course_id);
      }
      if (search) {
        countQuery +=
          " AND (u.name LIKE ? OR u.email LIKE ? OR c.title_en LIKE ?)";
        countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      const [countResult] = await pool.execute<RowDataPacket[]>(
        countQuery,
        countParams
      );
      const total = countResult[0].total;

      res.json(
        successResponse({
          enrollments,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        })
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Reviews Management
  async getAllReviews(req: any, res: Response) {
    try {
      const { page = 1, limit = 10, search } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT 
          r.id,
          r.user_id,
          u.name as user_name,
          u.email as user_email,
          r.course_id,
          c.title_en as course_title,
          r.rating,
          r.comment,
          r.created_at
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        JOIN courses c ON r.course_id = c.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (search) {
        query +=
          " AND (u.name LIKE ? OR c.title_en LIKE ? OR r.comment LIKE ?)";
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += ` ORDER BY r.created_at DESC LIMIT ${Number(limit)} OFFSET ${offset}`;

      const [reviews] = await pool.execute<RowDataPacket[]>(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total FROM reviews r
        JOIN users u ON r.user_id = u.id
        JOIN courses c ON r.course_id = c.id
        WHERE 1=1
      `;
      const countParams: any[] = [];
      if (search) {
        countQuery +=
          " AND (u.name LIKE ? OR c.title_en LIKE ? OR r.comment LIKE ?)";
        countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      const [countResult] = await pool.execute<RowDataPacket[]>(
        countQuery,
        countParams
      );
      const total = countResult[0].total;

      res.json({
        success: true,
        data: reviews,
        total,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async deleteReview(req: any, res: Response) {
    try {
      const { id } = req.params;

      await pool.execute("DELETE FROM reviews WHERE id = ?", [id]);

      res.json(successResponse({ message: "Review deleted successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async createQuizQuestion(req: any, res: Response) {
    try {
      const {
        quiz_id,
        question_text,
        question_type,
        options,
        correct_answer,
        points,
        explanation,
      } = req.body;

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO quiz_questions 
        (quiz_id, question_text, question_type, options, correct_answer, points, explanation) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          quiz_id,
          question_text,
          question_type,
          options,
          correct_answer,
          points,
          explanation || null,
        ]
      );

      res.json(
        successResponse(
          { id: result.insertId },
          "Quiz question created successfully"
        )
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async getLessonById(req: any, res: Response) {
    try {
      const { id } = req.params;

      const [lessons] = await pool.execute<RowDataPacket[]>(
        "SELECT * FROM lessons WHERE id = ?",
        [id]
      );

      if (lessons.length === 0) {
        return res.status(404).json(errorResponse("Lesson not found", 404));
      }

      res.json(successResponse(lessons[0]));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Course Approval Management
  async getPendingCourses(req: any, res: Response) {
    try {
      console.log("📋 getPendingCourses called");
      const { page = 1, limit = 10 } = req.query;
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 10;
      const offset = (pageNum - 1) * limitNum;

      const [courses] = await pool.execute<RowDataPacket[]>(
        `SELECT c.*, 
          u.name as instructor_name,
          u.email as instructor_email,
          cat.name_en as category_name
         FROM courses c
         LEFT JOIN users u ON c.instructor_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         WHERE c.approval_status = 'pending' OR c.approval_status IS NULL
         ORDER BY c.created_at DESC
         LIMIT ${limitNum} OFFSET ${offset}`
      );

      console.log("📋 Found pending courses:", courses.length);

      const [countResult] = await pool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) as total FROM courses WHERE approval_status = 'pending' OR approval_status IS NULL"
      );

      res.json(
        successResponse({
          courses,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: countResult[0].total,
            totalPages: Math.ceil(countResult[0].total / Number(limit)),
          },
        })
      );
    } catch (error: any) {
      console.error("❌ getPendingCourses error:", error.message);
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async approveCourse(req: any, res: Response) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      await pool.execute(
        `UPDATE courses 
         SET approval_status = 'approved', 
             approved_by = ?, 
             approved_at = NOW(),
             is_published = TRUE
         WHERE id = ?`,
        [adminId, id]
      );

      res.json(successResponse({ message: "Course approved successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async rejectCourse(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      if (!reason) {
        return res
          .status(400)
          .json(errorResponse("Rejection reason is required", 400));
      }

      await pool.execute(
        `UPDATE courses 
         SET approval_status = 'rejected', 
             approved_by = ?, 
             approved_at = NOW(),
             rejection_reason = ?,
             is_published = FALSE
         WHERE id = ?`,
        [adminId, reason, id]
      );

      res.json(successResponse({ message: "Course rejected successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Enrollment Management
  async createEnrollment(req: any, res: Response) {
    try {
      const { user_id, course_id } = req.body;

      // Check if enrollment already exists
      const [existing] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?",
        [user_id, course_id]
      );

      if (existing.length > 0) {
        return res
          .status(400)
          .json(errorResponse("User already enrolled in this course", 400));
      }

      // Check if course exists
      const [courses] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM courses WHERE id = ?",
        [course_id]
      );

      if (courses.length === 0) {
        return res.status(404).json(errorResponse("Course not found", 404));
      }

      await pool.execute(
        "INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)",
        [user_id, course_id]
      );

      res
        .status(201)
        .json(successResponse({ message: "Enrollment created successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async deleteEnrollment(req: any, res: Response) {
    try {
      const { id } = req.params;

      // Check if refund request exists
      const [refunds] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM refunds WHERE enrollment_id = ? AND status IN ('pending', 'approved')",
        [id]
      );

      if (refunds.length > 0) {
        return res
          .status(400)
          .json(
            errorResponse(
              "Cannot delete enrollment with pending/approved refund request",
              400
            )
          );
      }

      await pool.execute("DELETE FROM enrollments WHERE id = ?", [id]);

      res.json(successResponse({ message: "Enrollment deleted successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Refund Management
  async getAllRefunds(req: any, res: Response) {
    try {
      const { page = 1, limit = 10, status, user_id } = req.query;

      const result = await Refund.findAll({
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        user_id: user_id ? Number(user_id) : undefined,
      });

      res.json(
        successResponse({
          refunds: result.refunds,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: result.total,
            totalPages: Math.ceil(result.total / Number(limit)),
          },
        })
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async getRefundById(req: any, res: Response) {
    try {
      const { id } = req.params;
      const refund = await Refund.findById(Number(id));

      if (!refund) {
        return res
          .status(404)
          .json(errorResponse("Refund request not found", 404));
      }

      res.json(successResponse(refund));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async approveRefund(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { admin_note } = req.body;
      const adminId = req.user.id;

      const refund = await Refund.findById(Number(id));
      if (!refund) {
        return res
          .status(404)
          .json(errorResponse("Refund request not found", 404));
      }

      if (refund.status !== "pending") {
        return res
          .status(400)
          .json(errorResponse("Only pending refunds can be approved", 400));
      }

      await Refund.updateStatus(Number(id), "approved", adminId, admin_note);

      // Update order status to refunded
      await pool.execute(
        "UPDATE orders SET payment_status = 'refunded' WHERE id = ?",
        [refund.order_id]
      );

      res.json(successResponse({ message: "Refund approved successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async rejectRefund(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { admin_note } = req.body;
      const adminId = req.user.id;

      if (!admin_note) {
        return res
          .status(400)
          .json(errorResponse("Admin note is required for rejection", 400));
      }

      const refund = await Refund.findById(Number(id));
      if (!refund) {
        return res
          .status(404)
          .json(errorResponse("Refund request not found", 404));
      }

      if (refund.status !== "pending") {
        return res
          .status(400)
          .json(errorResponse("Only pending refunds can be rejected", 400));
      }

      await Refund.updateStatus(Number(id), "rejected", adminId, admin_note);

      res.json(successResponse({ message: "Refund rejected successfully" }));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async completeRefund(req: any, res: Response) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const refund = await Refund.findById(Number(id));
      if (!refund) {
        return res
          .status(404)
          .json(errorResponse("Refund request not found", 404));
      }

      if (refund.status !== "approved") {
        return res
          .status(400)
          .json(errorResponse("Only approved refunds can be completed", 400));
      }

      await Refund.updateStatus(Number(id), "completed", adminId);

      // Delete the enrollment
      await pool.execute("DELETE FROM enrollments WHERE id = ?", [
        refund.enrollment_id,
      ]);

      res.json(
        successResponse({ message: "Refund completed and enrollment removed" })
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async getRefundStatistics(req: any, res: Response) {
    try {
      const stats = await Refund.getStatistics();
      res.json(successResponse(stats));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Server Resource Management
  async getServerResources(req: any, res: Response) {
    try {
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      const cpus = os.cpus();
      const cpuCount = cpus.length;

      // Calculate CPU usage
      let totalIdle = 0;
      let totalTick = 0;
      cpus.forEach((cpu) => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });
      const cpuUsagePercent = 100 - (totalIdle / totalTick) * 100;

      const uptime = os.uptime();
      const loadAverage = os.loadavg();

      // Get database size
      const [dbSize] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          SUM(data_length + index_length) / 1024 / 1024 AS size_mb
         FROM information_schema.tables
         WHERE table_schema = DATABASE()`
      );

      // Get table counts
      const [tableCounts] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          'users' as table_name, COUNT(*) as count FROM users
         UNION ALL
         SELECT 'courses', COUNT(*) FROM courses
         UNION ALL
         SELECT 'enrollments', COUNT(*) FROM enrollments
         UNION ALL
         SELECT 'orders', COUNT(*) FROM orders
         UNION ALL
         SELECT 'lessons', COUNT(*) FROM lessons`
      );

      res.json(
        successResponse({
          server: {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            uptime: uptime,
            uptimeFormatted: formatUptime(uptime),
          },
          cpu: {
            count: cpuCount,
            model: cpus[0].model,
            speed: cpus[0].speed,
            usage: cpuUsagePercent.toFixed(2),
            loadAverage: loadAverage,
          },
          memory: {
            total: totalMemory,
            used: usedMemory,
            free: freeMemory,
            usagePercent: memoryUsagePercent.toFixed(2),
            totalGB: (totalMemory / 1024 / 1024 / 1024).toFixed(2),
            usedGB: (usedMemory / 1024 / 1024 / 1024).toFixed(2),
            freeGB: (freeMemory / 1024 / 1024 / 1024).toFixed(2),
          },
          database: {
            sizeMB: dbSize[0].size_mb
              ? parseFloat(dbSize[0].size_mb).toFixed(2)
              : 0,
            tables: tableCounts,
          },
        })
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  // Orders Management
  async getAllOrders(req: any, res: Response) {
    try {
      const { status } = req.query;

      let query = `
        SELECT 
          o.id,
          o.user_id,
          u.name as user_name,
          u.email as user_email,
          o.total_amount,
          o.payment_method,
          o.payment_status,
          o.created_at,
          COUNT(DISTINCT oi.id) as items_count
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE 1=1
      `;

      const params: any[] = [];
      if (status) {
        query += " AND o.payment_status = ?";
        params.push(status);
      }

      query += " GROUP BY o.id ORDER BY o.created_at DESC";

      const [orders] = await pool.execute<RowDataPacket[]>(query, params);
      res.json(paginationResponse(orders, 1, orders.length, orders.length));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async getOrderStatistics(req: any, res: Response) {
    try {
      const [stats] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN payment_status = 'completed' THEN total_amount ELSE 0 END) as total_revenue
         FROM orders`
      );
      res.json(successResponse(stats[0]));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async getOrderDetail(req: any, res: Response) {
    try {
      const { id } = req.params;

      const [orders] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          o.*,
          u.name as user_name,
          u.email as user_email
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ?`,
        [id]
      );

      if (orders.length === 0) {
        return res.status(404).json(errorResponse("Order not found", 404));
      }

      const order = orders[0];

      // Get order items
      const [items] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          oi.*,
          c.title_en as course_title
        FROM order_items oi
        JOIN courses c ON oi.course_id = c.id
        WHERE oi.order_id = ?`,
        [id]
      );

      order.items = items;
      res.json(successResponse(order));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async updateOrderStatus(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!["pending", "completed", "failed"].includes(status)) {
        return res.status(400).json(errorResponse("Invalid status", 400));
      }

      // Update order status
      await pool.execute(
        "UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?",
        [status, id]
      );

      // If status is completed, enroll user to courses
      if (status === "completed") {
        const [order] = await pool.execute<RowDataPacket[]>(
          "SELECT user_id FROM orders WHERE id = ?",
          [id]
        );

        if (order.length > 0) {
          const userId = order[0].user_id;

          // Get order items (courses)
          const [items] = await pool.execute<RowDataPacket[]>(
            "SELECT course_id FROM order_items WHERE order_id = ?",
            [id]
          );

          // Enroll user to each course
          for (const item of items) {
            // Check if already enrolled
            const [existing] = await pool.execute<RowDataPacket[]>(
              "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?",
              [userId, item.course_id]
            );

            if (existing.length === 0) {
              await pool.execute(
                "INSERT INTO enrollments (user_id, course_id, enrolled_at) VALUES (?, ?, NOW())",
                [userId, item.course_id]
              );

              // Update course total_students
              await pool.execute(
                "UPDATE courses SET total_students = total_students + 1 WHERE id = ?",
                [item.course_id]
              );
            }
          }
        }
      }

      res.json(
        successResponse({ message: "Order status updated successfully" })
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },
};
