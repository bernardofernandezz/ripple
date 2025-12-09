import * as vscode from 'vscode';
import { Symbol } from '../parsers/base-parser';
import { BreakingChange } from '../analysis/impact-analyzer';

export class DecorationManager {
    private criticalDecoration: vscode.TextEditorDecorationType;
    private warningDecoration: vscode.TextEditorDecorationType;
    private safeDecoration: vscode.TextEditorDecorationType;
    private affectedDecoration: vscode.TextEditorDecorationType;

    constructor() {
        this.criticalDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('errorForeground'),
            overviewRulerColor: new vscode.ThemeColor('errorForeground'),
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            gutterIconPath: vscode.Uri.parse('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjciIHN0cm9rZT0iI2Y0NDMzNiIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik04IDVWMTEiIHN0cm9rZT0iI2Y0NDMzNiIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Ik01IDhIMTEiIHN0cm9rZT0iI2Y0NDMzNiIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjwvc3ZnPgo='),
            gutterIconSize: 'contain'
        });

        this.warningDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editorWarning.foreground'),
            overviewRulerColor: new vscode.ThemeColor('editorWarning.foreground'),
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            gutterIconPath: vscode.Uri.parse('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMkwxIDE0SDE1TDggMloiIGZpbGw9IiNmZjkwMDAiLz4KPHBhdGggZD0iTTggNlYxMCIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTggMTJIMTgiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjwvc3ZnPgo='),
            gutterIconSize: 'contain'
        });

        this.safeDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editorInfo.foreground'),
            overviewRulerColor: new vscode.ThemeColor('editorInfo.foreground'),
            overviewRulerLane: vscode.OverviewRulerLane.Right
        });

        this.affectedDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('textBlockQuote.background'),
            border: `3px solid ${new vscode.ThemeColor('textLink.foreground')}`,
            overviewRulerColor: new vscode.ThemeColor('textLink.foreground'),
            overviewRulerLane: vscode.OverviewRulerLane.Left
        });
    }

    public decorateBreakingChanges(editor: vscode.TextEditor, changes: BreakingChange[]): void {
        const criticalRanges: vscode.Range[] = [];
        const warningRanges: vscode.Range[] = [];
        const safeRanges: vscode.Range[] = [];

        changes.forEach(change => {
            const ranges = change.affectedLocations
                .filter(loc => loc.file === editor.document.fileName)
                .map(loc => new vscode.Range(
                    loc.line - 1,
                    loc.column - 1,
                    loc.line - 1,
                    loc.column + 10
                ));

            switch (change.severity) {
                case 'critical':
                    criticalRanges.push(...ranges);
                    break;
                case 'warning':
                    warningRanges.push(...ranges);
                    break;
                case 'safe':
                    safeRanges.push(...ranges);
                    break;
            }
        });

        editor.setDecorations(this.criticalDecoration, criticalRanges);
        editor.setDecorations(this.warningDecoration, warningRanges);
        editor.setDecorations(this.safeDecoration, safeRanges);
    }

    public decorateAffectedLocations(editor: vscode.TextEditor, locations: { file: string; line: number; column: number }[]): void {
        const ranges = locations
            .filter(loc => loc.file === editor.document.fileName)
            .map(loc => new vscode.Range(
                loc.line - 1,
                loc.column - 1,
                loc.line - 1,
                loc.column + 10
            ));

        editor.setDecorations(this.affectedDecoration, ranges);
    }

    public clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(this.criticalDecoration, []);
        editor.setDecorations(this.warningDecoration, []);
        editor.setDecorations(this.safeDecoration, []);
        editor.setDecorations(this.affectedDecoration, []);
    }

    public dispose(): void {
        this.criticalDecoration.dispose();
        this.warningDecoration.dispose();
        this.safeDecoration.dispose();
        this.affectedDecoration.dispose();
    }
}

