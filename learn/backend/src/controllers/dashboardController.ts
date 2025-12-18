import { Request, Response } from "express";
import { EnrollmentModel } from "../models/Enrollment.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { detectLanguage } from "../utils/language.js";

export const dashboardController = {
  async getOverview(req: any, res: Response) {
    try {
      const userId = req.user.id;
      const lang = detectLanguage(req);

      // Get user enrollments
      const enrollments = await EnrollmentModel.findByUserId(userId);

      // Map to language-specific fields
      const mappedEnrollments = enrollments.map((enrollment) => ({
        id: enrollment.id,
        course_id: enrollment.course_id,
        title:
          lang === "vi"
            ? enrollment.title_vi || enrollment.title_en
            : enrollment.title_en,
        thumbnail: enrollment.thumbnail,
        instructor: enrollment.instructor_name,
        progress: parseFloat(enrollment.calculated_progress) || 0,
        completed: enrollment.completed,
        completed_lessons: enrollment.completed_lessons || 0,
        total_lessons: enrollment.total_lessons,
        enrolled_at: enrollment.enrolled_at,
        completed_at: enrollment.completed_at,
      }));

      // Calculate stats
      const stats = {
        total_courses: enrollments.length,
        completed_courses: enrollments.filter((e) => e.completed).length,
        in_progress_courses: enrollments.filter(
          (e) => !e.completed && e.progress > 0
        ).length,
        total_hours:
          enrollments.reduce((sum, e) => sum + e.total_lessons * 30, 0) / 60, // Assuming 30 min per lesson
        certificates: enrollments.filter((e) => e.completed).length,
      };

      res.json(
        successResponse({
          stats,
          enrollments: mappedEnrollments,
          recent_courses: mappedEnrollments.slice(0, 5),
        })
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },
};


