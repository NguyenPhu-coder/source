/**
 * Avatar Teacher Component
 * Interactive 3D avatar teacher for lesson presentation
 */

import React, { useState, useEffect, useRef } from 'react';
import { Avatar3DViewer } from './Avatar3DViewer';
import axios from 'axios';
import '../styles/AvatarTeacher.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

export function AvatarTeacher({ lessonId, content, lessonTitle }) {
    const [isPresenting, setIsPresenting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentGesture, setCurrentGesture] = useState('neutral');
    const [currentEmotion, setCurrentEmotion] = useState('neutral');
    const [subtitle, setSubtitle] = useState('');
    const [presentationData, setPresentationData] = useState(null);
    const [progress, setProgress] = useState(0);
    const [speed, setSpeed] = useState(1.0);
    const [error, setError] = useState(null);

    const audioRef = useRef(null);
    const timelineTimeoutsRef = useRef([]);

    useEffect(() => {
        return () => {
            // Cleanup timeouts on unmount
            timelineTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    const startPresentation = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Request lesson presentation from avatar agent
            const response = await axios.post(
                `${API_BASE_URL}/api/avatar-teacher/present-lesson/${lessonId}`,
                {
                    content,
                    language: 'en',
                    voice_type: 'neutral',
                    speed
                }
            );

            if (!response.data) {
                throw new Error('Failed to generate presentation');
            }

            setPresentationData(response.data);

            // Create audio element
            const audio = new Audio(`${API_BASE_URL}${response.data.audio_url}`);
            audioRef.current = audio;

            // Setup audio event listeners
            audio.addEventListener('loadedmetadata', () => {
                setIsLoading(false);
                setIsPresenting(true);
                audio.play();
            });

            audio.addEventListener('timeupdate', () => {
                const percent = (audio.currentTime / audio.duration) * 100;
                setProgress(percent);
            });

            audio.addEventListener('ended', () => {
                setIsPresenting(false);
                setProgress(100);
                setCurrentGesture('congratulate');
                setCurrentEmotion('excited');
                setSubtitle('Great job! You completed the lesson! 🎉');
            });

            // Schedule gesture and subtitle changes based on timeline
            response.data.timeline.forEach(({ time, gesture, emotion, text }) => {
                const timeout = setTimeout(() => {
                    setCurrentGesture(gesture);
                    setCurrentEmotion(emotion);
                    setSubtitle(text);
                }, time / speed);

                timelineTimeoutsRef.current.push(timeout);
            });

        } catch (err) {
            console.error('Presentation error:', err);
            setError(err.message || 'Failed to start presentation');
            setIsLoading(false);
        }
    };

    const pausePresentation = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            setIsPresenting(false);
        }
    };

    const resumePresentation = () => {
        if (audioRef.current) {
            audioRef.current.play();
            setIsPresenting(true);
        }
    };

    const stopPresentation = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }

        timelineTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        timelineTimeoutsRef.current = [];

        setIsPresenting(false);
        setProgress(0);
        setCurrentGesture('neutral');
        setCurrentEmotion('neutral');
        setSubtitle('');
    };

    const handleSpeedChange = (newSpeed) => {
        setSpeed(newSpeed);
        if (audioRef.current) {
            audioRef.current.playbackRate = newSpeed;
        }
    };

    return (
        <div className="avatar-teacher">
            <div className="teacher-header">
                <h2>{lessonTitle || 'Interactive Lesson'}</h2>
                <span className="ai-badge">🎭 AI Teacher</span>
            </div>

            <div className="teacher-content">
                {/* 3D Avatar Viewer */}
                <div className="avatar-viewport">
                    <Avatar3DViewer
                        gesture={currentGesture}
                        emotion={currentEmotion}
                        enableControls={!isPresenting}
                    />
                </div>

                {/* Lesson Content Panel */}
                <div className="lesson-panel">
                    <div className="lesson-info">
                        <h3>📚 Lesson Content</h3>
                        <div className="content-preview">
                            {content.substring(0, 200)}...
                        </div>
                    </div>

                    {/* Subtitle Display */}
                    {subtitle && (
                        <div className="subtitle-box">
                            <div className="subtitle-text">{subtitle}</div>
                        </div>
                    )}

                    {/* Progress Bar */}
                    {(isPresenting || progress > 0) && (
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="teacher-controls">
                <div className="control-buttons">
                    {!isPresenting && progress === 0 ? (
                        <button
                            onClick={startPresentation}
                            className="control-btn start"
                            disabled={isLoading}
                        >
                            {isLoading ? '⏳ Loading...' : '▶ Start Lesson'}
                        </button>
                    ) : !isPresenting && progress > 0 && progress < 100 ? (
                        <button onClick={resumePresentation} className="control-btn resume">
                            ▶ Resume
                        </button>
                    ) : isPresenting ? (
                        <button onClick={pausePresentation} className="control-btn pause">
                            ⏸ Pause
                        </button>
                    ) : null}

                    {progress > 0 && (
                        <button onClick={stopPresentation} className="control-btn stop">
                            ⏹ Stop
                        </button>
                    )}
                </div>

                {/* Speed Control */}
                <div className="speed-control">
                    <label>Speed:</label>
                    <select
                        value={speed}
                        onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                        disabled={isPresenting}
                    >
                        <option value={0.5}>0.5x</option>
                        <option value={0.75}>0.75x</option>
                        <option value={1.0}>1.0x</option>
                        <option value={1.25}>1.25x</option>
                        <option value={1.5}>1.5x</option>
                        <option value={2.0}>2.0x</option>
                    </select>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="error-message">
                    ⚠️ {error}
                </div>
            )}
        </div>
    );
}

export default AvatarTeacher;
