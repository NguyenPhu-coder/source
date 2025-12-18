import { Request, Response } from "express";
import { ReviewModel } from "../models/Review.js";
import { CourseModel } from "../models/Course.js";
import { EnrollmentModel } from "../models/Enrollment.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const reviewController = {
  async create(req: any, res: Response) {
    try {
      const userId = req.user.id;
      const { course_id, rating, comment } = req.body;

      if (!course_id || !rating) {
        return res
          .status(400)
          .json(errorResponse("Course ID and rating are required", 400));
      }

      if (rating < 1 || rating > 5) {
        return res
          .status(400)
          .json(errorResponse("Rating must be between 1 and 5", 400));
      }

      // Check if user is enrolled
      const isEnrolled = await EnrollmentModel.checkEnrollment(
        userId,
        course_id,
      );
      if (!isEnrolled) {
        return res
          .status(403)
          .json(errorResponse("Must be enrolled to review", 403));
      }

      // Check if already reviewed
      const existing = await ReviewModel.findOne(userId, course_id);
      if (existing) {
        // Update existing review
        await ReviewModel.update(existing.id!, rating, comment);
        await CourseModel.updateStats(course_id);
        return res.json(successResponse(null, "Review updated successfully"));
      }

      // Create new review
      const reviewId = await ReviewModel.create({
        user_id: userId,
        course_id,
        rating,
        comment,
      });

      // Update course stats
      await CourseModel.updateStats(course_id);

      res
        .status(201)
        .json(successResponse({ id: reviewId }, "Review created successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async getByCourseId(req: Request, res: Response) {
    try {
      const { course_id } = req.params;
      const reviews = await ReviewModel.findByCourseId(parseInt(course_id));

      res.json(successResponse(reviews));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async delete(req: any, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Get review to check ownership
      const review = await ReviewModel.findOne(userId, parseInt(id));
      if (!review || review.user_id !== userId) {
        return res.status(403).json(errorResponse("Unauthorized", 403));
      }

      const deleted = await ReviewModel.delete(parseInt(id));
      if (!deleted) {
        return res.status(404).json(errorResponse("Review not found", 404));
      }

      // Update course stats
      await CourseModel.updateStats(review.course_id);

      res.json(successResponse(null, "Review deleted successfully"));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },
};


