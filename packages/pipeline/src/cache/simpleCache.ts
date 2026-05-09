export class SimpleCache<T> {
  private map = new Map<string, { ts: number; value: T }>();
  private inFlight = new Map<string, Promise<T>>();
  private hits = 0;
  private misses = 0;
  private sets = 0;

  constructor(private ttlSeconds: number = 300) {}

  get(key: string): T | null {
    const ent = this.map.get(key);
    if (!ent) return null;
    if ((Date.now() - ent.ts) > this.ttlSeconds * 1000) {
      this.map.delete(key);
      return null;
    }
    this.hits++;
    return ent.value;
  }

  set(key: string, value: T) {
    this.map.set(key, { ts: Date.now(), value });
    this.sets++;
  }

  clear() {
    this.map.clear();
  }

  // Atomic get-or-set to avoid duplicate concurrent computations
  async getOrSet(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.get(key);
    if (existing !== null) return existing;

    // If another call is already computing, await it
    const inflight = this.inFlight.get(key);
    if (inflight) return inflight;

    this.misses++;
    const promise = (async () => {
      try {
        const val = await factory();
        this.set(key, val);
        return val;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  getStats() {
    return { hits: this.hits, misses: this.misses, sets: this.sets, size: this.map.size };
  }
}
