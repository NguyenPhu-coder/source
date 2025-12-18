/**
 * Course Knowledge Graph Visualization
 * Interactive visualization of course prerequisites and relationships
 */

import React, { useState, useEffect } from 'react';
import agentService from '../services/agentService';
import '../styles/CourseKnowledgeGraph.css';

export const CourseKnowledgeGraph = ({ courseId }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [graphData, setGraphData] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);

    useEffect(() => {
        fetchGraphData();
    }, [courseId]);

    const fetchGraphData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [prereqRes, relatedRes] = await Promise.all([
                agentService.getPrerequisites(courseId),
                agentService.getRelatedCourses(courseId)
            ]);

            if (prereqRes.success && relatedRes.success) {
                const graph = buildGraphStructure(prereqRes.data, relatedRes.data);
                setGraphData(graph);
            } else {
                setError('Failed to fetch knowledge graph data');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const buildGraphStructure = (prerequisites, related) => {
        const nodes = new Map();
        const edges = [];

        // Add current course
        nodes.set(courseId, {
            id: courseId,
            type: 'current',
            level: 0
        });

        // Add prerequisites
        if (prerequisites && prerequisites.length > 0) {
            prerequisites.forEach((prereq, idx) => {
                const nodeId = `prereq-${prereq.id || idx}`;
                nodes.set(nodeId, {
                    id: nodeId,
                    ...prereq,
                    type: 'prerequisite',
                    level: -1
                });
                edges.push({
                    from: nodeId,
                    to: courseId,
                    type: 'prerequisite',
                    strength: prereq.strength || 'required'
                });
            });
        }

        // Add related courses
        if (related && related.length > 0) {
            related.forEach((rel, idx) => {
                const nodeId = `related-${rel.id || idx}`;
                if (!nodes.has(nodeId)) {
                    nodes.set(nodeId, {
                        id: nodeId,
                        ...rel,
                        type: 'related',
                        level: 0
                    });
                    edges.push({
                        from: courseId,
                        to: nodeId,
                        type: 'related',
                        similarity: rel.similarity || 0.5
                    });
                }
            });
        }

        return {
            nodes: Array.from(nodes.values()),
            edges
        };
    };

    const handleNodeClick = (node) => {
        setSelectedNode(node);
    };

    if (loading) {
        return (
            <div className="knowledge-graph loading">
                <div className="spinner"></div>
                <p>Loading knowledge graph...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="knowledge-graph error">
                <span className="error-icon">⚠️</span>
                <p>{error}</p>
                <button onClick={fetchGraphData} className="retry-btn">
                    🔄 Retry
                </button>
            </div>
        );
    }

    if (!graphData || graphData.nodes.length === 0) {
        return (
            <div className="knowledge-graph empty">
                <span className="empty-icon">📚</span>
                <p>No knowledge graph data available for this course</p>
            </div>
        );
    }

    return (
        <div className="knowledge-graph">
            <div className="graph-header">
                <h3>🔗 Knowledge Graph</h3>
                <div className="graph-legend">
                    <div className="legend-item">
                        <span className="legend-dot prerequisite"></span>
                        <span>Prerequisites</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot current"></span>
                        <span>Current Course</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot related"></span>
                        <span>Related Courses</span>
                    </div>
                </div>
            </div>

            <div className="graph-container">
                <svg className="graph-svg" viewBox="0 0 800 600">
                    <defs>
                        <marker
                            id="arrowhead"
                            markerWidth="10"
                            markerHeight="10"
                            refX="9"
                            refY="3"
                            orient="auto"
                        >
                            <polygon points="0 0, 10 3, 0 6" fill="#999" />
                        </marker>
                    </defs>

                    {/* Render edges */}
                    <g className="edges">
                        {graphData.edges.map((edge, idx) => {
                            const fromNode = graphData.nodes.find(n => n.id === edge.from);
                            const toNode = graphData.nodes.find(n => n.id === edge.to);

                            if (!fromNode || !toNode) return null;

                            const fromX = 400 + (fromNode.level * 250);
                            const fromY = 300 + (graphData.nodes.filter(n => n.level === fromNode.level).indexOf(fromNode) * 100 - 100);
                            const toX = 400 + (toNode.level * 250);
                            const toY = 300 + (graphData.nodes.filter(n => n.level === toNode.level).indexOf(toNode) * 100 - 100);

                            return (
                                <line
                                    key={idx}
                                    x1={fromX}
                                    y1={fromY}
                                    x2={toX}
                                    y2={toY}
                                    className={`edge ${edge.type}`}
                                    markerEnd="url(#arrowhead)"
                                />
                            );
                        })}
                    </g>

                    {/* Render nodes */}
                    <g className="nodes">
                        {graphData.nodes.map((node, idx) => {
                            const x = 400 + (node.level * 250);
                            const y = 300 + (graphData.nodes.filter(n => n.level === node.level).indexOf(node) * 100 - 100);

                            return (
                                <g
                                    key={node.id}
                                    className={`node ${node.type} ${selectedNode?.id === node.id ? 'selected' : ''}`}
                                    onClick={() => handleNodeClick(node)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <circle cx={x} cy={y} r="40" />
                                    <text
                                        x={x}
                                        y={y}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        className="node-label"
                                    >
                                        {node.title?.substring(0, 15) || `Course ${idx + 1}`}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                </svg>
            </div>

            {selectedNode && (
                <div className="node-details">
                    <button
                        className="close-btn"
                        onClick={() => setSelectedNode(null)}
                    >
                        ×
                    </button>

                    <div className="node-type-badge">{selectedNode.type}</div>

                    <h4>{selectedNode.title || selectedNode.name || 'Untitled Course'}</h4>

                    {selectedNode.description && (
                        <p className="node-description">{selectedNode.description}</p>
                    )}

                    {selectedNode.difficulty && (
                        <div className="node-meta">
                            <span className="meta-label">Difficulty:</span>
                            <span className="meta-value">{selectedNode.difficulty}</span>
                        </div>
                    )}

                    {selectedNode.strength && (
                        <div className="node-meta">
                            <span className="meta-label">Required:</span>
                            <span className="meta-value">{selectedNode.strength}</span>
                        </div>
                    )}

                    {selectedNode.similarity && (
                        <div className="node-meta">
                            <span className="meta-label">Similarity:</span>
                            <span className="meta-value">{(selectedNode.similarity * 100).toFixed(0)}%</span>
                        </div>
                    )}

                    {selectedNode.reason && (
                        <div className="node-reason">
                            <strong>Why related:</strong>
                            <p>{selectedNode.reason}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CourseKnowledgeGraph;
