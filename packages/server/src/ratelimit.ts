export interface RateLimiter {
  check(userId: number): boolean;
}

export function createRateLimiter(windowMs: number, maxActions: number): RateLimiter {
  const store = new Map<number, number[]>();

  // Periodically clean up stale entries
  setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamps] of store) {
      const recent = timestamps.filter(t => now - t < windowMs);
      if (recent.length === 0) {
        store.delete(userId);
      } else {
        store.set(userId, recent);
      }
    }
  }, 60_000).unref();

  return {
    check(userId: number): boolean {
      const now = Date.now();
      const timestamps = store.get(userId) || [];
      const recent = timestamps.filter(t => now - t < windowMs);
      if (recent.length >= maxActions) {
        return false;
      }
      recent.push(now);
      store.set(userId, recent);
      return true;
    },
  };
}
