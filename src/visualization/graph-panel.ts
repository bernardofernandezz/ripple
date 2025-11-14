import * as vscode from 'vscode';
import * as path from 'path';

export class GraphPanelProvider {
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor(private extensionUri: vscode.Uri) {}

    public show(): void {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'dependencyGraph',
            'Dependency Impact Graph',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.extensionUri]
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        this.panel.onDidDispose(() => {
            this.dispose();
        }, null, this.disposables);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'nodeClicked':
                        this.handleNodeClick(message.data);
                        break;
                    case 'edgeClicked':
                        this.handleEdgeClick(message.data);
                        break;
                }
            },
            null,
            this.disposables
        );
    }

    public updateGraph(graphData: any): void {
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'updateGraph',
                data: graphData
            });
        }
    }

    public updateImpact(impactData: any): void {
        if (this.panel) {
            this.panel.webview.postMessage({
                command: 'updateImpact',
                data: impactData
            });
        }
    }

    private handleNodeClick(data: any): void {
        if (data.file && data.line) {
            vscode.workspace.openTextDocument(data.file).then(doc => {
                vscode.window.showTextDocument(doc).then(editor => {
                    const position = new vscode.Position(data.line - 1, data.column - 1 || 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position));
                });
            });
        }
    }

    private handleEdgeClick(data: any): void {
        // Handle edge click - could show dependency details
        if (data.location) {
            vscode.workspace.openTextDocument(data.location.file).then(doc => {
                vscode.window.showTextDocument(doc).then(editor => {
                    const position = new vscode.Position(data.location.line - 1, data.location.column - 1 || 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position));
                });
            });
        }
    }

    private getWebviewContent(): string {
        const d3Uri = vscode.Uri.joinPath(this.extensionUri, 'media', 'd3.v7.min.js');
        const d3Path = this.panel?.webview.asWebviewUri(d3Uri);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dependency Impact Graph</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
        }
        #graph {
            width: 100%;
            height: calc(100vh - 100px);
            border: 1px solid var(--vscode-panel-border);
        }
        .controls {
            margin-bottom: 10px;
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .controls button {
            padding: 5px 10px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
        .controls button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .node {
            cursor: pointer;
        }
        .node circle {
            stroke: var(--vscode-editor-foreground);
            stroke-width: 2px;
        }
        .node.critical circle {
            fill: #f44336;
        }
        .node.warning circle {
            fill: #ff9800;
        }
        .node.safe circle {
            fill: #4caf50;
        }
        .node.default circle {
            fill: var(--vscode-textLink-foreground);
        }
        .link {
            stroke: var(--vscode-textLink-foreground);
            stroke-opacity: 0.6;
            stroke-width: 2;
        }
        .node text {
            font: 12px var(--vscode-font-family);
            fill: var(--vscode-editor-foreground);
            pointer-events: none;
        }
        .tooltip {
            position: absolute;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            padding: 8px;
            border-radius: 4px;
            pointer-events: none;
            display: none;
            z-index: 1000;
        }
        .impact-summary {
            margin-bottom: 10px;
            padding: 10px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="controls">
        <button id="resetZoom">Reset Zoom</button>
        <button id="fitToScreen">Fit to Screen</button>
        <span id="nodeCount">Nodes: 0</span>
        <span id="edgeCount">Edges: 0</span>
    </div>
    <div id="impactSummary" class="impact-summary" style="display: none;"></div>
    <div id="graph"></div>
    <div class="tooltip" id="tooltip"></div>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script>
        const vscode = acquireVsCodeApi();
        let graphData = { nodes: [], edges: [] };
        let simulation = null;
        let svg = null;
        let width = 0;
        let height = 0;

        function updateDimensions() {
            width = window.innerWidth - 40;
            height = window.innerHeight - 140;
        }

        function renderGraph(data) {
            graphData = data;
            updateDimensions();

            d3.select('#graph').selectAll('*').remove();

            if (!data.nodes || data.nodes.length === 0) {
                d3.select('#graph').append('text')
                    .attr('x', width / 2)
                    .attr('y', height / 2)
                    .attr('text-anchor', 'middle')
                    .style('fill', 'var(--vscode-editor-foreground)')
                    .text('No dependencies found');
                return;
            }

            svg = d3.select('#graph')
                .append('svg')
                .attr('width', width)
                .attr('height', height);

            const container = svg.append('g');

            // Create force simulation
            simulation = d3.forceSimulation(data.nodes)
                .force('link', d3.forceLink(data.edges).id(d => d.id).distance(100))
                .force('charge', d3.forceManyBody().strength(-300))
                .force('center', d3.forceCenter(width / 2, height / 2))
                .force('collision', d3.forceCollide().radius(30));

            // Create edges
            const link = container.append('g')
                .selectAll('line')
                .data(data.edges)
                .enter().append('line')
                .attr('class', 'link')
                .attr('stroke-width', 2);

            // Create nodes
            const node = container.append('g')
                .selectAll('g')
                .data(data.nodes)
                .enter().append('g')
                .attr('class', d => \`node \${d.severity || 'default'}\`)
                .call(d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended));

            node.append('circle')
                .attr('r', d => d.severity === 'critical' ? 12 : d.severity === 'warning' ? 10 : 8);

            node.append('text')
                .attr('dx', 15)
                .attr('dy', 4)
                .text(d => d.name || d.id);

            // Tooltip
            const tooltip = d3.select('#tooltip');

            node.on('mouseover', function(event, d) {
                tooltip
                    .style('display', 'block')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px')
                    .html(\`
                        <strong>\${d.name || d.id}</strong><br>
                        Type: \${d.kind || 'unknown'}<br>
                        File: \${d.file || 'unknown'}<br>
                        \${d.severity ? 'Severity: ' + d.severity : ''}
                    \`);
            })
            .on('mouseout', function() {
                tooltip.style('display', 'none');
            })
            .on('click', function(event, d) {
                vscode.postMessage({
                    command: 'nodeClicked',
                    data: {
                        file: d.file,
                        line: d.line,
                        column: d.column,
                        name: d.name
                    }
                });
            });

            link.on('click', function(event, d) {
                event.stopPropagation();
                vscode.postMessage({
                    command: 'edgeClicked',
                    data: {
                        location: d.location,
                        type: d.type
                    }
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

            // Update counts
            document.getElementById('nodeCount').textContent = \`Nodes: \${data.nodes.length}\`;
            document.getElementById('edgeCount').textContent = \`Edges: \${data.edges.length}\`;

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

        function updateImpact(data) {
            const summary = document.getElementById('impactSummary');
            if (data && data.estimatedImpact) {
                summary.style.display = 'block';
                summary.innerHTML = \`
                    <h3>Impact Summary</h3>
                    <p><strong>Files Affected:</strong> \${data.estimatedImpact.filesAffected}</p>
                    <p><strong>Call Sites Affected:</strong> \${data.estimatedImpact.callSitesAffected}</p>
                    <p><strong>Estimated LOC to Change:</strong> \${data.estimatedImpact.estimatedLOC}</p>
                    <p><strong>Severity:</strong> <span class="\${data.severity}">\${data.severity}</span></p>
                    <p><strong>Description:</strong> \${data.description}</p>
                \`;
            } else {
                summary.style.display = 'none';
            }
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateGraph':
                    renderGraph(message.data);
                    break;
                case 'updateImpact':
                    updateImpact(message.data);
                    break;
            }
        });

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

        document.getElementById('resetZoom').addEventListener('click', () => {
            if (simulation) {
                simulation.alpha(1).restart();
            }
        });

        document.getElementById('fitToScreen').addEventListener('click', () => {
            if (simulation && graphData.nodes.length > 0) {
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

                const centerX = (bounds.minX + bounds.maxX) / 2;
                const centerY = (bounds.minY + bounds.maxY) / 2;
                const scale = Math.min(width / (bounds.maxX - bounds.minX), height / (bounds.maxY - bounds.minY)) * 0.8;

                // Reset and recenter
                simulation.force('center', d3.forceCenter(width / 2 - centerX * scale, height / 2 - centerY * scale));
                simulation.alpha(1).restart();
            }
        });
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

