import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  expenseQueryKeys,
  useCreateTransaction,
  useApproveInboxItem,
  useParseSyncText,
} from '../useExpenseApi';
import { api, ApiError } from '../../services/api';
import { offlineQueue } from '../../services/offlineQueue';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function renderHookWithQuery<T>(hookFn: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const result = { current: null as unknown as T };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function Wrapper() {
    result.current = hookFn();
    return null;
  }

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Wrapper />
      </QueryClientProvider>
    );
  });

  return {
    result,
    queryClient,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('useExpenseApi Hook & Queries', () => {
  beforeEach(() => {
    offlineQueue.clear();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('expenseQueryKeys', () => {
    it('generates consistent keys for system health, accounts, and inbox', () => {
      expect(expenseQueryKeys.health).toEqual(['system', 'health']);
      expect(expenseQueryKeys.accounts).toEqual(['accounts']);
      expect(expenseQueryKeys.inbox).toEqual(['inbox']);
    });

    it('generates parameterized query keys for transactions with and without params', () => {
      expect(expenseQueryKeys.transactions()).toEqual(['transactions', undefined]);
      const key = expenseQueryKeys.transactions({ page: 1, page_size: 20 });
      expect(key).toEqual(['transactions', { page: 1, page_size: 20 }]);
    });

    it('generates parameterized query keys for analytics', () => {
      const summaryKey = expenseQueryKeys.analyticsSummary('2026-08-01', '2026-08-31');
      expect(summaryKey).toEqual(['analytics', 'summary', '2026-08-01', '2026-08-31']);

      const categoriesKey = expenseQueryKeys.analyticsCategories('2026-08-01', '2026-08-31');
      expect(categoriesKey).toEqual(['analytics', 'categories', '2026-08-01', '2026-08-31']);

      const topSpendsKey = expenseQueryKeys.analyticsTopSpends(5, '2026-08-01', '2026-08-31', 10);
      expect(topSpendsKey).toEqual(['analytics', 'top-spends', 5, '2026-08-01', '2026-08-31', 10]);

      const momKey = expenseQueryKeys.analyticsMom(
        '2026-08-01',
        '2026-08-31',
        '2026-07-01',
        '2026-07-31'
      );
      expect(momKey).toEqual([
        'analytics',
        'mom',
        '2026-08-01',
        '2026-08-31',
        '2026-07-01',
        '2026-07-31',
      ]);
    });
  });

  describe('useCreateTransaction mutation & offline resilience', () => {
    it('creates transaction via API when online', async () => {
      const apiSpy = vi.spyOn(api, 'createTransaction').mockResolvedValue({
        id: 101,
        account_id: 1,
        amount: 500,
        currency: 'INR',
        is_expense: true,
        is_transfer: false,
        is_settlement: false,
        status: 'POSTED',
        merchant_name: 'Supermart',
        categorization_strategy: 'RULE',
        categorization_confidence: 1.0,
        timestamp: '2026-10-05T12:00:00Z',
      });

      const { result, unmount } = renderHookWithQuery(() => useCreateTransaction());

      let mutationResult: any;
      await act(async () => {
        mutationResult = await result.current.mutateAsync({
          account_id: 1,
          amount: 500,
          merchant_name: 'Supermart',
          timestamp: '2026-10-05T12:00:00Z',
        });
      });

      expect(apiSpy).toHaveBeenCalledTimes(1);
      expect(mutationResult.id).toBe(101);
      expect(offlineQueue.getPendingCount()).toBe(0);

      unmount();
    });

    it('immediately enqueues to offlineQueue when client is offline (navigator.onLine = false)', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });

      const apiSpy = vi.spyOn(api, 'createTransaction');

      const { result, unmount } = renderHookWithQuery(() => useCreateTransaction());

      let optimisticTx: any;
      await act(async () => {
        optimisticTx = await result.current.mutateAsync({
          account_id: 1,
          amount: 350,
          merchant_name: 'Cafe Coffee Day',
          timestamp: '2026-10-05T12:00:00Z',
        });
      });

      expect(apiSpy).not.toHaveBeenCalled();
      expect(optimisticTx.id).toBeLessThan(0);
      expect(optimisticTx.status).toBe('PENDING_SYNC');
      expect(optimisticTx.categorization_strategy).toBe('OFFLINE_QUEUED');
      expect(optimisticTx.merchant_name).toBe('Cafe Coffee Day');
      expect(offlineQueue.getPendingCount()).toBe(1);

      unmount();
    });

    it('catches network drop or 500 server error and falls back to offline queue', async () => {
      vi.spyOn(api, 'createTransaction').mockRejectedValue(new ApiError(500, 'Server Error'));

      const { result, unmount } = renderHookWithQuery(() => useCreateTransaction());

      let fallbackTx: any;
      await act(async () => {
        fallbackTx = await result.current.mutateAsync({
          account_id: 2,
          amount: 990,
          merchant_name: 'Decathlon',
          timestamp: '2026-10-05T14:00:00Z',
        });
      });

      expect(fallbackTx.id).toBeLessThan(0);
      expect(fallbackTx.status).toBe('PENDING_SYNC');
      expect(fallbackTx.amount).toBe(990);
      expect(offlineQueue.getPendingCount()).toBe(1);

      unmount();
    });

    it('rethrows 400 validation error without enqueueing to offlineQueue', async () => {
      vi.spyOn(api, 'createTransaction').mockRejectedValue(new ApiError(400, 'Invalid amount'));

      const { result, unmount } = renderHookWithQuery(() => useCreateTransaction());

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            account_id: 1,
            amount: -50,
            merchant_name: 'Bad Entry',
            timestamp: '2026-10-05T12:00:00Z',
          });
        })
      ).rejects.toThrow(ApiError);

      expect(offlineQueue.getPendingCount()).toBe(0);

      unmount();
    });
  });

  describe('useApproveInboxItem mutation & offline resilience', () => {
    it('approves inbox item via API when online', async () => {
      const apiSpy = vi.spyOn(api, 'approveInboxItem').mockResolvedValue({
        id: 7,
        account_id: 1,
        amount: 150,
        currency: 'INR',
        is_expense: true,
        is_transfer: false,
        is_settlement: false,
        status: 'POSTED',
        merchant_name: 'Grocery',
        categorization_strategy: 'MANUAL',
        categorization_confidence: 1.0,
        timestamp: '2026-10-05T12:00:00Z',
      });

      const { result, unmount } = renderHookWithQuery(() => useApproveInboxItem());

      let res: any;
      await act(async () => {
        res = await result.current.mutateAsync({
          txId: 7,
          payload: { category_id: 2, learn_merchant: true },
        });
      });

      expect(apiSpy).toHaveBeenCalledWith(7, { category_id: 2, learn_merchant: true });
      expect(res.id).toBe(7);
      expect(offlineQueue.getPendingCount()).toBe(0);

      unmount();
    });

    it('falls back to offline queue when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });

      const { result, unmount } = renderHookWithQuery(() => useApproveInboxItem());

      let res: any;
      await act(async () => {
        res = await result.current.mutateAsync({
          txId: 15,
          payload: { category_id: 3 },
        });
      });

      expect(res).toEqual({ success: true, queued: true });
      expect(offlineQueue.getPendingCount()).toBe(1);
      const queued = offlineQueue.getAll()[0];
      expect(queued.type).toBe('APPROVE_INBOX');

      unmount();
    });

    it('falls back to offline queue on 503 server error', async () => {
      vi.spyOn(api, 'approveInboxItem').mockRejectedValue(new ApiError(503, 'Service Unavailable'));

      const { result, unmount } = renderHookWithQuery(() => useApproveInboxItem());

      let res: any;
      await act(async () => {
        res = await result.current.mutateAsync({
          txId: 22,
          payload: { category_id: 1 },
        });
      });

      expect(res).toEqual({ success: true, queued: true });
      expect(offlineQueue.getPendingCount()).toBe(1);

      unmount();
    });
  });

  describe('useParseSyncText mutation & offline resilience', () => {
    it('parses SMS via API when online', async () => {
      const parseSpy = vi.spyOn(api, 'parseSyncText').mockResolvedValue({
        status: 'CREATED',
        action: 'TRANSACTION_CREATED',
        transaction: { id: 30 } as any,
      });

      const { result, unmount } = renderHookWithQuery(() => useParseSyncText());

      let res: any;
      await act(async () => {
        res = await result.current.mutateAsync({ raw_text: 'Test SMS' });
      });

      expect(parseSpy).toHaveBeenCalledWith({ raw_text: 'Test SMS' });
      expect(res.status).toBe('CREATED');
      expect(offlineQueue.getPendingCount()).toBe(0);

      unmount();
    });

    it('falls back to offline queue when offline or 500 server error', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });

      const { result, unmount } = renderHookWithQuery(() => useParseSyncText());

      let res: any;
      await act(async () => {
        res = await result.current.mutateAsync({ raw_text: 'Sent Rs 200 to Chai' });
      });

      expect(res).toEqual({
        status: 'QUEUED',
        action: 'OFFLINE_QUEUED',
        transaction: null,
      });
      expect(offlineQueue.getPendingCount()).toBe(1);
      expect(offlineQueue.getAll()[0].type).toBe('PARSE_SMS');

      unmount();
    });
  });
});
