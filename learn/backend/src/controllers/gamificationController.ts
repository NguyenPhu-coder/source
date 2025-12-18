import { Request, Response } from 'express';
import UserPoints from '../models/UserPoints.js';
import Badge from '../models/Badge.js';
import { successResponse, errorResponse } from '../utils/response.js';

// Get user points and stats
export const getUserPoints = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    let userPoints = await UserPoints.findByUserId(userId);
    
    if (!userPoints) {
      // Initialize if doesn't exist
      await UserPoints.initialize(userId);
      userPoints = await UserPoints.findByUserId(userId);
    }

    const rank = await UserPoints.getUserRank(userId);

    res.json(successResponse({
      ...userPoints,
      rank
    }, 'User points retrieved successfully'));
  } catch (error) {
    console.error('Error getting user points:', error);
    res.status(500).json(errorResponse('Failed to get user points'));
  }
};

// Get points history
export const getPointsHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await UserPoints.getPointsHistory(userId, limit);

    res.json(successResponse(history, 'Points history retrieved successfully'));
  } catch (error) {
    console.error('Error getting points history:', error);
    res.status(500).json(errorResponse('Failed to get points history'));
  }
};

// Get leaderboard
export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const leaderboard = await UserPoints.getLeaderboard(limit);

    res.json(successResponse(leaderboard, 'Leaderboard retrieved successfully'));
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json(errorResponse('Failed to get leaderboard'));
  }
};

// Get all badges
export const getAllBadges = async (req: Request, res: Response) => {
  try {
    const badges = await Badge.findAll();
    res.json(successResponse(badges, 'Badges retrieved successfully'));
  } catch (error) {
    console.error('Error getting badges:', error);
    res.status(500).json(errorResponse('Failed to get badges'));
  }
};

// Get user's earned badges
export const getUserBadges = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const badges = await Badge.getUserBadges(userId);

    res.json(successResponse(badges, 'User badges retrieved successfully'));
  } catch (error) {
    console.error('Error getting user badges:', error);
    res.status(500).json(errorResponse('Failed to get user badges'));
  }
};

// Get badges progress (how close user is to earning each badge)
export const getBadgesProgress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const progress = await Badge.getBadgesProgress(userId);

    res.json(successResponse(progress, 'Badges progress retrieved successfully'));
  } catch (error) {
    console.error('Error getting badges progress:', error);
    res.status(500).json(errorResponse('Failed to get badges progress'));
  }
};

// Update daily streak (called on user activity)
export const updateStreak = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    await UserPoints.updateStreak(userId);
    await Badge.checkAndAwardBadges(userId);

    const userPoints = await UserPoints.findByUserId(userId);

    res.json(successResponse(userPoints, 'Streak updated successfully'));
  } catch (error) {
    console.error('Error updating streak:', error);
    res.status(500).json(errorResponse('Failed to update streak'));
  }
};

// Get gamification overview (points, badges, streak in one call)
export const getGamificationOverview = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Get user points
    let userPoints = await UserPoints.findByUserId(userId);
    if (!userPoints) {
      await UserPoints.initialize(userId);
      userPoints = await UserPoints.findByUserId(userId);
    }

    // Get rank
    const rank = await UserPoints.getUserRank(userId);

    // Get earned badges
    const earnedBadges = await Badge.getUserBadges(userId);

    // Get badges progress
    const badgesProgress = await Badge.getBadgesProgress(userId);

    // Get recent points history
    const recentHistory = await UserPoints.getPointsHistory(userId, 10);

    res.json(successResponse({
      points: {
        ...userPoints,
        rank
      },
      earnedBadges,
      badgesProgress,
      recentHistory
    }, 'Gamification overview retrieved successfully'));
  } catch (error) {
    console.error('Error getting gamification overview:', error);
    res.status(500).json(errorResponse('Failed to get gamification overview'));
  }
};


