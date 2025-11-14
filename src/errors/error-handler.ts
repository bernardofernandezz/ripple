import * as vscode from 'vscode';

export class CriticalError extends Error {
    constructor(message: string, public context: ErrorContext) {
        super(message);
        this.name = 'CriticalError';
    }
}

export class ParsingError extends Error {
    constructor(message: string, public filename: string) {
        super(message);
        this.name = 'ParsingError';
    }
}

export class GraphBuildError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GraphBuildError';
    }
}

export interface ErrorContext {
    component: string;
    operation: string;
    metadata?: Record<string, any>;
}

export interface ErrorLogEntry {
    timestamp: number;
    error: Error;
    context: ErrorContext;
    user?: string;
}

export class ErrorHandler {
    private errorLog: ErrorLogEntry[] = [];
    private maxLogSize = 100;

    public async handleError(error: Error, context: ErrorContext): Promise<void> {
        this.logError(error, context);

        const userMessage = this.getUserFriendlyMessage(error);
        const action = this.suggestAction(error);

        if (error instanceof CriticalError) {
            vscode.window.showErrorMessage(userMessage, action).then(selected => {
                if (selected === action) {
                    this.performRecoveryAction(error, context);
                }
            });
        } else {
            vscode.window.showWarningMessage(userMessage, action).then(selected => {
                if (selected === action) {
                    this.performRecoveryAction(error, context);
                }
            });
        }

        await this.attemptRecovery(error, context);
    }

    private logError(error: Error, context: ErrorContext): void {
        const entry: ErrorLogEntry = {
            timestamp: Date.now(),
            error,
            context
        };

        this.errorLog.push(entry);

        // Keep log size manageable
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        // Log to console for debugging
        console.error(`[Ripple Error] ${error.name}: ${error.message}`, {
            context,
            stack: error.stack
        });
    }

    private getUserFriendlyMessage(error: Error): string {
        if (error instanceof ParsingError) {
            return `Failed to parse ${error.filename}. The file may contain syntax errors.`;
        }
        if (error instanceof GraphBuildError) {
            return `Unable to build dependency graph. Check for circular dependencies or syntax errors.`;
        }
        if (error instanceof CriticalError) {
            return `A critical error occurred: ${error.message}`;
        }
        return `An unexpected error occurred: ${error.message}`;
    }

    private suggestAction(error: Error): string {
        if (error instanceof ParsingError) {
            return 'Check File';
        }
        if (error instanceof GraphBuildError) {
            return 'Rebuild Graph';
        }
        return 'Retry';
    }

    private async attemptRecovery(error: Error, context: ErrorContext): Promise<void> {
        // Attempt automatic recovery based on error type
        if (error instanceof ParsingError) {
            // Skip this file and continue
            return;
        }

        if (error instanceof GraphBuildError) {
            // Try rebuilding with limited scope
            return;
        }
    }

    private async performRecoveryAction(error: Error, context: ErrorContext): Promise<void> {
        if (error instanceof ParsingError) {
            // Open the problematic file
            const doc = await vscode.workspace.openTextDocument(error.filename);
            await vscode.window.showTextDocument(doc);
        } else if (error instanceof GraphBuildError) {
            // Trigger graph rebuild
            await vscode.commands.executeCommand('ripple.showImpact');
        }
    }

    public getErrorLog(): ErrorLogEntry[] {
        return [...this.errorLog];
    }

    public clearErrorLog(): void {
        this.errorLog = [];
    }
}

