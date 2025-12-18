/**
 * Agent Integration Service
 * Communicates with the multi-agent system via Orchestration Agent
 */

import axios, { AxiosInstance } from 'axios';
import logger from './logger.js';

export interface AgentResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    agentName?: string;
    processingTime?: number;
}

export interface ContentQualityCheck {
    contentType: 'course' | 'lesson' | 'quiz';
    contentId: number;
    title: string;
    description?: string;
    content?: string;
}

export interface PersonalizationRequest {
    userId: number;
    courseHistory?: number[];
    currentLevel?: string;
    interests?: string[];
    limit?: number;
}

export interface QuizGenerationRequest {
    lessonId: number;
    courseId: number;
    content: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    questionCount: number;
}

export interface TranslationRequest {
    text: string;
    sourceLang: string;
    targetLang: string;
}

export interface AnalyticsRequest {
    userId?: number;
    courseId?: number;
    startDate?: Date;
    endDate?: Date;
    metrics: string[];
}

class AgentIntegrationService {
    private orchestrationClient: AxiosInstance;
    private baseUrl: string;
    private timeout: number;

    constructor() {
        this.baseUrl = process.env.ORCHESTRATION_AGENT_URL || 'http://orchestration-agent:8000';
        this.timeout = parseInt(process.env.AGENT_TIMEOUT || '30000');

        this.orchestrationClient = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-Source': 'learn-backend'
            }
        });

        // Add request interceptor for logging
        this.orchestrationClient.interceptors.request.use(
            (config) => {
                logger.debug(`Agent request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                logger.error('Agent request error:', error);
                return Promise.reject(error);
            }
        );

        // Add response interceptor for logging
        this.orchestrationClient.interceptors.response.use(
            (response) => {
                logger.debug(`Agent response: ${response.status} from ${response.config.url}`);
                return response;
            },
            (error) => {
                logger.error(`Agent response error:`, {
                    url: error.config?.url,
                    status: error.response?.status,
                    message: error.message
                });
                return Promise.reject(error);
            }
        );
    }

    /**
     * Health check for orchestration agent
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.orchestrationClient.get('/health');
            return response.status === 200;
        } catch (error) {
            logger.error('Orchestration agent health check failed:', error);
            return false;
        }
    }

    // ============================================
    // CONTENT QUALITY AGENT
    // ============================================

    /**
     * Validate content quality before publishing
     */
    async validateContent(check: ContentQualityCheck): Promise<AgentResponse<{
        passed: boolean;
        checks: {
            toxicity: { passed: boolean; score: number };
            plagiarism: { passed: boolean; score: number };
            bias: { passed: boolean; score: number };
            factCheck: { passed: boolean; score: number };
        };
        suggestions: string[];
    }>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'validate_content',
                targetAgent: 'content-quality',
                data: check
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'content-quality',
                processingTime: response.data.processingTime
            };
        } catch (error: any) {
            logger.error('Content validation failed:', error);
            return {
                success: false,
                error: error.message || 'Content validation failed'
            };
        }
    }

    /**
     * Check content for plagiarism
     */
    async checkPlagiarism(text: string, contentId: number): Promise<AgentResponse<{
        isPlagiarized: boolean;
        similarityScore: number;
        sources: Array<{ url: string; similarity: number }>;
    }>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'check_plagiarism',
                targetAgent: 'content-quality',
                data: { text, contentId }
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'content-quality'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Plagiarism check failed'
            };
        }
    }

    // ============================================
    // PERSONALIZATION AGENT
    // ============================================

    /**
     * Get personalized course recommendations
     */
    async getRecommendations(request: PersonalizationRequest): Promise<AgentResponse<{
        recommendations: Array<{
            courseId: number;
            score: number;
            reason: string;
            matchFactors: string[];
        }>;
    }>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'get_recommendations',
                targetAgent: 'personalization',
                data: request
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'personalization'
            };
        } catch (error: any) {
            logger.error('Recommendations failed:', error);
            return {
                success: false,
                error: error.message || 'Failed to get recommendations'
            };
        }
    }

    /**
     * Get adaptive learning path for user
     */
    async getAdaptiveLearningPath(userId: number, goalTopic: string): Promise<AgentResponse<{
        path: Array<{
            courseId: number;
            order: number;
            estimatedDuration: number;
            prerequisitesCompleted: boolean;
        }>;
        totalDuration: number;
    }>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'generate_learning_path',
                targetAgent: 'personalization',
                data: { userId, goalTopic }
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'personalization'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Failed to generate learning path'
            };
        }
    }

    // ============================================
    // ASSESSMENT AGENT
    // ============================================

    /**
     * Generate quiz questions from lesson content
     */
    async generateQuiz(request: QuizGenerationRequest): Promise<AgentResponse<{
        questions: Array<{
            question: string;
            type: 'multiple_choice' | 'true_false' | 'fill_in_blank';
            options?: string[];
            correctAnswer: string | number;
            explanation: string;
            difficulty: string;
        }>;
    }>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'generate_quiz',
                targetAgent: 'assessment',
                data: request
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'assessment'
            };
        } catch (error: any) {
            logger.error('Quiz generation failed:', error);
            return {
                success: false,
                error: error.message || 'Failed to generate quiz'
            };
        }
    }

    /**
     * Get adaptive quiz based on user performance
     */
    async getAdaptiveQuiz(userId: number, courseId: number, lessonId: number): Promise<AgentResponse<any>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'generate_adaptive_quiz',
                targetAgent: 'assessment',
                data: { userId, courseId, lessonId }
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'assessment'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Failed to generate adaptive quiz'
            };
        }
    }

    // ============================================
    // ANALYTICS AGENT
    // ============================================

    /**
     * Get analytics for user or course
     */
    async getAnalytics(request: AnalyticsRequest): Promise<AgentResponse<any>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'get_analytics',
                targetAgent: 'analytics',
                data: request
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'analytics'
            };
        } catch (error: any) {
            logger.error('Analytics request failed:', error);
            return {
                success: false,
                error: error.message || 'Failed to get analytics'
            };
        }
    }

    /**
     * Get dropout risk prediction for user
     */
    async getDropoutRisk(userId: number, courseId: number): Promise<AgentResponse<{
        riskScore: number;
        riskLevel: 'low' | 'medium' | 'high';
        factors: string[];
        interventionSuggestions: string[];
    }>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'predict_dropout_risk',
                targetAgent: 'analytics',
                data: { userId, courseId }
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'analytics'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Failed to predict dropout risk'
            };
        }
    }

    /**
     * Get engagement metrics
     */
    async getEngagementMetrics(userId: number): Promise<AgentResponse<{
        engagementScore: number;
        weeklyActivity: number[];
        streakDays: number;
        averageSessionTime: number;
        completionRate: number;
    }>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'get_engagement_metrics',
                targetAgent: 'analytics',
                data: { userId }
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'analytics'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Failed to get engagement metrics'
            };
        }
    }

    // ============================================
    // KNOWLEDGE GRAPH AGENT
    // ============================================

    /**
     * Get prerequisite courses
     */
    async getPrerequisites(courseId: number): Promise<AgentResponse<{
        prerequisites: Array<{
            courseId: number;
            title: string;
            importance: number;
        }>;
    }>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'get_prerequisites',
                targetAgent: 'knowledge-graph',
                data: { courseId }
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'knowledge-graph'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Failed to get prerequisites'
            };
        }
    }

    /**
     * Get related courses based on concepts
     */
    async getRelatedCourses(courseId: number, limit: number = 5): Promise<AgentResponse<any>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'get_related_courses',
                targetAgent: 'knowledge-graph',
                data: { courseId, limit }
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'knowledge-graph'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Failed to get related courses'
            };
        }
    }

    // ============================================
    // TRANSLATION AGENT
    // ============================================

    /**
     * Translate text to target language
     */
    async translate(request: TranslationRequest): Promise<AgentResponse<{
        translatedText: string;
        detectedLang?: string;
    }>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'translate',
                targetAgent: 'translation',
                data: request
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'translation'
            };
        } catch (error: any) {
            logger.error('Translation failed:', error);
            return {
                success: false,
                error: error.message || 'Translation failed'
            };
        }
    }

    /**
     * Auto-translate course content
     */
    async translateCourse(courseId: number, targetLang: string): Promise<AgentResponse<any>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'translate_course',
                targetAgent: 'translation',
                data: { courseId, targetLang }
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'translation'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Course translation failed'
            };
        }
    }

    // ============================================
    // VISUAL GENERATION AGENT
    // ============================================

    /**
     * Generate thumbnail for course
     */
    async generateThumbnail(courseId: number, title: string, category: string): Promise<AgentResponse<{
        imageUrl: string;
        s3Key: string;
    }>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'generate_thumbnail',
                targetAgent: 'visual-generation',
                data: { courseId, title, category }
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'visual-generation'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Thumbnail generation failed'
            };
        }
    }

    // ============================================
    // MINDMAP AGENT
    // ============================================

    /**
     * Generate mindmap for course
     */
    async generateMindmap(courseId: number): Promise<AgentResponse<{
        mindmapData: any;
        imageUrl: string;
    }>> {
        try {
            const response = await this.orchestrationClient.post('/route', {
                task: 'generate_mindmap',
                targetAgent: 'mindmap',
                data: { courseId }
            });
            return {
                success: true,
                data: response.data.result,
                agentName: 'mindmap'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Mindmap generation failed'
            };
        }
    }
}

// Singleton instance
export const agentService = new AgentIntegrationService();

export default agentService;
