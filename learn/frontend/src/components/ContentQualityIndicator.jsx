/**
 * Content Quality Indicator Component
 * Shows AI validation results for course content
 */

import React from 'react';
import '../styles/ContentQualityIndicator.css';

const QualityCheck = ({ name, passed, score, icon }) => {
    const percentage = (score * 100).toFixed(1);
    const status = passed ? 'passed' : 'failed';

    return (
        <div className={`quality-check ${status}`}>
            <div className="check-header">
                <span className="check-icon">{icon}</span>
                <span className="check-name">{name}</span>
                <span className={`check-status ${status}`}>
                    {passed ? '✓' : '✗'}
                </span>
            </div>
            <div className="check-score">
                <div className="score-bar">
                    <div
                        className={`score-fill ${status}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <span className="score-value">{percentage}%</span>
            </div>
        </div>
    );
};

export const ContentQualityIndicator = ({ checks, suggestions = [] }) => {
    if (!checks) return null;

    const allPassed = Object.values(checks).every(check => check.passed);

    return (
        <div className="content-quality-indicator">
            <div className="quality-header">
                <h3>🤖 AI Content Quality Check</h3>
                <span className={`overall-status ${allPassed ? 'passed' : 'warning'}`}>
                    {allPassed ? '✓ All Checks Passed' : '⚠ Issues Detected'}
                </span>
            </div>

            <div className="quality-checks">
                <QualityCheck
                    name="Toxicity Detection"
                    passed={checks.toxicity?.passed}
                    score={checks.toxicity?.score || 0}
                    icon="🛡️"
                />
                <QualityCheck
                    name="Plagiarism Check"
                    passed={checks.plagiarism?.passed}
                    score={checks.plagiarism?.score || 0}
                    icon="📝"
                />
                <QualityCheck
                    name="Bias Detection"
                    passed={checks.bias?.passed}
                    score={checks.bias?.score || 0}
                    icon="⚖️"
                />
                <QualityCheck
                    name="Fact Checking"
                    passed={checks.factCheck?.passed}
                    score={checks.factCheck?.score || 0}
                    icon="✓"
                />
            </div>

            {suggestions && suggestions.length > 0 && (
                <div className="quality-suggestions">
                    <h4>💡 Suggestions for Improvement:</h4>
                    <ul>
                        {suggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ContentQualityIndicator;
