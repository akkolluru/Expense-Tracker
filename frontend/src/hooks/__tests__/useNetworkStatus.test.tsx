import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNetworkStatus, NetworkStatus } from '../useNetworkStatus';
import { api } from '../../services/api';
import { offlineQueue } from '../../services/offlineQueue';

// Enable React 19 act environment flag
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Test render hook harness for React 19 + happy-dom
function renderHook<T>(hookFn: () => T) {
  const result = { current: null as unknown as T };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    rerender: () => {
      act(() => {
        root.render(<TestComponent />);
      });
    },
  };
}

describe('useNetworkStatus Hook', () => {
  let getSystemHealthSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    offlineQueue.clear();

    getSystemHealthSpy = vi.spyOn(api, 'getSystemHealth').mockResolvedValue({
      status: 'HEALTHY',
      database: 'CONNECTED',
      llm_circuit_breaker: 'CLOSED',
      active_parsers_count: 4,
      timestamp: '2026-10-05T12:00:00Z',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('initializes with online state and triggers health check', async () => {
    const { result, unmount } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.connectionState).toBe('online');
    expect(result.current.pendingSyncCount).toBe(0);

    // Let the initial health check promise resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(getSystemHealthSpy).toHaveBeenCalled();
    expect(result.current.isBackendReachable).toBe(true);
    expect(result.current.healthData?.database).toBe('CONNECTED');

    unmount();
  });

  it('updates state to offline when browser offline event fires', async () => {
    const { result, unmount } = renderHook(() => useNetworkStatus());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.connectionState).toBe('online');

    // Fire offline event
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isBackendReachable).toBe(false);
    expect(result.current.connectionState).toBe('offline');

    unmount();
  });

  it('triggers health check when browser online event fires', async () => {
    const { result, unmount } = renderHook(() => useNetworkStatus());

    // Go offline first
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);

    getSystemHealthSpy.mockClear();

    // Come back online
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    expect(result.current.isOnline).toBe(true);
    expect(getSystemHealthSpy).toHaveBeenCalled();
    expect(result.current.isBackendReachable).toBe(true);
    expect(result.current.connectionState).toBe('online');

    unmount();
  });

  it('handles backend health ping failure gracefully', async () => {
    getSystemHealthSpy.mockRejectedValue(new Error('Backend server down (503)'));

    const { result, unmount } = renderHook(() => useNetworkStatus());

    await act(async () => {
      const ok = await result.current.checkHealth();
      expect(ok).toBe(false);
    });

    expect(result.current.isBackendReachable).toBe(false);
    expect(result.current.connectionState).toBe('offline');

    unmount();
  });

  it('sets connectionState to degraded when backend returns DEGRADED status', async () => {
    getSystemHealthSpy.mockResolvedValue({
      status: 'DEGRADED',
      database: 'CONNECTED',
      llm_circuit_breaker: 'OPEN',
      active_parsers_count: 0,
      timestamp: '2026-10-05T12:00:00Z',
    });

    const { result, unmount } = renderHook(() => useNetworkStatus());

    await act(async () => {
      await result.current.checkHealth();
      await Promise.resolve();
    });

    expect(result.current.isBackendReachable).toBe(true);
    expect(result.current.connectionState).toBe('degraded');
    expect(result.current.healthData?.llm_circuit_breaker).toBe('OPEN');

    unmount();
  });

  it('auto-flushes pending offline queue when health check succeeds with pending items', async () => {
    const flushSpy = vi.spyOn(offlineQueue, 'flush').mockResolvedValue({
      succeeded: 1,
      failed: 0,
      remaining: 0,
    });

    offlineQueue.enqueue({
      type: 'PARSE_SMS',
      payload: { raw_text: 'Offline SMS payment' },
    });

    const { result, unmount } = renderHook(() => useNetworkStatus());

    expect(result.current.pendingSyncCount).toBe(1);

    await act(async () => {
      await result.current.checkHealth();
    });

    expect(flushSpy).toHaveBeenCalled();

    unmount();
  });

  it('allows manual invocation of flushPendingQueue with isSyncing indicator', async () => {
    let finishFlush: (res: any) => void;
    vi.spyOn(offlineQueue, 'flush').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishFlush = resolve;
        })
    );

    const { result, unmount } = renderHook(() => useNetworkStatus());

    let flushPromise: Promise<any>;
    act(() => {
      flushPromise = result.current.flushPendingQueue();
    });

    expect(result.current.isSyncing).toBe(true);

    await act(async () => {
      finishFlush!({ succeeded: 2, failed: 0, remaining: 0 });
      await flushPromise;
    });

    expect(result.current.isSyncing).toBe(false);

    unmount();
  });
});
