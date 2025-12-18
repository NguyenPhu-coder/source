/**
 * Analytics Dashboard Component
 * Shows AI-powered analytics and insights
 */

import React, { useState, useEffect } from 'react';
import agentService from '../services/agentService';
import '../styles/AnalyticsDashboard.css';

const StatCard = ({ title, value, trend, icon, color }) => (
    <div className="stat-card" style={{ borderTopColor: color }}>
        <div className="stat-icon" style={{ background: `${color}20`, color }}>
            {icon}
        </div>
        <div className="stat-content">
            <h4>{title}</h4>
            <div className="stat-value">{value}</div>
            {trend && (
                <div className={`stat-trend ${trend > 0 ? 'up' : 'down'}`}>
                    {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                </div>
            )}
        </div>
    </div>
);

const EngagementChart = ({ data }) => {
    if (!data || data.length === 0) return null;

    const maxValue = Math.max(...data);

    return (
        <div className="engagement-chart">
            <h3>📊 Weekly Activity</h3>
            <div className="chart-bars">
                {data.map((value, index) => (
                    <div key={index} className="bar-container">
                        <div
                            className="bar"
                            style={{
                                height: `${(value / maxValue) * 100}%`,
                                background: `hsl(${220 + index * 10}, 70%, 50%)`
                            }}
                        >
                            <span className="bar-value">{value}</span>
                        </div>
                        <span className="bar-label">Day {index + 1}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DropoutRiskAlert = ({ risk }) => {
    if (!risk || risk.riskLevel === 'low') return null;

    const colorMap = {
        high: '#f44336',
        medium: '#ff9800',
        low: '#4caf50'
    };

    return (
        <div
            className="dropout-alert"
            style={{ borderLeftColor: colorMap[risk.riskLevel] }}
        >
            <div className="alert-header">
                <span className="alert-icon">⚠️</span>
                <h4>Dropout Risk: {risk.riskLevel.toUpperCase()}</h4>
                <span className="risk-score">{(risk.riskScore * 100).toFixed(0)}%</span>
            </div>

            {risk.factors && risk.factors.length > 0 && (
                <div className="risk-factors">
                    <strong>Risk Factors:</strong>
                    <ul>
                        {risk.factors.map((factor, idx) => (
                            <li key={idx}>{factor}</li>
                        ))}
                    </ul>
                </div>
            )}

            {risk.interventionSuggestions && risk.interventionSuggestions.length > 0 && (
                <div className="interventions">
                    <strong>💡 Recommended Actions:</strong>
                    <ul>
                        {risk.interventionSuggestions.map((suggestion, idx) => (
                            <li key={idx}>{suggestion}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export const AnalyticsDashboard = ({ courseId }) => {
    const [engagement, setEngagement] = useState(null);
    const [dropoutRisk, setDropoutRisk] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAnalytics();
    }, [courseId]);

    const loadAnalytics = async () => {
        try {
            setLoading(true);

            // Load engagement metrics
            const engagementData = await agentService.getEngagementMetrics();
            if (engagementData.success) {
                setEngagement(engagementData.data);
            }

            // Load dropout risk if courseId provided
            if (courseId) {
                const riskData = await agentService.getDropoutRisk(courseId);
                if (riskData.success) {
                    setDropoutRisk(riskData.data);
                }
            }
        } catch (error) {
            console.error('Failed to load analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="analytics-dashboard loading">
                <div className="spinner"></div>
                <p>Loading AI-powered analytics...</p>
            </div>
        );
    }

    return (
        <div className="analytics-dashboard">
            <div className="dashboard-header">
                <h2>📈 AI Analytics Dashboard</h2>
                <button onClick={loadAnalytics} className="refresh-btn">
                    🔄 Refresh
                </button>
            </div>

            {engagement && (
                <>
                    <div className="stats-grid">
                        <StatCard
                            title="Engagement Score"
                            value={engagement.engagementScore?.toFixed(1) || 'N/A'}
                            icon="🎯"
                            color="#667eea"
                        />
                        <StatCard
                            title="Current Streak"
                            value={`${engagement.streakDays || 0} days`}
                            icon="🔥"
                            color="#ff6b6b"
                        />
                        <StatCard
                            title="Avg. Session Time"
                            value={`${engagement.averageSessionTime || 0} min`}
                            icon="⏱️"
                            color="#4ecdc4"
                        />
                        <StatCard
                            title="Completion Rate"
                            value={`${(engagement.completionRate || 0)}%`}
                            icon="✓"
                            color="#95e1d3"
                        />
                    </div>

                    {engagement.weeklyActivity && (
                        <EngagementChart data={engagement.weeklyActivity} />
                    )}
                </>
            )}

            {dropoutRisk && (
                <DropoutRiskAlert risk={dropoutRisk} />
            )}

            {!engagement && !dropoutRisk && (
                <div className="no-data">
                    <p>No analytics data available yet. Keep learning to see your insights!</p>
                </div>
            )}
        </div>
    );
};

export default AnalyticsDashboard;
