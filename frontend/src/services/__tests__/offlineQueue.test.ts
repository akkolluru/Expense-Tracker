import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  offlineQueue,
  generateUUID,
  OfflineQueueManager,
  KeyValueStorage,
  getSafeStorage,
  MAX_RETRY_LIMIT,
  hasReachedMaxRetries,
} from '../offlineQueue';
import { PaisaIQApiClient } from '../api';

describe('offlineQueue & OfflineQueueManager', () => {
  let memoryStorage: KeyValueStorage;
  let testQueue: OfflineQueueManager;
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map<string, string>();
    memoryStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    testQueue = new OfflineQueueManager(memoryStorage);
  });

  it('generates valid UUID format', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('enqueues a CREATE_TRANSACTION action with idempotency key', () => {
    const action = testQueue.enqueue({
      type: 'CREATE_TRANSACTION',
      payload: {
        account_id: 1,
        amount: 250,
        merchant_name: 'Chai Point',
        timestamp: '2026-10-05T12:00:00Z',
      },
    });

    expect(action.id).toBeDefined();
    expect(action.idempotencyKey).toBeDefined();
    expect(action.status).toBe('PENDING');
    expect(action.type).toBe('CREATE_TRANSACTION');
    if (action.type === 'CREATE_TRANSACTION') {
      expect(action.payload.idempotency_key).toBe(action.idempotencyKey);
    }

    expect(testQueue.getPendingCount()).toBe(1);
  });

  it('enqueues PARSE_SMS and APPROVE_INBOX actions with custom or generated idempotency keys', () => {
    const smsAction = testQueue.enqueue({
      type: 'PARSE_SMS',
      payload: { raw_text: 'Debited INR 500 at Swiggy' },
      idempotencyKey: 'custom-sms-key-1',
    });
    expect(smsAction.idempotencyKey).toBe('custom-sms-key-1');
    expect(smsAction.type).toBe('PARSE_SMS');

    const approveAction = testQueue.enqueue({
      type: 'APPROVE_INBOX',
      payload: { txId: 99, data: { category_id: 4, learn_merchant: true } },
    });
    expect(approveAction.idempotencyKey).toBeDefined();
    expect(approveAction.type).toBe('APPROVE_INBOX');
    expect(testQueue.getPendingCount()).toBe(2);
  });

  it('notifies subscribers on enqueue, remove, and clear', () => {
    const listener = vi.fn();
    const unsubscribe = testQueue.subscribe(listener);

    expect(listener).toHaveBeenCalledWith([]);

    const item = testQueue.enqueue({
      type: 'PARSE_SMS',
      payload: {
        raw_text: 'Sent Rs 500 to Swiggy from HDFC Bank ac **1234',
      },
    });

    expect(listener).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: item.id })])
    );

    testQueue.remove(item.id);
    expect(testQueue.getPendingCount()).toBe(0);

    testQueue.enqueue({
      type: 'PARSE_SMS',
      payload: { raw_text: 'Sample' },
    });
    expect(testQueue.getPendingCount()).toBe(1);

    testQueue.clear();
    expect(testQueue.getPendingCount()).toBe(0);
    expect(testQueue.getAll()).toEqual([]);

    unsubscribe();
  });

  it('flushes pending actions successfully across multiple types', async () => {
    const mockClient = {
      createTransaction: vi.fn().mockResolvedValue({ id: 10 }),
      parseSyncText: vi.fn().mockResolvedValue({ status: 'CREATED' }),
      approveInboxItem: vi.fn().mockResolvedValue({ id: 20 }),
    } as unknown as PaisaIQApiClient;

    testQueue.enqueue({
      type: 'CREATE_TRANSACTION',
      payload: {
        account_id: 1,
        amount: 120,
        merchant_name: 'Metro Ticket',
        timestamp: '2026-10-05T10:00:00Z',
      },
    });

    testQueue.enqueue({
      type: 'PARSE_SMS',
      payload: { raw_text: 'Test SMS' },
    });

    testQueue.enqueue({
      type: 'APPROVE_INBOX',
      payload: { txId: 20, data: { category_id: 1 } },
    });

    expect(testQueue.getPendingCount()).toBe(3);

    const result = await testQueue.flush(mockClient);

    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.remaining).toBe(0);
    expect(mockClient.createTransaction).toHaveBeenCalledTimes(1);
    expect(mockClient.parseSyncText).toHaveBeenCalledTimes(1);
    expect(mockClient.approveInboxItem).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Edge Case: Corrupted JSON in localStorage
  // -------------------------------------------------------------------------

  it('handles corrupted JSON syntax in storage without throwing', () => {
    const corruptStorage: KeyValueStorage = {
      getItem: () => '{ invalid: json syntax [}',
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const queue = new OfflineQueueManager(corruptStorage);
    expect(queue.getAll()).toEqual([]);
    expect(queue.getPendingCount()).toBe(0);
    warnSpy.mockRestore();
  });

  it('handles non-array stored data (strings, numbers, objects) safely', () => {
    const objectStorage: KeyValueStorage = {
      getItem: () => '{"notAnArray": true}',
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    const queue = new OfflineQueueManager(objectStorage);
    expect(queue.getAll()).toEqual([]);
    expect(queue.getPendingCount()).toBe(0);
  });

  it('resets interrupted SYNCING items to PENDING on loadFromStorage', () => {
    const savedQueue = [
      {
        id: 'tx-1',
        idempotencyKey: 'idemp-1',
        type: 'CREATE_TRANSACTION',
        payload: { account_id: 1, amount: 100, merchant_name: 'Cafe', timestamp: '2026-10-05' },
        createdAt: '2026-10-05T00:00:00Z',
        status: 'SYNCING',
        retryCount: 0,
      },
    ];

    const storageWithSyncing: KeyValueStorage = {
      getItem: () => JSON.stringify(savedQueue),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    const queue = new OfflineQueueManager(storageWithSyncing);
    expect(queue.getPendingCount()).toBe(1);
    expect(queue.getAll()[0].status).toBe('PENDING');
  });

  // -------------------------------------------------------------------------
  // Edge Case: Storage Fallback & Quota Exceeded Handling
  // -------------------------------------------------------------------------

  it('falls back to memory store when window.localStorage throws on write', () => {
    const originalLocalStorage = window.localStorage;

    // Simulate quota exceeded
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: () => {
          throw new DOMException('QuotaExceededError');
        },
        removeItem: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const safe = getSafeStorage();
    expect(safe).toBeDefined();

    // Verify safe memory storage operations work without crashing
    safe.setItem('key1', 'value1');
    expect(safe.getItem('key1')).toBe('value1');
    safe.removeItem('key1');
    expect(safe.getItem('key1')).toBeNull();

    // Restore original
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it('handles saveToStorage quota exceptions gracefully without crashing queue operations', () => {
    const throwingStorage: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('Quota exceeded');
      },
      removeItem: vi.fn(),
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const queue = new OfflineQueueManager(throwingStorage);

    // Enqueue should not throw despite storage error
    expect(() => {
      queue.enqueue({
        type: 'PARSE_SMS',
        payload: { raw_text: 'Test' },
      });
    }).not.toThrow();

    expect(queue.getPendingCount()).toBe(1);
    errorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Edge Case: Partial queue flush failures & retry limit
  // -------------------------------------------------------------------------

  it('handles partial queue flush failure: 1st succeeds, 2nd fails with network drop, flush halts', async () => {
    const mockClient = {
      createTransaction: vi.fn().mockImplementation((payload) => {
        if (payload.merchant_name === 'First Merchant') {
          return Promise.resolve({ id: 1 });
        }
        // Second merchant fails with network drop (no HTTP status code)
        return Promise.reject(new Error('Network connection lost'));
      }),
      parseSyncText: vi.fn(),
      approveInboxItem: vi.fn(),
    } as unknown as PaisaIQApiClient;

    // 1st action: Will succeed
    testQueue.enqueue({
      type: 'CREATE_TRANSACTION',
      payload: {
        account_id: 1,
        amount: 100,
        merchant_name: 'First Merchant',
        timestamp: '2026-10-05T10:00:00Z',
      },
    });

    // 2nd action: Will fail with network drop
    testQueue.enqueue({
      type: 'CREATE_TRANSACTION',
      payload: {
        account_id: 1,
        amount: 200,
        merchant_name: 'Second Merchant',
        timestamp: '2026-10-05T10:01:00Z',
      },
    });

    // 3rd action: Will remain unattempted because 2nd failed with network drop
    testQueue.enqueue({
      type: 'CREATE_TRANSACTION',
      payload: {
        account_id: 1,
        amount: 300,
        merchant_name: 'Third Merchant',
        timestamp: '2026-10-05T10:02:00Z',
      },
    });

    expect(testQueue.getPendingCount()).toBe(3);

    const result = await testQueue.flush(mockClient);

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.remaining).toBe(1); // 3rd item is still PENDING

    const allItems = testQueue.getAll();
    expect(allItems).toHaveLength(2); // 1st was removed

    const failedItem = allItems.find((i) => (i.payload as any).merchant_name === 'Second Merchant');
    expect(failedItem?.status).toBe('FAILED');
    expect(failedItem?.retryCount).toBe(1);
    expect(failedItem?.lastError).toBe('Network connection lost');

    const pendingItem = allItems.find((i) => (i.payload as any).merchant_name === 'Third Merchant');
    expect(pendingItem?.status).toBe('PENDING');

    // 3rd transaction was never called because loop broke
    expect(mockClient.createTransaction).toHaveBeenCalledTimes(2);
  });

  it('enforces retry limit and allows manual retryAction and retryFailed', async () => {
    const item = testQueue.enqueue({
      type: 'PARSE_SMS',
      payload: { raw_text: 'Failed parse' },
    });

    // Simulate 3 failures
    const mockClient = {
      parseSyncText: vi.fn().mockRejectedValue({ status: 500, message: 'Server 500' }),
    } as unknown as PaisaIQApiClient;

    for (let i = 0; i < MAX_RETRY_LIMIT; i++) {
      testQueue.retryFailed(MAX_RETRY_LIMIT);
      await testQueue.flush(mockClient);
    }

    const failed = testQueue.getFailed();
    expect(failed).toHaveLength(1);
    expect(failed[0].retryCount).toBe(3);
    expect(hasReachedMaxRetries(failed[0])).toBe(true);

    // retryFailed will now refuse to re-enqueue because max retries reached
    const retriedCount = testQueue.retryFailed(MAX_RETRY_LIMIT);
    expect(retriedCount).toBe(0);
    expect(testQueue.getPendingCount()).toBe(0);

    // Explicit manual retry resets retry count and makes it PENDING again
    const manualSuccess = testQueue.retryAction(item.id);
    expect(manualSuccess).toBe(true);
    expect(testQueue.getPendingCount()).toBe(1);
    expect(testQueue.getAll()[0].retryCount).toBe(0);
    expect(testQueue.getAll()[0].status).toBe('PENDING');
  });

  it('continues flush when encountering client 4xx validation errors (non-network failure)', async () => {
    const mockClient = {
      createTransaction: vi
        .fn()
        .mockRejectedValueOnce({ status: 400, message: 'Invalid category' })
        .mockResolvedValueOnce({ id: 2 }),
      parseSyncText: vi.fn(),
      approveInboxItem: vi.fn(),
    } as unknown as PaisaIQApiClient;

    testQueue.enqueue({
      type: 'CREATE_TRANSACTION',
      payload: { account_id: 1, amount: 10, merchant_name: 'Invalid', timestamp: '2026-10-05' },
    });

    testQueue.enqueue({
      type: 'CREATE_TRANSACTION',
      payload: { account_id: 1, amount: 20, merchant_name: 'Valid', timestamp: '2026-10-05' },
    });

    const result = await testQueue.flush(mockClient);

    // 1 failed with 400, but 2nd proceeded and succeeded
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.remaining).toBe(0);
    expect(mockClient.createTransaction).toHaveBeenCalledTimes(2);
  });

  it('protects against concurrent simultaneous flush calls', async () => {
    let resolveFirst: () => void;
    const slowClient = {
      createTransaction: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFirst = () => resolve({ id: 1 });
          })
      ),
    } as unknown as PaisaIQApiClient;

    testQueue.enqueue({
      type: 'CREATE_TRANSACTION',
      payload: { account_id: 1, amount: 50, merchant_name: 'Quick', timestamp: '2026-10-05' },
    });

    const flush1Promise = testQueue.flush(slowClient);
    // Call flush again while flush1 is active
    const flush2Result = await testQueue.flush(slowClient);

    expect(flush2Result.succeeded).toBe(0);
    expect(flush2Result.failed).toBe(0);

    // Resolve first
    resolveFirst!();
    const flush1Result = await flush1Promise;
    expect(flush1Result.succeeded).toBe(1);
  });
});
