import * as vscode from 'vscode';
import { EditImpact } from '../analysis/real-time-impact';
import { BreakingChange } from '../analysis/impact-analyzer';

export interface ChangeSuggestion {
    title: string;
    description: string;
    codeAction: vscode.CodeAction;
    severity: 'critical' | 'warning' | 'safe';
    affectedLocations: vscode.Location[];
}

export class ChangeSuggestionsProvider {
    public generateSuggestions(impact: EditImpact): ChangeSuggestion[] {
        const suggestions: ChangeSuggestion[] = [];

        // Suggest deprecation wrapper for deletions
        if (impact.type === 'delete' && impact.symbol) {
            suggestions.push({
                title: 'Create deprecation wrapper',
                description: `Create a wrapper function to maintain backward compatibility for "${impact.symbol.name}"`,
                codeAction: this.createDeprecationWrapperAction(impact),
                severity: 'critical',
                affectedLocations: impact.affectedFiles.map(f => 
                    new vscode.Location(
                        vscode.Uri.file(f.file),
                        new vscode.Position(f.line - 1, 0)
                    )
                )
            });
        }

        // Suggest parameter updates for modifications
        if (impact.type === 'modify' && impact.breakingChanges.length > 0) {
            impact.breakingChanges.forEach(change => {
                if (change.changeType === 'parameter') {
                    suggestions.push({
                        title: 'Update function parameters',
                        description: change.description,
                        codeAction: this.createParameterUpdateAction(impact, change),
                        severity: change.severity,
                        affectedLocations: change.affectedLocations.map(loc =>
                            new vscode.Location(
                                vscode.Uri.file(loc.file),
                                new vscode.Position(loc.line - 1, loc.column - 1)
                            )
                        )
                    });
                }
            });
        }

        // Suggest migration for high-risk changes
        if (impact.riskScore >= 70) {
            suggestions.push({
                title: 'Generate migration plan',
                description: 'High-risk change detected. Generate a step-by-step migration plan.',
                codeAction: this.createMigrationAction(impact),
                severity: 'critical',
                affectedLocations: []
            });
        }

        return suggestions;
    }

    private createDeprecationWrapperAction(impact: EditImpact): vscode.CodeAction {
        const action = new vscode.CodeAction(
            'Create deprecation wrapper',
            vscode.CodeActionKind.QuickFix
        );
        action.command = {
            command: 'ripple.generateMigration',
            title: 'Generate deprecation wrapper'
        };
        action.diagnostics = [];
        return action;
    }

    private createParameterUpdateAction(
        impact: EditImpact,
        change: BreakingChange
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            'Update parameters',
            vscode.CodeActionKind.QuickFix
        );
        action.command = {
            command: 'ripple.generateMigration',
            title: 'Update function parameters'
        };
        return action;
    }

    private createMigrationAction(impact: EditImpact): vscode.CodeAction {
        const action = new vscode.CodeAction(
            'Generate migration plan',
            vscode.CodeActionKind.Refactor
        );
        action.command = {
            command: 'ripple.generateMigration',
            title: 'Generate migration plan'
        };
        return action;
    }

    public showSuggestionsPanel(suggestions: ChangeSuggestion[]): void {
        if (suggestions.length === 0) {
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'ripple-suggestions',
            'Ripple - Change Suggestions',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = this.getSuggestionsHTML(suggestions);

        panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'applySuggestion') {
                vscode.commands.executeCommand(message.action);
            } else if (message.command === 'navigate') {
                vscode.workspace.openTextDocument(message.file).then(doc => {
                    vscode.window.showTextDocument(doc).then(editor => {
                        const position = new vscode.Position(message.line - 1, 0);
                        editor.selection = new vscode.Selection(position, position);
                        editor.revealRange(new vscode.Range(position, position));
                    });
                });
            }
        });
    }

    private getSuggestionsHTML(suggestions: ChangeSuggestion[]): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 24px;
        }
        .suggestion {
            background: var(--vscode-list-hoverBackground);
            border-left: 4px solid;
            padding: 16px;
            margin: 12px 0;
            border-radius: 4px;
        }
        .suggestion.critical { border-color: #dc2626; }
        .suggestion.warning { border-color: #f59e0b; }
        .suggestion.info { border-color: #3b82f6; }
        .suggestion h3 {
            margin: 0 0 8px 0;
            color: var(--vscode-textLink-foreground);
        }
        .suggestion p {
            margin: 8px 0;
            color: var(--vscode-descriptionForeground);
        }
        .action-button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 8px;
        }
        .action-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .location-list {
            margin-top: 12px;
            font-size: 12px;
        }
        .location-item {
            padding: 4px 8px;
            margin: 4px 0;
            background: var(--vscode-editor-background);
            border-radius: 3px;
            cursor: pointer;
        }
        .location-item:hover {
            background: var(--vscode-list-hoverBackground);
        }
    </style>
</head>
<body>
    <h1>💡 Change Suggestions</h1>
    ${suggestions.map((s, i) => `
        <div class="suggestion ${s.severity}">
            <h3>${s.title}</h3>
            <p>${s.description}</p>
            ${s.affectedLocations.length > 0 ? `
                <div class="location-list">
                    <strong>Affected locations (${s.affectedLocations.length}):</strong>
                    ${s.affectedLocations.slice(0, 5).map(loc => `
                        <div class="location-item" onclick="navigate('${loc.uri.fsPath}', ${loc.range.start.line + 1})">
                            ${loc.uri.fsPath.split(/[/\\\\]/).pop()}:${loc.range.start.line + 1}
                        </div>
                    `).join('')}
                    ${s.affectedLocations.length > 5 ? `<div>... and ${s.affectedLocations.length - 5} more</div>` : ''}
                </div>
            ` : ''}
            <button class="action-button" onclick="applySuggestion('${s.codeAction.command?.command || ''}')">
                Apply Suggestion
            </button>
        </div>
    `).join('')}
    <script>
        const vscode = acquireVsCodeApi();
        function applySuggestion(action) {
            vscode.postMessage({ command: 'applySuggestion', action });
        }
        function navigate(file, line) {
            vscode.postMessage({ command: 'navigate', file, line });
        }
    </script>
</body>
</html>`;
    }
}

