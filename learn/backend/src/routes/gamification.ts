import express from 'express';
import * as gamificationController from '../controllers/gamificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All gamification routes require authentication
router.use(authenticate);

// Points routes
router.get('/points', gamificationController.getUserPoints);
router.get('/points/history', gamificationController.getPointsHistory);
router.post('/points/streak', gamificationController.updateStreak);

// Leaderboard
router.get('/leaderboard', gamificationController.getLeaderboard);

// Badges routes
router.get('/badges', gamificationController.getAllBadges);
router.get('/badges/user', gamificationController.getUserBadges);
router.get('/badges/progress', gamificationController.getBadgesProgress);

// Overview (all gamification data in one call)
router.get('/overview', gamificationController.getGamificationOverview);

export default router;


