import * as vscode from 'vscode';
import { DependencyGraphManager } from './analysis/dependency-graph';
import { GraphPanelProvider } from './visualization/graph-panel';
import { EnhancedGraphPanelProvider } from './visualization/enhanced-graph-panel';
import { DecorationManager } from './visualization/decorations';
import { DependencyTreeProvider, ImpactSummaryProvider } from './ui/tree-view-provider';
import { FileWatcher } from './utils/file-watcher';
import { WorkspaceScanner } from './utils/workspace-scanner';
import { TypeScriptParser } from './parsers/typescript-parser';
import { ChangeDetector } from './analysis/change-detector';
import { ImpactAnalyzer } from './analysis/impact-analyzer';
import { MigrationGenerator } from './refactoring/migration-generator';
import { PreviewProvider } from './refactoring/preview-provider';
import { ImpactDashboard } from './visualization/impact-dashboard';
import { ImpactAggregator } from './analysis/data-aggregation';
import { GitIntegration } from './integrations/git-integration';
import { IntelligentRefactor } from './refactoring/intelligent-refactor';
import { InteractiveTutorial } from './ui/onboarding/tutorial';
import { OnboardingFlow } from './ui/onboarding/onboarding-flow';
import { RealTimeImpactAnalyzer, EditImpact } from './analysis/real-time-impact';
import { DependencyInstallImpactAnalyzer } from './analysis/dependency-install-impact';
import { ImpactNotification } from './ui/impact-notification';
import { ErrorHandler } from './errors/error-handler';
import { ActiveFileTracker } from './analysis/active-file-tracker';
import { InlineImpactIndicator } from './ui/inline-impact-indicator';
import { ChangeSuggestionsProvider } from './ui/change-suggestions';

let graphManager: DependencyGraphManager;
let panelProvider: GraphPanelProvider;
let enhancedPanelProvider: EnhancedGraphPanelProvider;
let decorationManager: DecorationManager;
let dependencyTreeProvider: DependencyTreeProvider;
let impactSummaryProvider: ImpactSummaryProvider;
let fileWatcher: FileWatcher;
let changeDetector: ChangeDetector;
let impactAnalyzer: ImpactAnalyzer;
let migrationGenerator: MigrationGenerator;
let impactDashboard: ImpactDashboard;
let impactAggregator: ImpactAggregator;
let gitIntegration: GitIntegration | null = null;
let intelligentRefactor: IntelligentRefactor;
let tutorial: InteractiveTutorial;
let onboardingFlow: OnboardingFlow;
let realTimeImpactAnalyzer: RealTimeImpactAnalyzer;
let dependencyImpactAnalyzer: DependencyInstallImpactAnalyzer;
let impactNotification: ImpactNotification;
let errorHandler: ErrorHandler;
let activeFileTracker: ActiveFileTracker;
let inlineImpactIndicator: InlineImpactIndicator;
let changeSuggestionsProvider: ChangeSuggestionsProvider;
let currentSymbol: any = null;

export async function activate(context: vscode.ExtensionContext) {
    console.log('🌊 Ripple is activating...');

    // Initialize error handler first - always needed
    errorHandler = new ErrorHandler();
    console.log('🌊 Ripple: Error handler created');

    // Initialize core systems
    const workspaceRoot = WorkspaceScanner.getWorkspaceRoot();
    
    if (!workspaceRoot) {
        console.warn('🌊 Ripple: No workspace folder found. Extension will work in limited mode.');
        vscode.window.showWarningMessage(
            'Ripple: No workspace folder found. Some features may be limited. Please open a workspace folder for full functionality.',
            'Open Folder'
        ).then(selection => {
            if (selection === 'Open Folder') {
                vscode.commands.executeCommand('workbench.action.files.openFolder');
            }
        });
        
        // Still register commands even without workspace
        registerCommands(context);
        return;
    }

    try {
        console.log('🌊 Ripple: Initializing components...');
        console.log('🌊 Ripple: Workspace root:', workspaceRoot);
        
        graphManager = new DependencyGraphManager(workspaceRoot);
        console.log('🌊 Ripple: Graph manager created');
        
        panelProvider = new GraphPanelProvider(context.extensionUri);
        enhancedPanelProvider = new EnhancedGraphPanelProvider(context.extensionUri);
        console.log('🌊 Ripple: Panel providers created');
        
        decorationManager = new DecorationManager();
        console.log('🌊 Ripple: Decoration manager created');
        
        dependencyTreeProvider = new DependencyTreeProvider();
        impactSummaryProvider = new ImpactSummaryProvider();
        changeDetector = new ChangeDetector();
        impactAnalyzer = new ImpactAnalyzer();
        migrationGenerator = new MigrationGenerator();
        impactDashboard = new ImpactDashboard();
        impactAggregator = new ImpactAggregator();
        intelligentRefactor = new IntelligentRefactor();
        tutorial = new InteractiveTutorial();
        onboardingFlow = new OnboardingFlow();
        realTimeImpactAnalyzer = new RealTimeImpactAnalyzer(graphManager, impactAnalyzer, changeDetector);
        dependencyImpactAnalyzer = new DependencyInstallImpactAnalyzer(graphManager);
        impactNotification = new ImpactNotification();
        inlineImpactIndicator = new InlineImpactIndicator();
        changeSuggestionsProvider = new ChangeSuggestionsProvider();
        activeFileTracker = new ActiveFileTracker(graphManager, realTimeImpactAnalyzer, impactNotification);
        console.log('🌊 Ripple: All components initialized');

        // Initialize Git integration if enabled
        const config = vscode.workspace.getConfiguration('ripple');
        if (config.get('enableGitIntegration', true)) {
            try {
                gitIntegration = new GitIntegration(workspaceRoot, graphManager);
            } catch (error) {
                console.warn('Git integration not available:', error);
            }
        }

        // Register tree views
        const dependencyTreeView = vscode.window.createTreeView('rippleTree', {
            treeDataProvider: dependencyTreeProvider
        });

        const impactSummaryView = vscode.window.createTreeView('rippleSummary', {
            treeDataProvider: impactSummaryProvider
        });

        // Register commands
        registerCommands(context);

        // File watcher
        fileWatcher = new FileWatcher();
        const fileChangeDisposable = fileWatcher.onFileChange(async (uri) => {
            const config = vscode.workspace.getConfiguration('ripple');
            if (config.get('autoAnalyze', true)) {
                try {
                    await graphManager.updateGraph(uri);
                    if (currentSymbol) {
                        await analyzeSymbol(currentSymbol);
                    }
                } catch (error) {
                    await errorHandler.handleError(error as Error, {
                        component: 'FileWatcher',
                        operation: 'updateGraph',
                        metadata: { file: uri.fsPath }
                    });
                }
            }
        });

        // Text editor selection change
        const selectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection(async (event) => {
            if (event.selections.length > 0) {
                const position = event.selections[0].active;
                await analyzeAtPosition(event.textEditor.document, position);
            }
        });

        // Document save
        const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
            const config = vscode.workspace.getConfiguration('ripple');
            if (config.get('autoAnalyze', true)) {
                try {
                    await graphManager.updateGraph(document.uri);
                    if (currentSymbol) {
                        await analyzeSymbol(currentSymbol);
                    }
                } catch (error) {
                    await errorHandler.handleError(error as Error, {
                        component: 'FileWatcher',
                        operation: 'updateGraph',
                        metadata: { file: document.uri.fsPath }
                    });
                }
            }
        });

        // Start tracking active file
        activeFileTracker.startTracking();

        // Real-time edit analysis with inline indicators
        const editDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
            const config = vscode.workspace.getConfiguration('ripple');
            if (config.get('autoAnalyze', true) && realTimeImpactAnalyzer && event.contentChanges.length > 0) {
                try {
                    const change = event.contentChanges[0];
                    const impact = await realTimeImpactAnalyzer.analyzeEdit(event.document, change);
                    if (impact && impact.affectedFiles.length > 0) {
                        const editor = vscode.window.activeTextEditor;
                        if (editor && editor.document === event.document) {
                            // Show inline impact indicator
                            inlineImpactIndicator.showImpact(editor, impact);
                            // Highlight affected lines in current file
                            inlineImpactIndicator.highlightAffectedLines(editor, impact.affectedFiles);
                            // Show suggestions
                            const suggestions = changeSuggestionsProvider.generateSuggestions(impact);
                            if (suggestions.length > 0) {
                                changeSuggestionsProvider.showSuggestionsPanel(suggestions);
                            }
                        }
                        impactNotification.showEditImpact(impact);
                    }
                } catch (error) {
                    // Silently fail for real-time analysis
                    console.debug('Real-time impact analysis error:', error);
                }
            }
        });

        // Status bar item
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.text = '$(graph) Ripple';
        statusBarItem.command = 'ripple.showImpact';
        statusBarItem.tooltip = 'Ripple - See the impact of every code change';
        statusBarItem.show();

        context.subscriptions.push(
            fileChangeDisposable,
            selectionChangeDisposable,
            saveDisposable,
            editDisposable,
            statusBarItem,
            dependencyTreeView,
            impactSummaryView,
            decorationManager,
            fileWatcher,
            inlineImpactIndicator
        );

        console.log('🌊 Ripple: Commands registered successfully');
        console.log('🌊 Ripple is now active');

        // Initial analysis
        vscode.window.showInformationMessage('🌊 Ripple: Building initial dependency graph...');
        buildInitialGraph().then(() => {
            vscode.window.showInformationMessage('🌊 Ripple: Ready! Press Ctrl+Shift+D to analyze impact.');
            // Offer onboarding on first run
            const hasSeenOnboarding = context.globalState.get('ripple.hasSeenOnboarding', false);
            if (!hasSeenOnboarding) {
                setTimeout(() => {
                    onboardingFlow.start();
                    context.globalState.update('ripple.hasSeenOnboarding', true);
                }, 2000);
            }
        }).catch(error => {
            console.error('Error building initial graph:', error);
            vscode.window.showWarningMessage('Ripple: Some features may not be available until the dependency graph is built.');
        });

    } catch (error) {
        console.error('❌ Failed to activate Ripple extension:', error);
        console.error('Error details:', error instanceof Error ? error.stack : String(error));
        
        // Show error to user
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(
            `Failed to activate Ripple: ${errorMessage}. Check the Output panel for details.`,
            'Show Output'
        ).then(selection => {
            if (selection === 'Show Output') {
                vscode.commands.executeCommand('workbench.action.output.toggleOutput');
            }
        });
        
        if (errorHandler) {
            try {
                await errorHandler.handleError(error as Error, {
                    component: 'Extension',
                    operation: 'activate'
                });
            } catch (handlerError) {
                console.error('Error handler also failed:', handlerError);
            }
        }
    }
}

async function buildInitialGraph(): Promise<void> {
    try {
        const files = await WorkspaceScanner.findSourceFiles();
        for (const file of files) {
            await graphManager.updateGraph(file);
        }
    } catch (error) {
        console.error('Error building initial graph:', error);
    }
}

async function analyzeAtPosition(document: vscode.TextDocument, position: vscode.Position): Promise<void> {
    try {
        const parser = graphManager.getParser();
        if (!parser) {
            return;
        }

        const symbol = parser.getSymbolAtPosition(document.fileName, position.line + 1, position.character + 1);
        if (symbol) {
            currentSymbol = symbol;
            await analyzeSymbol(symbol);
        }
    } catch (error) {
        console.error('Error analyzing at position:', error);
    }
}

function registerCommands(context: vscode.ExtensionContext): void {
    console.log('🌊 Ripple: Registering commands...');
    
    const showImpactCommand = vscode.commands.registerCommand('ripple.showImpact', (impactData?: EditImpact) => {
        try {
            if (enhancedPanelProvider) {
                enhancedPanelProvider.show();
                if (impactData) {
                    // Show impact with specific data
                    showImpactWithData(impactData);
                } else {
                    updateGraphVisualization();
                }
            } else if (panelProvider) {
                panelProvider.show();
                if (impactData) {
                    showImpactWithData(impactData);
                } else {
                    updateGraphVisualization();
                }
            } else {
                vscode.window.showErrorMessage('Ripple: Panel provider not initialized. Please open a workspace folder and reload the window.');
            }
        } catch (error) {
            console.error('Error in showImpact command:', error);
            vscode.window.showErrorMessage(`Error showing impact: ${error}`);
        }
    });

    const showDashboardCommand = vscode.commands.registerCommand('ripple.showDashboard', () => {
        try {
            showImpactDashboard();
        } catch (error) {
            console.error('Error in showDashboard command:', error);
            vscode.window.showErrorMessage(`Error showing dashboard: ${error}`);
        }
    });

    const analyzeCurrentSymbolCommand = vscode.commands.registerCommand('ripple.analyzeCurrentSymbol', async () => {
        try {
            await analyzeCurrentSymbol();
        } catch (error) {
            console.error('Error in analyzeCurrentSymbol command:', error);
            vscode.window.showErrorMessage(`Error analyzing symbol: ${error}`);
        }
    });

    const generateMigrationCommand = vscode.commands.registerCommand('ripple.generateMigration', async () => {
        try {
            await generateMigration();
        } catch (error) {
            console.error('Error in generateMigration command:', error);
            vscode.window.showErrorMessage(`Error generating migration: ${error}`);
        }
    });

    const analyzeBranchCommand = vscode.commands.registerCommand('ripple.analyzeBranch', async () => {
        try {
            await analyzeGitBranch();
        } catch (error) {
            console.error('Error in analyzeBranch command:', error);
            vscode.window.showErrorMessage(`Error analyzing branch: ${error}`);
        }
    });

        const startTutorialCommand = vscode.commands.registerCommand('ripple.startTutorial', () => {
            try {
                if (onboardingFlow) {
                    onboardingFlow.start();
                } else {
                    vscode.window.showInformationMessage('Ripple tutorial will be available after initialization.');
                }
            } catch (error) {
                console.error('Error in startTutorial command:', error);
                vscode.window.showErrorMessage(`Error starting tutorial: ${error}`);
            }
        });

        const analyzeDependencyCommand = vscode.commands.registerCommand('ripple.analyzeDependency', async () => {
            try {
                await analyzeDependency();
            } catch (error) {
                console.error('Error in analyzeDependency command:', error);
                vscode.window.showErrorMessage(`Error analyzing dependency: ${error}`);
            }
        });

        const highlightNodesCommand = vscode.commands.registerCommand('ripple.highlightNodes', (data: { affectedFiles: string[], severity: string }) => {
            if (enhancedPanelProvider) {
                enhancedPanelProvider.highlightAffectedNodes(data.affectedFiles, data.severity);
            }
        });

        const showInlineImpactCommand = vscode.commands.registerCommand('ripple.showInlineImpact', (impact: EditImpact) => {
            const editor = vscode.window.activeTextEditor;
            if (editor && inlineImpactIndicator) {
                inlineImpactIndicator.showImpact(editor, impact);
            }
        });

        const showImpactWithDataCommand = vscode.commands.registerCommand('ripple.showImpactWithData', async () => {
            const currentEdit = activeFileTracker?.getCurrentEdit();
            if (currentEdit) {
                await vscode.commands.executeCommand('ripple.showImpact', currentEdit);
            } else {
                await vscode.commands.executeCommand('ripple.showImpact');
            }
        });
    
    console.log('🌊 Ripple: Commands registered');
    
    context.subscriptions.push(
        showImpactCommand,
        showDashboardCommand,
        analyzeCurrentSymbolCommand,
        generateMigrationCommand,
        analyzeBranchCommand,
        startTutorialCommand,
        analyzeDependencyCommand,
        highlightNodesCommand,
        showInlineImpactCommand,
        showImpactWithDataCommand
    );
}

async function analyzeCurrentSymbol(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const position = editor.selection.active;
    await analyzeAtPosition(editor.document, position);
}

async function showImpactDashboard(): Promise<void> {
    if (!currentSymbol) {
        vscode.window.showWarningMessage('No symbol selected. Please analyze a symbol first.');
        return;
    }

    const dependents = graphManager.getDependents(currentSymbol);
    const topFiles = impactAggregator.getTopImpactedFiles(
        dependents.map(dep => ({
            file: dep.location.file,
            symbol: dep,
            dependentCount: 1,
            severity: 'safe' as const
        }))
    );

    const metrics = {
        totalFilesAffected: new Set(dependents.map(d => d.location.file)).size,
        directDependents: dependents.length,
        transitiveDependents: 0,
        estimatedEffort: 'medium' as 'low' | 'medium' | 'high' | 'critical',
        riskScore: 0,
        breakingChangeCount: 0,
        linesOfCodeImpacted: dependents.length * 2,
        topImpactedFiles: topFiles
    };

    metrics.riskScore = impactDashboard.calculateRiskScore(
        metrics.breakingChangeCount,
        metrics.totalFilesAffected,
        metrics.linesOfCodeImpacted
    );
    metrics.estimatedEffort = impactDashboard.estimateEffort(
        metrics.riskScore,
        metrics.totalFilesAffected
    );

    const summary = impactDashboard.renderQuickSummary(metrics);
    const breakdown = impactDashboard.renderBreakdown(metrics);

    vscode.window.showInformationMessage(
        `🌊 Ripple Impact: ${metrics.totalFilesAffected} files, Risk: ${metrics.riskScore}/100`,
        'View Details'
    ).then(choice => {
        if (choice === 'View Details') {
            panelProvider.show();
        }
    });
}

async function analyzeGitBranch(): Promise<void> {
    if (!gitIntegration) {
        vscode.window.showWarningMessage('Git integration is not available. Make sure Git is installed and the workspace is a Git repository.');
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '🌊 Analyzing Git branch...',
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 0, message: 'Analyzing branch changes...' });
            const report = await gitIntegration!.analyzeCurrentBranch();

            progress.report({ increment: 50, message: 'Generating report...' });
            const comment = await gitIntegration!.generatePRComment();

            progress.report({ increment: 100, message: 'Complete!' });

            const panel = vscode.window.createWebviewPanel(
                'ripple-git-report',
                `Ripple: ${report.branch}`,
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );

            panel.webview.html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            padding: 20px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background: var(--vscode-editor-background);
        }
        pre {
            background: var(--vscode-textBlockQuote-background);
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
        }
        .risk-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
        }
        .risk-low { background: #10B981; color: white; }
        .risk-moderate { background: #F59E0B; color: white; }
        .risk-high { background: #F97316; color: white; }
        .risk-critical { background: #DC2626; color: white; }
    </style>
</head>
<body>
    <h1>🌊 Ripple Branch Analysis</h1>
    <pre>${comment}</pre>
</body>
</html>
            `;
        } catch (error) {
            await errorHandler.handleError(error as Error, {
                component: 'GitIntegration',
                operation: 'analyzeBranch'
            });
        }
    });
}

async function analyzeSymbol(symbol: any): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('ripple');
        const showTransitive = config.get('showTransitive', true);
        const maxDepth = config.get('maxDepth', 5);

        // Get dependents
        const dependents = showTransitive
            ? graphManager.getTransitiveDependents(symbol, maxDepth)
            : graphManager.getDependents(symbol);

        // Get affected locations
        const affectedLocations = dependents.flatMap(dep => {
            const edges = graphManager.getEdgesForSymbol(dep);
            return edges
                .filter(e => graphManager.getSymbolKey(e.to) === graphManager.getSymbolKey(symbol))
                .map(e => e.location);
        });

        // Detect breaking changes
        const oldSymbol = changeDetector.getLastSymbol(symbol);
        const breakingChange = impactAnalyzer.detectBreakingChanges(
            oldSymbol,
            symbol,
            affectedLocations
        );

        // Update UI
        if (breakingChange) {
            dependencyTreeProvider.refresh(dependents, [breakingChange]);
            impactSummaryProvider.updateImpact(breakingChange.estimatedImpact);
            panelProvider.updateImpact(breakingChange);

            // Show decorations
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                decorationManager.decorateBreakingChanges(editor, [breakingChange]);
            }
        } else {
            dependencyTreeProvider.refresh(dependents, []);
            impactSummaryProvider.updateImpact({
                filesAffected: new Set(affectedLocations.map(loc => loc.file)).size,
                callSitesAffected: affectedLocations.length,
                estimatedLOC: affectedLocations.length * 2
            });
        }

        // Update graph visualization
        updateGraphVisualizationForSymbol(symbol, dependents);

    } catch (error) {
        console.error('Error analyzing symbol:', error);
        vscode.window.showErrorMessage(`Error analyzing symbol: ${error}`);
    }
}

function showImpactWithData(impact: EditImpact): void {
    if (!graphManager) return;

    const graph = graphManager.getGraph();
    const affectedFileSet = new Set(impact.affectedFiles.map(f => f.file));
    
    // Get all nodes from affected files
    const allNodes = graph.getAllNodes();
    const affectedNodes = allNodes.filter(node => {
        const nodeFile = node.location?.file || '';
        return affectedFileSet.has(nodeFile);
    });

    // Also include the changed symbol if available
    if (impact.symbol) {
        const symbolKey = graphManager.getSymbolKey(impact.symbol);
        const symbolNode = allNodes.find(n => graphManager.getSymbolKey(n) === symbolKey);
        if (symbolNode && !affectedNodes.includes(symbolNode)) {
            affectedNodes.push(symbolNode);
        }
    }

    // Create focused graph data
    const nodes = affectedNodes.map(node => ({
        id: graphManager.getSymbolKey(node),
        name: node.name,
        kind: node.kind,
        file: node.location.file,
        line: node.location.line,
        column: node.location.column,
        severity: impact.riskScore >= 70 ? 'critical' : 
                 impact.riskScore >= 40 ? 'warning' : 'safe'
    }));

    // Get edges between affected nodes
    const edges: any[] = [];
    affectedNodes.forEach(node => {
        const nodeEdges = graph.getEdgesForSymbol(node);
        nodeEdges.forEach(edge => {
            const fromKey = graphManager.getSymbolKey(edge.from);
            const toKey = graphManager.getSymbolKey(edge.to);
            if (nodes.some(n => n.id === fromKey) && nodes.some(n => n.id === toKey)) {
                edges.push({
                    source: fromKey,
                    target: toKey,
                    type: edge.type,
                    location: edge.location
                });
            }
        });
    });

    // Update graph with impact data
    if (enhancedPanelProvider) {
        enhancedPanelProvider.updateGraph({ nodes, edges });
        enhancedPanelProvider.highlightAffectedNodes(
            impact.affectedFiles.map(f => f.file),
            impact.riskScore >= 70 ? 'critical' : 
            impact.riskScore >= 40 ? 'warning' : 'safe'
        );
    } else if (panelProvider) {
        panelProvider.updateGraph({ nodes, edges });
    }
}

function updateGraphVisualization(): void {
    if (!graphManager) {
        return;
    }

    const graph = graphManager.getGraph();
    const graphData = graph.toJSON();

    // Transform for visualization
    const nodes = graphData.nodes.map((node: any, index: number) => {
        const nodeId = `${node.location.file}:${node.name}:${node.kind}`;
        const dependents = graph.getDependents(node);
        return {
            id: nodeId,
            name: node.name,
            kind: node.kind,
            file: node.location.file,
            line: node.location.line,
            column: node.location.column,
            severity: 'default',
            dependentCount: dependents.length
        };
    });

    const edges = graphData.edges.map((edge: any) => ({
        source: edge.from,
        target: edge.to,
        type: edge.type,
        location: edge.location
    }));

    // Update both panel providers
    if (enhancedPanelProvider) {
        enhancedPanelProvider.updateGraph({ nodes, edges });
    }
    if (panelProvider) {
        panelProvider.updateGraph({ nodes, edges });
    }
}

function updateGraphVisualizationForSymbol(symbol: any, dependents: any[]): void {
    const graph = graphManager.getGraph();
    const symbolKey = graphManager.getSymbolKey(symbol);

    // Create focused graph with symbol and its dependents
    const nodes = [
        {
            id: symbolKey,
            name: symbol.name,
            kind: symbol.kind,
            file: symbol.location.file,
            line: symbol.location.line,
            column: symbol.location.column,
            severity: 'default'
        },
        ...dependents.map(dep => {
            const key = graphManager.getSymbolKey(dep);
            return {
                id: key,
                name: dep.name,
                kind: dep.kind,
                file: dep.location.file,
                line: dep.location.line,
                column: dep.location.column,
                severity: 'warning'
            };
        })
    ];

    const edges = dependents.map(dep => {
        const depKey = graphManager.getSymbolKey(dep);
        const graphEdges = graph.getEdgesForSymbol(dep);
        const relevantEdge = graphEdges.find(
            (e: any) => graphManager.getSymbolKey(e.to) === symbolKey
        );
        return {
            source: depKey,
            target: symbolKey,
            type: relevantEdge?.type || 'calls',
            location: relevantEdge?.location
        };
    });

    panelProvider.updateGraph({ nodes, edges });
}

async function generateMigration(): Promise<void> {
    if (!currentSymbol) {
        vscode.window.showWarningMessage('No symbol selected. Please analyze a symbol first.');
        return;
    }

    try {
        const dependents = graphManager.getDependents(currentSymbol);
        const affectedLocations = dependents.flatMap(dep => {
            const edges = graphManager.getEdgesForSymbol(dep);
            return edges
                .filter((e: any) => graphManager.getSymbolKey(e.to) === graphManager.getSymbolKey(currentSymbol))
                .map((e: any) => e.location);
        });

        const oldSymbol = changeDetector.getLastSymbol(currentSymbol);
        const breakingChange = impactAnalyzer.detectBreakingChanges(
            oldSymbol,
            currentSymbol,
            affectedLocations
        );

        if (!breakingChange) {
            vscode.window.showInformationMessage('No breaking changes detected. Migration not needed.');
            return;
        }

        // Use intelligent refactor for better migration plans
        const migrationPlan = intelligentRefactor.generateMigrationPlan(breakingChange);
        const suggestions = migrationGenerator.generateMigration(breakingChange);
        
        if (suggestions.length === 0) {
            vscode.window.showInformationMessage('No migration suggestions available.');
            return;
        }

        // Show migration options
        const items = suggestions.map((s, i) => ({
            label: `${i + 1}. ${s.type}`,
            description: s.description,
            suggestion: s
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a migration strategy'
        });

        if (selected) {
            await PreviewProvider.showMigrationPreview(selected.suggestion);
            
            // Option to generate documentation
            const generateDoc = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: 'Generate migration documentation?'
            });

            if (generateDoc === 'Yes') {
                await PreviewProvider.showMigrationDocumentation(suggestions);
            }
        }

    } catch (error) {
        console.error('Error generating migration:', error);
        vscode.window.showErrorMessage(`Error generating migration: ${error}`);
    }
}

async function analyzeDependency(): Promise<void> {
    if (!dependencyImpactAnalyzer) {
        vscode.window.showErrorMessage('Dependency analyzer not initialized. Please reload the window.');
        return;
    }

    const packageName = await vscode.window.showInputBox({
        prompt: 'Enter package name to analyze',
        placeHolder: 'e.g., lodash, react, axios'
    });

    if (!packageName) {
        return;
    }

    const action = await vscode.window.showQuickPick(
        ['Install', 'Remove', 'Update'],
        { placeHolder: 'What do you want to do with this package?' }
    );

    if (!action) {
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `🌊 Analyzing ${action.toLowerCase()} impact for ${packageName}...`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 0, message: 'Analyzing dependencies...' });
            
            let impact;
            if (action === 'Install') {
                const version = await vscode.window.showInputBox({
                    prompt: 'Enter version (leave empty for latest)',
                    placeHolder: 'e.g., ^4.17.21 or latest'
                });
                impact = await dependencyImpactAnalyzer.analyzeInstall(
                    packageName,
                    version || 'latest'
                );
            } else if (action === 'Remove') {
                impact = await dependencyImpactAnalyzer.analyzeRemove(packageName);
            } else {
                const version = await vscode.window.showInputBox({
                    prompt: 'Enter new version',
                    placeHolder: 'e.g., ^4.17.21'
                });
                impact = await dependencyImpactAnalyzer.analyzeInstall(
                    packageName,
                    version || 'latest'
                );
            }

            progress.report({ increment: 100, message: 'Complete!' });
            impactNotification.showDependencyImpact(impact);
        } catch (error) {
            if (errorHandler) {
                await errorHandler.handleError(error as Error, {
                    component: 'DependencyAnalyzer',
                    operation: 'analyzeDependency'
                });
            }
        }
    });
}

export function deactivate() {
    if (fileWatcher) {
        fileWatcher.dispose();
    }
    if (decorationManager) {
        decorationManager.dispose();
    }
}

