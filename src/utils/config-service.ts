import * as vscode from 'vscode';

export class ConfigService {
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.config = vscode.workspace.getConfiguration('ripple');
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('ripple')) {
                this.config = vscode.workspace.getConfiguration('ripple');
            }
        });
    }

    public isLanguageEnabled(language: string): boolean {
        return this.config.get<boolean>(`languages.${language}.enabled`, true);
    }

    public getPythonPath(): string {
        return this.config.get<string>('languages.python.pythonPath', 'python3');
    }

    public getMaxFileSize(): number {
        return this.config.get<number>('performance.maxFileSize', 1024 * 1024);
    }

    public getWorkerPoolSize(): number {
        return this.config.get<number>('performance.workerPoolSize', 4);
    }

    public getCacheMaxEntries(): number {
        return this.config.get<number>('cache.maxMemoryEntries', 1000);
    }

    public getCacheTTL(): number {
        const minutes = this.config.get<number>('cache.ttlMinutes', 5);
        return minutes * 60 * 1000;
    }

    public isWorkerPoolEnabled(): boolean {
        return this.config.get<boolean>('experimental.enableWorkerPool', true);
    }
}

export const configService = new ConfigService();
