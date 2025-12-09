import * as fs from 'fs';
import { LRUCache } from './lru-cache';
import { ParseResult } from '../parsers/base-parser';

export interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
}

/**
 * Advanced cache manager with LRU, TTL, and file fingerprinting.
 */
export class CacheManager {
    private memoryCache: LRUCache<string, ParseResult>;
    private stats = { hits: 0, misses: 0 };
    private fileFingerprints: Map<string, string> = new Map();

    constructor(options: { maxMemoryEntries?: number; ttlMs?: number } = {}) {
        this.memoryCache = new LRUCache<string, ParseResult>({
            maxSize: options.maxMemoryEntries ?? 1000,
            ttlMs: options.ttlMs ?? 5 * 60 * 1000,
        });
    }

    public async get(filePath: string): Promise<ParseResult | null> {
        const cached = this.memoryCache.get(filePath);
        const fingerprint = await this.computeFingerprint(filePath);
        const cachedFingerprint = this.fileFingerprints.get(filePath);

        if (cached && cachedFingerprint === fingerprint) {
            this.stats.hits++;
            return cached;
        }

        this.stats.misses++;
        this.invalidate(filePath);
        return null;
    }

    public async set(filePath: string, result: ParseResult): Promise<void> {
        const fingerprint = await this.computeFingerprint(filePath);
        this.fileFingerprints.set(filePath, fingerprint);
        this.memoryCache.set(filePath, result);
    }

    public invalidate(filePath: string): void {
        this.memoryCache.delete(filePath);
        this.fileFingerprints.delete(filePath);
    }

    public invalidatePattern(pattern: RegExp): void {
        this.memoryCache.keys().forEach((key) => {
            if (pattern.test(key)) {
                this.invalidate(key);
            }
        });
    }

    public clear(): void {
        this.memoryCache.clear();
        this.fileFingerprints.clear();
        this.stats = { hits: 0, misses: 0 };
    }

    public getStats(): CacheStats {
        const total = this.stats.hits + this.stats.misses;
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            size: this.memoryCache.size(),
            hitRate: total > 0 ? this.stats.hits / total : 0,
        };
    }

    private async computeFingerprint(filePath: string): Promise<string> {
        try {
            const stats = await fs.promises.stat(filePath);
            return `${stats.mtimeMs}-${stats.size}`;
        } catch {
            return '';
        }
    }
}
