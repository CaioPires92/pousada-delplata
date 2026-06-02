type CacheEntry = { value: string; expiresAt: number | null };

class MemoryStore {
  private map = new Map<string, CacheEntry>();

  private now() {
    return Date.now();
  }

  private cleanIfExpired(key: string) {
    const entry = this.map.get(key);
    if (!entry) return;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.map.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    this.cleanIfExpired(key);
    return this.map.get(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = typeof ttlSeconds === "number" && ttlSeconds > 0
      ? this.now() + ttlSeconds * 1000
      : null;
    this.map.set(key, { value, expiresAt });
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    this.cleanIfExpired(key);
    if (this.map.has(key)) return false;
    await this.set(key, value, ttlSeconds);
    return true;
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    this.cleanIfExpired(key);
    const current = Number.parseInt((await this.get(key)) ?? "0", 10) || 0;
    const next = current + 1;
    await this.set(key, String(next), ttlSeconds);
    return next;
  }
}

const store = new MemoryStore();

export async function cacheGet(key: string) {
  return store.get(key);
}

export async function cacheSet(key: string, value: string, ttlSeconds?: number) {
  await store.set(key, value, ttlSeconds);
}

export async function cacheSetNx(key: string, value: string, ttlSeconds: number) {
  return store.setNx(key, value, ttlSeconds);
}

export async function cacheIncrWithTtl(key: string, ttlSeconds: number) {
  return store.incrWithTtl(key, ttlSeconds);
}
