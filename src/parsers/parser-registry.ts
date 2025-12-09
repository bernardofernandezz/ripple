import * as path from 'path';
import { BaseParser } from './base-parser';

/**
 * Registry for managing multiple language parsers
 */
export class ParserRegistry {
    private parsers: Map<string, BaseParser> = new Map();
    private extensionMap: Map<string, string> = new Map();
    private lazyLoaders: Map<string, () => Promise<BaseParser>> = new Map();

    /**
     * Register a parser instance
     */
    register(parser: BaseParser): void {
        const language = parser.getLanguage();
        this.parsers.set(language, parser);

        for (const ext of parser.getSupportedExtensions()) {
            this.extensionMap.set(ext.toLowerCase(), language);
        }
    }

    /**
     * Register a lazy-loaded parser
     */
    registerLazy(language: string, extensions: string[], loader: () => Promise<BaseParser>): void {
        this.lazyLoaders.set(language, loader);
        for (const ext of extensions) {
            this.extensionMap.set(ext.toLowerCase(), language);
        }
    }

    /**
     * Get parser for a specific language
     */
    async getParser(language: string): Promise<BaseParser | null> {
        if (this.parsers.has(language)) {
            return this.parsers.get(language)!;
        }

        if (this.lazyLoaders.has(language)) {
            try {
                const loader = this.lazyLoaders.get(language)!;
                const parser = await loader();
                this.register(parser);
                return parser;
            } catch (error) {
                console.error(`Failed to lazy-load parser for ${language}:`, error);
                return null;
            }
        }

        return null;
    }

    /**
     * Get parser for a specific file
     */
    async getParserForFile(filePath: string): Promise<BaseParser | null> {
        const ext = path.extname(filePath).toLowerCase();
        const language = this.extensionMap.get(ext);
        if (!language) {
            return null;
        }
        return this.getParser(language);
    }

    /**
     * Get all registered language identifiers
     */
    getRegisteredLanguages(): string[] {
        return Array.from(new Set([...this.parsers.keys(), ...this.lazyLoaders.keys()]));
    }

    /**
     * Check if a file can be parsed
     */
    canParse(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return this.extensionMap.has(ext);
    }

    unregister(language: string): void {
        this.parsers.delete(language);
        this.lazyLoaders.delete(language);
    }

    clear(): void {
        this.parsers.clear();
        this.extensionMap.clear();
        this.lazyLoaders.clear();
    }
}

export const parserRegistry = new ParserRegistry();

