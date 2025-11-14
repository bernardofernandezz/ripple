import { Symbol, Dependency } from '../parsers/parser-interface';
import { TypeScriptParser } from '../parsers/typescript-parser';
import * as vscode from 'vscode';

export class DependencyGraph {
    private nodes: Map<string, Symbol> = new Map();
    private edges: Dependency[] = [];
    private nodeEdges: Map<string, Dependency[]> = new Map();

    public addNode(symbol: Symbol): void {
        const key = this.getSymbolKey(symbol);
        if (!this.nodes.has(key)) {
            this.nodes.set(key, symbol);
            this.nodeEdges.set(key, []);
        }
    }

    public addEdge(dependency: Dependency): void {
        const fromKey = this.getSymbolKey(dependency.from);
        const toKey = this.getSymbolKey(dependency.to);

        // Add nodes if they don't exist
        this.addNode(dependency.from);
        this.addNode(dependency.to);

        // Check if edge already exists
        const existingEdge = this.edges.find(
            e => this.getSymbolKey(e.from) === fromKey && 
                 this.getSymbolKey(e.to) === toKey &&
                 e.type === dependency.type
        );

        if (!existingEdge) {
            this.edges.push(dependency);
            const edges = this.nodeEdges.get(fromKey) || [];
            edges.push(dependency);
            this.nodeEdges.set(fromKey, edges);
        }
    }

    public removeNode(symbol: Symbol): void {
        const key = this.getSymbolKey(symbol);
        this.nodes.delete(key);
        this.edges = this.edges.filter(
            e => this.getSymbolKey(e.from) !== key && this.getSymbolKey(e.to) !== key
        );
        this.nodeEdges.delete(key);
    }

    public getDependents(symbol: Symbol): Symbol[] {
        const key = this.getSymbolKey(symbol);
        const dependents = new Set<string>();

        this.edges
            .filter(edge => this.getSymbolKey(edge.to) === key)
            .forEach(edge => {
                dependents.add(this.getSymbolKey(edge.from));
            });

        return Array.from(dependents)
            .map(k => this.nodes.get(k))
            .filter((s): s is Symbol => s !== undefined);
    }

    public getDependencies(symbol: Symbol): Symbol[] {
        const key = this.getSymbolKey(symbol);
        const dependencies = new Set<string>();

        this.edges
            .filter(edge => this.getSymbolKey(edge.from) === key)
            .forEach(edge => {
                dependencies.add(this.getSymbolKey(edge.to));
            });

        return Array.from(dependencies)
            .map(k => this.nodes.get(k))
            .filter((s): s is Symbol => s !== undefined);
    }

    public getTransitiveDependents(symbol: Symbol, maxDepth: number = 5): Symbol[] {
        const visited = new Set<string>();
        const result: Symbol[] = [];

        const traverse = (current: Symbol, depth: number): void => {
            if (depth > maxDepth) {
                return;
            }

            const key = this.getSymbolKey(current);
            if (visited.has(key)) {
                return;
            }
            visited.add(key);

            const dependents = this.getDependents(current);
            dependents.forEach(dep => {
                result.push(dep);
                traverse(dep, depth + 1);
            });
        };

        traverse(symbol, 0);
        return result;
    }

    public getTransitiveDependencies(symbol: Symbol, maxDepth: number = 5): Symbol[] {
        const visited = new Set<string>();
        const result: Symbol[] = [];

        const traverse = (current: Symbol, depth: number): void => {
            if (depth > maxDepth) {
                return;
            }

            const key = this.getSymbolKey(current);
            if (visited.has(key)) {
                return;
            }
            visited.add(key);

            const dependencies = this.getDependencies(current);
            dependencies.forEach(dep => {
                result.push(dep);
                traverse(dep, depth + 1);
            });
        };

        traverse(symbol, 0);
        return result;
    }

    public getEdgesForSymbol(symbol: Symbol): Dependency[] {
        const key = this.getSymbolKey(symbol);
        return this.edges.filter(
            e => this.getSymbolKey(e.from) === key || this.getSymbolKey(e.to) === key
        );
    }

    public getNode(key: string): Symbol | undefined {
        return this.nodes.get(key);
    }

    public getAllNodes(): Symbol[] {
        return Array.from(this.nodes.values());
    }

    public getAllEdges(): Dependency[] {
        return [...this.edges];
    }

    private getSymbolKey(symbol: Symbol): string {
        return `${symbol.location.file}:${symbol.name}:${symbol.kind}`;
    }

    public toJSON(): any {
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges.map(edge => ({
                from: this.getSymbolKey(edge.from),
                to: this.getSymbolKey(edge.to),
                type: edge.type,
                location: edge.location
            }))
        };
    }

    public clear(): void {
        this.nodes.clear();
        this.edges = [];
        this.nodeEdges.clear();
    }
}

export class DependencyGraphManager {
    private graph: DependencyGraph = new DependencyGraph();
    private parser: TypeScriptParser | null = null;

    constructor(private workspaceRoot: string) {
        try {
            this.parser = new TypeScriptParser(workspaceRoot);
        } catch (error) {
            console.error('Failed to initialize parser:', error);
        }
    }

    public async updateGraph(uri: vscode.Uri): Promise<void> {
        if (!this.parser) {
            return;
        }

        try {
            const dependencies = this.parser.extractDependencies(uri.fsPath);
            const symbols = this.parser.extractSymbols(uri.fsPath);

            // Add all symbols as nodes
            symbols.forEach(symbol => {
                this.graph.addNode(symbol);
            });

            // Add all dependencies as edges
            dependencies.forEach(dep => {
                this.graph.addEdge(dep);
            });
        } catch (error) {
            console.error(`Error updating graph for ${uri.fsPath}:`, error);
        }
    }

    public getDependents(symbol: any): any[] {
        return this.graph.getDependents(symbol);
    }

    public getTransitiveDependents(symbol: any, maxDepth: number = 5): any[] {
        return this.graph.getTransitiveDependents(symbol, maxDepth);
    }

    public getEdgesForSymbol(symbol: any): any[] {
        return this.graph.getEdgesForSymbol(symbol);
    }

    public getGraph(): DependencyGraph {
        return this.graph;
    }

    public getParser(): TypeScriptParser | null {
        return this.parser;
    }

    public getSymbolKey(symbol: any): string {
        return `${symbol.location.file}:${symbol.name}:${symbol.kind}`;
    }
}

