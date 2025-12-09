import { Symbol, Dependency as ParsedDependency, ParseResult } from '../parsers/base-parser';
import * as vscode from 'vscode';
import { parserRegistry } from '../parsers/parser-registry';
import { CacheManager } from '../utils/cache-manager';

type GraphEdge = {
    from: Symbol;
    to: Symbol;
    type: ParsedDependency['type'] | 'calls' | 'imports';
    location: { file: string; line: number; column: number };
};

export class DependencyGraph {
    private nodes: Map<string, Symbol> = new Map();
    private edges: GraphEdge[] = [];
    private nodeEdges: Map<string, GraphEdge[]> = new Map();

    public addNode(symbol: Symbol): void {
        const key = this.getSymbolKey(symbol);
        if (!this.nodes.has(key)) {
            this.nodes.set(key, symbol);
            this.nodeEdges.set(key, []);
        }
    }

    public addEdge(dependency: GraphEdge): void {
        const fromKey = this.getSymbolKey(dependency.from);
        const toKey = this.getSymbolKey(dependency.to);

        // Add nodes if they don't exist
        this.addNode(dependency.from);
        this.addNode(dependency.to);

        // Check if edge already exists
        const existingEdge = this.edges.find(
            e =>
                this.getSymbolKey(e.from) === fromKey &&
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

    public getEdgesForSymbol(symbol: Symbol): GraphEdge[] {
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

    public getAllEdges(): GraphEdge[] {
        return [...this.edges];
    }

    private getSymbolKey(symbol: Symbol): string {
        const file = symbol.location?.file || (symbol as any).filePath || 'unknown';
        return `${file}:${symbol.name}:${symbol.kind}`;
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
    private cacheManager: CacheManager = new CacheManager();

    constructor(private workspaceRoot: string) {}

    public async updateGraph(uri: vscode.Uri): Promise<void> {
        const parser = await parserRegistry.getParserForFile(uri.fsPath);
        if (!parser) {
            console.warn(`No parser available for ${uri.fsPath}`);
            return;
        }

        try {
            const cached = this.cacheManager.get<ParseResult>(uri.fsPath);
            if (cached) {
                this.updateGraphFromParseResult(cached);
                return;
            }

            const result = await parser.parse(uri.fsPath);
            this.cacheManager.set(uri.fsPath, result);
            this.updateGraphFromParseResult(result);
        } catch (error) {
            console.error(`Error updating graph for ${uri.fsPath}:`, error);
        }
    }

    private updateGraphFromParseResult(result: ParseResult): void {
        const symbolMap = new Map<string, Symbol>();

        result.symbols.forEach((symbol) => {
            // Ensure backward compatible location
            if (!symbol.location) {
                symbol.location = {
                    file: symbol.filePath,
                    line: symbol.startLine,
                    column: symbol.startColumn,
                };
            }
            this.graph.addNode(symbol);
            symbolMap.set(this.getSymbolKey(symbol), symbol);
        });

        result.dependencies.forEach((dep) => {
            const from = symbolMap.get(dep.source) || symbolMap.get(this.normalizeSymbolKey(dep.source));
            const to = symbolMap.get(dep.target) || symbolMap.get(this.normalizeSymbolKey(dep.target));
            if (from && to) {
                this.graph.addEdge({
                    from,
                    to,
                    type: dep.type,
                    location: {
                        file: from.filePath || from.location?.file || result.filePath,
                        line: dep.line || from.startLine,
                        column: dep.column || from.startColumn,
                    },
                });
            }
        });
    }

    private normalizeSymbolKey(key: string): string {
        return key;
    }

    public getDependents(symbol: Symbol): Symbol[] {
        return this.graph.getDependents(symbol);
    }

    public getTransitiveDependents(symbol: Symbol, maxDepth: number = 5): Symbol[] {
        return this.graph.getTransitiveDependents(symbol, maxDepth);
    }

    public getEdgesForSymbol(symbol: Symbol): GraphEdge[] {
        return this.graph.getEdgesForSymbol(symbol);
    }

    public getGraph(): DependencyGraph {
        return this.graph;
    }

    public async getParserForFile(filePath: string) {
        return parserRegistry.getParserForFile(filePath);
    }

    public getSymbolKey(symbol: Symbol): string {
        const file = symbol.location?.file || symbol.filePath || 'unknown';
        return `${file}:${symbol.name}:${symbol.kind}`;
    }
}

