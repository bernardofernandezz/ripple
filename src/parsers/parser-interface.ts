export interface Symbol {
    name: string;
    kind: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type';
    location: { file: string; line: number; column: number };
    signature?: string;
    returnType?: string;
    parameters?: Parameter[];
}

export interface Parameter {
    name: string;
    type: string;
    optional: boolean;
    defaultValue?: string;
}

export interface Dependency {
    from: Symbol;
    to: Symbol;
    type: 'calls' | 'imports' | 'extends' | 'implements' | 'references';
    location: { file: string; line: number; column: number };
}

export interface Parser {
    extractDependencies(filePath: string): Dependency[];
    extractSymbols(filePath: string): Symbol[];
    getSymbolAtPosition(filePath: string, line: number, column: number): Symbol | null;
}

