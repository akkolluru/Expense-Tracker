import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const safeStorage = (() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      // Test storage availability
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch {
      // Quota exceeded or private browsing restricted
    }
  }
  // In-memory fallback if localStorage is unavailable
  const inMemory = new Map<string, string>();
  return {
    getItem: (key: string) => inMemory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      inMemory.set(key, value);
    },
    removeItem: (key: string) => {
      inMemory.delete(key);
    },
  };
})();

export const queryPersister = createSyncStoragePersister({
  storage: safeStorage,
  key: 'PAISAIQ_QUERY_CACHE_V1',
  throttleTime: 1000,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours persistence
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        // Do not retry on 4xx client errors
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
