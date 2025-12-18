import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import pool from "../config/db.js";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import {
  successResponse,
  errorResponse,
  paginationResponse,
} from "../utils/response.js";
import { detectLanguage } from "../utils/language.js";

export const instructorController = {
  // Get instructor's own courses
  async getMyCourses(req: AuthRequest, res: Response) {
    try {
      const instructorId = req.user?.id;
      const lang = detectLanguage(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const [courses] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          c.id,
          c.title_en,
          c.title_vi,
          c.description_en,
          c.description_vi,
          c.thumbnail,
          c.price,
          c.level,
          c.duration,
          c.created_at,
          cat.name_en as category_name_en,
          cat.name_vi as category_name_vi,
          COUNT(DISTINCT e.id) as total_students,
          COUNT(DISTINCT l.id) as total_lessons,
          COALESCE(AVG(r.rating), 0) as rating,
          COUNT(DISTINCT r.id) as total_reviews
        FROM courses c
        LEFT JOIN categories cat ON c.category_id = cat.id
        LEFT JOIN enrollments e ON c.id = e.course_id
        LEFT JOIN lessons l ON c.id = l.course_id
        LEFT JOIN reviews r ON c.id = r.course_id
        WHERE c.instructor_id = ?
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
        [instructorId]
      );

      const [countResult] = await pool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) as total FROM courses WHERE instructor_id = ?",
        [instructorId]
      );
      const total = countResult[0].total;

      const mappedCourses = courses.map((course: any) => ({
        id: course.id,
        title:
          lang === "vi" ? course.title_vi || course.title_en : course.title_en,
        description:
          lang === "vi"
            ? course.description_vi || course.description_en
            : course.description_en,
        thumbnail: course.thumbnail,
        price: course.price,
        level: course.level,
        duration: course.duration,
        category:
          lang === "vi"
            ? course.category_name_vi || course.category_name_en
            : course.category_name_en,
        total_students: course.total_students || 0,
        total_lessons: course.total_lessons || 0,
        rating: parseFloat(course.rating) || 0,
        total_reviews: course.total_reviews || 0,
        created_at: course.created_at,
      }));

      res.json(paginationResponse(mappedCourses, page, limit, total));
    } catch (error) {
      console.error("Get my courses error:", error);
      res.status(500).json(errorResponse("Error fetching courses"));
    }
  },

  // Get students enrolled in instructor's courses
  async getMyStudents(req: AuthRequest, res: Response) {
    try {
      const instructorId = req.user?.id;
      const courseId = req.query.courseId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      let query = `
        SELECT DISTINCT
          u.id,
          u.name,
          u.email,
          e.enrolled_at,
          e.course_id,
          c.title_en as course_title,
          COUNT(DISTINCT lp.id) as completed_lessons,
          c.total_lessons,
          ROUND((COUNT(DISTINCT lp.id) / NULLIF(c.total_lessons, 0)) * 100, 2) as progress
        FROM users u
        INNER JOIN enrollments e ON u.id = e.user_id
        INNER JOIN courses c ON e.course_id = c.id
        LEFT JOIN lessons l ON c.id = l.course_id
        LEFT JOIN lesson_progress lp ON u.id = lp.user_id AND l.id = lp.lesson_id AND lp.completed = 1
        WHERE c.instructor_id = ?
      `;

      const params: any[] = [instructorId];

      if (courseId) {
        query += " AND c.id = ?";
        params.push(courseId);
      }

      query += `
        GROUP BY u.id, e.enrolled_at, e.course_id, c.title_en, c.total_lessons
        ORDER BY e.enrolled_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const [students] = await pool.execute<RowDataPacket[]>(query, params);

      let countQuery = `
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        INNER JOIN enrollments e ON u.id = e.user_id
        INNER JOIN courses c ON e.course_id = c.id
        WHERE c.instructor_id = ?
      `;

      const countParams: any[] = [instructorId];
      if (courseId) {
        countQuery += " AND c.id = ?";
        countParams.push(courseId);
      }

      const [countResult] = await pool.execute<RowDataPacket[]>(
        countQuery,
        countParams
      );
      const total = countResult[0].total;

      res.json(paginationResponse(students, page, limit, total));
    } catch (error) {
      console.error("Get my students error:", error);
      res.status(500).json(errorResponse("Error fetching students"));
    }
  },

  // Get instructor dashboard statistics
  async getDashboard(req: AuthRequest, res: Response) {
    try {
      const instructorId = req.user?.id;

      // Total courses
      const [coursesCount] = await pool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) as total FROM courses WHERE instructor_id = ?",
        [instructorId]
      );

      // Total students
      const [studentsCount] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT e.user_id) as total
        FROM enrollments e
        INNER JOIN courses c ON e.course_id = c.id
        WHERE c.instructor_id = ?`,
        [instructorId]
      );

      // Total revenue
      const [revenue] = await pool.execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(c.price), 0) as total
        FROM enrollments e
        INNER JOIN courses c ON e.course_id = c.id
        WHERE c.instructor_id = ?`,
        [instructorId]
      );

      // Average rating
      const [rating] = await pool.execute<RowDataPacket[]>(
        `SELECT COALESCE(AVG(r.rating), 0) as average
        FROM reviews r
        INNER JOIN courses c ON r.course_id = c.id
        WHERE c.instructor_id = ?`,
        [instructorId]
      );

      // Recent enrollments
      const [recentEnrollments] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          u.name as student_name,
          u.email as student_email,
          c.title_en as course_title,
          e.enrolled_at
        FROM enrollments e
        INNER JOIN courses c ON e.course_id = c.id
        INNER JOIN users u ON e.user_id = u.id
        WHERE c.instructor_id = ?
        ORDER BY e.enrolled_at DESC
        LIMIT 10`,
        [instructorId]
      );

      // Course performance
      const [coursePerformance] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          c.id,
          c.title_en,
          COUNT(DISTINCT e.id) as enrollments,
          COALESCE(AVG(r.rating), 0) as rating,
          COUNT(DISTINCT r.id) as reviews
        FROM courses c
        LEFT JOIN enrollments e ON c.id = e.course_id
        LEFT JOIN reviews r ON c.id = r.course_id
        WHERE c.instructor_id = ?
        GROUP BY c.id, c.title_en
        ORDER BY enrollments DESC`,
        [instructorId]
      );

      const dashboard = {
        statistics: {
          totalCourses: coursesCount[0].total,
          totalStudents: studentsCount[0].total,
          totalRevenue: parseFloat(revenue[0].total) || 0,
          averageRating: parseFloat(rating[0].average) || 0,
        },
        recentEnrollments,
        coursePerformance,
      };

      res.json(successResponse(dashboard));
    } catch (error) {
      console.error("Get dashboard error:", error);
      res.status(500).json(errorResponse("Error fetching dashboard data"));
    }
  },

  // Get course analytics
  async getCourseAnalytics(req: AuthRequest, res: Response) {
    try {
      const instructorId = req.user?.id;
      const courseId = req.params.courseId;

      // Verify ownership
      const [course] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM courses WHERE id = ? AND instructor_id = ?",
        [courseId, instructorId]
      );

      if (!course.length) {
        return res
          .status(403)
          .json(errorResponse("You don't have access to this course"));
      }

      // Enrollment trend (last 30 days)
      const [enrollmentTrend] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          DATE(enrolled_at) as date,
          COUNT(*) as enrollments
        FROM enrollments
        WHERE course_id = ? AND enrolled_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(enrolled_at)
        ORDER BY date`,
        [courseId]
      );

      // Lesson completion rate
      const [lessonCompletion] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          l.id,
          l.title_en,
          COUNT(DISTINCT lp.user_id) as completed_by
        FROM lessons l
        LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.completed = 1
        WHERE l.course_id = ?
        GROUP BY l.id, l.title_en
        ORDER BY l.id`,
        [courseId]
      );

      // Student progress distribution
      const [progressDistribution] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          CASE
            WHEN progress = 100 THEN 'Completed'
            WHEN progress >= 75 THEN '75-99%'
            WHEN progress >= 50 THEN '50-74%'
            WHEN progress >= 25 THEN '25-49%'
            ELSE '0-24%'
          END as progress_range,
          COUNT(*) as count
        FROM (
          SELECT 
            e.user_id,
            ROUND((COUNT(DISTINCT lp.id) / NULLIF(c.total_lessons, 0)) * 100, 2) as progress
          FROM enrollments e
          INNER JOIN courses c ON e.course_id = c.id
          LEFT JOIN lessons l ON l.course_id = c.id
          LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND e.user_id = lp.user_id AND lp.completed = 1
          WHERE e.course_id = ?
          GROUP BY e.user_id, c.total_lessons
        ) as student_progress
        GROUP BY progress_range
        ORDER BY FIELD(progress_range, '0-24%', '25-49%', '50-74%', '75-99%', 'Completed')`,
        [courseId]
      );

      // Reviews summary
      const [reviewsSummary] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          AVG(rating) as average_rating,
          COUNT(*) as total_reviews,
          SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
          SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
          SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
          SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
          SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
        FROM reviews
        WHERE course_id = ?`,
        [courseId]
      );

      const analytics = {
        enrollmentTrend,
        lessonCompletion,
        progressDistribution,
        reviewsSummary: reviewsSummary[0],
      };

      res.json(successResponse(analytics));
    } catch (error) {
      console.error("Get course analytics error:", error);
      res.status(500).json(errorResponse("Error fetching course analytics"));
    }
  },

  // Create a lesson for instructor's course
  async createLesson(req: AuthRequest, res: Response) {
    try {
      console.log("=== CREATE LESSON REQUEST ===");
      console.log("User:", req.user);
      console.log("Body:", req.body);

      const instructorId = req.user?.id;
      const courseId = req.body.course_id;
      const {
        title_en,
        title_vi,
        description_en,
        description_vi,
        video_url,
        duration,
        order_index,
        lesson_type,
        content_text,
        document_url,
      } = req.body;

      // Verify course ownership
      const [course] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM courses WHERE id = ? AND instructor_id = ?",
        [courseId, instructorId]
      );

      if (!course.length) {
        return res
          .status(403)
          .json(errorResponse("You don't have access to this course"));
      }

      // Create lesson with new fields
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO lessons (
          course_id, title_en, title_vi, description_en, description_vi, 
          video_url, duration, order_index, lesson_type, content_text, document_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          courseId,
          title_en,
          title_vi,
          description_en,
          description_vi,
          video_url,
          duration,
          order_index,
          lesson_type || "video",
          content_text || null,
          document_url || null,
        ]
      );

      // Update course total_lessons
      await pool.execute(
        `UPDATE courses SET total_lessons = (SELECT COUNT(*) FROM lessons WHERE course_id = ?) WHERE id = ?`,
        [courseId, courseId]
      );

      res
        .status(201)
        .json(
          successResponse(
            { id: result.insertId },
            "Lesson created successfully"
          )
        );
    } catch (error) {
      console.error("Create lesson error:", error);
      res.status(500).json(errorResponse("Error creating lesson"));
    }
  },

  // Update a lesson
  async updateLesson(req: AuthRequest, res: Response) {
    try {
      const instructorId = req.user?.id;
      const lessonId = req.params.lessonId;
      const {
        title_en,
        title_vi,
        description_en,
        description_vi,
        video_url,
        duration,
        order_index,
      } = req.body;

      // Verify lesson ownership through course
      const [lesson] = await pool.execute<RowDataPacket[]>(
        `SELECT l.id FROM lessons l
        INNER JOIN courses c ON l.course_id = c.id
        WHERE l.id = ? AND c.instructor_id = ?`,
        [lessonId, instructorId]
      );

      if (!lesson.length) {
        return res
          .status(403)
          .json(errorResponse("You don't have access to this lesson"));
      }

      // Update lesson
      const fields: string[] = [];
      const values: any[] = [];

      const updates = {
        title_en,
        title_vi,
        description_en,
        description_vi,
        video_url,
        duration,
        order_index,
      };

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      });

      if (fields.length > 0) {
        values.push(lessonId);
        await pool.execute(
          `UPDATE lessons SET ${fields.join(", ")} WHERE id = ?`,
          values
        );
      }

      res.json(successResponse(null, "Lesson updated successfully"));
    } catch (error) {
      console.error("Update lesson error:", error);
      res.status(500).json(errorResponse("Error updating lesson"));
    }
  },

  // Delete a lesson
  async deleteLesson(req: AuthRequest, res: Response) {
    try {
      const instructorId = req.user?.id;
      const lessonId = req.params.lessonId;

      // Verify lesson ownership and get course_id
      const [lesson] = await pool.execute<RowDataPacket[]>(
        `SELECT l.course_id FROM lessons l
        INNER JOIN courses c ON l.course_id = c.id
        WHERE l.id = ? AND c.instructor_id = ?`,
        [lessonId, instructorId]
      );

      if (!lesson.length) {
        return res
          .status(403)
          .json(errorResponse("You don't have access to this lesson"));
      }

      const courseId = lesson[0].course_id;

      // Delete lesson
      await pool.execute("DELETE FROM lessons WHERE id = ?", [lessonId]);

      // Update course total_lessons
      await pool.execute(
        `UPDATE courses SET total_lessons = (SELECT COUNT(*) FROM lessons WHERE course_id = ?) WHERE id = ?`,
        [courseId, courseId]
      );

      res.json(successResponse(null, "Lesson deleted successfully"));
    } catch (error) {
      console.error("Delete lesson error:", error);
      res.status(500).json(errorResponse("Error deleting lesson"));
    }
  },

  // Delete course (instructor can only delete their own courses)
  async deleteCourse(req: AuthRequest, res: Response) {
    try {
      const instructorId = req.user?.id;
      const courseId = req.params.courseId;

      console.log(
        `🗑️ Attempting to delete course ${courseId} by instructor ${instructorId}`
      );

      // Verify course ownership
      const [course] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM courses WHERE id = ? AND instructor_id = ?",
        [courseId, instructorId]
      );

      if (!course.length) {
        console.log(
          `❌ Access denied: Course ${courseId} not found or not owned by instructor ${instructorId}`
        );
        return res
          .status(403)
          .json(errorResponse("You don't have access to this course"));
      }

      console.log(`✅ Course ownership verified, starting deletion...`);

      // Most tables have ON DELETE CASCADE, so we just need to delete the course
      // MySQL will automatically handle cascading deletes for:
      // - lessons (and their quizzes, quiz_questions, quiz_attempts, lesson_progress)
      // - enrollments
      // - reviews
      // - certificates
      // - discussions
      // - course_analytics

      console.log(`📝 Deleting course and all related data...`);
      await pool.execute("DELETE FROM courses WHERE id = ?", [courseId]);

      console.log(`✅ Course ${courseId} deleted successfully`);
      res.json(successResponse(null, "Course deleted successfully"));
    } catch (error: any) {
      console.error("❌ Delete course error:", error);
      console.error("Error details:", error.message);
      res
        .status(500)
        .json(errorResponse(`Error deleting course: ${error.message}`));
    }
  },

  // Upload video for lesson
  async uploadLessonVideo(req: AuthRequest, res: Response) {
    try {
      const instructorId = req.user?.id;
      const lessonId = req.params.lessonId;

      if (!req.file) {
        return res.status(400).json(errorResponse("No video file uploaded"));
      }

      // Verify lesson ownership
      const [lesson] = await pool.execute<RowDataPacket[]>(
        `SELECT l.id, l.course_id FROM lessons l
        INNER JOIN courses c ON l.course_id = c.id
        WHERE l.id = ? AND c.instructor_id = ?`,
        [lessonId, instructorId]
      );

      if (!lesson.length) {
        return res
          .status(403)
          .json(errorResponse("You don't have access to this lesson"));
      }

      // Update lesson with video URL
      const videoUrl = `/uploads/videos/${req.file.filename}`;
      await pool.execute("UPDATE lessons SET video_url = ? WHERE id = ?", [
        videoUrl,
        lessonId,
      ]);

      res.json(
        successResponse({ video_url: videoUrl }, "Video uploaded successfully")
      );
    } catch (error) {
      console.error("Upload video error:", error);
      res.status(500).json(errorResponse("Error uploading video"));
    }
  },

  async uploadDocument(req: AuthRequest, res: Response) {
    try {
      const instructorId = req.user?.id;

      if (!req.file) {
        return res.status(400).json(errorResponse("No document file uploaded"));
      }

      // Verify instructor is authenticated
      if (!instructorId) {
        return res.status(401).json(errorResponse("Unauthorized"));
      }

      // Generate document URL
      const documentUrl = `/uploads/documents/${req.file.filename}`;

      res.json(
        successResponse(
          {
            url: documentUrl,
            filename: req.file.originalname,
            size: req.file.size,
          },
          "Document uploaded successfully"
        )
      );
    } catch (error) {
      console.error("Upload document error:", error);
      res.status(500).json(errorResponse("Error uploading document"));
    }
  },
};
