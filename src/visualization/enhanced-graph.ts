export type GraphViewMode = 'compact' | 'detailed' | 'heatmap' | 'timeline';

export interface GraphNode {
    id: string;
    name: string;
    kind: string;
    file: string;
    line: number;
    column: number;
    severity?: 'critical' | 'warning' | 'safe';
    dependentCount?: number;
    estimatedLOC?: number;
    isCurrentNode?: boolean;
}

export interface GraphEdge {
    source: string;
    target: string;
    type: string;
    location?: {
        file: string;
        line: number;
        column: number;
    };
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export class EnhancedGraphVisualization {
    private viewMode: GraphViewMode = 'compact';

    public setViewMode(mode: GraphViewMode): void {
        this.viewMode = mode;
    }

    public getViewMode(): GraphViewMode {
        return this.viewMode;
    }

    public transformDataForView(data: GraphData, mode: GraphViewMode): GraphData {
        switch (mode) {
            case 'compact':
                return this.getCompactView(data);
            case 'detailed':
                return data; // Full data
            case 'heatmap':
                return this.getHeatmapView(data);
            case 'timeline':
                return this.getTimelineView(data);
            default:
                return data;
        }
    }

    private getCompactView(data: GraphData): GraphData {
        // Show only direct dependencies
        const currentNodes = data.nodes.filter(n => n.isCurrentNode);
        if (currentNodes.length === 0) {
            return data;
        }

        const currentNode = currentNodes[0];
        const directEdges = data.edges.filter(
            e => e.source === currentNode.id || e.target === currentNode.id
        );
        const directNodeIds = new Set<string>();
        directEdges.forEach(e => {
            directNodeIds.add(e.source);
            directNodeIds.add(e.target);
        });

        return {
            nodes: data.nodes.filter(n => directNodeIds.has(n.id)),
            edges: directEdges
        };
    }

    private getHeatmapView(data: GraphData): GraphData {
        // Add heatmap intensity based on dependent count
        return {
            nodes: data.nodes.map(node => ({
                ...node,
                heatmapIntensity: this.calculateHeatmapIntensity(node)
            })),
            edges: data.edges
        };
    }

    private getTimelineView(data: GraphData): GraphData {
        // Group by dependency depth
        const depthMap = new Map<string, number>();
        const currentNodes = data.nodes.filter(n => n.isCurrentNode);
        
        if (currentNodes.length > 0) {
            const currentNode = currentNodes[0];
            this.calculateDepths(currentNode.id, data, depthMap, 0);
        }

        return {
            nodes: data.nodes.map(node => ({
                ...node,
                depth: depthMap.get(node.id) || 0
            })),
            edges: data.edges
        };
    }

    private calculateDepths(
        nodeId: string,
        data: GraphData,
        depthMap: Map<string, number>,
        currentDepth: number
    ): void {
        if (depthMap.has(nodeId) && depthMap.get(nodeId)! <= currentDepth) {
            return;
        }

        depthMap.set(nodeId, currentDepth);

        const outgoingEdges = data.edges.filter(e => e.source === nodeId);
        outgoingEdges.forEach(edge => {
            this.calculateDepths(edge.target, data, depthMap, currentDepth + 1);
        });
    }

    private calculateHeatmapIntensity(node: GraphNode): number {
        // Intensity based on dependent count and severity
        let intensity = 0;
        
        if (node.dependentCount) {
            intensity += Math.min(node.dependentCount * 10, 50);
        }

        if (node.severity === 'critical') intensity += 40;
        else if (node.severity === 'warning') intensity += 20;

        return Math.min(intensity, 100);
    }
}

