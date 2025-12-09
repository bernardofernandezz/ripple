import { BaseParser, ParseResult, Symbol } from './base-parser';

/**
 * Python parser placeholder - to be implemented with AST-based parsing.
 */
export class PythonParser extends BaseParser {
    constructor(workspaceRoot: string, config?: Partial<import('./base-parser').ParserConfig>) {
        super(workspaceRoot, config);
    }

    public getLanguage(): string {
        return 'python';
    }

    public getSupportedExtensions(): string[] {
        return ['.py', '.pyw'];
    }

    public async parse(filePath: string, content?: string): Promise<ParseResult> {
        // Placeholder implementation to keep extension functional until full parser is added.
        return {
            filePath,
            language: 'python',
            symbols: [],
            dependencies: [],
            exports: [],
            imports: [],
            parseTimeMs: 0,
        };
    }

    public async findSymbolAtPosition(): Promise<Symbol | null> {
        return null;
    }
}


