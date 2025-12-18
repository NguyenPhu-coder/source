/**
 * Example: Course Detail Page with Avatar Teacher Integration
 * Shows how to integrate the Avatar Teacher into existing course pages
 */

import React, { useState, useEffect } from 'react';
import { AvatarTeacher, AvatarCustomizer } from '../components';
import '../styles/CourseDetailWithAvatar.css';

export function CourseDetailWithAvatar() {
    const [course, setCourse] = useState(null);
    const [currentLesson, setCurrentLesson] = useState(null);
    const [viewMode, setViewMode] = useState('text'); // 'text' or 'avatar'
    const [showCustomizer, setShowCustomizer] = useState(false);
    const userId = 1; // Get from auth context

    // Example lesson data
    const exampleLesson = {
        id: 1,
        title: "Introduction to React Hooks",
        content: `Welcome to this lesson on React Hooks! 

React Hooks are functions that let you use state and other React features in functional components. They were introduced in React 16.8 and have revolutionized how we write React applications.

The most commonly used hooks are useState and useEffect. useState allows you to add state to functional components, while useEffect lets you perform side effects like data fetching, subscriptions, or manual DOM manipulation.

Let's explore how these hooks work and when to use them. Remember, hooks follow specific rules - they must be called at the top level of your component and only from React functions.

By the end of this lesson, you'll understand how to use hooks effectively in your React applications. Are you ready to learn?`
    };

    useEffect(() => {
        setCurrentLesson(exampleLesson);
    }, []);

    const toggleViewMode = () => {
        setViewMode(prev => prev === 'text' ? 'avatar' : 'text');
    };

    if (!currentLesson) {
        return <div>Loading...</div>;
    }

    return (
        <div className="course-detail-with-avatar">
            {/* Header */}
            <div className="course-header">
                <h1>{currentLesson.title}</h1>

                <div className="header-actions">
                    <button
                        onClick={toggleViewMode}
                        className={`mode-toggle ${viewMode}`}
                    >
                        {viewMode === 'text' ? '🎭 Switch to Avatar Teacher' : '📖 Switch to Text Mode'}
                    </button>

                    {viewMode === 'avatar' && (
                        <button
                            onClick={() => setShowCustomizer(true)}
                            className="customize-btn"
                        >
                            ⚙️ Customize Avatar
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="course-content">
                {viewMode === 'text' ? (
                    <div className="text-mode">
                        <div className="lesson-text">
                            {currentLesson.content.split('\n\n').map((paragraph, idx) => (
                                <p key={idx}>{paragraph}</p>
                            ))}
                        </div>

                        <div className="text-mode-cta">
                            <div className="cta-card">
                                <h3>🎭 Want a more interactive experience?</h3>
                                <p>Try our AI Avatar Teacher! Get personalized narration with gestures and expressions.</p>
                                <button onClick={toggleViewMode} className="cta-btn">
                                    Launch Avatar Teacher
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <AvatarTeacher
                        lessonId={currentLesson.id}
                        content={currentLesson.content}
                        lessonTitle={currentLesson.title}
                    />
                )}
            </div>

            {/* Customizer Modal */}
            {showCustomizer && (
                <div className="modal-overlay" onClick={() => setShowCustomizer(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="modal-close"
                            onClick={() => setShowCustomizer(false)}
                        >
                            ×
                        </button>
                        <AvatarCustomizer
                            userId={userId}
                            onSave={(preferences) => {
                                console.log('Saved preferences:', preferences);
                                setShowCustomizer(false);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default CourseDetailWithAvatar;
