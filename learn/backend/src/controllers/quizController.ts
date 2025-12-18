import { Request, Response } from "express";
import Quiz from "../models/Quiz.js";
import UserPoints from "../models/UserPoints.js";
import Badge from "../models/Badge.js";
import { successResponse, errorResponse } from "../utils/response.js";

// Get quiz by lesson ID
export const getQuizByLesson = async (req: Request, res: Response) => {
  try {
    const { lessonId } = req.params;
    const quiz = await Quiz.getByLessonId(parseInt(lessonId));

    if (!quiz) {
      return res.status(404).json(errorResponse("Quiz not found"));
    }

    const quizWithQuestions = await Quiz.getQuizWithQuestions(quiz.id);

    // Remove correct answer flags from options before sending to client
    if (quizWithQuestions.questions) {
      quizWithQuestions.questions.forEach((question: any) => {
        if (question.options) {
          question.options = question.options.map((option: any) => {
            const { is_correct, ...optionWithoutAnswer } = option;
            return optionWithoutAnswer;
          });
        }
      });
    }

    res.json(successResponse(quizWithQuestions, "Quiz retrieved successfully"));
  } catch (error) {
    console.error("Error getting quiz:", error);
    res.status(500).json(errorResponse("Failed to get quiz"));
  }
};

// Get quiz by ID
export const getQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.getQuizWithQuestions(parseInt(id));

    if (!quiz) {
      return res.status(404).json(errorResponse("Quiz not found"));
    }

    // Remove correct answer flags
    if (quiz.questions) {
      quiz.questions.forEach((question: any) => {
        if (question.options) {
          question.options = question.options.map((option: any) => {
            const { is_correct, ...optionWithoutAnswer } = option;
            return optionWithoutAnswer;
          });
        }
      });
    }

    res.json(successResponse(quiz, "Quiz retrieved successfully"));
  } catch (error) {
    console.error("Error getting quiz:", error);
    res.status(500).json(errorResponse("Failed to get quiz"));
  }
};

// Submit quiz attempt
export const submitQuizAttempt = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { quizId } = req.params;
    const { answers, timeTaken } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json(errorResponse("Invalid answers format"));
    }

    const result = await Quiz.submitAttempt(userId, parseInt(quizId), answers);

    // Award points for passing
    if (result.passed) {
      await UserPoints.addPoints(
        userId,
        result.totalPoints * 10,
        "perfect_quiz",
        result.attemptId
      );

      // Award extra points for perfect score
      if (result.score === 100) {
        await UserPoints.addPoints(
          userId,
          100,
          "perfect_quiz",
          result.attemptId
        );
      }

      // Check and award badges
      await Badge.checkAndAwardBadges(userId);
    }

    res.json(successResponse(result, "Quiz attempt submitted successfully"));
  } catch (error) {
    console.error("Error submitting quiz:", error);
    res.status(500).json(errorResponse("Failed to submit quiz"));
  }
};

// Get user's quiz attempts
export const getUserAttempts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { quizId } = req.params;

    const attempts = await Quiz.getUserAttempts(userId, parseInt(quizId));
    const bestAttempt = await Quiz.getBestAttempt(userId, parseInt(quizId));

    res.json(
      successResponse(
        {
          attempts,
          bestAttempt,
        },
        "Attempts retrieved successfully"
      )
    );
  } catch (error) {
    console.error("Error getting attempts:", error);
    res.status(500).json(errorResponse("Failed to get attempts"));
  }
};

// Create quiz (instructor only)
export const createQuiz = async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user.role;

    if (userRole !== "instructor" && userRole !== "admin") {
      return res
        .status(403)
        .json(errorResponse("Only instructors can create quizzes"));
    }

    const {
      lesson_id,
      title_en,
      title_vi,
      description_en,
      description_vi,
      passing_score,
      time_limit,
      questions,
    } = req.body;

    if (!lesson_id || !title_en || !questions || questions.length === 0) {
      return res.status(400).json(errorResponse("Missing required fields"));
    }

    // Create quiz
    const quizId = await Quiz.create({
      lesson_id,
      title_en,
      title_vi,
      description_en,
      description_vi,
      passing_score,
      time_limit,
    });

    // Add questions and options
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const questionId = await Quiz.addQuestion({
        quiz_id: quizId,
        question_en: question.question_en,
        question_vi: question.question_vi,
        question_type: question.question_type || "multiple_choice",
        order_index: i,
        points: question.points || 1,
      });

      if (question.options && Array.isArray(question.options)) {
        for (let j = 0; j < question.options.length; j++) {
          const option = question.options[j];
          await Quiz.addOption({
            question_id: questionId,
            option_en: option.option_en,
            option_vi: option.option_vi,
            is_correct: option.is_correct || false,
            order_index: j,
          });
        }
      }
    }

    res
      .status(201)
      .json(successResponse({ id: quizId }, "Quiz created successfully"));
  } catch (error) {
    console.error("Error creating quiz:", error);
    res.status(500).json(errorResponse("Failed to create quiz"));
  }
};
