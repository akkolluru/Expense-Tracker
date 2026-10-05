import { useState, useEffect, useCallback, useRef } from 'react';
import { api, SystemHealthResponse } from '../services/api';
import { offlineQueue, FlushResult } from '../services/offlineQueue';

export type ConnectionState = 'online' | 'degraded' | 'offline';

export interface NetworkStatus {
  isOnline: boolean;
  isBackendReachable: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  connectionState: ConnectionState;
  healthData: SystemHealthResponse | null;
  flushPendingQueue: () => Promise<FlushResult>;
  checkHealth: () => Promise<boolean>;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isBackendReachable, setIsBackendReachable] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => offlineQueue.getPendingCount());
  const [healthData, setHealthData] = useState<SystemHealthResponse | null>(null);

  const isFlushingRef = useRef(false);

  // Subscribe to offline queue changes
  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe((queue) => {
      const pending = queue.filter((i) => i.status === 'PENDING' || i.status === 'SYNCING').length;
      setPendingSyncCount(pending);
    });
    return unsubscribe;
  }, []);

  const flushPendingQueue = useCallback(async (): Promise<FlushResult> => {
    if (isFlushingRef.current) {
      return { succeeded: 0, failed: 0, remaining: offlineQueue.getPendingCount() };
    }
    isFlushingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await offlineQueue.flush(api);
      return result;
    } finally {
      setIsSyncing(false);
      isFlushingRef.current = false;
    }
  }, []);

  // Health ping to backend
  const checkHealth = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsBackendReachable(false);
      return false;
    }
    try {
      const data = await api.getSystemHealth();
      setHealthData(data);
      setIsBackendReachable(true);

      // If we have pending offline actions and the backend is healthy, flush now
      if (offlineQueue.getPendingCount() > 0 && !isFlushingRef.current) {
        flushPendingQueue();
      }

      return true;
    } catch {
      setIsBackendReachable(false);
      return false;
    }
  }, [flushPendingQueue]);

  // Handle browser online / offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkHealth();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsBackendReachable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial health check
    checkHealth();

    // Periodic heartbeat (every 30 seconds)
    const intervalId = window.setInterval(() => {
      if (typeof navigator !== 'undefined' ? navigator.onLine : true) {
        checkHealth();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(intervalId);
    };
  }, [checkHealth]);

  // Derived connection state
  let connectionState: ConnectionState = 'online';
  if (!isOnline || !isBackendReachable) {
    connectionState = 'offline';
  } else if (healthData && healthData.status === 'DEGRADED') {
    connectionState = 'degraded';
  }

  return {
    isOnline,
    isBackendReachable,
    isSyncing,
    pendingSyncCount,
    connectionState,
    healthData,
    flushPendingQueue,
    checkHealth,
  };
}
