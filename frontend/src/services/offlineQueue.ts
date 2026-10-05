/**
 * Offline Action Queue (ADR 0009)
 * Provides optimistic offline persistence with automatic replay & idempotency key stamping.
 */

import {
  api,
  PaisaIQApiClient,
  TransactionCreate,
  SyncParseTextRequest,
  InboxApproveRequest,
} from './api';

export type QueuedActionType = 'CREATE_TRANSACTION' | 'PARSE_SMS' | 'APPROVE_INBOX';

export interface BaseQueuedAction {
  id: string; // Internal queue item ID (UUID)
  idempotencyKey: string; // Sent to backend to guarantee exactly-once execution
  type: QueuedActionType;
  createdAt: string;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  retryCount: number;
  lastError?: string;
}

export interface CreateTransactionQueuedAction extends BaseQueuedAction {
  type: 'CREATE_TRANSACTION';
  payload: TransactionCreate;
}

export interface ParseSmsQueuedAction extends BaseQueuedAction {
  type: 'PARSE_SMS';
  payload: SyncParseTextRequest;
}

export interface ApproveInboxQueuedAction extends BaseQueuedAction {
  type: 'APPROVE_INBOX';
  payload: {
    txId: number;
    data: InboxApproveRequest;
  };
}

export type QueuedAction =
  | CreateTransactionQueuedAction
  | ParseSmsQueuedAction
  | ApproveInboxQueuedAction;

export interface FlushResult {
  succeeded: number;
  failed: number;
  remaining: number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear?(): void;
}

const STORAGE_KEY = 'PAISAIQ_OFFLINE_QUEUE_V1';

export function getSafeStorage(): KeyValueStorage {
  if (
    typeof window !== 'undefined' &&
    window.localStorage &&
    typeof window.localStorage.getItem === 'function' &&
    typeof window.localStorage.setItem === 'function'
  ) {
    try {
      const testKey = '__test_storage__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch {
      // Storage unavailable or quota exceeded
    }
  }

  const memoryStore = new Map<string, string>();
  return {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStore.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStore.delete(key);
    },
    clear: () => {
      memoryStore.clear();
    },
  };
}

// Cross-environment UUID v4 generator
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const MAX_RETRY_LIMIT = 3;

export function hasReachedMaxRetries(item: QueuedAction, maxRetries = MAX_RETRY_LIMIT): boolean {
  return item.retryCount >= maxRetries;
}

export interface FlushOptions {
  retryFailed?: boolean;
  maxRetries?: number;
}

export class OfflineQueueManager {
  private queue: QueuedAction[] = [];
  private listeners: Set<(queue: QueuedAction[]) => void> = new Set();
  private isFlushing = false;
  private storage: KeyValueStorage;

  constructor(storage: KeyValueStorage = getSafeStorage()) {
    this.storage = storage;
    this.loadFromStorage();
  }

  public setStorage(storage: KeyValueStorage) {
    this.storage = storage;
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = this.storage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.queue = parsed;
          // Reset any SYNCING items that were interrupted mid-flight
          this.queue.forEach((item) => {
            if (item && item.status === 'SYNCING') {
              item.status = 'PENDING';
            }
          });
          return;
        }
      }
      this.queue = [];
    } catch (err) {
      console.warn('[OfflineQueue] Failed to load from storage:', err);
      this.queue = [];
    }
  }

  private saveToStorage() {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (err) {
      console.error('[OfflineQueue] Failed to save to storage:', err);
    }
    this.notify();
  }

  private notify() {
    const snapshot = [...this.queue];
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[OfflineQueue] Listener error:', err);
      }
    });
  }

  public subscribe(listener: (queue: QueuedAction[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.queue]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getAll(): QueuedAction[] {
    return [...this.queue];
  }

  public getPending(): QueuedAction[] {
    return this.queue.filter((item) => item.status === 'PENDING' || item.status === 'SYNCING');
  }

  public getPendingCount(): number {
    return this.queue.filter((item) => item.status === 'PENDING' || item.status === 'SYNCING').length;
  }

  public getFailed(): QueuedAction[] {
    return this.queue.filter((item) => item.status === 'FAILED');
  }

  public getFailedCount(): number {
    return this.queue.filter((item) => item.status === 'FAILED').length;
  }

  public retryFailed(maxRetries: number = MAX_RETRY_LIMIT): number {
    let retried = 0;
    this.queue.forEach((item) => {
      if (item.status === 'FAILED' && item.retryCount < maxRetries) {
        item.status = 'PENDING';
        retried++;
      }
    });
    if (retried > 0) {
      this.saveToStorage();
    }
    return retried;
  }

  public retryAction(id: string): boolean {
    const item = this.queue.find((q) => q.id === id);
    if (item && item.status === 'FAILED') {
      item.status = 'PENDING';
      item.retryCount = 0;
      item.lastError = undefined;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  public enqueue(
    action:
      | { type: 'CREATE_TRANSACTION'; payload: TransactionCreate; idempotencyKey?: string }
      | { type: 'PARSE_SMS'; payload: SyncParseTextRequest; idempotencyKey?: string }
      | { type: 'APPROVE_INBOX'; payload: { txId: number; data: InboxApproveRequest }; idempotencyKey?: string }
  ): QueuedAction {
    const id = generateUUID();
    const idempotencyKey = action.idempotencyKey || generateUUID();

    let queuedItem: QueuedAction;

    if (action.type === 'CREATE_TRANSACTION') {
      queuedItem = {
        id,
        idempotencyKey,
        type: 'CREATE_TRANSACTION',
        payload: {
          ...action.payload,
          idempotency_key: idempotencyKey,
        },
        createdAt: new Date().toISOString(),
        status: 'PENDING',
        retryCount: 0,
      };
    } else if (action.type === 'PARSE_SMS') {
      queuedItem = {
        id,
        idempotencyKey,
        type: 'PARSE_SMS',
        payload: action.payload,
        createdAt: new Date().toISOString(),
        status: 'PENDING',
        retryCount: 0,
      };
    } else {
      queuedItem = {
        id,
        idempotencyKey,
        type: 'APPROVE_INBOX',
        payload: action.payload,
        createdAt: new Date().toISOString(),
        status: 'PENDING',
        retryCount: 0,
      };
    }

    this.queue.push(queuedItem);
    this.saveToStorage();
    return queuedItem;
  }

  public remove(id: string) {
    this.queue = this.queue.filter((item) => item.id !== id);
    this.saveToStorage();
  }

  public clear() {
    this.queue = [];
    if (this.storage.removeItem) {
      this.storage.removeItem(STORAGE_KEY);
    }
    this.notify();
  }

  public async flush(
    client: PaisaIQApiClient = api,
    options?: FlushOptions
  ): Promise<FlushResult> {
    if (options?.retryFailed) {
      this.retryFailed(options.maxRetries ?? MAX_RETRY_LIMIT);
    }

    if (this.isFlushing) {
      return {
        succeeded: 0,
        failed: 0,
        remaining: this.getPendingCount(),
      };
    }

    this.isFlushing = true;
    let succeeded = 0;
    let failed = 0;

    try {
      const pendingItems = this.getPending();

      for (const item of pendingItems) {
        item.status = 'SYNCING';
        this.saveToStorage();

        try {
          if (item.type === 'CREATE_TRANSACTION') {
            await client.createTransaction(item.payload, item.idempotencyKey);
          } else if (item.type === 'PARSE_SMS') {
            await client.parseSyncText(item.payload);
          } else if (item.type === 'APPROVE_INBOX') {
            await client.approveInboxItem(item.payload.txId, item.payload.data);
          }

          // Successfully executed, remove from queue
          this.queue = this.queue.filter((q) => q.id !== item.id);
          succeeded++;
          this.saveToStorage();
        } catch (err: unknown) {
          failed++;
          item.status = 'FAILED';
          item.retryCount += 1;
          item.lastError = err instanceof Error ? err.message : String(err);
          this.saveToStorage();

          // If offline error or server unreachable, halt queue flush to avoid thrashing
          const status = (err as { status?: number })?.status;
          if (!status || status >= 500) {
            break;
          }
        }
      }
    } finally {
      this.isFlushing = false;
    }

    return {
      succeeded,
      failed,
      remaining: this.getPendingCount(),
    };
  }
}

export const offlineQueue = new OfflineQueueManager();
