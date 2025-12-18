import { Request, Response } from "express";
import { LessonProgressModel } from "../models/LessonProgress.js";
import UserPoints from "../models/UserPoints.js";
import Badge from "../models/Badge.js";
import { successResponse, errorResponse } from "../utils/response.js";
import AutoQuizService from "../services/autoQuizService.js";
import logger from "../services/logger.js";

export const lessonProgressController = {
  async markLessonCompleted(req: any, res: Response) {
    try {
      const userId = req.user.id;
      const { lesson_id, course_id } = req.body;

      if (!lesson_id || !course_id) {
        return res
          .status(400)
          .json(errorResponse("Lesson ID and Course ID are required", 400));
      }

      // Mark lesson as completed
      await LessonProgressModel.markCompleted(userId, lesson_id);

      // Award points for completing lesson
      await UserPoints.addPoints(userId, 50, 'complete_lesson', lesson_id);

      // Update streak
      await UserPoints.updateStreak(userId);

      // Update enrollment progress
      await LessonProgressModel.updateEnrollmentProgress(userId, course_id);

      // Get updated progress
      const progressData = await LessonProgressModel.getCourseProgress(
        userId,
        course_id,
      );

      // Check if course is completed and award bonus points + auto generate quiz
      if (progressData.progress >= 100) {
        await UserPoints.addPoints(userId, 500, 'finish_course', course_id);

        // Auto generate quiz using AI Agent (async, don't wait)
        AutoQuizService.generateQuizForCompletion(userId, course_id)
          .then((quizId) => {
            if (quizId) {
              logger.info(`Auto quiz ${quizId} generated for user ${userId} after completing course ${course_id}`);
            }
          })
          .catch((err) => {
            logger.error(`Failed to generate auto quiz for user ${userId}, course ${course_id}:`, err);
          });
      }

      // Check and award badges
      await Badge.checkAndAwardBadges(userId);

      res.json(
        successResponse(
          progressData,
          "Lesson marked as completed and progress updated",
        ),
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async markLessonIncomplete(req: any, res: Response) {
    try {
      const userId = req.user.id;
      const { lesson_id, course_id } = req.body;

      if (!lesson_id || !course_id) {
        return res
          .status(400)
          .json(errorResponse("Lesson ID and Course ID are required", 400));
      }

      // Mark lesson as incomplete
      await LessonProgressModel.markIncomplete(userId, lesson_id);

      // Update enrollment progress
      await LessonProgressModel.updateEnrollmentProgress(userId, course_id);

      // Get updated progress
      const progressData = await LessonProgressModel.getCourseProgress(
        userId,
        course_id,
      );

      res.json(
        successResponse(
          progressData,
          "Lesson marked as incomplete and progress updated",
        ),
      );
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },

  async getCourseProgress(req: any, res: Response) {
    try {
      const userId = req.user.id;
      const { course_id } = req.params;

      const progress = await LessonProgressModel.getUserProgress(
        userId,
        parseInt(course_id),
      );

      res.json(successResponse(progress));
    } catch (error: any) {
      res.status(500).json(errorResponse(error.message, 500));
    }
  },
};


