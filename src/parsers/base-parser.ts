import * as fs from 'fs';
import * as path from 'path';

export interface Parameter {
    name: string;
    type?: string;
    optional?: boolean;
    defaultValue?: string;
}

/**
 * Represents a code symbol (function, class, variable, etc.)
 */
export interface Symbol {
    name: string;
    kind: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type' | 'constant' | 'module';
    filePath: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    signature?: string;
    modifiers?: string[];
    parameters?: Parameter[];
    returnType?: string;
    location?: { file: string; line: number; column: number }; // Backwards compatibility with existing graph code
}

/**
 * Represents a dependency between files or symbols
 */
export interface Dependency {
    source: string;
    target: string;
    type: 'import' | 'call' | 'extends' | 'implements' | 'uses' | 'references';
    line?: number;
    column?: number;
}

/**
 * Result of parsing a single file
 */
export interface ParseResult {
    filePath: string;
    language: string;
    symbols: Symbol[];
    dependencies: Dependency[];
    exports: string[];
    imports: string[];
    parseTimeMs: number;
    errors?: ParseError[];
}

/**
 * Parse error details
 */
export interface ParseError {
    message: string;
    line?: number;
    column?: number;
    severity: 'error' | 'warning';
}

/**
 * Parser configuration per language
 */
export interface ParserConfig {
    enabled: boolean;
    maxFileSize?: number;
    timeout?: number;
    followImports?: boolean;
    customOptions?: Record<string, any>;
}

/**
 * Base abstract parser that all language parsers must extend
 */
export abstract class BaseParser {
    protected workspaceRoot: string;
    protected config: ParserConfig;

    constructor(workspaceRoot: string, config?: Partial<ParserConfig>) {
        this.workspaceRoot = workspaceRoot;
        this.config = {
            enabled: true,
            maxFileSize: 1024 * 1024,
            timeout: 5000,
            followImports: true,
            ...config,
        };
    }

    /**
     * Get the language identifier for this parser
     */
    abstract getLanguage(): string;

    /**
     * Get file extensions supported by this parser (e.g., ['.ts', '.tsx'])
     */
    abstract getSupportedExtensions(): string[];

    /**
     * Parse a file and extract symbols and dependencies
     */
    abstract parse(filePath: string, content?: string): Promise<ParseResult>;

    /**
     * Find symbol at a specific position in a file
     */
    abstract findSymbolAtPosition(
        filePath: string,
        line: number,
        column: number,
        content?: string
    ): Promise<Symbol | null>;

    /**
     * Validate if this parser can handle the given file
     */
    canParse(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return this.config.enabled && this.getSupportedExtensions().includes(ext);
    }

    /**
     * Safe file read with error handling
     */
    protected async readFile(filePath: string): Promise<string> {
        const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.workspaceRoot, filePath);

        const stats = await fs.promises.stat(fullPath);

        if (this.config.maxFileSize && stats.size > this.config.maxFileSize) {
            throw new Error(
                `File ${filePath} exceeds max size (${stats.size} > ${this.config.maxFileSize})`
            );
        }

        return fs.promises.readFile(fullPath, 'utf-8');
    }

    /**
     * Normalize import paths for cross-file resolution
     */
    protected normalizePath(importPath: string, currentFilePath: string): string {
        if (path.isAbsolute(importPath)) {
            return importPath;
        }

        const dir = path.dirname(currentFilePath);
        return path.normalize(path.join(dir, importPath));
    }

    /**
     * Detect potential breaking changes when a symbol is modified
     */
    detectBreakingChanges(
        oldSymbol: Symbol,
        newSymbol: Symbol
    ): { isBreaking: boolean; reasons: string[] } {
        const reasons: string[] = [];

        if (oldSymbol.name !== newSymbol.name) {
            reasons.push(`Symbol renamed from "${oldSymbol.name}" to "${newSymbol.name}"`);
        }

        if (oldSymbol.kind !== newSymbol.kind) {
            reasons.push(`Symbol kind changed from ${oldSymbol.kind} to ${newSymbol.kind}`);
        }

        if (oldSymbol.signature && newSymbol.signature && oldSymbol.signature !== newSymbol.signature) {
            reasons.push(`Signature changed: ${oldSymbol.signature} → ${newSymbol.signature}`);
        }

        const oldModifiers = new Set(oldSymbol.modifiers || []);
        const newModifiers = new Set(newSymbol.modifiers || []);
        if (oldModifiers.has('public') && newModifiers.has('private')) {
            reasons.push('Symbol visibility reduced (public → private)');
        }

        return {
            isBreaking: reasons.length > 0,
            reasons,
        };
    }
}

