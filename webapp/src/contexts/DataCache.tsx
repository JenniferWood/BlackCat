import { createContext, useContext, useRef, type ReactNode } from 'react';

interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}

interface DataCacheAPI {
  get: <T>(key: string) => T | undefined;
  set: (key: string, data: unknown) => void;
  invalidate: (key: string) => void;
  isFresh: (key: string, maxAgeMs?: number) => boolean;
}

const DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5 minutes

const DataCacheContext = createContext<DataCacheAPI | null>(null);

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const store = useRef(new Map<string, CacheEntry>());

  const api = useRef<DataCacheAPI>({
    get<T>(key: string): T | undefined {
      return store.current.get(key)?.data as T | undefined;
    },
    set(key: string, data: unknown) {
      store.current.set(key, { data, fetchedAt: Date.now() });
    },
    invalidate(key: string) {
      store.current.delete(key);
    },
    isFresh(key: string, maxAgeMs = DEFAULT_MAX_AGE): boolean {
      const entry = store.current.get(key);
      if (!entry) return false;
      return Date.now() - entry.fetchedAt < maxAgeMs;
    },
  }).current;

  return (
    <DataCacheContext.Provider value={api}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache(): DataCacheAPI {
  const ctx = useContext(DataCacheContext);
  if (!ctx) throw new Error('useDataCache must be inside DataCacheProvider');
  return ctx;
}
