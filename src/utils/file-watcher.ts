import * as vscode from 'vscode';
import * as path from 'path';

export class FileWatcher {
    private watcher: vscode.FileSystemWatcher;
    private callbacks: Map<string, Set<(uri: vscode.Uri) => void>> = new Map();

    constructor(pattern: string = '**/*.{ts,tsx,js,jsx,py}') {
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.setupWatchers();
    }

    private setupWatchers(): void {
        this.watcher.onDidChange((uri) => {
            this.notifyCallbacks('change', uri);
        });

        this.watcher.onDidCreate((uri) => {
            this.notifyCallbacks('create', uri);
        });

        this.watcher.onDidDelete((uri) => {
            this.notifyCallbacks('delete', uri);
        });
    }

    public onFileChange(callback: (uri: vscode.Uri) => void, filePattern?: string): vscode.Disposable {
        const key = filePattern || 'all';
        if (!this.callbacks.has(key)) {
            this.callbacks.set(key, new Set());
        }
        this.callbacks.get(key)!.add(callback);

        return new vscode.Disposable(() => {
            const callbacks = this.callbacks.get(key);
            if (callbacks) {
                callbacks.delete(callback);
            }
        });
    }

    private notifyCallbacks(event: 'change' | 'create' | 'delete', uri: vscode.Uri): void {
        // Notify all callbacks
        const allCallbacks = this.callbacks.get('all');
        if (allCallbacks) {
            allCallbacks.forEach(cb => cb(uri));
        }

        // Notify pattern-specific callbacks
        const ext = path.extname(uri.fsPath);
        const extCallbacks = this.callbacks.get(ext);
        if (extCallbacks) {
            extCallbacks.forEach(cb => cb(uri));
        }

        // Notify file-specific callbacks
        const fileCallbacks = this.callbacks.get(uri.fsPath);
        if (fileCallbacks) {
            fileCallbacks.forEach(cb => cb(uri));
        }
    }

    public dispose(): void {
        this.watcher.dispose();
        this.callbacks.clear();
    }
}

