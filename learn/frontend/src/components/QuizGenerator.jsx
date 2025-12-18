/**
 * Quiz Generator Component
 * AI-powered quiz generation from lesson content
 */

import React, { useState } from 'react';
import agentService from '../services/agentService';
import '../styles/QuizGenerator.css';

export const QuizGenerator = ({ lessonId, courseId, lessonContent }) => {
    const [generating, setGenerating] = useState(false);
    const [generatedQuiz, setGeneratedQuiz] = useState(null);
    const [error, setError] = useState(null);
    const [settings, setSettings] = useState({
        difficulty: 'intermediate',
        questionCount: 5
    });

    const handleGenerate = async () => {
        if (!lessonContent || lessonContent.trim().length < 100) {
            setError('Lesson content must be at least 100 characters to generate quiz');
            return;
        }

        try {
            setGenerating(true);
            setError(null);

            const response = await agentService.generateQuiz({
                lessonId,
                courseId,
                content: lessonContent,
                difficulty: settings.difficulty,
                questionCount: settings.questionCount
            });

            if (response.success && response.data) {
                setGeneratedQuiz(response.data);
            } else {
                setError(response.error || 'Failed to generate quiz');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveQuiz = () => {
        // This would integrate with your quiz save functionality
        console.log('Saving quiz:', generatedQuiz);
        alert('Quiz saved successfully! (Integrate with your save API)');
    };

    return (
        <div className="quiz-generator">
            <div className="generator-header">
                <h3>🤖 AI Quiz Generator</h3>
                <span className="ai-badge">Powered by AI</span>
            </div>

            <div className="generator-settings">
                <div className="setting-group">
                    <label>Difficulty Level:</label>
                    <select
                        value={settings.difficulty}
                        onChange={(e) => setSettings({ ...settings, difficulty: e.target.value })}
                        disabled={generating}
                    >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                    </select>
                </div>

                <div className="setting-group">
                    <label>Number of Questions:</label>
                    <input
                        type="number"
                        min="3"
                        max="10"
                        value={settings.questionCount}
                        onChange={(e) => setSettings({ ...settings, questionCount: parseInt(e.target.value) })}
                        disabled={generating}
                    />
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={generating || !lessonContent}
                    className="generate-btn"
                >
                    {generating ? (
                        <>
                            <span className="spinner-small"></span>
                            Generating...
                        </>
                    ) : (
                        <>✨ Generate Quiz</>
                    )}
                </button>
            </div>

            {error && (
                <div className="error-message">
                    ⚠️ {error}
                </div>
            )}

            {generatedQuiz && generatedQuiz.questions && (
                <div className="generated-quiz">
                    <div className="quiz-header">
                        <h4>Generated Quiz ({generatedQuiz.questions.length} questions)</h4>
                        <button onClick={handleSaveQuiz} className="save-btn">
                            💾 Save Quiz
                        </button>
                    </div>

                    <div className="questions-list">
                        {generatedQuiz.questions.map((q, index) => (
                            <div key={index} className="question-card">
                                <div className="question-header">
                                    <span className="question-number">Q{index + 1}</span>
                                    <span className="question-type">{q.type}</span>
                                    <span className="difficulty-badge">{q.difficulty}</span>
                                </div>

                                <div className="question-text">{q.question}</div>

                                {q.options && q.options.length > 0 && (
                                    <div className="question-options">
                                        {q.options.map((option, optIdx) => (
                                            <div
                                                key={optIdx}
                                                className={`option ${optIdx === q.correctAnswer || option === q.correctAnswer ? 'correct' : ''}`}
                                            >
                                                <span className="option-letter">
                                                    {String.fromCharCode(65 + optIdx)}
                                                </span>
                                                <span className="option-text">{option}</span>
                                                {(optIdx === q.correctAnswer || option === q.correctAnswer) && (
                                                    <span className="correct-marker">✓</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {q.explanation && (
                                    <div className="question-explanation">
                                        <strong>💡 Explanation:</strong> {q.explanation}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuizGenerator;
