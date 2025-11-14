import * as vscode from 'vscode';
import * as path from 'path';

export class WorkspaceScanner {
    public static async findSourceFiles(
        includePattern: string = '**/*.{ts,tsx,js,jsx}',
        excludePattern: string = '**/node_modules/**'
    ): Promise<vscode.Uri[]> {
        try {
            const files = await vscode.workspace.findFiles(includePattern, excludePattern);
            return files;
        } catch (error) {
            console.error('Error scanning workspace:', error);
            return [];
        }
    }

    public static async findFilesByExtension(extensions: string[]): Promise<vscode.Uri[]> {
        const patterns = extensions.map(ext => `**/*${ext}`);
        const allFiles: vscode.Uri[] = [];

        for (const pattern of patterns) {
            const files = await this.findSourceFiles(pattern);
            allFiles.push(...files);
        }

        return allFiles;
    }

    public static getWorkspaceRoot(): string | null {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return null;
        }
        return folders[0].uri.fsPath;
    }

    public static isInWorkspace(filePath: string): boolean {
        const root = this.getWorkspaceRoot();
        if (!root) {
            return false;
        }
        return filePath.startsWith(root);
    }

    public static getRelativePath(filePath: string): string {
        const root = this.getWorkspaceRoot();
        if (!root) {
            return filePath;
        }
        return path.relative(root, filePath);
    }
}

