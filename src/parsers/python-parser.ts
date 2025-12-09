import { spawn } from 'child_process';
import { BaseParser, Dependency, ParseError, ParseResult, Symbol } from './base-parser';

/**
 * Python parser using stdlib ast via subprocess.
 */
export class PythonParser extends BaseParser {
    private pythonExecutable: string;

    constructor(workspaceRoot: string, config?: Partial<import('./base-parser').ParserConfig>) {
        super(workspaceRoot, config);
        this.pythonExecutable = (config?.customOptions?.pythonPath as string) || 'python3';
    }

    public getLanguage(): string {
        return 'python';
    }

    public getSupportedExtensions(): string[] {
        return ['.py', '.pyw'];
    }

    public async parse(filePath: string, content?: string): Promise<ParseResult> {
        const start = Date.now();
        try {
            const code = content ?? (await this.readFile(filePath));
            const astData = await this.parseWithAst(filePath, code);
            return {
                filePath,
                language: 'python',
                symbols: astData.symbols,
                dependencies: astData.dependencies,
                exports: astData.exports,
                imports: astData.imports,
                parseTimeMs: Date.now() - start,
            };
        } catch (error: any) {
            return {
                filePath,
                language: 'python',
                symbols: [],
                dependencies: [],
                exports: [],
                imports: [],
                parseTimeMs: Date.now() - start,
                errors: [this.toParseError(error)],
            };
        }
    }

    public async findSymbolAtPosition(
        filePath: string,
        line: number,
        column: number,
        content?: string
    ): Promise<Symbol | null> {
        const result = await this.parse(filePath, content);
        return (
            result.symbols.find(
                (sym) =>
                    sym.startLine <= line &&
                    sym.endLine >= line &&
                    sym.startColumn <= column &&
                    sym.endColumn >= column
            ) || null
        );
    }

    private toParseError(error: any): ParseError {
        return {
            message: error?.message ? String(error.message) : String(error),
            severity: 'error',
        };
    }

    private async parseWithAst(
        filePath: string,
        content: string
    ): Promise<{
        symbols: Symbol[];
        dependencies: Dependency[];
        exports: string[];
        imports: string[];
    }> {
        const script = `
import ast
import json
import sys

code = sys.stdin.read()

try:
    tree = ast.parse(code)
    symbols = []
    dependencies = []
    imports = []
    exports = []

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            symbols.append({
                'name': node.name,
                'kind': 'function',
                'startLine': node.lineno,
                'endLine': getattr(node, 'end_lineno', node.lineno),
                'startColumn': node.col_offset + 1,
                'endColumn': getattr(node, 'end_col_offset', node.col_offset) + 1,
                'modifiers': [getattr(dec, 'id', '') for dec in node.decorator_list if hasattr(dec, 'id')],
            })
            if not node.name.startswith('_'):
                exports.append(node.name)
        elif isinstance(node, ast.ClassDef):
            symbols.append({
                'name': node.name,
                'kind': 'class',
                'startLine': node.lineno,
                'endLine': getattr(node, 'end_lineno', node.lineno),
                'startColumn': node.col_offset + 1,
                'endColumn': getattr(node, 'end_col_offset', node.col_offset) + 1,
            })
            if not node.name.startswith('_'):
                exports.append(node.name)
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    symbols.append({
                        'name': f"{node.name}.{item.name}",
                        'kind': 'method',
                        'startLine': item.lineno,
                        'endLine': getattr(item, 'end_lineno', item.lineno),
                        'startColumn': item.col_offset + 1,
                        'endColumn': getattr(item, 'end_col_offset', item.col_offset) + 1,
                    })
        elif isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
                dependencies.append({
                    'source': '${filePath}',
                    'target': alias.name,
                    'type': 'import',
                    'line': node.lineno,
                    'column': node.col_offset + 1,
                })
        elif isinstance(node, ast.ImportFrom):
            module_name = node.module or ''
            imports.append(module_name)
            for alias in node.names:
                dependencies.append({
                    'source': '${filePath}',
                    'target': f"{module_name}.{alias.name}" if module_name else alias.name,
                    'type': 'import',
                    'line': node.lineno,
                    'column': node.col_offset + 1,
                })

    print(json.dumps({
        'symbols': symbols,
        'dependencies': dependencies,
        'imports': imports,
        'exports': exports,
    }))
except SyntaxError as e:
    print(json.dumps({'error': str(e), 'line': e.lineno, 'column': e.offset}), file=sys.stderr)
    sys.exit(1)
`;

        return new Promise((resolve, reject) => {
            const proc = spawn(this.pythonExecutable, ['-c', script], {
                timeout: this.config.timeout,
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            proc.on('close', (code: number | null) => {
                if (code !== 0) {
                    reject(new Error(stderr || `Python parser exited with code ${code}`));
                    return;
                }

                try {
                    const result = JSON.parse(stdout);
                    const symbols: Symbol[] = (result.symbols || []).map((s: any) => ({
                        ...s,
                        filePath,
                        location: {
                            file: filePath,
                            line: s.startLine,
                            column: s.startColumn,
                        },
                    }));

                    const dependencies: Dependency[] = (result.dependencies || []).map((d: any) => ({
                        ...d,
                    }));

                    resolve({
                        symbols,
                        dependencies,
                        imports: result.imports || [],
                        exports: result.exports || [],
                    });
                } catch (err) {
                    reject(new Error(`Failed to parse Python AST output: ${err}`));
                }
            });

            proc.stdin.write(content);
            proc.stdin.end();
        });
    }
}
