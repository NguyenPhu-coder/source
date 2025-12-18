import { Request, Response } from "express";
import { EnrollmentModel } from "../models/Enrollment.js";
import { CourseModel } from "../models/Course.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { detectLanguage } from "../utils/language.js";

// Helper function to validate thumbnail URL
const validateThumbnail = (
  thumbnail: string | null | undefined
): string | null => {
  if (!thumbnail) return null;
  if (thumbnail.startsWith("data:")) return null;
  if (!thumbnail.startsWith("http://") && !thumbnail.startsWith("https://"))
    return null;
  return thumbnail;
};

export const enrollmentController = {
  async enroll(req: any, res: Response) {
    try {
      const userId = req.user.id;
      const { course_id } = req.body;

      console.log("Enrollment attempt:", {
        userId,
        userType: typeof userId,
        courseId: course_id,
        fullUser: req.user,
      });

      if (!course_id) {
        return res
          .status(400)
          .json(errorResponse("Course ID is required", 400));
      }

      // Check if already enrolled
      const existing = await EnrollmentModel.findOne(userId, course_id);
      if (existing) {
        return res
          .status(400)
          .json(errorResponse("Already enrolled in this course", 400));
      }

      // Create enrollment
      const enrollmentId = await EnrollmentModel.create(userId, course_id);

      // Update course stats
      await CourseModel.updateStats(course_id);

      res
        .status(201)
        .json(
          successResponse(
            { id: enrollmentId, user_id: userId, course_id },
            "Successfully enrolled in course"
          )
        );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async getUserEnrollments(req: any, res: Response) {
    try {
      const userId = req.params.user_id || req.user.id;
      const lang = detectLanguage(req);

      const enrollments = await EnrollmentModel.findByUserId(userId);

      // Map to language-specific fields
      const mappedEnrollments = enrollments.map((enrollment) => ({
        id: enrollment.id,
        course_id: enrollment.course_id,
        title:
          lang === "vi"
            ? enrollment.title_vi || enrollment.title_en
            : enrollment.title_en,
        thumbnail: validateThumbnail(enrollment.thumbnail),
        instructor: enrollment.instructor_name,
        progress: parseFloat(enrollment.calculated_progress) || 0,
        completed: enrollment.completed,
        completed_lessons: enrollment.completed_lessons || 0,
        total_lessons: enrollment.total_lessons,
        enrolled_at: enrollment.enrolled_at,
      }));

      res.json(successResponse(mappedEnrollments));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async updateProgress(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { progress } = req.body;
      const userId = req.user.id;

      if (progress === undefined || progress < 0 || progress > 100) {
        return res
          .status(400)
          .json(errorResponse("Invalid progress value", 400));
      }

      // Verify enrollment belongs to user
      const [enrollment] = await EnrollmentModel.findByUserId(userId);
      if (!enrollment || enrollment.id !== parseInt(id)) {
        return res.status(403).json(errorResponse("Unauthorized", 403));
      }

      await EnrollmentModel.updateProgress(parseInt(id), progress);

      res.json(successResponse({ progress }, "Progress updated successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async unenroll(req: any, res: Response) {
    try {
      const userId = req.user.id;
      const { course_id } = req.params;

      if (!course_id) {
        return res
          .status(400)
          .json(errorResponse("Course ID is required", 400));
      }

      // Check if enrolled
      const existing = await EnrollmentModel.findOne(userId, course_id);
      if (!existing) {
        return res
          .status(404)
          .json(errorResponse("Not enrolled in this course", 404));
      }

      // Delete enrollment
      await EnrollmentModel.delete(userId, course_id);

      // Update course stats
      await CourseModel.updateStats(course_id);

      res.json(successResponse(null, "Successfully unenrolled from course"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async getMyCourses(req: any, res: Response) {
    try {
      const userId = req.user.id;
      const lang = detectLanguage(req);

      const enrollments = await EnrollmentModel.findByUserId(userId);

      // Map to include progress and course details
      const mappedCourses = enrollments.map((enrollment: any) => ({
        id: enrollment.id,
        course_id: enrollment.course_id,
        title_vi: enrollment.title_vi,
        title_en: enrollment.title_en,
        thumbnail: validateThumbnail(enrollment.thumbnail),
        instructor_name: enrollment.instructor_name,
        progress: parseFloat(enrollment.calculated_progress) || 0,
        completed: enrollment.completed === 1,
        total_lessons: enrollment.total_lessons || 0,
        completed_lessons: enrollment.completed_lessons || 0,
        enrolled_at: enrollment.enrolled_at,
      }));

      res.json(successResponse(mappedCourses));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },
};
