import express from 'express';
import * as quizController from '../controllers/quizController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/lesson/:lessonId', quizController.getQuizByLesson);
router.get('/:id', quizController.getQuiz);

// Protected routes
router.use(authenticate);

router.post('/:quizId/submit', quizController.submitQuizAttempt);
router.get('/:quizId/attempts', quizController.getUserAttempts);

// Instructor routes
router.post('/', quizController.createQuiz);

export default router;


