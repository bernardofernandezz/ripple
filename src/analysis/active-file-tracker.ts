import * as vscode from 'vscode';
import { Symbol } from '../parsers/base-parser';
import { DependencyGraphManager } from './dependency-graph';
import { RealTimeImpactAnalyzer, EditImpact } from './real-time-impact';
import { ImpactNotification } from '../ui/impact-notification';

export interface ActiveFileState {
    file: vscode.TextDocument;
    symbols: Symbol[];
    currentEdit: EditImpact | null;
    lastChange: Date;
}

export class ActiveFileTracker {
    private activeFile: ActiveFileState | null = null;
    private changeBuffer: vscode.TextDocumentContentChangeEvent[] = [];
    private debounceTimer: NodeJS.Timeout | null = null;
    private readonly DEBOUNCE_MS = 500;

    constructor(
        private graphManager: DependencyGraphManager,
        private impactAnalyzer: RealTimeImpactAnalyzer,
        private notification: ImpactNotification
    ) {}

    public startTracking(): void {
        // Track active editor changes
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.trackFile(editor.document);
            }
        });

        // Track document changes
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document === this.activeFile?.file) {
                this.handleChange(event);
            }
        });

        // Track current editor on start
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            this.trackFile(activeEditor.document);
        }
    }

    private async trackFile(document: vscode.TextDocument): Promise<void> {
        const parser = await this.graphManager.getParserForFile(document.fileName);
        if (!parser) {
            return;
        }

        try {
            const result = await parser.parse(document.fileName);
            const symbols = result.symbols;
            
            this.activeFile = {
                file: document,
                symbols,
                currentEdit: null,
                lastChange: new Date()
            };

            // Notify that we're tracking this file
            this.showTrackingIndicator(document);
        } catch (error) {
            console.error('Error tracking file:', error);
        }
    }

    private handleChange(event: vscode.TextDocumentChangeEvent): void {
        if (!this.activeFile || event.contentChanges.length === 0) {
            return;
        }

        // Buffer changes for debouncing
        this.changeBuffer.push(...event.contentChanges);
        this.activeFile.lastChange = new Date();

        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Debounce analysis
        this.debounceTimer = setTimeout(() => {
            this.analyzeChanges();
        }, this.DEBOUNCE_MS);
    }

    private async analyzeChanges(): Promise<void> {
        if (!this.activeFile || this.changeBuffer.length === 0) {
            return;
        }

        const changes = [...this.changeBuffer];
        this.changeBuffer = [];

        try {
            // Analyze each significant change
            for (const change of changes) {
                if (change.text.length === 0 && change.rangeLength > 0) {
                    // Deletion
                    const impact = await this.impactAnalyzer.analyzeDelete(
                        this.activeFile.file,
                        change.range
                    );
                    if (impact) {
                        this.activeFile.currentEdit = impact;
                        this.showImpact(impact);
                    }
                } else if (change.rangeLength > 0 || change.text.length > 0) {
                    // Modification or addition
                    const impact = await this.impactAnalyzer.analyzeEdit(
                        this.activeFile.file,
                        change
                    );
                    if (impact && impact.affectedFiles.length > 0) {
                        this.activeFile.currentEdit = impact;
                        this.showImpact(impact);
                    }
                }
            }
        } catch (error) {
            console.error('Error analyzing changes:', error);
        }
    }

    private showImpact(impact: EditImpact): void {
        // Show notification
        this.notification.showEditImpact(impact);

        // Update graph to highlight affected nodes
        this.highlightAffectedNodes(impact);

        // Show inline decorations
        this.showInlineImpact(impact);
    }

    private highlightAffectedNodes(impact: EditImpact): void {
        // Send message to graph to highlight affected nodes
        vscode.commands.executeCommand('ripple.highlightNodes', {
            affectedFiles: impact.affectedFiles.map(f => f.file),
            severity: impact.riskScore >= 70 ? 'critical' : 
                     impact.riskScore >= 40 ? 'warning' : 'safe'
        });
    }

    private showInlineImpact(impact: EditImpact): void {
        // This will be handled by the decoration manager
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === this.activeFile?.file) {
            vscode.commands.executeCommand('ripple.showInlineImpact', impact);
        }
    }

    private showTrackingIndicator(document: vscode.TextDocument): void {
        // Show a subtle indicator that we're tracking this file
        const fileName = document.fileName.split(/[/\\]/).pop() || 'Unknown';
        vscode.window.setStatusBarMessage(
            `🌊 Ripple: Tracking ${fileName}`,
            2000
        );
    }

    public getCurrentEdit(): EditImpact | null {
        return this.activeFile?.currentEdit || null;
    }

    public getActiveFile(): vscode.TextDocument | null {
        return this.activeFile?.file || null;
    }
}

