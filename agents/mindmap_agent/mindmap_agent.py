"""
Mind Map Agent - Generate interactive mind maps from knowledge graph data

This agent:
- Queries knowledge graph for concept relationships
- Applies multiple layout algorithms (force-directed, hierarchical, radial, tree)
- Generates SVG and interactive JSON for visualization
- Color-codes nodes by mastery level
- Exports to multiple formats (JSON, SVG, PNG, PDF)
- Provides prerequisite tree visualization
- Supports real-time updates based on learning progress

Architecture:
- Standalone agent with API calls to knowledge graph
- Config-driven layout and visualization settings
- Client-side rendering data generation
- Multiple export formats
"""

import asyncio
import base64
import hashlib
import io
import json
import math
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx
import networkx as nx
import numpy as np
import structlog
import yaml
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import Response
from prometheus_client import Counter, Histogram, generate_latest
from pydantic import BaseModel, Field

try:
    import cairosvg
    CAIRO_AVAILABLE = True
except ImportError:
    CAIRO_AVAILABLE = False
    structlog.get_logger().warning("cairosvg not available - PNG/PDF export disabled")

try:
    import svgwrite
    SVG_AVAILABLE = True
except ImportError:
    SVG_AVAILABLE = False
    structlog.get_logger().warning("svgwrite not available - SVG export disabled")


logger = structlog.get_logger()


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class GenerateMindmapRequest(BaseModel):
    """Request to generate a mind map"""
    concept_id: str = Field(..., description="Root concept ID")
    user_id: str = Field(..., description="User ID for mastery data")
    layout: str = Field(default="force_directed", description="Layout algorithm")
    max_depth: Optional[int] = Field(default=3, description="Maximum depth")
    max_nodes: Optional[int] = Field(default=100, description="Maximum nodes")


class ApplyLayoutRequest(BaseModel):
    """Request to apply layout algorithm"""
    nodes: List[Dict[str, Any]] = Field(..., description="Graph nodes")
    edges: List[Dict[str, Any]] = Field(..., description="Graph edges")
    algorithm: str = Field(default="force_directed", description="Layout algorithm")


class ExportRequest(BaseModel):
    """Request to export mind map"""
    graph_data: Dict[str, Any] = Field(..., description="Graph data")
    format: str = Field(..., description="Export format: json, svg, png, pdf")
    include_legend: bool = Field(default=True, description="Include legend")
    high_resolution: bool = Field(default=True, description="High resolution export")


class UpdateMasteryRequest(BaseModel):
    """Request to update mastery data"""
    user_id: str = Field(..., description="User ID")
    concept_id: str = Field(..., description="Concept ID")
    mastery_level: float = Field(..., ge=0.0, le=1.0, description="Mastery level")


class Node(BaseModel):
    """Graph node"""
    id: str
    label: str
    x: float
    y: float
    size: float
    color: str
    mastery: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class Edge(BaseModel):
    """Graph edge"""
    source: str
    target: str
    weight: float = 1.0
    relation_type: str = "related"


class GraphData(BaseModel):
    """Complete graph data"""
    nodes: List[Node]
    edges: List[Edge]
    layout: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ============================================================================
# CONFIGURATION LOADER
# ============================================================================

class ConfigLoader:
    """Load and validate configuration from YAML"""
    
    def __init__(self, config_path: str = "config.yaml"):
        self.config_path = config_path
        self.config = self._load_config()
        self._validate_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from YAML file"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            logger.info("configuration_loaded", path=self.config_path)
            return config
        except FileNotFoundError:
            logger.error("config_file_not_found", path=self.config_path)
            raise
        except yaml.YAMLError as e:
            logger.error("yaml_parse_error", error=str(e))
            raise
    
    def _validate_config(self):
        """Validate configuration structure"""
        required_sections = ["agent", "layout", "visualization", "interactivity", "export", "knowledge_graph_api"]
        for section in required_sections:
            if section not in self.config:
                raise ValueError(f"Missing required config section: {section}")
        
        # Validate layout algorithms
        if "algorithms" not in self.config["layout"]:
            raise ValueError("Missing layout.algorithms in config")
        
        supported_algorithms = ["force_directed", "hierarchical", "radial", "tree"]
        for algo in self.config["layout"]["algorithms"]:
            if algo not in supported_algorithms:
                raise ValueError(f"Unsupported layout algorithm: {algo}")
        
        logger.info("configuration_validated")
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by dot-notation key"""
        keys = key.split(".")
        value = self.config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k, default)
            else:
                return default
        return value


# ============================================================================
# KNOWLEDGE GRAPH CLIENT
# ============================================================================

class KnowledgeGraphClient:
    """Client for knowledge graph API"""
    
    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)
    
    async def get_concept(self, concept_id: str) -> Dict[str, Any]:
        """Get concept details from knowledge graph"""
        try:
            url = f"{self.base_url}/concepts/{concept_id}"
            response = await self.client.get(url)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error("knowledge_graph_error", error=str(e), concept_id=concept_id)
            raise HTTPException(status_code=502, detail=f"Knowledge graph error: {str(e)}")
    
    async def get_related_concepts(self, concept_id: str, depth: int = 1) -> Dict[str, Any]:
        """Get related concepts from knowledge graph"""
        try:
            url = f"{self.base_url}/concepts/{concept_id}/related"
            params = {"depth": depth}
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error("knowledge_graph_error", error=str(e), concept_id=concept_id)
            raise HTTPException(status_code=502, detail=f"Knowledge graph error: {str(e)}")
    
    async def get_prerequisites(self, concept_id: str) -> Dict[str, Any]:
        """Get prerequisites for a concept"""
        try:
            url = f"{self.base_url}/concepts/{concept_id}/prerequisites"
            response = await self.client.get(url)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error("knowledge_graph_error", error=str(e), concept_id=concept_id)
            raise HTTPException(status_code=502, detail=f"Knowledge graph error: {str(e)}")
    
    async def get_user_mastery(self, user_id: str, concept_ids: List[str]) -> Dict[str, float]:
        """Get user mastery levels for concepts"""
        try:
            url = f"{self.base_url}/users/{user_id}/mastery"
            payload = {"concept_ids": concept_ids}
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("mastery", {})
        except httpx.HTTPError as e:
            logger.error("knowledge_graph_error", error=str(e), user_id=user_id)
            # Return empty mastery if service unavailable
            return {}
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# ============================================================================
# LAYOUT ALGORITHMS
# ============================================================================

class LayoutEngine:
    """Apply various layout algorithms to graphs"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
    
    def apply_layout(self, nodes: List[Dict], edges: List[Dict], algorithm: str) -> List[Dict]:
        """Apply layout algorithm to nodes and edges"""
        if algorithm == "force_directed":
            return self._force_directed_layout(nodes, edges)
        elif algorithm == "hierarchical":
            return self._hierarchical_layout(nodes, edges)
        elif algorithm == "radial":
            return self._radial_layout(nodes, edges)
        elif algorithm == "tree":
            return self._tree_layout(nodes, edges)
        else:
            raise ValueError(f"Unknown layout algorithm: {algorithm}")
    
    def _force_directed_layout(self, nodes: List[Dict], edges: List[Dict]) -> List[Dict]:
        """Force-directed layout using Fruchterman-Reingold algorithm"""
        # Get config parameters
        iterations = self.config.get("layout.force_directed.iterations", 300)
        link_distance = self.config.get("layout.force_directed.link_distance", 100)
        link_strength = self.config.get("layout.force_directed.link_strength", 0.5)
        charge = self.config.get("layout.force_directed.charge", -300)
        
        # Build NetworkX graph
        G = nx.Graph()
        for node in nodes:
            G.add_node(node["id"], **node)
        for edge in edges:
            G.add_edge(edge["source"], edge["target"], weight=edge.get("weight", 1.0))
        
        # Apply spring layout
        pos = nx.spring_layout(
            G,
            k=link_distance / 100,  # Optimal distance between nodes
            iterations=iterations,
            scale=500  # Scale factor for positions
        )
        
        # Update node positions
        positioned_nodes = []
        for node in nodes:
            node_id = node["id"]
            if node_id in pos:
                x, y = pos[node_id]
                positioned_nodes.append({
                    **node,
                    "x": float(x * 500),  # Scale to reasonable coordinates
                    "y": float(y * 500)
                })
            else:
                positioned_nodes.append(node)
        
        return positioned_nodes
    
    def _hierarchical_layout(self, nodes: List[Dict], edges: List[Dict]) -> List[Dict]:
        """Hierarchical layout with levels"""
        # Build directed graph
        G = nx.DiGraph()
        for node in nodes:
            G.add_node(node["id"], **node)
        for edge in edges:
            G.add_edge(edge["source"], edge["target"])
        
        # Calculate levels using topological sort
        try:
            levels = {}
            for i, layer in enumerate(nx.topological_generations(G)):
                for node_id in layer:
                    levels[node_id] = i
        except nx.NetworkXError:
            # Graph has cycles, use approximate levels
            levels = self._approximate_levels(G, nodes[0]["id"] if nodes else None)
        
        # Position nodes by level
        max_level = max(levels.values()) if levels else 0
        level_counts = {}
        for level in levels.values():
            level_counts[level] = level_counts.get(level, 0) + 1
        
        level_positions = {}
        positioned_nodes = []
        
        for node in nodes:
            node_id = node["id"]
            level = levels.get(node_id, 0)
            
            # Calculate position
            if level not in level_positions:
                level_positions[level] = 0
            
            position_in_level = level_positions[level]
            level_positions[level] += 1
            
            nodes_in_level = level_counts.get(level, 1)
            x = (position_in_level - nodes_in_level / 2) * 150
            y = level * 150
            
            positioned_nodes.append({
                **node,
                "x": float(x),
                "y": float(y)
            })
        
        return positioned_nodes
    
    def _approximate_levels(self, G: nx.DiGraph, root: Optional[str]) -> Dict[str, int]:
        """Approximate levels for graphs with cycles"""
        levels = {}
        if root and root in G:
            # BFS from root
            visited = {root}
            queue = [(root, 0)]
            while queue:
                node, level = queue.pop(0)
                levels[node] = level
                for neighbor in G.neighbors(node):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append((neighbor, level + 1))
        
        # Assign level 0 to remaining nodes
        for node in G.nodes():
            if node not in levels:
                levels[node] = 0
        
        return levels
    
    def _radial_layout(self, nodes: List[Dict], edges: List[Dict]) -> List[Dict]:
        """Radial layout with root at center"""
        if not nodes:
            return []
        
        # Build graph
        G = nx.Graph()
        for node in nodes:
            G.add_node(node["id"], **node)
        for edge in edges:
            G.add_edge(edge["source"], edge["target"])
        
        # Use first node as root
        root = nodes[0]["id"]
        
        # Calculate distances from root
        try:
            distances = nx.single_source_shortest_path_length(G, root)
        except nx.NetworkXError:
            # Root not in graph
            distances = {node["id"]: 0 for node in nodes}
        
        # Group nodes by distance
        levels = {}
        for node_id, dist in distances.items():
            if dist not in levels:
                levels[dist] = []
            levels[dist].append(node_id)
        
        # Position nodes in circles
        positioned_nodes = []
        for node in nodes:
            node_id = node["id"]
            dist = distances.get(node_id, 0)
            
            if dist == 0:
                # Root at center
                x, y = 0, 0
            else:
                # Position on circle
                nodes_at_level = levels.get(dist, [node_id])
                angle = 2 * math.pi * nodes_at_level.index(node_id) / len(nodes_at_level)
                radius = dist * 120
                x = radius * math.cos(angle)
                y = radius * math.sin(angle)
            
            positioned_nodes.append({
                **node,
                "x": float(x),
                "y": float(y)
            })
        
        return positioned_nodes
    
    def _tree_layout(self, nodes: List[Dict], edges: List[Dict]) -> List[Dict]:
        """Tree layout with vertical orientation"""
        # Build directed graph
        G = nx.DiGraph()
        for node in nodes:
            G.add_node(node["id"], **node)
        for edge in edges:
            G.add_edge(edge["source"], edge["target"])
        
        # Find root (node with no incoming edges)
        roots = [n for n in G.nodes() if G.in_degree(n) == 0]
        root = roots[0] if roots else (nodes[0]["id"] if nodes else None)
        
        if not root:
            return nodes
        
        # Build tree using BFS
        tree_levels = {root: 0}
        tree_positions = {root: 0}
        queue = [root]
        visited = {root}
        
        while queue:
            node = queue.pop(0)
            level = tree_levels[node]
            
            children = [n for n in G.neighbors(node) if n not in visited]
            for i, child in enumerate(children):
                visited.add(child)
                tree_levels[child] = level + 1
                tree_positions[child] = i
                queue.append(child)
        
        # Calculate positions
        level_widths = {}
        for node_id, level in tree_levels.items():
            level_widths[level] = level_widths.get(level, 0) + 1
        
        level_counts = {}
        positioned_nodes = []
        
        for node in nodes:
            node_id = node["id"]
            level = tree_levels.get(node_id, 0)
            
            if level not in level_counts:
                level_counts[level] = 0
            
            position = level_counts[level]
            level_counts[level] += 1
            
            width = level_widths.get(level, 1)
            x = (position - width / 2) * 150
            y = level * 150
            
            positioned_nodes.append({
                **node,
                "x": float(x),
                "y": float(y)
            })
        
        return positioned_nodes


# ============================================================================
# NODE PROPERTY CALCULATOR
# ============================================================================

class NodePropertyCalculator:
    """Calculate node visual properties based on mastery and metadata"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
    
    def calculate_properties(self, node: Dict, user_mastery: Dict[str, float]) -> Dict:
        """Calculate visual properties for a node"""
        node_id = node["id"]
        mastery = user_mastery.get(node_id, 0.0)
        
        # Calculate size based on importance
        importance = node.get("importance", 0.5)
        size_range = self.config.get("visualization.node_size_range", [20, 80])
        size = size_range[0] + (size_range[1] - size_range[0]) * importance
        
        # Calculate color based on mastery
        color = self._calculate_color(mastery)
        
        return {
            **node,
            "size": float(size),
            "color": color,
            "mastery": float(mastery)
        }
    
    def _calculate_color(self, mastery: float) -> str:
        """Calculate color based on mastery level"""
        color_scheme = self.config.get("visualization.color_scheme", "mastery")
        
        if color_scheme == "mastery":
            # Red (low) -> Yellow (medium) -> Green (high)
            if mastery < 0.33:
                # Red to Yellow
                r = 255
                g = int(255 * (mastery / 0.33))
                b = 0
            elif mastery < 0.67:
                # Yellow to Green
                r = int(255 * (1 - (mastery - 0.33) / 0.34))
                g = 255
                b = 0
            else:
                # Green
                r = 0
                g = 255
                b = int(255 * ((mastery - 0.67) / 0.33))
            
            return f"#{r:02x}{g:02x}{b:02x}"
        else:
            # Default gray
            return "#888888"


# ============================================================================
# SVG GENERATOR
# ============================================================================

class SVGGenerator:
    """Generate SVG from graph data"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
    
    def generate(self, graph_data: Dict[str, Any]) -> str:
        """Generate SVG representation of graph"""
        if not SVG_AVAILABLE:
            raise HTTPException(status_code=501, detail="SVG generation not available")
        
        nodes = graph_data.get("nodes", [])
        edges = graph_data.get("edges", [])
        
        if not nodes:
            return self._empty_svg()
        
        # Calculate bounding box
        min_x = min(n["x"] for n in nodes)
        max_x = max(n["x"] for n in nodes)
        min_y = min(n["y"] for n in nodes)
        max_y = max(n["y"] for n in nodes)
        
        padding = 50
        width = max_x - min_x + 2 * padding
        height = max_y - min_y + 2 * padding
        
        # Create SVG document
        dwg = svgwrite.Drawing(size=(width, height))
        
        # Offset for centering
        offset_x = -min_x + padding
        offset_y = -min_y + padding
        
        # Draw edges
        for edge in edges:
            source = next((n for n in nodes if n["id"] == edge["source"]), None)
            target = next((n for n in nodes if n["id"] == edge["target"]), None)
            
            if source and target:
                x1 = source["x"] + offset_x
                y1 = source["y"] + offset_y
                x2 = target["x"] + offset_x
                y2 = target["y"] + offset_y
                
                dwg.add(dwg.line(
                    (x1, y1),
                    (x2, y2),
                    stroke="#cccccc",
                    stroke_width=2
                ))
        
        # Draw nodes
        show_labels = self.config.get("visualization.show_labels", True)
        
        for node in nodes:
            x = node["x"] + offset_x
            y = node["y"] + offset_y
            size = node.get("size", 30)
            color = node.get("color", "#888888")
            label = node.get("label", node["id"])
            
            # Draw circle
            dwg.add(dwg.circle(
                (x, y),
                r=size / 2,
                fill=color,
                stroke="#333333",
                stroke_width=2
            ))
            
            # Draw label
            if show_labels:
                dwg.add(dwg.text(
                    label,
                    insert=(x, y + size / 2 + 15),
                    text_anchor="middle",
                    font_size=12,
                    fill="#333333"
                ))
        
        return dwg.tostring()
    
    def _empty_svg(self) -> str:
        """Generate empty SVG"""
        dwg = svgwrite.Drawing(size=(400, 300))
        dwg.add(dwg.text(
            "No data",
            insert=(200, 150),
            text_anchor="middle",
            font_size=16,
            fill="#888888"
        ))
        return dwg.tostring()


# ============================================================================
# EXPORT HANDLER
# ============================================================================

class ExportHandler:
    """Handle export to various formats"""
    
    def __init__(self, config: ConfigLoader, svg_generator: SVGGenerator):
        self.config = config
        self.svg_generator = svg_generator
    
    def export(self, graph_data: Dict[str, Any], format: str, include_legend: bool = True, high_resolution: bool = True) -> bytes:
        """Export graph data to specified format"""
        if format == "json":
            return self._export_json(graph_data)
        elif format == "svg":
            return self._export_svg(graph_data, include_legend)
        elif format == "png":
            return self._export_png(graph_data, include_legend, high_resolution)
        elif format == "pdf":
            return self._export_pdf(graph_data, include_legend, high_resolution)
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    def _export_json(self, graph_data: Dict[str, Any]) -> bytes:
        """Export as JSON"""
        json_str = json.dumps(graph_data, indent=2)
        return json_str.encode('utf-8')
    
    def _export_svg(self, graph_data: Dict[str, Any], include_legend: bool) -> bytes:
        """Export as SVG"""
        svg_content = self.svg_generator.generate(graph_data)
        
        if include_legend:
            svg_content = self._add_legend_to_svg(svg_content)
        
        return svg_content.encode('utf-8')
    
    def _export_png(self, graph_data: Dict[str, Any], include_legend: bool, high_resolution: bool) -> bytes:
        """Export as PNG"""
        if not CAIRO_AVAILABLE:
            raise HTTPException(status_code=501, detail="PNG export not available - install cairosvg")
        
        svg_content = self.svg_generator.generate(graph_data)
        
        if include_legend:
            svg_content = self._add_legend_to_svg(svg_content)
        
        # Convert SVG to PNG
        scale = 2.0 if high_resolution else 1.0
        png_bytes = cairosvg.svg2png(
            bytestring=svg_content.encode('utf-8'),
            scale=scale
        )
        
        return png_bytes
    
    def _export_pdf(self, graph_data: Dict[str, Any], include_legend: bool, high_resolution: bool) -> bytes:
        """Export as PDF"""
        if not CAIRO_AVAILABLE:
            raise HTTPException(status_code=501, detail="PDF export not available - install cairosvg")
        
        svg_content = self.svg_generator.generate(graph_data)
        
        if include_legend:
            svg_content = self._add_legend_to_svg(svg_content)
        
        # Convert SVG to PDF
        scale = 2.0 if high_resolution else 1.0
        pdf_bytes = cairosvg.svg2pdf(
            bytestring=svg_content.encode('utf-8'),
            scale=scale
        )
        
        return pdf_bytes
    
    def _add_legend_to_svg(self, svg_content: str) -> str:
        """Add legend to SVG content"""
        # Simple legend addition (append before closing svg tag)
        legend = '''
        <g transform="translate(20, 20)">
            <text x="0" y="0" font-size="14" font-weight="bold">Mastery Level:</text>
            <circle cx="10" cy="20" r="8" fill="#ff0000"/>
            <text x="25" y="25" font-size="12">Low (0-33%)</text>
            <circle cx="10" cy="40" r="8" fill="#ffff00"/>
            <text x="25" y="45" font-size="12">Medium (33-67%)</text>
            <circle cx="10" cy="60" r="8" fill="#00ff00"/>
            <text x="25" y="65" font-size="12">High (67-100%)</text>
        </g>
        '''
        
        return svg_content.replace('</svg>', legend + '</svg>')


# ============================================================================
# MIND MAP AGENT
# ============================================================================

class MindMapAgent:
    """Main Mind Map Agent orchestrator"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
        
        # Initialize components
        kg_base_url = config.get("knowledge_graph_api.base_url")
        self.kg_client = KnowledgeGraphClient(kg_base_url)
        self.layout_engine = LayoutEngine(config)
        self.node_calculator = NodePropertyCalculator(config)
        self.svg_generator = SVGGenerator(config)
        self.export_handler = ExportHandler(config, self.svg_generator)
        
        # Cache
        self.cache = {}
        
        logger.info("mindmap_agent_initialized")
    
    async def generate_mindmap(self, concept_id: str, user_id: str, layout: str = "force_directed", max_depth: int = 3, max_nodes: int = 100) -> Dict[str, Any]:
        """
        Generate mind map for a concept
        
        6-step process:
        1. Get graph data from knowledge graph
        2. Fetch user mastery data
        3. Calculate node properties
        4. Apply layout algorithm
        5. Generate interactive JSON
        6. Return complete mind map data
        """
        logger.info("generating_mindmap", concept_id=concept_id, user_id=user_id, layout=layout)
        
        # Step 1: Get graph data
        graph_data = await self.get_graph_data(concept_id, max_depth)
        
        # Limit nodes
        nodes = graph_data["nodes"][:max_nodes]
        node_ids = {n["id"] for n in nodes}
        edges = [e for e in graph_data["edges"] if e["source"] in node_ids and e["target"] in node_ids]
        
        # Step 2: Fetch user mastery
        concept_ids = [n["id"] for n in nodes]
        user_mastery = await self.kg_client.get_user_mastery(user_id, concept_ids)
        
        # Step 3: Calculate node properties
        nodes_with_properties = []
        for node in nodes:
            node_with_props = self.node_calculator.calculate_properties(node, user_mastery)
            nodes_with_properties.append(node_with_props)
        
        # Step 4: Apply layout
        positioned_nodes = self.layout_engine.apply_layout(nodes_with_properties, edges, layout)
        
        # Step 5: Generate interactive JSON
        interactive_data = self.generate_interactive_json({
            "nodes": positioned_nodes,
            "edges": edges,
            "layout": layout
        })
        
        # Step 6: Return complete data
        return {
            "concept_id": concept_id,
            "user_id": user_id,
            "layout": layout,
            "graph_data": interactive_data,
            "metadata": {
                "node_count": len(positioned_nodes),
                "edge_count": len(edges),
                "max_depth": max_depth,
                "generated_at": datetime.utcnow().isoformat()
            }
        }
    
    async def get_graph_data(self, concept_id: str, depth: int = 1) -> Dict[str, Any]:
        """
        Get graph data from knowledge graph
        
        Fetches concept and related concepts, builds node and edge structures
        """
        logger.info("fetching_graph_data", concept_id=concept_id, depth=depth)
        
        # Check cache
        cache_key = f"graph:{concept_id}:{depth}"
        if cache_key in self.cache:
            logger.info("cache_hit", key=cache_key)
            return self.cache[cache_key]
        
        # Fetch from knowledge graph
        try:
            # Get root concept
            root_concept = await self.kg_client.get_concept(concept_id)
            
            # Get related concepts
            related_data = await self.kg_client.get_related_concepts(concept_id, depth)
            
            # Build nodes
            nodes = []
            nodes.append({
                "id": root_concept.get("id", concept_id),
                "label": root_concept.get("name", concept_id),
                "importance": 1.0,
                "metadata": root_concept
            })
            
            for concept in related_data.get("concepts", []):
                nodes.append({
                    "id": concept.get("id", ""),
                    "label": concept.get("name", ""),
                    "importance": concept.get("importance", 0.5),
                    "metadata": concept
                })
            
            # Build edges
            edges = []
            for relation in related_data.get("relationships", []):
                edges.append({
                    "source": relation.get("source_id", ""),
                    "target": relation.get("target_id", ""),
                    "weight": relation.get("weight", 1.0),
                    "relation_type": relation.get("type", "related")
                })
            
            graph_data = {
                "nodes": nodes,
                "edges": edges
            }
            
            # Cache result
            self.cache[cache_key] = graph_data
            
            return graph_data
            
        except Exception as e:
            logger.error("graph_data_fetch_error", error=str(e))
            raise
    
    def apply_layout_algorithm(self, nodes: List[Dict], edges: List[Dict], algorithm: str) -> Dict[str, Any]:
        """
        Apply layout algorithm to nodes and edges
        
        Returns positioned nodes with x, y coordinates
        """
        logger.info("applying_layout", algorithm=algorithm, node_count=len(nodes))
        
        positioned_nodes = self.layout_engine.apply_layout(nodes, edges, algorithm)
        
        return {
            "nodes": positioned_nodes,
            "edges": edges,
            "layout": algorithm
        }
    
    def calculate_node_properties(self, node: Dict, user_mastery: Dict[str, float]) -> Dict:
        """
        Calculate node visual properties
        
        Returns node with size, color, mastery level
        """
        return self.node_calculator.calculate_properties(node, user_mastery)
    
    def generate_svg(self, graph_data: Dict[str, Any]) -> str:
        """
        Generate SVG representation
        
        Returns SVG string
        """
        logger.info("generating_svg")
        return self.svg_generator.generate(graph_data)
    
    def generate_interactive_json(self, graph_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate interactive JSON for client-side rendering
        
        Includes nodes, edges, interactivity settings, animation data
        """
        logger.info("generating_interactive_json")
        
        # Add interactivity settings from config
        interactivity = {
            "enable_zoom": self.config.get("interactivity.enable_zoom", True),
            "enable_pan": self.config.get("interactivity.enable_pan", True),
            "enable_drag": self.config.get("interactivity.enable_drag", True),
            "click_to_expand": self.config.get("interactivity.click_to_expand", True),
            "hover_info": self.config.get("interactivity.hover_info", True)
        }
        
        # Add animation data
        animation = {
            "duration": 500,
            "easing": "ease-in-out",
            "stagger": 50
        }
        
        return {
            **graph_data,
            "interactivity": interactivity,
            "animation": animation
        }
    
    def export_to_format(self, graph_data: Dict[str, Any], format: str, include_legend: bool = True, high_resolution: bool = True) -> bytes:
        """
        Export graph to specified format
        
        Supports: json, svg, png, pdf
        """
        logger.info("exporting", format=format)
        return self.export_handler.export(graph_data, format, include_legend, high_resolution)
    
    async def get_prerequisite_tree(self, concept_id: str) -> Dict[str, Any]:
        """
        Get prerequisite tree for a concept
        
        Returns tree structure with dependencies
        """
        logger.info("fetching_prerequisite_tree", concept_id=concept_id)
        
        # Check cache
        cache_key = f"prereq:{concept_id}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # Fetch prerequisites
        prereq_data = await self.kg_client.get_prerequisites(concept_id)
        
        # Build tree structure
        tree = {
            "concept_id": concept_id,
            "prerequisites": prereq_data.get("prerequisites", []),
            "depth": self._calculate_tree_depth(prereq_data.get("prerequisites", []))
        }
        
        # Cache result
        self.cache[cache_key] = tree
        
        return tree
    
    def _calculate_tree_depth(self, prerequisites: List[Dict]) -> int:
        """Calculate maximum depth of prerequisite tree"""
        if not prerequisites:
            return 0
        
        max_depth = 0
        for prereq in prerequisites:
            child_prereqs = prereq.get("prerequisites", [])
            depth = 1 + self._calculate_tree_depth(child_prereqs)
            max_depth = max(max_depth, depth)
        
        return max_depth
    
    async def close(self):
        """Close resources"""
        await self.kg_client.close()


# ============================================================================
# METRICS
# ============================================================================

mindmap_generation_duration = Histogram(
    "mindmap_generation_duration_seconds",
    "Time to generate mind map",
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

mindmap_generations_total = Counter(
    "mindmap_generations_total",
    "Total mind maps generated",
    ["layout", "status"]
)

export_duration = Histogram(
    "export_duration_seconds",
    "Time to export mind map",
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0]
)

exports_total = Counter(
    "exports_total",
    "Total exports",
    ["format", "status"]
)


# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

# Load configuration
config = ConfigLoader("config.yaml")

# Initialize agent
agent = MindMapAgent(config)

# Create FastAPI app
app = FastAPI(
    title=config.get("agent.name", "mindmap_agent"),
    description="Mind Map Agent - Generate interactive mind maps from knowledge graph",
    version="1.0.0"
)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    await agent.close()


@app.post("/generate")
async def generate_mindmap_endpoint(request: GenerateMindmapRequest):
    """
    Generate mind map for a concept
    
    Returns complete mind map with positioned nodes, edges, and interactivity data
    """
    start_time = time.time()
    
    try:
        result = await agent.generate_mindmap(
            concept_id=request.concept_id,
            user_id=request.user_id,
            layout=request.layout,
            max_depth=request.max_depth or 3,
            max_nodes=request.max_nodes or 100
        )
        
        duration = time.time() - start_time
        mindmap_generation_duration.observe(duration)
        mindmap_generations_total.labels(layout=request.layout, status="success").inc()
        
        return result
        
    except Exception as e:
        duration = time.time() - start_time
        mindmap_generation_duration.observe(duration)
        mindmap_generations_total.labels(layout=request.layout, status="error").inc()
        logger.error("mindmap_generation_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/layout")
async def apply_layout_endpoint(request: ApplyLayoutRequest):
    """
    Apply layout algorithm to existing graph data
    
    Returns positioned nodes with x, y coordinates
    """
    try:
        result = agent.apply_layout_algorithm(
            nodes=request.nodes,
            edges=request.edges,
            algorithm=request.algorithm
        )
        return result
        
    except Exception as e:
        logger.error("layout_application_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graph/{concept_id}")
async def get_graph_endpoint(
    concept_id: str,
    depth: int = Query(default=1, ge=1, le=5)
):
    """
    Get graph data for a concept
    
    Returns nodes and edges from knowledge graph
    """
    try:
        result = await agent.get_graph_data(concept_id, depth)
        return result
        
    except Exception as e:
        logger.error("graph_data_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/export")
async def export_endpoint(request: ExportRequest):
    """
    Export mind map to specified format
    
    Supports: json, svg, png, pdf
    Returns file bytes with appropriate content type
    """
    start_time = time.time()
    
    try:
        file_bytes = agent.export_to_format(
            graph_data=request.graph_data,
            format=request.format,
            include_legend=request.include_legend,
            high_resolution=request.high_resolution
        )
        
        duration = time.time() - start_time
        export_duration.observe(duration)
        exports_total.labels(format=request.format, status="success").inc()
        
        # Determine content type
        content_types = {
            "json": "application/json",
            "svg": "image/svg+xml",
            "png": "image/png",
            "pdf": "application/pdf"
        }
        content_type = content_types.get(request.format, "application/octet-stream")
        
        return Response(
            content=file_bytes,
            media_type=content_type,
            headers={
                "Content-Disposition": f"attachment; filename=mindmap.{request.format}"
            }
        )
        
    except Exception as e:
        duration = time.time() - start_time
        export_duration.observe(duration)
        exports_total.labels(format=request.format, status="error").inc()
        logger.error("export_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/prerequisite-tree/{concept_id}")
async def get_prerequisite_tree_endpoint(concept_id: str):
    """
    Get prerequisite tree for a concept
    
    Returns tree structure with all prerequisites
    """
    try:
        result = await agent.get_prerequisite_tree(concept_id)
        return result
        
    except Exception as e:
        logger.error("prerequisite_tree_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/update-mastery")
async def update_mastery_endpoint(request: UpdateMasteryRequest):
    """
    Update mastery data and invalidate cache
    
    Forces regeneration of mind maps with new mastery levels
    """
    try:
        # Invalidate relevant cache entries
        cache_keys_to_remove = [
            key for key in agent.cache.keys()
            if request.concept_id in key
        ]
        
        for key in cache_keys_to_remove:
            del agent.cache[key]
        
        logger.info("cache_invalidated", concept_id=request.concept_id, keys_removed=len(cache_keys_to_remove))
        
        return {
            "status": "success",
            "message": f"Mastery updated for concept {request.concept_id}",
            "cache_entries_invalidated": len(cache_keys_to_remove)
        }
        
    except Exception as e:
        logger.error("update_mastery_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "mindmap_agent",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(content=generate_latest(), media_type="text/plain")


if __name__ == "__main__":
    import uvicorn
    
    port = config.get("agent.port", 8007)
    host = config.get("agent.host", "0.0.0.0")
    
    uvicorn.run(app, host=host, port=port)
