import * as vscode from 'vscode';
import { EditImpact } from '../analysis/real-time-impact';

export class InlineImpactIndicator {
    private impactDecoration: vscode.TextEditorDecorationType;
    private suggestionDecoration: vscode.TextEditorDecorationType;
    private affectedLineDecoration: vscode.TextEditorDecorationType;
    private severityDecorations: Map<string, vscode.TextEditorDecorationType> = new Map();

    constructor() {
        // Decoration for the line being edited
        this.impactDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editorWarning.foreground'),
            border: '2px solid',
            borderColor: new vscode.ThemeColor('editorWarning.foreground'),
            overviewRulerColor: new vscode.ThemeColor('editorWarning.foreground'),
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            after: {
                contentText: ' ⚠️ Impact: ',
                color: new vscode.ThemeColor('editorWarning.foreground'),
                fontWeight: 'bold',
                margin: '0 0 0 10px'
            }
        });

        // Decoration for suggested changes
        this.suggestionDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editorInfo.foreground'),
            border: '3px solid',
            borderColor: new vscode.ThemeColor('textLink.foreground'),
            overviewRulerColor: new vscode.ThemeColor('textLink.foreground'),
            overviewRulerLane: vscode.OverviewRulerLane.Left
        });

        // Decoration for affected lines (where impact is reflected)
        this.affectedLineDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '3px solid #f59e0b',
            overviewRulerColor: '#f59e0b',
            overviewRulerLane: vscode.OverviewRulerLane.Left,
            after: {
                contentText: ' 🔗 Affected by change',
                color: '#f59e0b',
                fontWeight: 'normal',
                margin: '0 0 0 10px'
            }
        });
    }

    public showImpact(editor: vscode.TextEditor, impact: EditImpact): void {
        // Highlight the changed line
        const changeRange = new vscode.Range(
            impact.location.line - 1,
            0,
            impact.location.line - 1,
            1000
        );

        const severity = impact.riskScore >= 70 ? 'critical' : 
                       impact.riskScore >= 40 ? 'warning' : 'safe';

        const decoration = this.getSeverityDecoration(severity);
        const hoverMessage = this.createHoverMessage(impact);

        editor.setDecorations(decoration, [{
            range: changeRange,
            hoverMessage
        }]);

        // Show suggestions if there are breaking changes
        if (impact.breakingChanges.length > 0) {
            this.showSuggestions(editor, impact);
        }
    }

    public highlightAffectedLines(
        editor: vscode.TextEditor,
        affectedFiles: EditImpact['affectedFiles']
    ): void {
        const ranges: vscode.Range[] = [];

        affectedFiles.forEach(file => {
            if (file.file === editor.document.fileName) {
                ranges.push(new vscode.Range(
                    file.line - 1,
                    0,
                    file.line - 1,
                    1000
                ));
            }
        });

        if (ranges.length > 0) {
            editor.setDecorations(this.affectedLineDecoration, ranges);
        }
    }

    private getSeverityDecoration(severity: string): vscode.TextEditorDecorationType {
        if (severity === 'critical') {
            return vscode.window.createTextEditorDecorationType({
                backgroundColor: 'rgba(220, 38, 38, 0.15)',
                border: '2px solid #dc2626',
                overviewRulerColor: '#dc2626',
                overviewRulerLane: vscode.OverviewRulerLane.Right,
                after: {
                    contentText: ' 🔴 CRITICAL IMPACT',
                    color: '#dc2626',
                    fontWeight: 'bold',
                    margin: '0 0 0 10px'
                }
            });
        } else if (severity === 'warning') {
            return vscode.window.createTextEditorDecorationType({
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                border: '2px solid #f59e0b',
                overviewRulerColor: '#f59e0b',
                overviewRulerLane: vscode.OverviewRulerLane.Right,
                after: {
                    contentText: ' 🟡 WARNING',
                    color: '#f59e0b',
                    fontWeight: 'bold',
                    margin: '0 0 0 10px'
                }
            });
        } else {
            return vscode.window.createTextEditorDecorationType({
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '2px solid #10b981',
                overviewRulerColor: '#10b981',
                overviewRulerLane: vscode.OverviewRulerLane.Right,
                after: {
                    contentText: ' 🟢 SAFE',
                    color: '#10b981',
                    fontWeight: 'bold',
                    margin: '0 0 0 10px'
                }
            });
        }
    }

    private createHoverMessage(impact: EditImpact): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        md.appendMarkdown(`### 🌊 Ripple Impact Analysis\n\n`);
        md.appendMarkdown(`**Change Type:** ${impact.type}\n\n`);
        md.appendMarkdown(`**Risk Score:** ${impact.riskScore}/100\n\n`);
        md.appendMarkdown(`**Files Affected:** ${impact.affectedFiles.length}\n\n`);
        md.appendMarkdown(`**Estimated Effort:** ${impact.estimatedEffort}\n\n`);

        if (impact.affectedFiles.length > 0) {
            md.appendMarkdown(`**Top Affected Files:**\n`);
            impact.affectedFiles.slice(0, 5).forEach(file => {
                md.appendMarkdown(`- \`${file.file.split(/[/\\]/).pop()}\` (line ${file.line})\n`);
            });
        }

        if (impact.breakingChanges.length > 0) {
            md.appendMarkdown(`\n**⚠️ Breaking Changes:** ${impact.breakingChanges.length}\n`);
        }

        md.appendMarkdown(`\n[View Full Impact](command:ripple.showImpactWithData)`);

        return md;
    }

    private showSuggestions(editor: vscode.TextEditor, impact: EditImpact): void {
        // Show suggestions for fixing breaking changes
        const suggestions: vscode.DecorationOptions[] = [];

        impact.breakingChanges.forEach(change => {
            const range = new vscode.Range(
                impact.location.line - 1,
                0,
                impact.location.line - 1,
                1000
            );

            const suggestion = new vscode.MarkdownString();
            suggestion.isTrusted = true;
            suggestion.appendMarkdown(`### 💡 Suggestion\n\n`);
            suggestion.appendMarkdown(`${change.description}\n\n`);
            suggestion.appendMarkdown(`[Generate Migration Code](command:ripple.generateMigration)`);

            suggestions.push({
                range,
                hoverMessage: suggestion
            });
        });

        editor.setDecorations(this.suggestionDecoration, suggestions);
    }

    public clear(editor: vscode.TextEditor): void {
        editor.setDecorations(this.impactDecoration, []);
        editor.setDecorations(this.suggestionDecoration, []);
        editor.setDecorations(this.affectedLineDecoration, []);
    }

    public dispose(): void {
        this.impactDecoration.dispose();
        this.suggestionDecoration.dispose();
        this.affectedLineDecoration.dispose();
        this.severityDecorations.forEach((dec: vscode.TextEditorDecorationType) => dec.dispose());
        this.severityDecorations.clear();
    }
}

