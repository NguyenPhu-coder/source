/**
 * Kafka Event Publisher Service
 * Publishes events from Learn Platform to agent system
 */

import { Kafka, Producer, ProducerRecord, RecordMetadata } from 'kafkajs';
import logger from './logger';

export interface LearnEvent {
    eventType: string;
    userId?: number;
    courseId?: number;
    lessonId?: number;
    quizId?: number;
    data: Record<string, any>;
    timestamp: Date;
}

class EventPublisher {
    private kafka: Kafka;
    private producer: Producer;
    private isConnected: boolean = false;

    constructor() {
        const brokers = process.env.KAFKA_BROKERS?.split(',') || ['kafka:29092'];

        this.kafka = new Kafka({
            clientId: 'learn-backend',
            brokers: brokers,
            retry: {
                initialRetryTime: 100,
                retries: 8
            }
        });

        this.producer = this.kafka.producer({
            allowAutoTopicCreation: true,
            transactionTimeout: 30000
        });
    }

    /**
     * Connect to Kafka
     */
    async connect(): Promise<void> {
        try {
            await this.producer.connect();
            this.isConnected = true;
            logger.info('Kafka producer connected successfully');
        } catch (error) {
            logger.error('Failed to connect Kafka producer:', error);
            throw error;
        }
    }

    /**
     * Disconnect from Kafka
     */
    async disconnect(): Promise<void> {
        try {
            await this.producer.disconnect();
            this.isConnected = false;
            logger.info('Kafka producer disconnected');
        } catch (error) {
            logger.error('Error disconnecting Kafka producer:', error);
        }
    }

    /**
     * Publish event to Kafka
     */
    async publish(topic: string, event: LearnEvent): Promise<RecordMetadata[]> {
        if (!this.isConnected) {
            logger.warn('Kafka producer not connected, skipping event publish');
            return [];
        }

        try {
            const message: ProducerRecord = {
                topic,
                messages: [
                    {
                        key: event.userId?.toString() || 'system',
                        value: JSON.stringify({
                            ...event,
                            timestamp: event.timestamp.toISOString()
                        }),
                        headers: {
                            'event-type': event.eventType,
                            'source': 'learn-backend'
                        }
                    }
                ]
            };

            const result = await this.producer.send(message);
            logger.debug(`Event published to ${topic}:`, event.eventType);
            return result;
        } catch (error) {
            logger.error(`Failed to publish event to ${topic}:`, error);
            // Don't throw - we don't want to break the main flow if Kafka fails
            return [];
        }
    }

    // ============================================
    // USER EVENTS
    // ============================================

    async publishUserRegistered(userId: number, userData: any): Promise<void> {
        await this.publish('user.events', {
            eventType: 'user.registered',
            userId,
            data: userData,
            timestamp: new Date()
        });
    }

    async publishUserLoggedIn(userId: number): Promise<void> {
        await this.publish('user.events', {
            eventType: 'user.logged_in',
            userId,
            data: {},
            timestamp: new Date()
        });
    }

    async publishUserProfileUpdated(userId: number, updates: any): Promise<void> {
        await this.publish('user.events', {
            eventType: 'user.profile_updated',
            userId,
            data: updates,
            timestamp: new Date()
        });
    }

    // ============================================
    // COURSE EVENTS
    // ============================================

    async publishCourseCreated(courseId: number, instructorId: number, courseData: any): Promise<void> {
        await this.publish('course.events', {
            eventType: 'course.created',
            userId: instructorId,
            courseId,
            data: courseData,
            timestamp: new Date()
        });
    }

    async publishCourseUpdated(courseId: number, updates: any): Promise<void> {
        await this.publish('course.events', {
            eventType: 'course.updated',
            courseId,
            data: updates,
            timestamp: new Date()
        });
    }

    async publishCoursePublished(courseId: number, instructorId: number): Promise<void> {
        await this.publish('course.events', {
            eventType: 'course.published',
            userId: instructorId,
            courseId,
            data: {},
            timestamp: new Date()
        });
    }

    async publishCourseApproved(courseId: number, approvedBy: number): Promise<void> {
        await this.publish('course.events', {
            eventType: 'course.approved',
            userId: approvedBy,
            courseId,
            data: {},
            timestamp: new Date()
        });
    }

    async publishCourseRejected(courseId: number, rejectedBy: number, reason: string): Promise<void> {
        await this.publish('course.events', {
            eventType: 'course.rejected',
            userId: rejectedBy,
            courseId,
            data: { reason },
            timestamp: new Date()
        });
    }

    // ============================================
    // ENROLLMENT EVENTS
    // ============================================

    async publishCourseEnrolled(userId: number, courseId: number): Promise<void> {
        await this.publish('enrollment.events', {
            eventType: 'course.enrolled',
            userId,
            courseId,
            data: {},
            timestamp: new Date()
        });
    }

    async publishCourseCompleted(userId: number, courseId: number, completionData: any): Promise<void> {
        await this.publish('enrollment.events', {
            eventType: 'course.completed',
            userId,
            courseId,
            data: completionData,
            timestamp: new Date()
        });
    }

    async publishCourseDropped(userId: number, courseId: number, reason?: string): Promise<void> {
        await this.publish('enrollment.events', {
            eventType: 'course.dropped',
            userId,
            courseId,
            data: { reason },
            timestamp: new Date()
        });
    }

    // ============================================
    // LESSON EVENTS
    // ============================================

    async publishLessonStarted(userId: number, lessonId: number, courseId: number): Promise<void> {
        await this.publish('lesson.events', {
            eventType: 'lesson.started',
            userId,
            courseId,
            lessonId,
            data: {},
            timestamp: new Date()
        });
    }

    async publishLessonCompleted(userId: number, lessonId: number, courseId: number, timeSpent: number): Promise<void> {
        await this.publish('lesson.events', {
            eventType: 'lesson.completed',
            userId,
            courseId,
            lessonId,
            data: { timeSpent },
            timestamp: new Date()
        });
    }

    async publishVideoProgress(userId: number, lessonId: number, courseId: number, progress: number): Promise<void> {
        await this.publish('lesson.events', {
            eventType: 'video.progress',
            userId,
            courseId,
            lessonId,
            data: { progress },
            timestamp: new Date()
        });
    }

    // ============================================
    // QUIZ EVENTS
    // ============================================

    async publishQuizStarted(userId: number, quizId: number, lessonId: number, courseId: number): Promise<void> {
        await this.publish('quiz.events', {
            eventType: 'quiz.started',
            userId,
            courseId,
            lessonId,
            quizId,
            data: {},
            timestamp: new Date()
        });
    }

    async publishQuizCompleted(
        userId: number,
        quizId: number,
        lessonId: number,
        courseId: number,
        score: number,
        passed: boolean,
        timeTaken: number
    ): Promise<void> {
        await this.publish('quiz.events', {
            eventType: 'quiz.completed',
            userId,
            courseId,
            lessonId,
            quizId,
            data: { score, passed, timeTaken },
            timestamp: new Date()
        });
    }

    // ============================================
    // GAMIFICATION EVENTS
    // ============================================

    async publishPointsEarned(userId: number, points: number, activity: string, relatedId?: number): Promise<void> {
        await this.publish('gamification.events', {
            eventType: 'points.earned',
            userId,
            data: { points, activity, relatedId },
            timestamp: new Date()
        });
    }

    async publishBadgeEarned(userId: number, badgeId: number, badgeName: string): Promise<void> {
        await this.publish('gamification.events', {
            eventType: 'badge.earned',
            userId,
            data: { badgeId, badgeName },
            timestamp: new Date()
        });
    }

    async publishStreakUpdated(userId: number, streakDays: number, isNewRecord: boolean): Promise<void> {
        await this.publish('gamification.events', {
            eventType: 'streak.updated',
            userId,
            data: { streakDays, isNewRecord },
            timestamp: new Date()
        });
    }

    // ============================================
    // REVIEW EVENTS
    // ============================================

    async publishReviewSubmitted(userId: number, courseId: number, rating: number, comment: string): Promise<void> {
        await this.publish('review.events', {
            eventType: 'review.submitted',
            userId,
            courseId,
            data: { rating, comment },
            timestamp: new Date()
        });
    }

    // ============================================
    // ANALYTICS EVENTS
    // ============================================

    async publishPageView(userId: number | undefined, page: string, referrer?: string): Promise<void> {
        await this.publish('analytics.events', {
            eventType: 'page.viewed',
            userId,
            data: { page, referrer },
            timestamp: new Date()
        });
    }

    async publishSearchPerformed(userId: number | undefined, query: string, resultsCount: number): Promise<void> {
        await this.publish('analytics.events', {
            eventType: 'search.performed',
            userId,
            data: { query, resultsCount },
            timestamp: new Date()
        });
    }
}

// Singleton instance
export const eventPublisher = new EventPublisher();

export default eventPublisher;
