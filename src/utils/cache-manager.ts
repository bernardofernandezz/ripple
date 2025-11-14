export class CacheManager {
    private cache: Map<string, { value: any; expires: number }> = new Map();

    public get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }

        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            return null;
        }

        return entry.value as T;
    }

    public set(key: string, value: any, ttl: number = 300000): void {
        const expires = Date.now() + ttl;
        this.cache.set(key, { value, expires });
    }

    public has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }

        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    public invalidate(pattern: string): void {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    public clear(): void {
        this.cache.clear();
    }

    public size(): number {
        // Clean expired entries first
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expires) {
                this.cache.delete(key);
            }
        }
        return this.cache.size;
    }
}

