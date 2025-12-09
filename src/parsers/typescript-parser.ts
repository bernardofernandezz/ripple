import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { BaseParser, Dependency, ParseResult, Symbol, Parameter } from './base-parser';

export class TypeScriptParser extends BaseParser {
    private program: ts.Program | null = null;
    private checker: ts.TypeChecker | null = null;

    constructor(workspaceRoot: string, config?: Partial<import('./base-parser').ParserConfig>) {
        super(workspaceRoot, config);
        try {
            this.initializeProgram();
        } catch (error) {
            console.error('Failed to initialize TypeScript parser:', error);
        }
    }

    public getLanguage(): string {
        return 'typescript';
    }

    public getSupportedExtensions(): string[] {
        return ['.ts', '.tsx', '.js', '.jsx'];
    }

    public async parse(filePath: string, content?: string): Promise<ParseResult> {
        const start = Date.now();
        const parseDependencies = this.extractDependencies(filePath);
        const parseSymbols = this.extractSymbols(filePath);

        return {
            filePath,
            language: 'typescript',
            symbols: parseSymbols,
            dependencies: parseDependencies.map((dep) => ({
                source: this.getSymbolKey(dep.from),
                target: this.getSymbolKey(dep.to),
                type: dep.type === 'imports' ? 'import' : dep.type === 'calls' ? 'call' : (dep.type as Dependency['type']),
                line: dep.location.line,
                column: dep.location.column,
            })),
            exports: parseSymbols.filter((s) => !s.name.startsWith('_')).map((s) => s.name),
            imports: parseDependencies.filter((d) => d.type === 'imports').map((d) => d.to.name),
            parseTimeMs: Date.now() - start,
        };
    }

    public async findSymbolAtPosition(
        filePath: string,
        line: number,
        column: number,
        content?: string
    ): Promise<Symbol | null> {
        return this.getSymbolAtPosition(filePath, line, column);
    }

    private initializeProgram(): void {
        try {
            const configPath = ts.findConfigFile(
                this.workspaceRoot,
                ts.sys.fileExists,
                'tsconfig.json'
            );

            if (!configPath) {
                // Fallback: create program from all TS/JS files
                const files = this.findSourceFiles();
                if (files.length === 0) {
                    console.warn('No TypeScript/JavaScript files found in workspace');
                    return;
                }
                const compilerOptions: ts.CompilerOptions = {
                    target: ts.ScriptTarget.ES2020,
                    module: ts.ModuleKind.CommonJS,
                    allowJs: true,
                    checkJs: false,
                };
                this.program = ts.createProgram(files, compilerOptions);
            } else {
                const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
                if (configFile.error) {
                    console.warn('Error reading tsconfig.json:', configFile.error);
                    return;
                }
                const parsedConfig = ts.parseJsonConfigFileContent(
                    configFile.config,
                    ts.sys,
                    path.dirname(configPath)
                );
                this.program = ts.createProgram(
                    parsedConfig.fileNames,
                    parsedConfig.options
                );
            }

            if (this.program) {
                this.checker = this.program.getTypeChecker();
            }
        } catch (error) {
            console.error('Failed to initialize TypeScript program:', error);
            // Don't throw - allow extension to continue
        }
    }

    private findSourceFiles(): string[] {
        const files: string[] = [];
        const extensions = ['.ts', '.tsx', '.js', '.jsx'];

        const walkDir = (dir: string): void => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                            walkDir(fullPath);
                        }
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name);
                        if (extensions.includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                // Ignore permission errors
            }
        };

        walkDir(this.workspaceRoot);
        return files;
    }

    private extractDependencies(filePath: string): Array<{
        from: Symbol;
        to: Symbol;
        type: 'calls' | 'imports' | 'extends' | 'implements';
        location: { file: string; line: number; column: number };
    }> {
        if (!this.program || !this.checker) {
            return [];
        }

        const sourceFile = this.program.getSourceFile(filePath);
        if (!sourceFile) {
            return [];
        }

        const dependencies: Array<{
            from: Symbol;
            to: Symbol;
            type: 'calls' | 'imports' | 'extends' | 'implements';
            location: { file: string; line: number; column: number };
        }> = [];

        const visit = (node: ts.Node, parentSymbol: Symbol | null = null): void => {
            // Find function calls
            if (ts.isCallExpression(node)) {
                const symbol = this.getSymbolFromNode(node.expression);
                if (symbol && parentSymbol) {
                    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                    dependencies.push({
                        from: parentSymbol,
                        to: symbol,
                        type: 'calls',
                        location: {
                            file: filePath,
                            line: line + 1,
                            column: character + 1
                        }
                    });
                }
            }

            // Find imports
            if (ts.isImportDeclaration(node)) {
                const moduleSpecifier = node.moduleSpecifier;
                if (ts.isStringLiteral(moduleSpecifier)) {
                    const symbol = this.getSymbolFromNode(node);
                    if (symbol && parentSymbol) {
                        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                        dependencies.push({
                            from: parentSymbol,
                            to: symbol,
                            type: 'imports',
                            location: {
                                file: filePath,
                                line: line + 1,
                                column: character + 1
                            }
                        });
                    }
                }
            }

            // Find class extensions
            if (ts.isClassDeclaration(node) && node.heritageClauses) {
                const classSymbol = this.getClassSymbol(node, sourceFile);
                if (classSymbol) {
            node.heritageClauses.forEach((clause: ts.HeritageClause) => {
                clause.types.forEach((type: ts.ExpressionWithTypeArguments) => {
                            const symbol = this.getSymbolFromNode(type.expression);
                            if (symbol) {
                                const { line, character } = sourceFile.getLineAndCharacterOfPosition(type.getStart());
                                dependencies.push({
                                    from: classSymbol,
                                    to: symbol,
                                    type: clause.token === ts.SyntaxKind.ExtendsKeyword ? 'extends' : 'implements',
                                    location: {
                                        file: filePath,
                                        line: line + 1,
                                        column: character + 1
                                    }
                                });
                            }
                        });
                    });
                }
            }

            // Get current symbol context
            let currentSymbol = parentSymbol;
            if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isClassDeclaration(node)) {
                const symbol = this.getSymbolFromNode(node);
                if (symbol) {
                    currentSymbol = symbol;
                }
            }

            ts.forEachChild(node, (child: ts.Node) => visit(child, currentSymbol));
        };

        visit(sourceFile);
        return dependencies;
    }

    public extractSymbols(filePath: string): Symbol[] {
        if (!this.program || !this.checker) {
            return [];
        }

        const sourceFile = this.program.getSourceFile(filePath);
        if (!sourceFile) {
            return [];
        }

        const symbols: Symbol[] = [];

        const visit = (node: ts.Node): void => {
            if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || 
                ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) ||
                ts.isTypeAliasDeclaration(node) || ts.isVariableStatement(node)) {
                const symbol = this.getSymbolFromNode(node);
                if (symbol) {
                    symbols.push(symbol);
                }
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return symbols;
    }

    public getSymbolAtPosition(filePath: string, line: number, column: number): Symbol | null {
        if (!this.program || !this.checker) {
            return null;
        }

        const sourceFile = this.program.getSourceFile(filePath);
        if (!sourceFile) {
            return null;
        }

        const position = sourceFile.getPositionOfLineAndCharacter(line - 1, column - 1);
        const node = this.getNodeAtPosition(sourceFile, position);
        
        if (node) {
            return this.getSymbolFromNode(node);
        }

        return null;
    }

    private getNodeAtPosition(sourceFile: ts.SourceFile, position: number): ts.Node | null {
        let result: ts.Node | null = null;

        const visit = (node: ts.Node): void => {
            if (node.getStart() <= position && position < node.getEnd()) {
                result = node;
                ts.forEachChild(node, visit);
            }
        };

        visit(sourceFile);
        return result;
    }

    private getSymbolFromNode(node: ts.Node): Symbol | null {
        if (!this.checker) {
            return null;
        }

        let symbol: ts.Symbol | undefined;

        if (ts.isIdentifier(node)) {
            symbol = this.checker.getSymbolAtLocation(node);
        } else if (ts.isPropertyAccessExpression(node)) {
            symbol = this.checker.getSymbolAtLocation(node.name);
        } else if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || 
                   ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) ||
                   ts.isTypeAliasDeclaration(node)) {
            symbol = this.checker.getSymbolAtLocation(node.name || node);
        } else if (ts.isVariableStatement(node)) {
            if (node.declarationList.declarations.length > 0) {
                symbol = this.checker.getSymbolAtLocation(node.declarationList.declarations[0].name);
            }
        }

        if (!symbol) {
            return null;
        }

        const declarations = symbol.getDeclarations();
        if (!declarations || declarations.length === 0) {
            return null;
        }

        const decl = declarations[0];
        const sourceFile = decl.getSourceFile();
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(decl.getStart());
        const endPos = sourceFile.getLineAndCharacterOfPosition(decl.getEnd());

        let kind: Symbol['kind'] = 'variable';
        if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl)) {
            kind = ts.isMethodDeclaration(decl) ? 'method' : 'function';
        } else if (ts.isClassDeclaration(decl)) {
            kind = 'class';
        } else if (ts.isInterfaceDeclaration(decl)) {
            kind = 'interface';
        } else if (ts.isTypeAliasDeclaration(decl)) {
            kind = 'type';
        }

        const signature = this.getSignature(symbol, decl);
        const parameters = this.getParameters(decl);

        return {
            name: symbol.getName(),
            kind,
            filePath: sourceFile.fileName,
            startLine: line + 1,
            endLine: endPos.line + 1,
            startColumn: character + 1,
            endColumn: endPos.character + 1,
            location: {
                file: sourceFile.fileName,
                line: line + 1,
                column: character + 1
            },
            signature,
            parameters,
            returnType: this.getReturnType(symbol, decl)
        };
    }

    private getSignature(symbol: ts.Symbol, decl: ts.Declaration): string | undefined {
        if (!this.checker) {
            return undefined;
        }

        if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl)) {
            const type = this.checker.getTypeOfSymbolAtLocation(symbol, decl);
            return this.checker.typeToString(type);
        }

        return undefined;
    }

    private getParameters(decl: ts.Declaration): Parameter[] | undefined {
        if (!ts.isFunctionDeclaration(decl) && !ts.isMethodDeclaration(decl)) {
            return undefined;
        }

        if (!decl.parameters) {
            return [];
        }

        return decl.parameters.map((param: ts.ParameterDeclaration) => {
            const name = ts.isIdentifier(param.name) ? param.name.text : param.name.getText();
            const type = param.type ? param.type.getText() : 'any';
            const optional = !!param.questionToken;
            const defaultValue = param.initializer ? param.initializer.getText() : undefined;

            return { name, type, optional, defaultValue };
        });
    }

    private getReturnType(symbol: ts.Symbol, decl: ts.Declaration): string | undefined {
        if (!this.checker) {
            return undefined;
        }

        if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl)) {
            if (decl.type) {
                return decl.type.getText();
            }
            const signature = this.checker.getSignatureFromDeclaration(decl as ts.SignatureDeclaration);
            if (signature) {
                return this.checker.typeToString(signature.getReturnType());
            }
        }

        return undefined;
    }

    private getClassSymbol(node: ts.ClassDeclaration, sourceFile: ts.SourceFile): Symbol | null {
        if (!node.name) {
            return null;
        }

        if (!this.checker) {
            return null;
        }

        const symbol = this.checker.getSymbolAtLocation(node.name);
        if (!symbol) {
            return null;
        }

        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        return {
            name: symbol.getName(),
            kind: 'class',
            filePath: sourceFile.fileName,
            startLine: line + 1,
            endLine: line + 1,
            startColumn: character + 1,
            endColumn: character + 1,
            location: {
                file: sourceFile.fileName,
                line: line + 1,
                column: character + 1
            }
        };
    }

    private getSymbolKey(symbol: Symbol): string {
        const file = symbol.location?.file || symbol.filePath || 'unknown';
        return `${file}:${symbol.name}:${symbol.kind}`;
    }

    public refresh(): void {
        this.initializeProgram();
    }
}

