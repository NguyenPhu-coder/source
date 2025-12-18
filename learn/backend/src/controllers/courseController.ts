import { Request, Response } from "express";
import { CourseModel } from "../models/Course.js";
import { EnrollmentModel } from "../models/Enrollment.js";
import {
  successResponse,
  errorResponse,
  paginationResponse,
} from "../utils/response.js";
import { detectLanguage } from "../utils/language.js";

// Helper function to validate thumbnail URL
const validateThumbnail = (
  thumbnail: string | null | undefined
): string | null => {
  if (!thumbnail) return null;
  // Block base64 data URLs
  if (thumbnail.startsWith("data:")) return null;
  // Only allow http/https URLs
  if (!thumbnail.startsWith("http://") && !thumbnail.startsWith("https://"))
    return null;
  return thumbnail;
};

export const courseController = {
  async getAll(req: Request, res: Response) {
    try {
      const lang = detectLanguage(req);
      const filters = {
        category: req.query.category as string,
        level: req.query.level as string,
        search: req.query.search as string,
        sort: req.query.sort as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 12,
      };

      const { courses, total } = await CourseModel.findAll(filters);

      // Map courses to include language-specific fields
      const mappedCourses = courses.map((course) => ({
        id: course.id,
        title:
          lang === "vi" ? course.title_vi || course.title_en : course.title_en,
        description:
          lang === "vi"
            ? course.description_vi || course.description_en
            : course.description_en,
        thumbnail: validateThumbnail(course.thumbnail),
        category:
          lang === "vi" ? course.category_name_vi : course.category_name_en,
        category_id: course.category_id,
        instructor: course.instructor_name,
        instructor_email: course.instructor_email,
        price: parseFloat(course.price) || 0,
        level: course.level,
        rating: parseFloat(course.rating) || 0,
        total_reviews: course.total_reviews || 0,
        total_students: course.total_students || 0,
        total_lessons: course.total_lessons || 0,
        total_duration: course.duration || 0,
        duration: course.duration || 0,
      }));

      res.json(
        paginationResponse(mappedCourses, filters.page, filters.limit, total)
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const lang = detectLanguage(req);
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      const course = await CourseModel.findById(parseInt(id), lang);

      if (!course) {
        return res.status(404).json(errorResponse("Course not found", 404));
      }

      // Only allow access to approved courses for regular users
      // Instructors can see their own courses, admins can see all
      const isInstructor =
        userRole === "instructor" && course.instructor_id === userId;
      const isAdmin = userRole === "admin";
      const isApproved = course.approval_status === "approved";

      if (!isApproved && !isInstructor && !isAdmin) {
        return res
          .status(403)
          .json(errorResponse("Khóa học chưa được duyệt", 403));
      }

      // Map to language-specific fields
      const mappedCourse = {
        id: course.id,
        title:
          lang === "vi" ? course.title_vi || course.title_en : course.title_en,
        description:
          lang === "vi"
            ? course.description_vi || course.description_en
            : course.description_en,
        thumbnail: validateThumbnail(course.thumbnail),
        category:
          lang === "vi" ? course.category_name_vi : course.category_name_en,
        instructor: {
          name: course.instructor_name,
          email: course.instructor_email,
        },
        price: parseFloat(course.price) || 0,
        level: course.level,
        rating: parseFloat(course.rating) || 0,
        total_reviews: course.total_reviews || 0,
        total_students: course.total_students || 0,
        total_lessons: course.total_lessons || 0,
        duration: course.duration || 0,
        lessons: course.lessons.map((lesson: any) => ({
          id: lesson.id,
          title:
            lang === "vi"
              ? lesson.title_vi || lesson.title_en
              : lesson.title_en,
          description:
            lang === "vi"
              ? lesson.description_vi || lesson.description_en
              : lesson.description_en,
          video_url: lesson.video_url,
          duration: lesson.duration,
          is_free: lesson.is_free,
          lesson_type: lesson.lesson_type,
          content_text: lesson.content_text,
          document_url: lesson.document_url,
        })),
        reviewStats: course.reviewStats,
        isEnrolled: false,
        isCompleted: false,
      };

      // Get enrollment status if user is authenticated
      if (userId) {
        const enrollmentStatus = await EnrollmentModel.getEnrollmentStatus(
          userId,
          course.id
        );
        mappedCourse.isEnrolled = enrollmentStatus.isEnrolled;
        mappedCourse.isCompleted = enrollmentStatus.isCompleted;
      }

      res.json(successResponse(mappedCourse));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async create(req: Request, res: Response) {
    try {
      const instructorId = (req as any).user.id;
      
      // Handle thumbnail from file upload
      let thumbnail = req.body.thumbnail || "/images/placeholder-course.svg";
      if (req.file) {
        thumbnail = `/uploads/courses/${req.file.filename}`;
      }
      
      const courseData = {
        ...req.body,
        instructor_id: instructorId,
        thumbnail,
        approval_status: "pending",
      };

      const courseId = await CourseModel.create(courseData);
      const course = await CourseModel.findById(courseId);

      res
        .status(201)
        .json(successResponse(course, "Course created successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // Handle thumbnail from file upload
      const updateData = { ...req.body };
      if (req.file) {
        updateData.thumbnail = `/uploads/courses/${req.file.filename}`;
      }
      
      const updated = await CourseModel.update(parseInt(id), updateData);

      if (!updated) {
        return res.status(404).json(errorResponse("Course not found", 404));
      }

      const course = await CourseModel.findById(parseInt(id));
      res.json(successResponse(course, "Course updated successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = await CourseModel.delete(parseInt(id));

      if (!deleted) {
        return res.status(404).json(errorResponse("Course not found", 404));
      }

      res.json(successResponse(null, "Course deleted successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async getByInstructor(req: Request, res: Response) {
    try {
      const { instructorId } = req.params;
      const lang = detectLanguage(req);

      const courses = await CourseModel.findByInstructor(
        parseInt(instructorId)
      );

      // Map courses to include language-specific fields
      const mappedCourses = courses.map((course: any) => ({
        id: course.id,
        title_en: course.title_en,
        title_vi: course.title_vi,
        description_en: course.description_en,
        description_vi: course.description_vi,
        thumbnail: course.thumbnail,
        category_id: course.category_id,
        instructor_id: course.instructor_id,
        price: parseFloat(course.price),
        level: course.level,
        language: course.language,
        rating: parseFloat(course.rating),
        total_reviews: course.total_reviews,
        total_students: course.total_students,
        total_lessons: course.total_lessons,
        duration: course.duration,
        is_published: course.is_published === 1,
      }));

      res.json(
        successResponse(mappedCourses, "Courses retrieved successfully")
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async getLessons(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const lang = detectLanguage(req);

      const course = await CourseModel.findById(parseInt(id), lang);

      if (!course) {
        return res.status(404).json(errorResponse("Course not found", 404));
      }

      const mappedLessons = course.lessons.map((lesson: any) => ({
        id: lesson.id,
        title:
          lang === "vi" ? lesson.title_vi || lesson.title_en : lesson.title_en,
        description:
          lang === "vi"
            ? lesson.description_vi || lesson.description_en
            : lesson.description_en,
        video_url: lesson.video_url,
        duration: lesson.duration,
        order_index: lesson.order_index,
        is_free: lesson.is_free,
        lesson_type: lesson.lesson_type,
        content_text: lesson.content_text,
        document_url: lesson.document_url,
      }));

      res.json(successResponse(mappedLessons));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },
};
