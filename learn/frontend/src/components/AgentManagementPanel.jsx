/**
 * Admin Agent Management Panel
 * Monitor and manage all AI agents
 */

import React, { useState, useEffect } from 'react';
import agentService from '../services/agentService';
import '../styles/AgentManagementPanel.css';

export const AgentManagementPanel = () => {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

    const agentList = [
        { id: 'orchestration', name: 'Orchestration Agent', port: 8000, icon: '🎯' },
        { id: 'knowledge-graph', name: 'Knowledge Graph Agent', port: 8001, icon: '🔗' },
        { id: 'content-ingestion', name: 'Content Ingestion Agent', port: 8002, icon: '📥' },
        { id: 'personalization', name: 'Personalization Agent', port: 8003, icon: '👤' },
        { id: 'assessment', name: 'Assessment Agent', port: 8004, icon: '📝' },
        { id: 'analytics', name: 'Analytics Agent', port: 8005, icon: '📊' },
        { id: 'content-quality', name: 'Content Quality Agent', port: 8006, icon: '✅' },
        { id: 'learning-science', name: 'Learning Science Agent', port: 8007, icon: '🧠' },
        { id: 'visual-generation', name: 'Visual Generation Agent', port: 8008, icon: '🎨' },
        { id: 'audio-generation', name: 'Audio Generation Agent', port: 8009, icon: '🔊' },
        { id: 'translation', name: 'Translation Agent', port: 8010, icon: '🌐' },
        { id: 'mindmap', name: 'Mindmap Agent', port: 8011, icon: '🗺️' },
        { id: 'caching', name: 'Caching Agent', port: 8012, icon: '⚡' },
        { id: 'database-management', name: 'Database Management Agent', port: 8013, icon: '💾' },
        { id: 'infrastructure', name: 'Infrastructure Agent', port: 8014, icon: '🏗️' },
        { id: 'security-compliance', name: 'Security & Compliance Agent', port: 8015, icon: '🔒' },
        { id: 'testing-qa', name: 'Testing & QA Agent', port: 8016, icon: '🧪' },
        { id: 'realtime-coordination', name: 'Realtime Coordination Agent', port: 8017, icon: '⚡' },
        { id: 'local-ai', name: 'Local AI Agent', port: 8018, icon: '🤖' }
    ];

    useEffect(() => {
        checkAgentsHealth();
        const interval = setInterval(checkAgentsHealth, refreshInterval);
        return () => clearInterval(interval);
    }, [refreshInterval]);

    const checkAgentsHealth = async () => {
        setLoading(true);
        const healthStatuses = await Promise.all(
            agentList.map(async (agent) => {
                try {
                    const response = await agentService.checkHealth(agent.id);
                    return {
                        ...agent,
                        status: response.success ? 'healthy' : 'unhealthy',
                        responseTime: response.responseTime || 0,
                        lastCheck: new Date(),
                        details: response.data || {}
                    };
                } catch (error) {
                    return {
                        ...agent,
                        status: 'offline',
                        error: error.message,
                        lastCheck: new Date()
                    };
                }
            })
        );
        setAgents(healthStatuses);
        setLoading(false);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'healthy': return '#4caf50';
            case 'unhealthy': return '#ff9800';
            case 'offline': return '#f44336';
            default: return '#9e9e9e';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'healthy': return '✓';
            case 'unhealthy': return '⚠';
            case 'offline': return '✗';
            default: return '?';
        }
    };

    const healthyCount = agents.filter(a => a.status === 'healthy').length;
    const unhealthyCount = agents.filter(a => a.status === 'unhealthy').length;
    const offlineCount = agents.filter(a => a.status === 'offline').length;

    return (
        <div className="agent-management-panel">
            <div className="panel-header">
                <div className="header-title">
                    <h2>🤖 AI Agent Management</h2>
                    <span className="agent-count">{agents.length} Agents</span>
                </div>

                <div className="header-actions">
                    <select
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                        className="refresh-select"
                    >
                        <option value={10000}>Refresh: 10s</option>
                        <option value={30000}>Refresh: 30s</option>
                        <option value={60000}>Refresh: 1min</option>
                        <option value={300000}>Refresh: 5min</option>
                    </select>

                    <button onClick={checkAgentsHealth} className="refresh-btn" disabled={loading}>
                        {loading ? '🔄 Checking...' : '🔄 Refresh Now'}
                    </button>
                </div>
            </div>

            <div className="status-overview">
                <div className="status-card healthy">
                    <div className="status-icon">✓</div>
                    <div className="status-info">
                        <div className="status-count">{healthyCount}</div>
                        <div className="status-label">Healthy</div>
                    </div>
                </div>

                <div className="status-card unhealthy">
                    <div className="status-icon">⚠</div>
                    <div className="status-info">
                        <div className="status-count">{unhealthyCount}</div>
                        <div className="status-label">Degraded</div>
                    </div>
                </div>

                <div className="status-card offline">
                    <div className="status-icon">✗</div>
                    <div className="status-info">
                        <div className="status-count">{offlineCount}</div>
                        <div className="status-label">Offline</div>
                    </div>
                </div>

                <div className="status-card uptime">
                    <div className="status-icon">⏱</div>
                    <div className="status-info">
                        <div className="status-count">
                            {agents.length > 0 ? ((healthyCount / agents.length) * 100).toFixed(1) : 0}%
                        </div>
                        <div className="status-label">Uptime</div>
                    </div>
                </div>
            </div>

            <div className="agents-grid">
                {agents.map((agent) => (
                    <div
                        key={agent.id}
                        className={`agent-card ${agent.status}`}
                        onClick={() => setSelectedAgent(agent)}
                    >
                        <div className="agent-header">
                            <div className="agent-icon">{agent.icon}</div>
                            <div
                                className="agent-status-dot"
                                style={{ background: getStatusColor(agent.status) }}
                            ></div>
                        </div>

                        <h3 className="agent-name">{agent.name}</h3>

                        <div className="agent-meta">
                            <div className="meta-item">
                                <span className="meta-label">Port:</span>
                                <span className="meta-value">{agent.port}</span>
                            </div>
                            <div className="meta-item">
                                <span className="meta-label">Status:</span>
                                <span className="meta-value" style={{ color: getStatusColor(agent.status) }}>
                                    {getStatusIcon(agent.status)} {agent.status}
                                </span>
                            </div>
                        </div>

                        {agent.responseTime && (
                            <div className="response-time">
                                ⚡ {agent.responseTime}ms
                            </div>
                        )}

                        {agent.lastCheck && (
                            <div className="last-check">
                                Last: {agent.lastCheck.toLocaleTimeString()}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {selectedAgent && (
                <div className="agent-modal-overlay" onClick={() => setSelectedAgent(null)}>
                    <div className="agent-modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="modal-close"
                            onClick={() => setSelectedAgent(null)}
                        >
                            ×
                        </button>

                        <div className="modal-header">
                            <div className="modal-icon">{selectedAgent.icon}</div>
                            <div>
                                <h3>{selectedAgent.name}</h3>
                                <span
                                    className="modal-status"
                                    style={{ color: getStatusColor(selectedAgent.status) }}
                                >
                                    {getStatusIcon(selectedAgent.status)} {selectedAgent.status}
                                </span>
                            </div>
                        </div>

                        <div className="modal-content">
                            <div className="detail-section">
                                <h4>Configuration</h4>
                                <div className="detail-grid">
                                    <div className="detail-item">
                                        <span className="detail-label">Agent ID:</span>
                                        <span className="detail-value">{selectedAgent.id}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Port:</span>
                                        <span className="detail-value">{selectedAgent.port}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Response Time:</span>
                                        <span className="detail-value">{selectedAgent.responseTime || 'N/A'}ms</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Last Check:</span>
                                        <span className="detail-value">
                                            {selectedAgent.lastCheck?.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {selectedAgent.details && Object.keys(selectedAgent.details).length > 0 && (
                                <div className="detail-section">
                                    <h4>Health Details</h4>
                                    <pre className="details-json">
                                        {JSON.stringify(selectedAgent.details, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {selectedAgent.error && (
                                <div className="detail-section error">
                                    <h4>Error Information</h4>
                                    <div className="error-message">
                                        {selectedAgent.error}
                                    </div>
                                </div>
                            )}

                            <div className="modal-actions">
                                <button className="action-btn restart">
                                    🔄 Restart Agent
                                </button>
                                <button className="action-btn logs">
                                    📋 View Logs
                                </button>
                                <button className="action-btn config">
                                    ⚙️ Configuration
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentManagementPanel;
