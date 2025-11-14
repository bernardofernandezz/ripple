import * as vscode from 'vscode';
import * as path from 'path';

export class EnhancedGraphPanelProvider {
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];
    private currentFocusNode: string | null = null;
    private viewMode: 'overview' | 'focused' | 'detailed' = 'overview';
    private highlightedFiles: Set<string> = new Set();
    private highlightSeverity: string = 'safe';

    constructor(private extensionUri?: vscode.Uri) {}

    public show(): void {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        try {
            this.panel = vscode.window.createWebviewPanel(
                'rippleGraph',
                'Ripple - Dependency Impact',
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: this.extensionUri ? [this.extensionUri] : []
                }
            );
        } catch (error) {
            console.error('Error creating webview panel:', error);
            vscode.window.showErrorMessage(`Failed to create graph panel: ${error}`);
            return;
        }

        this.panel.webview.html = this.getEnhancedWebviewContent();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.dispose();
        }, null, this.disposables);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            message => {
                this.handleMessage(message);
            },
            null,
            this.disposables
        );
    }

    private handleMessage(message: any): void {
        switch (message.command) {
            case 'nodeClicked':
                this.handleNodeClick(message.data);
                break;
            case 'nodeFocus':
                this.currentFocusNode = message.data.nodeId;
                this.updateGraphOptions({ focusNode: message.data.nodeId });
                break;
            case 'search':
                this.updateGraphOptions({ searchQuery: message.data.query });
                break;
            case 'filter':
                this.updateGraphOptions({ filter: message.data });
                break;
            case 'changeViewMode':
                this.viewMode = message.data.mode;
                this.updateGraphOptions({ viewMode: message.data.mode });
                break;
            case 'highlightNodes':
                this.highlightAffectedNodes(message.data.files, message.data.severity);
                break;
        }
    }

    public highlightAffectedNodes(files: string[], severity: string): void {
        this.highlightedFiles = new Set(files);
        this.highlightSeverity = severity;
        if (this.panel) {
            try {
                this.panel.webview.postMessage({
                    command: 'highlightAffectedNodes',
                    data: { files, severity }
                });
            } catch (error) {
                console.error('Error highlighting nodes:', error);
            }
        }
    }

    private handleNodeClick(data: any): void {
        if (data.file && data.line) {
            vscode.workspace.openTextDocument(data.file).then(doc => {
                return vscode.window.showTextDocument(doc);
            }).then(editor => {
                const line = Math.max(0, (data.line || 1) - 1);
                const column = Math.max(0, (data.column || 1) - 1);
                const position = new vscode.Position(line, column);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position));
            }, (err: any) => {
                console.error('Error opening/showing text document:', err);
            });
        }
    }

    public updateGraph(graphData: any): void {
        if (this.panel) {
            try {
                this.panel.webview.postMessage({
                    command: 'updateGraph',
                    data: graphData
                });
            } catch (error) {
                console.error('Error updating graph:', error);
            }
        }
    }

    private updateGraphOptions(options: any): void {
        if (this.panel) {
            try {
                this.panel.webview.postMessage({
                    command: 'updateGraphOptions',
                    data: options
                });
            } catch (error) {
                console.error('Error updating graph options:', error);
            }
        }
    }

    private getEnhancedWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ripple - Dependency Impact</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }

        .header {
            background: var(--vscode-titleBar-activeBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        .search-box {
            flex: 1;
            min-width: 200px;
            position: relative;
        }

        .search-box input {
            width: 100%;
            padding: 6px 30px 6px 10px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 13px;
        }

        .search-box::before {
            content: '🔍';
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
        }

        .view-mode-selector {
            display: flex;
            gap: 4px;
            background: var(--vscode-button-secondaryBackground);
            border-radius: 4px;
            padding: 2px;
        }

        .view-mode-btn {
            padding: 6px 12px;
            background: transparent;
            border: none;
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            border-radius: 2px;
            font-size: 12px;
            transition: all 0.2s;
        }

        .view-mode-btn.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .view-mode-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .stats {
            display: flex;
            gap: 16px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .stat-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .controls {
            display: flex;
            gap: 8px;
        }

        .btn {
            padding: 6px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.2s;
        }

        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .main-container {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        .sidebar {
            width: 300px;
            background: var(--vscode-sideBar-background);
            border-right: 1px solid var(--vscode-panel-border);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .sidebar-header {
            padding: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-weight: 600;
            font-size: 13px;
        }

        .sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
        }

        .node-info {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 12px;
        }

        .node-info h3 {
            font-size: 14px;
            margin-bottom: 8px;
            color: var(--vscode-textLink-foreground);
        }

        .node-info p {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin: 4px 0;
        }

        .node-info .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            margin-right: 4px;
        }

        .badge.critical { background: #dc2626; color: white; }
        .badge.warning { background: #f59e0b; color: white; }
        .badge.safe { background: #10b981; color: white; }

        .graph-container {
            flex: 1;
            position: relative;
            overflow: hidden;
        }

        #graph {
            width: 100%;
            height: 100%;
        }

        .legend {
            position: absolute;
            bottom: 16px;
            right: 16px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 10px 14px;
            font-size: 11px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 4px 0;
        }

        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            padding: 40px;
        }

        .empty-state h2 {
            margin-bottom: 12px;
            color: var(--vscode-editor-foreground);
        }

        .node {
            cursor: pointer;
            transition: all 0.2s;
        }

        .node:hover {
            filter: brightness(1.2);
        }

        .node circle {
            stroke: var(--vscode-editor-foreground);
            stroke-width: 2px;
        }

        .node.focused circle {
            stroke-width: 3px;
            filter: drop-shadow(0 0 8px currentColor);
        }

        .node text {
            font-size: 11px;
            fill: var(--vscode-editor-foreground);
            pointer-events: none;
            text-anchor: start;
        }

        .link {
            stroke: var(--vscode-textLink-foreground);
            stroke-opacity: 0.3;
            stroke-width: 1.5;
        }

        .link.highlighted {
            stroke-opacity: 0.8;
            stroke-width: 2.5;
        }

        .tooltip {
            position: absolute;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 8px 12px;
            pointer-events: none;
            display: none;
            z-index: 1000;
            font-size: 12px;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .tooltip h4 {
            margin-bottom: 4px;
            color: var(--vscode-textLink-foreground);
        }

        .tooltip p {
            margin: 2px 0;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="search-box">
            <input type="text" id="searchInput" placeholder="🔍 Search functions or files...">
        </div>
        <div class="header-right">
            <div class="stats">
                <span id="nodeCount">0</span> nodes
            </div>
            <button class="btn btn-secondary" id="fitToScreen" title="Fit to screen">Fit</button>
        </div>
    </div>

    <div class="main-container">
        <div class="sidebar" id="sidebar">
            <div class="sidebar-header">Node Information</div>
            <div class="sidebar-content" id="sidebarContent">
                <div class="empty-state">
                    <h2>👆 Click a node</h2>
                    <p>Select a node in the graph to see detailed information about its dependencies and impact.</p>
                </div>
            </div>
        </div>

        <div class="graph-container">
            <div id="graph"></div>
            <div class="legend">
                <div class="legend-item">
                    <div class="legend-color" style="background: #dc2626;"></div>
                    <span>Critical Impact</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #f59e0b;"></div>
                    <span>Warning</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #10b981;"></div>
                    <span>Safe</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #6b7280;"></div>
                    <span>Neutral</span>
                </div>
            </div>
        </div>
    </div>

    <div class="tooltip" id="tooltip"></div>

    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script>
        const vscode = acquireVsCodeApi();
        
        let graphData = { nodes: [], edges: [] };
        let filteredData = { nodes: [], edges: [] };
        let simulation = null;
        let svg = null;
        let width = 0;
        let height = 0;
        let currentFocusNodeId = null;
        let searchQuery = '';
        let viewMode = 'overview';

        function init() {
            updateDimensions();
            setupEventListeners();
            renderGraph();
        }

        function updateDimensions() {
            const container = document.querySelector('.graph-container');
            width = container.clientWidth;
            height = container.clientHeight;
        }

        function setupEventListeners() {
            // Search
            const searchInput = document.getElementById('searchInput');
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    searchQuery = e.target.value.toLowerCase();
                    filterAndRender();
                    vscode.postMessage({ command: 'search', data: { query: searchQuery } });
                }, 300);
            });

            // Fit to screen button
            const fitBtn = document.getElementById('fitToScreen');
            if (fitBtn) {
                fitBtn.addEventListener('click', () => {
                    if (svg && simulation) {
                        const bounds = svg.node().getBBox();
                        const fullWidth = bounds.width;
                        const fullHeight = bounds.height;
                        const widthScale = width / fullWidth;
                        const heightScale = height / fullHeight;
                        const scale = Math.min(widthScale, heightScale) * 0.85;
                        const translateX = (width - fullWidth * scale) / 2;
                        const translateY = (height - fullHeight * scale) / 2;
                        
                        svg.attr('transform', 'translate(' + translateX + ',' + translateY + ') scale(' + scale + ')');
                        simulation.force('center', d3.forceCenter(width / 2, height / 2));
                        simulation.alpha(0.3).restart();
                    }
                });
            }

            // Window resize
            window.addEventListener('resize', () => {
                updateDimensions();
                if (svg) {
                    svg.attr('width', width).attr('height', height);
                    if (simulation) {
                        simulation.force('center', d3.forceCenter(width / 2, height / 2));
                        simulation.alpha(0.3).restart();
                    }
                }
            });
        }

        function filterAndRender() {
            filteredData = {
                nodes: [...graphData.nodes],
                edges: [...graphData.edges]
            };

            // Apply search filter
            if (searchQuery) {
                const matchingNodeIds = new Set();
                filteredData.nodes = filteredData.nodes.filter(node => {
                    const matches = node.name.toLowerCase().includes(searchQuery) ||
                                   node.file.toLowerCase().includes(searchQuery);
                    if (matches) matchingNodeIds.add(node.id);
                    return matches;
                });

                // Include connected edges
                filteredData.edges = filteredData.edges.filter(edge => {
                    return matchingNodeIds.has(edge.source.id || edge.source) ||
                           matchingNodeIds.has(edge.target.id || edge.target);
                });
            }


            updateStats();
            renderGraph();
        }

        function renderGraph() {
            if (!filteredData.nodes || filteredData.nodes.length === 0) {
                document.getElementById('graph').innerHTML = '<div class="empty-state"><h2>No nodes to display</h2><p>Try adjusting your search or filters.</p></div>';
                return;
            }

            updateDimensions();
            d3.select('#graph').selectAll('*').remove();

            svg = d3.select('#graph')
                .append('svg')
                .attr('width', width)
                .attr('height', height);

            const container = svg.append('g');

            // Prepare data for D3
            const nodes = filteredData.nodes.map(n => ({ ...n, x: width / 2, y: height / 2 }));
            const links = filteredData.edges.map(e => ({
                source: typeof e.source === 'string' ? nodes.find(n => n.id === e.source) : e.source,
                target: typeof e.target === 'string' ? nodes.find(n => n.id === e.target) : e.target,
                type: e.type
            })).filter(l => l.source && l.target);

            // Create force simulation
            simulation = d3.forceSimulation(nodes)
                .force('link', d3.forceLink(links).id(d => d.id).distance(100))
                .force('charge', d3.forceManyBody().strength(-400))
                .force('center', d3.forceCenter(width / 2, height / 2))
                .force('collision', d3.forceCollide().radius(30));

            // Create links
            const link = container.append('g')
                .selectAll('line')
                .data(links)
                .enter().append('line')
                .attr('class', d => {
                    const isHighlighted = currentFocusNodeId && 
                        (d.source.id === currentFocusNodeId || d.target.id === currentFocusNodeId);
                    return \`link \${isHighlighted ? 'highlighted' : ''}\`;
                });

            // Create nodes
            const node = container.append('g')
                .selectAll('g')
                .data(nodes)
                .enter().append('g')
                .attr('class', d => \`node \${d.id === currentFocusNodeId ? 'focused' : ''} \${d.severity || 'neutral'}\`)
                .call(d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended));

            // Node circles with size based on connections
            node.append('circle')
                .attr('r', d => {
                    const connections = links.filter(l => 
                        l.source.id === d.id || l.target.id === d.id
                    ).length;
                    return Math.min(8 + connections * 2, 20);
                })
                .attr('fill', d => {
                    if (d.severity === 'critical') return '#dc2626';
                    if (d.severity === 'warning') return '#f59e0b';
                    if (d.severity === 'safe') return '#10b981';
                    return '#6b7280';
                });

            // Node labels
            node.append('text')
                .attr('dx', 15)
                .attr('dy', 4)
                .text(d => {
                    const fileName = d.file ? d.file.split(/[/\\\\]/).pop() : '';
                    return \`\${d.name}\`;
                });

            // Tooltip
            const tooltip = d3.select('#tooltip');
            node.on('mouseenter', function(event, d) {
                tooltip
                    .style('display', 'block')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px')
                    .html(\`
                        <h4>\${d.name}</h4>
                        <p><strong>Type:</strong> \${d.kind || 'unknown'}</p>
                        <p><strong>File:</strong> \${d.file ? d.file.split(/[/\\\\]/).slice(-2).join('/') : 'unknown'}</p>
                        <p><strong>Severity:</strong> \${d.severity || 'neutral'}</p>
                        <p><strong>Dependents:</strong> \${d.dependentCount || 0}</p>
                    \`);
            })
            .on('mouseleave', () => {
                tooltip.style('display', 'none');
            })
            .on('click', function(event, d) {
                event.stopPropagation();
                currentFocusNodeId = d.id;
                updateNodeInfo(d);
                filterAndRender();
                vscode.postMessage({
                    command: 'nodeFocus',
                    data: { nodeId: d.id }
                });
            });

            // Update on simulation tick
            simulation.on('tick', () => {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                node.attr('transform', d => \`translate(\${d.x},\${d.y})\`);
            });

            function dragstarted(event, d) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            }

            function dragged(event, d) {
                d.fx = event.x;
                d.fy = event.y;
            }

            function dragended(event, d) {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }
        }

        function updateNodeInfo(node) {
            const sidebar = document.getElementById('sidebarContent');
            const connections = filteredData.edges.filter(e => 
                (e.source.id || e.source) === node.id || (e.target.id || e.target) === node.id
            ).length;

            sidebar.innerHTML = \`
                <div class="node-info">
                    <h3>\${node.name}</h3>
                    <p><strong>Type:</strong> \${node.kind || 'unknown'}</p>
                    <p><strong>File:</strong> \${node.file || 'unknown'}</p>
                    <p><strong>Line:</strong> \${node.line || 'N/A'}</p>
                    <p><strong>Connections:</strong> \${connections}</p>
                    <p><strong>Dependents:</strong> \${node.dependentCount || 0}</p>
                    <p>
                        <span class="badge \${node.severity || 'safe'}">\${(node.severity || 'safe').toUpperCase()}</span>
                    </p>
                    <button class="btn" style="margin-top: 8px; width: 100%;" onclick="openInEditor('\${node.file}', \${node.line})">
                        Open in Editor
                    </button>
                </div>
            \`;
        }

        function openInEditor(file, line) {
            vscode.postMessage({
                command: 'nodeClicked',
                data: { file, line, column: 0 }
            });
        }

        function updateStats() {
            const nodeCountEl = document.getElementById('nodeCount');
            if (nodeCountEl) {
                nodeCountEl.textContent = filteredData.nodes.length.toString();
            }
        }

        function fitToScreen() {
            if (simulation && filteredData.nodes.length > 0) {
                const bounds = d3.selectAll('.node').nodes().reduce((acc, node) => {
                    const transform = d3.select(node).attr('transform');
                    if (transform) {
                        const match = transform.match(/translate\\(([^,]+),([^)]+)\\)/);
                        if (match) {
                            const x = parseFloat(match[1]);
                            const y = parseFloat(match[2]);
                            acc.minX = Math.min(acc.minX, x);
                            acc.maxX = Math.max(acc.maxX, x);
                            acc.minY = Math.min(acc.minY, y);
                            acc.maxY = Math.max(acc.maxY, y);
                        }
                    }
                    return acc;
                }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

                if (bounds.minX !== Infinity) {
                    const centerX = (bounds.minX + bounds.maxX) / 2;
                    const centerY = (bounds.minY + bounds.maxY) / 2;
                    const scale = Math.min(
                        width / (bounds.maxX - bounds.minX || 1),
                        height / (bounds.maxY - bounds.minY || 1)
                    ) * 0.8;

                    simulation.force('center', d3.forceCenter(
                        width / 2 - centerX * scale,
                        height / 2 - centerY * scale
                    ));
                    simulation.alpha(1).restart();
                }
            }
        }

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateGraph':
                    graphData = message.data;
                    filterAndRender();
                    break;
                case 'updateGraphOptions':
                    if (message.data.focusNode) {
                        currentFocusNodeId = message.data.focusNode;
                    }
                    if (message.data.viewMode) {
                        viewMode = message.data.viewMode;
                    }
                    filterAndRender();
                    break;
                case 'highlightAffectedNodes':
                    highlightAffectedNodes(message.data.files, message.data.severity);
                    break;
            }
        });

        function highlightAffectedNodes(files, severity) {
            const fileSet = new Set(files);
            d3.selectAll('.node').each(function(d) {
                const node = d3.select(this);
                const nodeData = d;
                if (fileSet.has(nodeData.file)) {
                    node.select('circle')
                        .attr('stroke', '#fff')
                        .attr('stroke-width', 3)
                        .attr('fill', severity === 'critical' ? '#dc2626' : 
                                   severity === 'warning' ? '#f59e0b' : '#10b981')
                        .transition()
                        .duration(500)
                        .attr('r', 15);
                    
                    // Pulse animation
                    node.select('circle')
                        .transition()
                        .duration(1000)
                        .attr('r', 12)
                        .transition()
                        .duration(1000)
                        .attr('r', 15)
                        .on('end', function repeat() {
                            d3.select(this)
                                .transition()
                                .duration(1000)
                                .attr('r', 12)
                                .transition()
                                .duration(1000)
                                .attr('r', 15)
                                .on('end', repeat);
                        });
                }
            });
        }

        // Initialize
        init();
    </script>
</body>
</html>`;
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.panel = undefined;
    }
}

