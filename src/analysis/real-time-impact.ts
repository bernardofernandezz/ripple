import * as vscode from 'vscode';
import { Symbol, Dependency } from '../parsers/parser-interface';
import { DependencyGraphManager } from './dependency-graph';
import { ImpactAnalyzer, BreakingChange } from './impact-analyzer';
import { ChangeDetector, CodeChange } from './change-detector';

export interface EditImpact {
    type: 'delete' | 'modify' | 'add' | 'rename';
    location: {
        file: string;
        line: number;
        column: number;
    };
    symbol?: Symbol;
    affectedFiles: Array<{
        file: string;
        line: number;
        reason: string;
        severity: 'critical' | 'warning' | 'safe';
    }>;
    breakingChanges: BreakingChange[];
    riskScore: number;
    estimatedEffort: 'low' | 'medium' | 'high' | 'critical';
}

export class RealTimeImpactAnalyzer {
    constructor(
        private graphManager: DependencyGraphManager,
        private impactAnalyzer: ImpactAnalyzer,
        private changeDetector: ChangeDetector
    ) {}

    public async analyzeEdit(
        document: vscode.TextDocument,
        change: vscode.TextDocumentContentChangeEvent
    ): Promise<EditImpact | null> {
        try {
            const parser = this.graphManager.getParser();
            if (!parser) {
                return null;
            }

            // Get symbol at the changed location
            const position = new vscode.Position(
                change.range.start.line,
                change.range.start.character
            );
            const symbol = parser.getSymbolAtPosition(
                document.fileName,
                position.line + 1,
                position.character + 1
            );

            if (!symbol) {
                return null;
            }

            // Detect what type of change
            const changeType = this.detectChangeType(change);
            
            // Get dependents
            const dependents = this.graphManager.getDependents(symbol);
            const edges = this.graphManager.getEdgesForSymbol(symbol);

            // Analyze impact
            const affectedFiles = edges.map(edge => {
                const dependentSymbol = edge.from;
                const severity = this.calculateSeverity(changeType, symbol, dependentSymbol);
                
                return {
                    file: dependentSymbol.location.file,
                    line: edge.location.line,
                    reason: this.getReason(changeType, symbol, dependentSymbol),
                    severity
                };
            });

            // Detect breaking changes
            const oldSymbol = this.changeDetector.getLastSymbol(symbol);
            const breakingChanges: BreakingChange[] = [];
            
            if (oldSymbol) {
                const breakingChange = this.impactAnalyzer.detectBreakingChanges(
                    oldSymbol,
                    symbol,
                    affectedFiles.map(f => ({ file: f.file, line: f.line, column: 0 }))
                );
                if (breakingChange) {
                    breakingChanges.push(breakingChange);
                }
            }

            // Calculate risk score
            const riskScore = this.calculateRiskScore(changeType, affectedFiles, breakingChanges);
            const estimatedEffort = this.estimateEffort(riskScore, affectedFiles.length);

            return {
                type: changeType,
                location: {
                    file: document.fileName,
                    line: position.line + 1,
                    column: position.character + 1
                },
                symbol,
                affectedFiles,
                breakingChanges,
                riskScore,
                estimatedEffort
            };
        } catch (error) {
            console.error('Error analyzing edit impact:', error);
            return null;
        }
    }

    public async analyzeDelete(
        document: vscode.TextDocument,
        range: vscode.Range
    ): Promise<EditImpact | null> {
        try {
            const parser = this.graphManager.getParser();
            if (!parser) {
                return null;
            }

            // Get symbol at deleted location
            const symbol = parser.getSymbolAtPosition(
                document.fileName,
                range.start.line + 1,
                range.start.character + 1
            );

            if (!symbol) {
                return null;
            }

            // Get all dependents
            const dependents = this.graphManager.getDependents(symbol);
            const edges = this.graphManager.getEdgesForSymbol(symbol);

            const affectedFiles = edges.map(edge => ({
                file: edge.from.location.file,
                line: edge.location.line,
                reason: `Uses deleted ${symbol.kind} "${symbol.name}"`,
                severity: 'critical' as const
            }));

            const riskScore = this.calculateRiskScore('delete', affectedFiles, []);
            const estimatedEffort = this.estimateEffort(riskScore, affectedFiles.length);

            return {
                type: 'delete',
                location: {
                    file: document.fileName,
                    line: range.start.line + 1,
                    column: range.start.character + 1
                },
                symbol,
                affectedFiles,
                breakingChanges: [],
                riskScore,
                estimatedEffort
            };
        } catch (error) {
            console.error('Error analyzing delete impact:', error);
            return null;
        }
    }

    private detectChangeType(change: vscode.TextDocumentContentChangeEvent): EditImpact['type'] {
        const textBefore = change.rangeLength > 0;
        const textAfter = change.text.length > 0;

        if (!textBefore && textAfter) return 'add';
        if (textBefore && !textAfter) return 'delete';
        if (textBefore && textAfter) return 'modify';
        return 'modify';
    }

    private calculateSeverity(
        changeType: EditImpact['type'],
        symbol: Symbol,
        dependent: Symbol
    ): 'critical' | 'warning' | 'safe' {
        if (changeType === 'delete') return 'critical';
        if (changeType === 'modify' && symbol.kind === 'function') return 'warning';
        return 'safe';
    }

    private getReason(
        changeType: EditImpact['type'],
        symbol: Symbol,
        dependent: Symbol
    ): string {
        switch (changeType) {
            case 'delete':
                return `Calls deleted ${symbol.kind} "${symbol.name}"`;
            case 'modify':
                return `Uses modified ${symbol.kind} "${symbol.name}"`;
            case 'add':
                return `May need to use new ${symbol.kind} "${symbol.name}"`;
            default:
                return `Depends on ${symbol.name}`;
        }
    }

    private calculateRiskScore(
        changeType: EditImpact['type'],
        affectedFiles: EditImpact['affectedFiles'],
        breakingChanges: BreakingChange[]
    ): number {
        let score = 0;

        // Change type weight
        if (changeType === 'delete') score += 50;
        else if (changeType === 'modify') score += 30;
        else score += 10;

        // Affected files
        score += Math.min(affectedFiles.length * 5, 30);

        // Breaking changes
        score += breakingChanges.length * 10;

        // Critical severity files
        const criticalCount = affectedFiles.filter(f => f.severity === 'critical').length;
        score += criticalCount * 5;

        return Math.min(score, 100);
    }

    private estimateEffort(
        riskScore: number,
        affectedFilesCount: number
    ): EditImpact['estimatedEffort'] {
        if (riskScore >= 85 || affectedFilesCount > 50) return 'critical';
        if (riskScore >= 60 || affectedFilesCount > 20) return 'high';
        if (riskScore >= 30 || affectedFilesCount > 10) return 'medium';
        return 'low';
    }
}

