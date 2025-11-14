import { Symbol } from '../parsers/parser-interface';

export interface CodeChange {
    symbol: Symbol;
    oldSymbol?: Symbol;
    changeType: 'added' | 'modified' | 'removed' | 'signature' | 'visibility' | 'type';
    timestamp: number;
}

export class ChangeDetector {
    private symbolHistory: Map<string, Symbol[]> = new Map();
    private changes: CodeChange[] = [];

    public recordSymbol(symbol: Symbol): void {
        const key = this.getSymbolKey(symbol);
        const history = this.symbolHistory.get(key) || [];
        
        // Check if symbol has changed
        const lastSymbol = history[history.length - 1];
        if (lastSymbol && this.hasChanged(lastSymbol, symbol)) {
            this.changes.push({
                symbol,
                oldSymbol: lastSymbol,
                changeType: this.detectChangeType(lastSymbol, symbol),
                timestamp: Date.now()
            });
        }

        history.push(symbol);
        this.symbolHistory.set(key, history);
    }

    public getChanges(): CodeChange[] {
        return [...this.changes];
    }

    public getChangesForSymbol(symbol: Symbol): CodeChange[] {
        const key = this.getSymbolKey(symbol);
        return this.changes.filter(c => this.getSymbolKey(c.symbol) === key);
    }

    public clearChanges(): void {
        this.changes = [];
    }

    public getLastSymbol(symbol: Symbol): Symbol | undefined {
        const key = this.getSymbolKey(symbol);
        const history = this.symbolHistory.get(key);
        if (!history || history.length < 2) {
            return undefined;
        }
        return history[history.length - 2];
    }

    private hasChanged(oldSymbol: Symbol, newSymbol: Symbol): boolean {
        // Compare signatures
        if (oldSymbol.signature !== newSymbol.signature) {
            return true;
        }

        // Compare parameters
        if (JSON.stringify(oldSymbol.parameters) !== JSON.stringify(newSymbol.parameters)) {
            return true;
        }

        // Compare return types
        if (oldSymbol.returnType !== newSymbol.returnType) {
            return true;
        }

        return false;
    }

    private detectChangeType(oldSymbol: Symbol, newSymbol: Symbol): CodeChange['changeType'] {
        if (!oldSymbol.signature && newSymbol.signature) {
            return 'added';
        }

        if (oldSymbol.signature && !newSymbol.signature) {
            return 'removed';
        }

        if (oldSymbol.signature !== newSymbol.signature) {
            return 'signature';
        }

        if (oldSymbol.returnType !== newSymbol.returnType) {
            return 'type';
        }

        return 'modified';
    }

    private getSymbolKey(symbol: Symbol): string {
        return `${symbol.location.file}:${symbol.name}:${symbol.kind}`;
    }
}

