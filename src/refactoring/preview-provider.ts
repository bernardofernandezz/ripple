import * as vscode from 'vscode';
import { MigrationSuggestion } from './migration-generator';

export class PreviewProvider {
    public static async showMigrationPreview(suggestion: MigrationSuggestion): Promise<void> {
        const doc = await vscode.workspace.openTextDocument({
            content: suggestion.code,
            language: 'typescript'
        });

        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    }

    public static async showDiffPreview(
        originalFile: string,
        modifiedContent: string
    ): Promise<void> {
        // Create a diff view
        const originalDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(originalFile));
        const modifiedDoc = await vscode.workspace.openTextDocument({
            content: modifiedContent,
            language: originalDoc.languageId
        });

        await vscode.commands.executeCommand(
            'vscode.diff',
            originalDoc.uri,
            modifiedDoc.uri,
            'Migration Preview'
        );
    }

    public static async showMigrationDocumentation(
        suggestions: MigrationSuggestion[]
    ): Promise<void> {
        const markdown = this.generateMigrationMarkdown(suggestions);
        const doc = await vscode.workspace.openTextDocument({
            content: markdown,
            language: 'markdown'
        });

        await vscode.window.showTextDocument(doc);
    }

    private static generateMigrationMarkdown(suggestions: MigrationSuggestion[]): string {
        let markdown = '# Migration Guide\n\n';
        markdown += `Generated on: ${new Date().toLocaleString()}\n\n`;
        markdown += `## Summary\n\n`;
        markdown += `Total migration suggestions: ${suggestions.length}\n\n`;

        suggestions.forEach((suggestion, index) => {
            markdown += `## Suggestion ${index + 1}: ${suggestion.type}\n\n`;
            markdown += `${suggestion.description}\n\n`;

            if (suggestion.affectedFiles.length > 0) {
                markdown += `### Affected Files\n\n`;
                suggestion.affectedFiles.forEach(file => {
                    markdown += `- ${file}\n`;
                });
                markdown += `\n`;
            }

            markdown += `### Code\n\n`;
            markdown += `\`\`\`typescript\n${suggestion.code}\n\`\`\`\n\n`;
            markdown += `---\n\n`;
        });

        return markdown;
    }
}

