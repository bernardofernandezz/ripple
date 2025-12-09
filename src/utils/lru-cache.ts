/**
 * LRU Cache with TTL and size limits.
 */
export class LRUCache<K, V> {
    private cache: Map<K, CacheEntry<V>>;
    private maxSize: number;
    private ttlMs: number;
    private onEvict?: (key: K, value: V) => void;

    constructor(options: { maxSize: number; ttlMs?: number; onEvict?: (key: K, value: V) => void }) {
        this.cache = new Map();
        this.maxSize = options.maxSize;
        this.ttlMs = options.ttlMs ?? Infinity;
        this.onEvict = options.onEvict;
    }

    public get(key: K): V | undefined {
        const entry = this.cache.get(key);
        if (!entry) {
            return undefined;
        }

        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.delete(key);
            return undefined;
        }

        // refresh recency
        this.cache.delete(key);
        this.cache.set(key, { ...entry, timestamp: entry.timestamp });
        return entry.value;
    }

    public set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            const oldest = this.cache.get(oldestKey);
            if (oldest && this.onEvict) {
                this.onEvict(oldestKey, oldest.value);
            }
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, { value, timestamp: Date.now() });
    }

    public has(key: K): boolean {
        return this.get(key) !== undefined;
    }

    public delete(key: K): boolean {
        const existing = this.cache.get(key);
        if (existing && this.onEvict) {
            this.onEvict(key, existing.value);
        }
        return this.cache.delete(key);
    }

    public clear(): void {
        if (this.onEvict) {
            for (const [key, entry] of this.cache.entries()) {
                this.onEvict(key, entry.value);
            }
        }
        this.cache.clear();
    }

    public size(): number {
        return this.cache.size;
    }

    public keys(): K[] {
        return Array.from(this.cache.keys());
    }
}

interface CacheEntry<V> {
    value: V;
    timestamp: number;
}

