/**
 * Enhanced Course Controller with Agent Integration
 * Adds content quality validation and AI-powered features
 */

import { Request, Response } from 'express';
import agentService from '../services/agentService.js';
import eventPublisher from '../services/eventPublisher.js';
import logger from '../services/logger.js';

/**
 * Validate course content quality before approval
 */
export async function validateCourseContent(req: Request, res: Response) {
    try {
        const { courseId } = req.params;
        const lang = (req.query.lang as string) || 'en';

        // Fetch course data from database (pseudo-code - adapt to your Course model)
        // const course = await CourseModel.findById(parseInt(courseId));

        // For demo purposes, using request body
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).json({
                success: false,
                error: 'title and description are required'
            });
        }

        logger.info(`Validating content for course ${courseId}`);

        // Call content quality agent
        const validationResult = await agentService.validateContent({
            contentType: 'course',
            contentId: parseInt(courseId),
            title,
            description
        });

        if (!validationResult.success) {
            return res.status(500).json(validationResult);
        }

        // Check if content passed all checks
        const { passed, checks, suggestions } = validationResult.data!;

        logger.info(`Course ${courseId} validation result: ${passed ? 'PASSED' : 'FAILED'}`);

        res.json({
            success: true,
            data: {
                passed,
                checks,
                suggestions,
                recommendation: passed ? 'approve' : 'review_required'
            }
        });
    } catch (error: any) {
        logger.error('Course validation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get AI-generated course recommendations for a user
 */
export async function getCourseRecommendations(req: Request, res: Response) {
    try {
        const userId = (req as any).userId;
        const { limit } = req.query;

        logger.info(`Getting recommendations for user ${userId}`);

        const result = await agentService.getRecommendations({
            userId,
            limit: limit ? parseInt(limit as string) : 10
        });

        res.json(result);
    } catch (error: any) {
        logger.error('Recommendations error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get related courses using knowledge graph
 */
export async function getRelatedCourses(req: Request, res: Response) {
    try {
        const { courseId } = req.params;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

        logger.info(`Getting related courses for course ${courseId}`);

        const result = await agentService.getRelatedCourses(parseInt(courseId), limit);

        res.json(result);
    } catch (error: any) {
        logger.error('Related courses error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get course prerequisites
 */
export async function getCoursePrerequisites(req: Request, res: Response) {
    try {
        const { courseId } = req.params;

        logger.info(`Getting prerequisites for course ${courseId}`);

        const result = await agentService.getPrerequisites(parseInt(courseId));

        res.json(result);
    } catch (error: any) {
        logger.error('Prerequisites error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Generate course thumbnail using AI
 */
export async function generateCourseThumbnail(req: Request, res: Response) {
    try {
        const { courseId } = req.params;
        const { title, category } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                error: 'title is required'
            });
        }

        logger.info(`Generating thumbnail for course ${courseId}`);

        const result = await agentService.generateThumbnail(
            parseInt(courseId),
            title,
            category || 'general'
        );

        res.json(result);
    } catch (error: any) {
        logger.error('Thumbnail generation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Auto-translate course content
 */
export async function translateCourseContent(req: Request, res: Response) {
    try {
        const { courseId } = req.params;
        const { targetLang } = req.body;

        if (!targetLang) {
            return res.status(400).json({
                success: false,
                error: 'targetLang is required'
            });
        }

        logger.info(`Translating course ${courseId} to ${targetLang}`);

        const result = await agentService.translateCourse(parseInt(courseId), targetLang);

        // Publish translation event
        await eventPublisher.publish('course.events', {
            eventType: 'course.translated',
            courseId: parseInt(courseId),
            data: { targetLang },
            timestamp: new Date()
        });

        res.json(result);
    } catch (error: any) {
        logger.error('Translation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get course mindmap
 */
export async function getCourseMindmap(req: Request, res: Response) {
    try {
        const { courseId } = req.params;

        logger.info(`Generating mindmap for course ${courseId}`);

        const result = await agentService.generateMindmap(parseInt(courseId));

        res.json(result);
    } catch (error: any) {
        logger.error('Mindmap generation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Publish course created event to agents
 */
export async function publishCourseCreatedEvent(courseId: number, instructorId: number, courseData: any) {
    try {
        await eventPublisher.publishCourseCreated(courseId, instructorId, courseData);
        logger.info(`Published course.created event for course ${courseId}`);
    } catch (error: any) {
        logger.error(`Failed to publish course.created event:`, error);
        // Non-critical, don't throw
    }
}

/**
 * Publish course updated event to agents
 */
export async function publishCourseUpdatedEvent(courseId: number, updates: any) {
    try {
        await eventPublisher.publishCourseUpdated(courseId, updates);
        logger.info(`Published course.updated event for course ${courseId}`);
    } catch (error: any) {
        logger.error(`Failed to publish course.updated event:`, error);
    }
}

/**
 * Publish course approved event to agents
 */
export async function publishCourseApprovedEvent(courseId: number, approvedBy: number) {
    try {
        await eventPublisher.publishCourseApproved(courseId, approvedBy);
        logger.info(`Published course.approved event for course ${courseId}`);
    } catch (error: any) {
        logger.error(`Failed to publish course.approved event:`, error);
    }
}

export default {
    validateCourseContent,
    getCourseRecommendations,
    getRelatedCourses,
    getCoursePrerequisites,
    generateCourseThumbnail,
    translateCourseContent,
    getCourseMindmap,
    publishCourseCreatedEvent,
    publishCourseUpdatedEvent,
    publishCourseApprovedEvent
};
