/** Page-lifetime cache. Pending requests are shared; failed requests can be retried. */
export class DataCache {
  private entries = new Map<string, { value?: unknown; pending?: Promise<unknown> }>();

  peek<T>(key: string): T | null {
    return (this.entries.get(key)?.value as T | undefined) ?? null;
  }

  load<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    if (existing?.pending) return existing.pending as Promise<T>;
    if (existing && 'value' in existing) return Promise.resolve(existing.value as T);
    const entry: { value?: T; pending?: Promise<T> } = {};
    this.entries.set(key, entry);
    entry.pending = fetcher().then((value) => {
      if (this.entries.get(key) === entry) { entry.value = value; delete entry.pending; }
      return value;
    }, (error: unknown) => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw error;
    });
    return entry.pending;
  }

  set<T>(key: string, value: T) { this.entries.set(key, { value }); }
  delete(key: string) { this.entries.delete(key); }
  deletePrefix(prefix: string) {
    for (const key of this.entries.keys()) if (key.startsWith(prefix)) this.entries.delete(key);
  }
  clear() { this.entries.clear(); }
}
