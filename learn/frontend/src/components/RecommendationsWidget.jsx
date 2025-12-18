/**
 * Course Recommendations Widget
 * Shows AI-powered personalized course recommendations
 */

import React, { useState, useEffect } from 'react';
import agentService from '../services/agentService';
import { Link } from 'react-router-dom';
import '../styles/RecommendationsWidget.css';

export const RecommendationsWidget = ({ limit = 6 }) => {
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadRecommendations();
    }, []);

    const loadRecommendations = async () => {
        try {
            setLoading(true);
            const response = await agentService.getRecommendations({ limit });

            if (response.success && response.data) {
                setRecommendations(response.data.recommendations || []);
            }
        } catch (err) {
            setError(err.message);
            console.error('Failed to load recommendations:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="recommendations-widget loading">
                <div className="widget-header">
                    <h3>🎯 Recommended for You</h3>
                </div>
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>AI is analyzing your learning profile...</p>
                </div>
            </div>
        );
    }

    if (error || recommendations.length === 0) {
        return null; // Hide widget if error or no recommendations
    }

    return (
        <div className="recommendations-widget">
            <div className="widget-header">
                <h3>🎯 AI-Powered Recommendations</h3>
                <span className="ai-badge">Powered by AI</span>
            </div>

            <div className="recommendations-grid">
                {recommendations.map((rec) => (
                    <div key={rec.courseId} className="recommendation-card">
                        <div className="card-content">
                            <div className="course-info">
                                <h4>{rec.title || `Course ${rec.courseId}`}</h4>
                                <p className="reason">{rec.reason}</p>
                            </div>

                            <div className="match-score">
                                <div className="score-circle" style={{ '--score': rec.score }}>
                                    <span>{Math.round(rec.score * 100)}%</span>
                                </div>
                                <span className="match-label">Match</span>
                            </div>
                        </div>

                        {rec.matchFactors && rec.matchFactors.length > 0 && (
                            <div className="match-factors">
                                {rec.matchFactors.slice(0, 3).map((factor, idx) => (
                                    <span key={idx} className="factor-tag">{factor}</span>
                                ))}
                            </div>
                        )}

                        <Link
                            to={`/courses/${rec.courseId}`}
                            className="view-course-btn"
                        >
                            View Course →
                        </Link>
                    </div>
                ))}
            </div>

            <button
                onClick={loadRecommendations}
                className="refresh-btn"
            >
                🔄 Refresh Recommendations
            </button>
        </div>
    );
};

export default RecommendationsWidget;
