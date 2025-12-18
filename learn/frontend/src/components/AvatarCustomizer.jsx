/**
 * Avatar Customizer Component
 * Customize avatar appearance, voice, and preferences
 */

import React, { useState, useEffect } from 'react';
import { Avatar3DViewer } from './Avatar3DViewer';
import axios from 'axios';
import '../styles/AvatarCustomizer.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

export function AvatarCustomizer({ userId, onSave }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [availableModels, setAvailableModels] = useState([]);
    const [preferences, setPreferences] = useState({
        avatar_model: 'default_teacher',
        voice_type: 'neutral',
        voice_speed: 1.0,
        language: 'en',
        gesture_enabled: true,
        subtitle_enabled: true
    });
    const [previewGesture, setPreviewGesture] = useState('wave');
    const [message, setMessage] = useState(null);

    useEffect(() => {
        loadAvatarModels();
    }, []);

    const loadAvatarModels = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/avatar-teacher/models`);
            if (response.data.success) {
                setAvailableModels(response.data.models);
            }
        } catch (error) {
            console.error('Failed to load models:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setPreferences(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setMessage(null);

            const response = await axios.post(
                `${API_BASE_URL}/api/avatar-teacher/customize`,
                {
                    user_id: userId,
                    ...preferences
                }
            );

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Preferences saved successfully!' });
                if (onSave) {
                    onSave(preferences);
                }
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save preferences' });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setPreferences({
            avatar_model: 'default_teacher',
            voice_type: 'neutral',
            voice_speed: 1.0,
            language: 'en',
            gesture_enabled: true,
            subtitle_enabled: true
        });
    };

    if (loading) {
        return (
            <div className="avatar-customizer loading">
                <div className="spinner"></div>
                <p>Loading customization options...</p>
            </div>
        );
    }

    const selectedModel = availableModels.find(m => m.id === preferences.avatar_model);

    return (
        <div className="avatar-customizer">
            <div className="customizer-header">
                <h2>🎨 Customize Your AI Teacher</h2>
                <p>Personalize your learning experience with a custom avatar</p>
            </div>

            <div className="customizer-content">
                {/* Preview Section */}
                <div className="preview-section">
                    <h3>Preview</h3>
                    <div className="avatar-preview">
                        <Avatar3DViewer
                            modelUrl={selectedModel?.model_url}
                            gesture={previewGesture}
                            emotion="happy"
                            enableControls={true}
                        />
                    </div>

                    <div className="preview-controls">
                        <label>Test Gesture:</label>
                        <select
                            value={previewGesture}
                            onChange={(e) => setPreviewGesture(e.target.value)}
                        >
                            <option value="wave">Wave</option>
                            <option value="point">Point</option>
                            <option value="thinking">Thinking</option>
                            <option value="congratulate">Congratulate</option>
                            <option value="explain">Explain</option>
                            <option value="neutral">Neutral</option>
                        </select>
                    </div>
                </div>

                {/* Customization Options */}
                <div className="options-section">
                    {/* Avatar Model Selection */}
                    <div className="option-group">
                        <h3>👤 Avatar Model</h3>
                        <div className="model-grid">
                            {availableModels.map(model => (
                                <div
                                    key={model.id}
                                    className={`model-card ${preferences.avatar_model === model.id ? 'selected' : ''}`}
                                    onClick={() => handleChange('avatar_model', model.id)}
                                >
                                    <div className="model-preview">
                                        <img src={model.preview_url || '/avatars/placeholder.png'} alt={model.name} />
                                    </div>
                                    <div className="model-info">
                                        <h4>{model.name}</h4>
                                        <p>{model.description}</p>
                                    </div>
                                    {preferences.avatar_model === model.id && (
                                        <div className="selected-indicator">✓</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Voice Settings */}
                    <div className="option-group">
                        <h3>🎤 Voice Settings</h3>

                        <div className="option-field">
                            <label>Voice Type:</label>
                            <select
                                value={preferences.voice_type}
                                onChange={(e) => handleChange('voice_type', e.target.value)}
                            >
                                <option value="neutral">Neutral</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>

                        <div className="option-field">
                            <label>Speech Speed: {preferences.voice_speed}x</label>
                            <input
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.25"
                                value={preferences.voice_speed}
                                onChange={(e) => handleChange('voice_speed', parseFloat(e.target.value))}
                            />
                            <div className="range-labels">
                                <span>Slower</span>
                                <span>Normal</span>
                                <span>Faster</span>
                            </div>
                        </div>

                        <div className="option-field">
                            <label>Language:</label>
                            <select
                                value={preferences.language}
                                onChange={(e) => handleChange('language', e.target.value)}
                            >
                                <option value="en">English</option>
                                <option value="vi">Tiếng Việt</option>
                                <option value="es">Español</option>
                                <option value="fr">Français</option>
                                <option value="de">Deutsch</option>
                                <option value="ja">日本語</option>
                                <option value="ko">한국어</option>
                                <option value="zh">中文</option>
                            </select>
                        </div>
                    </div>

                    {/* Display Settings */}
                    <div className="option-group">
                        <h3>⚙️ Display Settings</h3>

                        <div className="option-toggle">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={preferences.gesture_enabled}
                                    onChange={(e) => handleChange('gesture_enabled', e.target.checked)}
                                />
                                <span>Enable Gestures</span>
                            </label>
                            <p className="option-description">
                                Avatar will use hand gestures and body language
                            </p>
                        </div>

                        <div className="option-toggle">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={preferences.subtitle_enabled}
                                    onChange={(e) => handleChange('subtitle_enabled', e.target.checked)}
                                />
                                <span>Show Subtitles</span>
                            </label>
                            <p className="option-description">
                                Display text captions during lessons
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="action-buttons">
                        <button
                            onClick={handleSave}
                            className="save-btn"
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : '💾 Save Preferences'}
                        </button>
                        <button onClick={handleReset} className="reset-btn">
                            🔄 Reset to Defaults
                        </button>
                    </div>

                    {/* Message Display */}
                    {message && (
                        <div className={`message ${message.type}`}>
                            {message.type === 'success' ? '✓' : '⚠️'} {message.text}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AvatarCustomizer;
