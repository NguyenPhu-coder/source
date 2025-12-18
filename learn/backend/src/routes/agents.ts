/**
 * Agent Integration Routes - Connect to AI Agent System
 * Routes that proxy requests to the actual AI agents running on Docker
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import logger from '../services/logger.js';
import db from '../config/db.js';
import { uploadDocument } from '../middleware/upload.js';

const router = Router();

// Agent service URLs (Docker internal network)
const AGENT_URLS = {
    orchestration: 'http://lyw-orchestration:8000',
    contentIngestion: 'http://lyw-content-ingestion:8001',
    assessment: 'http://lyw-assessment:8008',
    personalization: 'http://lyw-personalization:8009',
    knowledgeGraph: 'http://lyw-knowledge-graph:8010',
    analytics: 'http://lyw-analytics:8011',
    learningScience: 'http://lyw-learning-science:8012',
    caching: 'http://lyw-caching:8014',
    databaseMgmt: 'http://lyw-database-mgmt:8015',
};

// Helper to make agent requests with timeout and error handling
async function callAgent(url: string, options: any = {}) {
    try {
        const response = await axios({
            url,
            timeout: 30000, // 30 second timeout
            ...options,
        });
        return response.data;
    } catch (error: any) {
        logger.error(`Agent call failed: ${url}`, { error: error.message });
        throw error;
    }
}

// ============================================
// HEALTH & STATUS
// ============================================

router.get('/health', async (req: Request, res: Response) => {
    try {
        // Check multiple agents health
        const healthChecks = await Promise.allSettled([
            callAgent(`${AGENT_URLS.orchestration}/health`),
            callAgent(`${AGENT_URLS.analytics}/health`),
            callAgent(`${AGENT_URLS.personalization}/health`),
            callAgent(`${AGENT_URLS.knowledgeGraph}/health`),
        ]);

        const results = healthChecks.map((result, index) => ({
            agent: ['orchestration', 'analytics', 'personalization', 'knowledgeGraph'][index],
            healthy: result.status === 'fulfilled',
            data: result.status === 'fulfilled' ? result.value : null,
        }));

        const allHealthy = results.every(r => r.healthy);

        res.json({
            success: true,
            agentSystem: allHealthy ? 'healthy' : 'degraded',
            agents: results,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ============================================
// ANALYTICS AGENT ENDPOINTS
// ============================================

router.get('/analytics/engagement', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        // Call analytics agent for engagement data
        const agentData = await callAgent(`${AGENT_URLS.analytics}/engagement/${userId}`);

        // Also get supplementary data from MySQL for complete picture
        const [pointsResult]: any = await db.query(
            `SELECT total_points, current_streak, level, level_name 
             FROM user_points WHERE user_id = ?`,
            [userId]
        );

        const [progressResult]: any = await db.query(
            `SELECT COUNT(CASE WHEN completed = 1 THEN 1 END) as completed_lessons,
                    COUNT(*) as total_lessons
             FROM lesson_progress WHERE user_id = ?`,
            [userId]
        );

        const [enrollmentResult]: any = await db.query(
            `SELECT COUNT(*) as enrolled_courses FROM enrollments WHERE user_id = ?`,
            [userId]
        );

        // Get weekly activity
        const [activityResult]: any = await db.query(
            `SELECT DATE(completed_at) as date, COUNT(*) as count
             FROM lesson_progress 
             WHERE user_id = ? AND completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             GROUP BY DATE(completed_at)
             ORDER BY date`,
            [userId]
        );

        // Build weekly activity array
        const weeklyActivity = [0, 0, 0, 0, 0, 0, 0];
        const today = new Date();
        activityResult.forEach((row: any) => {
            const dayDiff = Math.floor((today.getTime() - new Date(row.date).getTime()) / (1000 * 60 * 60 * 24));
            if (dayDiff >= 0 && dayDiff < 7) {
                weeklyActivity[6 - dayDiff] = row.count;
            }
        });

        const points = pointsResult[0] || { total_points: 0, current_streak: 0, level: 1, level_name: 'Beginner' };
        const progress = progressResult[0] || { completed_lessons: 0, total_lessons: 0 };
        const enrollment = enrollmentResult[0] || { enrolled_courses: 0 };

        const completionRate = progress.total_lessons > 0
            ? Math.round((progress.completed_lessons / progress.total_lessons) * 100)
            : 0;

        res.json({
            success: true,
            data: {
                // From AI Agent
                engagementScore: agentData.engagement_score || 0,
                sessionCount: agentData.session_count || 0,
                totalTimeSpent: agentData.total_time_spent || 0,
                quizPerformance: agentData.quiz_performance || 0,
                // From MySQL
                streakDays: points.current_streak || 0,
                averageSessionTime: 25,
                completionRate,
                weeklyActivity,
                totalPoints: points.total_points || 0,
                currentLevel: points.level || 1,
                levelName: points.level_name || 'Beginner',
                enrolledCourses: enrollment.enrolled_courses || 0,
                completedLessons: progress.completed_lessons || 0,
            },
            source: 'agent+database',
        });
    } catch (error: any) {
        logger.error('Analytics engagement error:', { message: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.get('/analytics/dashboard', authenticate, async (req: Request, res: Response) => {
    try {
        // Get dashboard data from analytics agent
        const agentData = await callAgent(`${AGENT_URLS.analytics}/dashboard-data`);

        // Supplement with MySQL data
        const [userStats]: any = await db.query(
            `SELECT COUNT(*) as total_users FROM users`
        );

        const [courseStats]: any = await db.query(
            `SELECT COUNT(*) as total_courses FROM courses WHERE is_published = 1`
        );

        const [enrollmentStats]: any = await db.query(
            `SELECT COUNT(*) as total_enrollments,
                    COUNT(CASE WHEN completed = 1 THEN 1 END) as completed
             FROM enrollments`
        );

        res.json({
            success: true,
            data: {
                // From Agent
                activeUsers: agentData.metrics?.active_users || 0,
                totalEvents: agentData.metrics?.total_events || 0,
                retention7d: agentData.metrics?.retention_7d || 0,
                retention30d: agentData.metrics?.retention_30d || 0,
                eventDistribution: agentData.event_distribution || {},
                // From MySQL
                totalUsers: userStats[0]?.total_users || 0,
                totalCourses: courseStats[0]?.total_courses || 0,
                totalEnrollments: enrollmentStats[0]?.total_enrollments || 0,
                completionRate: enrollmentStats[0]?.total_enrollments > 0
                    ? Math.round((enrollmentStats[0].completed / enrollmentStats[0].total_enrollments) * 100)
                    : 0,
            },
            source: 'agent+database',
        });
    } catch (error: any) {
        logger.error('Analytics dashboard error:', { message: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.get('/analytics/dropout-risk', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { courseId } = req.query;

        if (!courseId) {
            return res.status(400).json({
                success: false,
                error: 'courseId is required',
            });
        }

        // Call analytics agent for dropout prediction
        const agentData = await callAgent(`${AGENT_URLS.analytics}/predict-dropout/${userId}`);

        // Get enrollment data from MySQL
        const [enrollmentData]: any = await db.query(
            `SELECT e.progress, e.enrolled_at, DATEDIFF(NOW(), e.enrolled_at) as days_enrolled
             FROM enrollments e WHERE e.user_id = ? AND e.course_id = ?`,
            [userId, courseId]
        );

        const enrollment = enrollmentData[0];

        res.json({
            success: true,
            data: {
                userId,
                courseId,
                // From Agent
                dropoutRisk: agentData.dropout_probability || 0,
                riskLevel: agentData.risk_level || 'low',
                factors: agentData.risk_factors || [],
                interventionSuggestions: agentData.intervention_suggestions || [],
                // From MySQL
                progress: enrollment?.progress || 0,
                daysEnrolled: enrollment?.days_enrolled || 0,
            },
            source: 'agent+database',
        });
    } catch (error: any) {
        logger.error('Dropout risk error:', { message: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.get('/analytics/retention', authenticate, async (req: Request, res: Response) => {
    try {
        const { period = 7 } = req.query;

        // Call analytics agent for retention data
        const agentData = await callAgent(`${AGENT_URLS.analytics}/retention?period=${period}`);

        res.json({
            success: true,
            data: agentData,
            source: 'agent',
        });
    } catch (error: any) {
        logger.error('Retention error:', { message: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.get('/analytics/cohort', authenticate, async (req: Request, res: Response) => {
    try {
        // Call analytics agent for cohort analysis
        const agentData = await callAgent(`${AGENT_URLS.analytics}/cohort-analysis`);

        res.json({
            success: true,
            data: agentData,
            source: 'agent',
        });
    } catch (error: any) {
        logger.error('Cohort analysis error:', { message: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ============================================
// PERSONALIZATION AGENT ENDPOINTS
// ============================================

router.post('/recommendations', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { limit = 6 } = req.body;

        // Get user profile from personalization agent
        const profileData = await callAgent(`${AGENT_URLS.personalization}/profile/${userId}`);

        // Get enrolled courses to exclude
        const [enrolled]: any = await db.query(
            `SELECT course_id FROM enrollments WHERE user_id = ?`,
            [userId]
        );
        const enrolledIds = enrolled.map((e: any) => e.course_id);

        // Get courses from MySQL based on user profile
        const exclusionClause = enrolledIds.length > 0
            ? `AND c.id NOT IN (${enrolledIds.join(',')})`
            : '';

        const [courses]: any = await db.query(
            `SELECT c.id as courseId, c.title_vi as title, c.title_en,
                    c.thumbnail, c.price, c.rating, c.total_students,
                    c.level, cat.name_vi as category, u.name as instructor_name
             FROM courses c
             JOIN categories cat ON c.category_id = cat.id
             JOIN users u ON c.instructor_id = u.id
             WHERE c.is_published = 1 ${exclusionClause}
             ORDER BY c.rating DESC, c.total_students DESC
             LIMIT ?`,
            [limit]
        );

        // Score recommendations based on agent profile
        const learningStyle = profileData.profile?.learning_style || 'visual';
        const difficulty = profileData.profile?.difficulty || 'intermediate';

        const recommendations = courses.map((course: any, index: number) => {
            let score = 1 - (index * 0.1);

            // Boost score based on difficulty match
            if (course.level === difficulty) {
                score += 0.1;
            }

            return {
                courseId: course.courseId,
                title: course.title || course.title_en,
                thumbnail: course.thumbnail,
                price: course.price,
                rating: course.rating,
                totalStudents: course.total_students,
                level: course.level,
                category: course.category,
                instructor: course.instructor_name,
                score: Math.min(1, score),
                reason: index < 3
                    ? 'Phù hợp với phong cách học tập của bạn'
                    : 'Được đánh giá cao bởi học viên',
            };
        });

        res.json({
            success: true,
            data: {
                recommendations,
                userProfile: profileData.profile,
                learningVelocity: profileData.learning_velocity,
                agentRecommendations: profileData.recommendations,
            },
            source: 'agent+database',
        });
    } catch (error: any) {
        logger.error('Recommendations error:', { message: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.post('/personalize', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { content, content_type = 'explanation' } = req.body;

        // Call personalization agent
        const result = await callAgent(`${AGENT_URLS.personalization}/personalize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: {
                user_id: String(userId),
                content,
                content_type,
            },
        });

        res.json({
            success: true,
            data: result,
            source: 'agent',
        });
    } catch (error: any) {
        logger.error('Personalize error:', { message: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.get('/profile/:userId', authenticate, async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        // Get profile from personalization agent
        const profileData = await callAgent(`${AGENT_URLS.personalization}/profile/${userId}`);

        res.json({
            success: true,
            data: profileData,
            source: 'agent',
        });
    } catch (error: any) {
        logger.error('Profile error:', { message: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.post('/learning-path', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { goalTopic, conceptId } = req.body;

        // Try to get learning path from knowledge graph agent
        let agentPath = null;
        if (conceptId) {
            try {
                agentPath = await callAgent(
                    `${AGENT_URLS.knowledgeGraph}/learning-path/${userId}/${conceptId}`
                );
            } catch (e) {
                // Agent path not available, fall back to MySQL
            }
        }

        // Get courses matching goal topic from MySQL
        const [courses]: any = await db.query(
            `SELECT c.id, c.title_vi as title, c.title_en, c.level, c.duration,
                    c.thumbnail, c.price, cat.name_vi as category
             FROM courses c
             JOIN categories cat ON c.category_id = cat.id
             WHERE c.is_published = 1 
               AND (c.title_vi LIKE ? OR c.title_en LIKE ? OR c.description_vi LIKE ?)
             ORDER BY CASE c.level 
                        WHEN 'beginner' THEN 1 
                        WHEN 'intermediate' THEN 2 
                        WHEN 'advanced' THEN 3 
                      END
             LIMIT 5`,
            [`%${goalTopic}%`, `%${goalTopic}%`, `%${goalTopic}%`]
        );

        const learningPath = courses.map((course: any, index: number) => ({
            order: index + 1,
            courseId: course.id,
            title: course.title || course.title_en,
            level: course.level,
            duration: course.duration,
            thumbnail: course.thumbnail,
            category: course.category,
        }));

        res.json({
            success: true,
            data: {
                goal: goalTopic,
                totalCourses: learningPath.length,
                estimatedDuration: courses.reduce((sum: number, c: any) => sum + (c.duration || 0), 0),
                path: learningPath,
                agentPath: agentPath,
            },
            source: agentPath ? 'agent+database' : 'database',
        });
    } catch (error: any) {
        logger.error('Learning path error:', { message: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ============================================
// KNOWLEDGE GRAPH AGENT ENDPOINTS
// ============================================

router.get('/prerequisites/:courseId', async (req: Request, res: Response) => {
    try {
        const courseId = parseInt(req.params.courseId);

        // Try to get prerequisites from knowledge graph agent
        let agentPrereqs = null;
        try {
            agentPrereqs = await callAgent(`${AGENT_URLS.knowledgeGraph}/prerequisites/${courseId}`);
        } catch (e) {
            // Agent not available, fall back to MySQL
        }

        // Get course info from MySQL
        const [courseData]: any = await db.query(
            `SELECT c.id, c.title_vi as title, c.title_en, c.level, cat.name_vi as category
             FROM courses c
             JOIN categories cat ON c.category_id = cat.id
             WHERE c.id = ?`,
            [courseId]
        );

        if (courseData.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Course not found',
            });
        }

        const course = courseData[0];

        // Get related courses from same category at lower level
        const [relatedCourses]: any = await db.query(
            `SELECT c.id, c.title_vi as title, c.title_en, c.level
             FROM courses c
             WHERE c.category_id = (SELECT category_id FROM courses WHERE id = ?)
               AND c.id != ? AND c.is_published = 1
             ORDER BY CASE c.level 
                        WHEN 'beginner' THEN 1 
                        WHEN 'intermediate' THEN 2 
                        WHEN 'advanced' THEN 3 
                      END
             LIMIT 5`,
            [courseId, courseId]
        );

        res.json({
            success: true,
            data: {
                courseId,
                courseName: course.title || course.title_en,
                level: course.level,
                category: course.category,
                // From Agent
                agentPrerequisites: agentPrereqs,
                // From MySQL
                prerequisites: relatedCourses
                    .filter((c: any) => {
                        const levels = ['beginner', 'intermediate', 'advanced'];
                        return levels.indexOf(c.level) < levels.indexOf(course.level);
                    })
                    .map((c: any) => ({
                        id: c.id,
                        title: c.title || c.title_en,
                        level: c.level,
                    })),
                relatedCourses: relatedCourses.map((c: any) => ({
                    id: c.id,
                    title: c.title || c.title_en,
                    level: c.level,
                })),
            },
            source: agentPrereqs ? 'agent+database' : 'database',
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.get('/graph/:conceptId', authenticate, async (req: Request, res: Response) => {
    try {
        const { conceptId } = req.params;

        // Get graph visualization from knowledge graph agent
        const graphData = await callAgent(`${AGENT_URLS.knowledgeGraph}/graph/${conceptId}`);

        res.json({
            success: true,
            data: graphData,
            source: 'agent',
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.get('/similar-users/:userId', authenticate, async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        // Get similar users from knowledge graph agent
        const similarUsers = await callAgent(`${AGENT_URLS.knowledgeGraph}/similar-users/${userId}`);

        res.json({
            success: true,
            data: similarUsers,
            source: 'agent',
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ============================================
// LEARNING SCIENCE AGENT ENDPOINTS
// ============================================

router.get('/spaced-repetition/:userId', authenticate, async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        // Get spaced repetition schedule from learning science agent
        const schedule = await callAgent(`${AGENT_URLS.learningScience}/review-schedule/${userId}`);

        res.json({
            success: true,
            data: schedule,
            source: 'agent',
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.get('/cognitive-load/:lessonId', authenticate, async (req: Request, res: Response) => {
    try {
        const { lessonId } = req.params;

        // Get cognitive load analysis from learning science agent
        const analysis = await callAgent(`${AGENT_URLS.learningScience}/cognitive-load/${lessonId}`);

        res.json({
            success: true,
            data: analysis,
            source: 'agent',
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ============================================
// ASSESSMENT AGENT ENDPOINTS
// ============================================

router.post('/generate-quiz', authenticate, async (req: Request, res: Response) => {
    try {
        const { lessonId, courseId, content, difficulty, questionCount } = req.body;

        if (!lessonId || !courseId) {
            return res.status(400).json({
                success: false,
                error: 'lessonId and courseId are required',
            });
        }

        // Try to get quiz from assessment agent
        let agentQuiz = null;
        try {
            agentQuiz = await callAgent(`${AGENT_URLS.assessment}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                data: {
                    content: content || '',
                    question_types: ['multiple_choice'],
                    difficulty: difficulty || 'medium',
                    count: questionCount || 5,
                },
            });
        } catch (e) {
            logger.warn('Assessment agent not available, falling back to database');
        }

        // Get existing quiz from database
        const [existingQuiz]: any = await db.query(
            `SELECT q.id, qq.question_en, qq.question_vi, qo.option_en, qo.option_vi, qo.is_correct
             FROM quizzes q
             JOIN quiz_questions qq ON q.id = qq.quiz_id
             JOIN quiz_options qo ON qq.id = qo.question_id
             WHERE q.lesson_id = ?
             ORDER BY qq.order_index, qo.order_index`,
            [lessonId]
        );

        res.json({
            success: true,
            data: {
                lessonId,
                courseId,
                agentQuestions: agentQuiz?.questions || null,
                existingQuiz: existingQuiz.length > 0 ? existingQuiz : null,
            },
            source: agentQuiz ? 'agent+database' : 'database',
        });
    } catch (error: any) {
        logger.error('Quiz generation error:', { message: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.post('/grade-response', authenticate, async (req: Request, res: Response) => {
    try {
        const { questionId, studentResponse, correctAnswer, questionType } = req.body;

        // Call assessment agent for grading
        const result = await callAgent(`${AGENT_URLS.assessment}/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: {
                question_id: questionId,
                student_response: studentResponse,
                correct_answer: correctAnswer,
                question_type: questionType || 'multiple_choice',
            },
        });

        res.json({
            success: true,
            data: result,
            source: 'agent',
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ============================================
// ORCHESTRATION AGENT ENDPOINTS
// ============================================

router.get('/orchestration/status', authenticate, async (req: Request, res: Response) => {
    try {
        // Get system status from orchestration agent
        const status = await callAgent(`${AGENT_URLS.orchestration}/health`);

        res.json({
            success: true,
            data: status,
            source: 'agent',
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

router.get('/orchestration/metrics', authenticate, async (req: Request, res: Response) => {
    try {
        // Get metrics from orchestration agent
        const metrics = await callAgent(`${AGENT_URLS.orchestration}/metrics`);

        res.json({
            success: true,
            data: metrics,
            source: 'agent',
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ============================================
// MINDMAP (Knowledge Graph based)
// ============================================

router.get('/mindmap/:courseId', async (req: Request, res: Response) => {
    try {
        const courseId = parseInt(req.params.courseId);

        // Get course with lessons from MySQL
        const [courseData]: any = await db.query(
            `SELECT c.id, c.title_vi as title, c.title_en, cat.name_vi as category
             FROM courses c
             JOIN categories cat ON c.category_id = cat.id
             WHERE c.id = ?`,
            [courseId]
        );

        if (courseData.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Course not found',
            });
        }

        const [lessons]: any = await db.query(
            `SELECT id, title_vi as title, title_en, order_index
             FROM lessons
             WHERE course_id = ?
             ORDER BY order_index`,
            [courseId]
        );

        const course = courseData[0];

        // Build mindmap structure
        const mindmap = {
            id: `course-${courseId}`,
            name: course.title || course.title_en,
            children: lessons.map((lesson: any) => ({
                id: `lesson-${lesson.id}`,
                name: lesson.title || lesson.title_en,
                order: lesson.order_index,
            })),
        };

        res.json({
            success: true,
            data: mindmap,
            source: 'database',
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ============================================
// TRANSLATION (placeholder - would need translation agent)
// ============================================

router.post('/translate', async (req: Request, res: Response) => {
    try {
        const { text, sourceLang, targetLang } = req.body;

        if (!text || !targetLang) {
            return res.status(400).json({
                success: false,
                error: 'text and targetLang are required',
            });
        }

        // For now, return the original text
        // In production, would call translation agent
        res.json({
            success: true,
            data: {
                original: text,
                translated: text,
                sourceLang: sourceLang || 'auto',
                targetLang,
                confidence: 0.95,
            },
            source: 'mock',
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ============================================
// CONTENT VALIDATION
// ============================================

router.post('/validate-content', authenticate, async (req: Request, res: Response) => {
    try {
        const { contentType, contentId, title, description, content } = req.body;

        // Simple content validation
        const issues: string[] = [];
        const suggestions: string[] = [];
        let score = 100;

        if (!title || title.length < 10) {
            issues.push('Title is too short');
            suggestions.push('Use a descriptive title with at least 10 characters');
            score -= 20;
        }

        if (!description || description.length < 50) {
            issues.push('Description is too short');
            suggestions.push('Add more details to the description (at least 50 characters)');
            score -= 20;
        }

        if (!content || content.length < 100) {
            issues.push('Content is too short');
            suggestions.push('Expand your content with more details');
            score -= 30;
        }

        res.json({
            success: true,
            data: {
                contentType,
                contentId,
                qualityScore: Math.max(0, score),
                issues,
                suggestions,
                status: score >= 70 ? 'good' : score >= 50 ? 'needs_improvement' : 'poor',
            },
            source: 'local',
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ============================================
// CONTENT INGESTION - Process Documents (PDF/DOCX/PPTX)
// ============================================

router.post('/ingest-document', authenticate, uploadDocument.single('document'), async (req: AuthRequest, res: Response) => {
    try {
        const formData = new (await import('form-data')).default();

        // Get file from request
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        // Prepare metadata
        const metadata = JSON.stringify({
            subject: req.body.subject || 'general',
            language: req.body.language || 'vi',
            author: (req as any).user?.name || 'Unknown',
            tags: req.body.tags ? req.body.tags.split(',') : []
        });

        // Forward to content ingestion agent
        const fs = await import('fs');
        formData.append('file', fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });
        formData.append('metadata', metadata);

        const result = await callAgent(`${AGENT_URLS.contentIngestion}/ingest`, {
            method: 'POST',
            data: formData,
            headers: formData.getHeaders(),
            timeout: 800000
        });

        // Clean up temp file
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            data: result,
            message: 'Document processing started'
        });
    } catch (error: any) {
        logger.error('Document ingestion failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process document'
        });
    }
});

// Get document processing status
router.get('/ingest-status/:jobId', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { jobId } = req.params;

        const result = await callAgent(`${AGENT_URLS.contentIngestion}/status/${jobId}`);

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get status'
        });
    }
});

// ============================================
// ASSESSMENT GENERATION - Auto-generate questions
// ============================================

router.post('/generate-questions', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { conceptId, numQuestions, difficulty, questionTypes } = req.body;

        if (!conceptId) {
            return res.status(400).json({
                success: false,
                error: 'conceptId is required'
            });
        }

        const result = await callAgent(`${AGENT_URLS.assessment}/generate-questions`, {
            method: 'POST',
            data: {
                concept_id: conceptId,
                num_questions: numQuestions || 5,
                difficulty: difficulty || 3,
                question_types: questionTypes || null
            }
        });

        res.json({
            success: true,
            data: result.questions,
            message: `Generated ${result.questions?.length || 0} questions`
        });
    } catch (error: any) {
        logger.error('Question generation failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate questions'
        });
    }
});

// Generate questions by Bloom's taxonomy
router.post('/generate-questions-blooms', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { concept, level, numQuestions } = req.body;

        if (!concept || !level) {
            return res.status(400).json({
                success: false,
                error: 'concept and level are required'
            });
        }

        const result = await callAgent(`${AGENT_URLS.assessment}/generate-by-blooms`, {
            method: 'POST',
            data: {
                concept,
                level,
                num_questions: numQuestions || 3
            }
        });

        res.json({
            success: true,
            data: result,
            message: `Generated ${result.questions?.length || 0} ${level} level questions`
        });
    } catch (error: any) {
        logger.error('Blooms question generation failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate questions'
        });
    }
});

// Create quiz from concepts
router.post('/create-quiz', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { conceptIds, numQuestions, difficultyRange, bloomsDistribution } = req.body;

        if (!conceptIds || !Array.isArray(conceptIds) || conceptIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'conceptIds array is required'
            });
        }

        const result = await callAgent(`${AGENT_URLS.assessment}/quiz`, {
            method: 'POST',
            data: {
                concept_ids: conceptIds,
                num_questions: numQuestions || 10,
                difficulty_range: difficultyRange || [2, 4],
                blooms_distribution: bloomsDistribution || null
            }
        });

        res.json({
            success: true,
            data: result,
            message: `Quiz created with ${result.questions?.length || 0} questions`
        });
    } catch (error: any) {
        logger.error('Quiz creation failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create quiz'
        });
    }
});

// ============================================
// AI-ASSISTED COURSE CREATION
// ============================================

router.post('/analyze-document-for-course', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        // This endpoint analyzes a document and returns structured course content
        const { fileId, generateQuestions } = req.body;

        // Get processed content from content ingestion agent
        const contentResult = await callAgent(`${AGENT_URLS.contentIngestion}/status/${fileId}`);

        if (contentResult.status !== 'completed') {
            return res.json({
                success: false,
                error: 'Document still processing',
                data: contentResult
            });
        }

        const extractedContent = contentResult.result;

        // If requested, also generate questions for extracted concepts
        let questions: any[] = [];
        if (generateQuestions && extractedContent?.concepts?.length > 0) {
            const conceptIds = extractedContent.concepts.slice(0, 5).map((c: any) => c.text);

            for (const conceptId of conceptIds) {
                try {
                    const questionResult = await callAgent(`${AGENT_URLS.assessment}/generate-questions`, {
                        method: 'POST',
                        data: {
                            concept_id: conceptId,
                            num_questions: 3,
                            difficulty: 3
                        }
                    });

                    if (questionResult.questions) {
                        questions = [...questions, ...questionResult.questions];
                    }
                } catch (e) {
                    logger.warn('Failed to generate questions for concept', { conceptId });
                }
            }
        }

        // Structure response for course creation
        res.json({
            success: true,
            data: {
                title: extractedContent?.classification?.primary_subject || 'New Course',
                description: extractedContent?.content?.summary || '',
                level: extractedContent?.classification?.difficulty || 'intermediate',
                concepts: extractedContent?.concepts || [],
                relationships: extractedContent?.relationships || [],
                suggestedLessons: structureLessonsFromContent(extractedContent),
                generatedQuestions: questions,
                bloomsLevel: extractedContent?.classification?.blooms_level || 'understand'
            },
            message: 'Document analyzed successfully'
        });
    } catch (error: any) {
        logger.error('Document analysis failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to analyze document'
        });
    }
});

// Helper function to structure lessons from extracted content
function structureLessonsFromContent(content: any): any[] {
    if (!content?.content?.sections) {
        return [];
    }

    return content.content.sections.map((section: any, index: number) => ({
        title: section.title || `Lesson ${index + 1}`,
        content: section.text || '',
        order_index: index + 1,
        duration: Math.ceil((section.text?.split(' ').length || 0) / 200) * 5 // ~5 min per 200 words
    }));
}

// ============================================
// RELATED COURSES
// ============================================

router.get('/related-courses/:courseId', async (req: Request, res: Response) => {
    try {
        const courseId = parseInt(req.params.courseId);
        const limit = parseInt(req.query.limit as string) || 5;

        const [courses]: any = await db.query(
            `SELECT c.id, c.title_vi as title, c.title_en, c.thumbnail, 
                    c.rating, c.total_students, c.level, cat.name_vi as category
             FROM courses c
             JOIN categories cat ON c.category_id = cat.id
             WHERE c.category_id = (SELECT category_id FROM courses WHERE id = ?)
               AND c.id != ?
               AND c.is_published = 1
             ORDER BY c.rating DESC, c.total_students DESC
             LIMIT ?`,
            [courseId, courseId, limit]
        );

        res.json({
            success: true,
            data: courses.map((c: any) => ({
                id: c.id,
                title: c.title || c.title_en,
                thumbnail: c.thumbnail,
                rating: c.rating,
                totalStudents: c.total_students,
                level: c.level,
                category: c.category,
            })),
            source: 'database',
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ============================================
// AUTO-GENERATED QUIZ ENDPOINTS
// ============================================

import { AutoGeneratedQuizModel } from '../models/AutoGeneratedQuiz.js';
import AutoQuizService from '../services/autoQuizService.js';

// Get all auto quizzes for current user
router.get('/auto-quiz/my-quizzes', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const quizzes = await AutoGeneratedQuizModel.getAllForUser(userId);
        const stats = await AutoGeneratedQuizModel.getStats(userId);

        res.json({
            success: true,
            data: {
                quizzes: quizzes.map(q => ({
                    id: q.id,
                    title: q.title,
                    description: q.description,
                    courseTitle: q.course_title || q.course_title_vi,
                    courseId: q.course_id,
                    passingScore: q.passing_score,
                    timeLimit: q.time_limit,
                    status: q.status,
                    score: q.score,
                    passed: q.passed,
                    attemptedAt: q.attempted_at,
                    createdAt: q.created_at,
                    questionCount: JSON.parse(q.questions_data).length,
                })),
                stats,
            },
        });
    } catch (error: any) {
        logger.error('Failed to get auto quizzes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get pending quizzes for current user
router.get('/auto-quiz/pending', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const quizzes = await AutoGeneratedQuizModel.getPendingForUser(userId);

        res.json({
            success: true,
            data: quizzes.map(q => ({
                id: q.id,
                title: q.title,
                description: q.description,
                courseTitle: q.course_title || q.course_title_vi,
                courseId: q.course_id,
                passingScore: q.passing_score,
                timeLimit: q.time_limit,
                questionCount: JSON.parse(q.questions_data).length,
                createdAt: q.created_at,
            })),
        });
    } catch (error: any) {
        logger.error('Failed to get pending auto quizzes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get quiz detail by ID
router.get('/auto-quiz/:quizId', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const quizId = parseInt(req.params.quizId);

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const quiz = await AutoGeneratedQuizModel.getById(quizId, userId);
        if (!quiz) {
            return res.status(404).json({ success: false, error: 'Quiz not found' });
        }

        const questions = JSON.parse(quiz.questions_data);

        res.json({
            success: true,
            data: {
                id: quiz.id,
                title: quiz.title,
                description: quiz.description,
                courseTitle: quiz.course_title || quiz.course_title_vi,
                courseId: quiz.course_id,
                passingScore: quiz.passing_score,
                timeLimit: quiz.time_limit,
                status: quiz.status,
                score: quiz.score,
                passed: quiz.passed,
                attemptedAt: quiz.attempted_at,
                createdAt: quiz.created_at,
                questions: quiz.status === 'pending'
                    ? questions.map((q: any, idx: number) => ({
                        index: idx,
                        question: q.question,
                        type: q.type,
                        options: q.options,
                        difficulty: q.difficulty,
                        bloomLevel: q.bloom_level,
                    }))
                    : questions.map((q: any, idx: number) => ({
                        index: idx,
                        question: q.question,
                        type: q.type,
                        options: q.options,
                        correctAnswer: q.correct_answer,
                        explanation: q.explanation,
                        difficulty: q.difficulty,
                        bloomLevel: q.bloom_level,
                    })),
            },
        });
    } catch (error: any) {
        logger.error('Failed to get auto quiz:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit quiz attempt
router.post('/auto-quiz/:quizId/submit', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const quizId = parseInt(req.params.quizId);
        const { answers } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ success: false, error: 'Answers array required' });
        }

        const result = await AutoGeneratedQuizModel.submitAttempt(quizId, userId, answers);

        // Award points for completing quiz
        if (result.passed) {
            const [points]: any = await db.query(
                `SELECT id FROM points_history 
                 WHERE user_id = ? AND action = 'complete_auto_quiz' AND reference_id = ?`,
                [userId, quizId]
            );

            if (points.length === 0) {
                // Award bonus points for passing
                await db.query(
                    `INSERT INTO points_history (user_id, points, action, reference_id, description)
                     VALUES (?, 100, 'complete_auto_quiz', ?, 'Hoàn thành bài tập tổng kết')`,
                    [userId, quizId]
                );
                await db.query(
                    `UPDATE user_points SET total_points = total_points + 100 WHERE user_id = ?`,
                    [userId]
                );
            }
        }

        res.json({
            success: true,
            data: {
                score: result.score,
                passed: result.passed,
                passingScore: 70,
                results: result.results,
            },
        });
    } catch (error: any) {
        logger.error('Failed to submit auto quiz:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Manually trigger quiz generation (for testing or re-generation)
router.post('/auto-quiz/generate/:courseId', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const courseId = parseInt(req.params.courseId);

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Check if user has completed this course
        const [enrollments]: any = await db.query(
            `SELECT progress FROM enrollments WHERE user_id = ? AND course_id = ?`,
            [userId, courseId]
        );

        if (enrollments.length === 0 || enrollments[0].progress < 100) {
            return res.status(400).json({
                success: false,
                error: 'You must complete the course before generating a quiz'
            });
        }

        const quizId = await AutoQuizService.generateQuizForCompletion(userId, courseId);

        if (!quizId) {
            return res.status(400).json({
                success: false,
                error: 'Failed to generate quiz or quiz already exists'
            });
        }

        res.json({
            success: true,
            data: { quizId },
            message: 'Quiz generated successfully',
        });
    } catch (error: any) {
        logger.error('Failed to generate auto quiz:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;

