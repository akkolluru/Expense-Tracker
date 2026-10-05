import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  AccountCreate,
  TransactionCreate,
  TransactionFilterParams,
  SplitItemDTO,
  PeerSplitItemDTO,
  InboxApproveRequest,
  SyncParseTextRequest,
} from '../services/api';
import { offlineQueue } from '../services/offlineQueue';

export const expenseQueryKeys = {
  health: ['system', 'health'] as const,
  accounts: ['accounts'] as const,
  categories: ['categories'] as const,
  transactions: (params?: TransactionFilterParams) => ['transactions', params] as const,
  inbox: ['inbox'] as const,
  analyticsSummary: (start: string, end: string) => ['analytics', 'summary', start, end] as const,
  analyticsCategories: (start: string, end: string) => ['analytics', 'categories', start, end] as const,
  analyticsTopSpends: (catId: number, start: string, end: string, limit?: number) =>
    ['analytics', 'top-spends', catId, start, end, limit] as const,
  analyticsMom: (cStart: string, cEnd: string, pStart: string, pEnd: string) =>
    ['analytics', 'mom', cStart, cEnd, pStart, pEnd] as const,
};

// --- Queries ---

export function useSystemHealth() {
  return useQuery({
    queryKey: expenseQueryKeys.health,
    queryFn: () => api.getSystemHealth(),
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: expenseQueryKeys.accounts,
    queryFn: () => api.listAccounts(),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: expenseQueryKeys.categories,
    queryFn: () => api.listCategories(),
  });
}

export function useTransactions(params?: TransactionFilterParams) {
  return useQuery({
    queryKey: expenseQueryKeys.transactions(params),
    queryFn: () => api.listTransactions(params),
  });
}

export function useInbox() {
  return useQuery({
    queryKey: expenseQueryKeys.inbox,
    queryFn: () => api.listInbox(),
  });
}

export function useAnalyticsSummary(startDate: string, endDate: string) {
  return useQuery({
    queryKey: expenseQueryKeys.analyticsSummary(startDate, endDate),
    queryFn: () => api.getAnalyticsSummary(startDate, endDate),
    enabled: Boolean(startDate && endDate),
  });
}

export function useAnalyticsCategories(startDate: string, endDate: string) {
  return useQuery({
    queryKey: expenseQueryKeys.analyticsCategories(startDate, endDate),
    queryFn: () => api.getAnalyticsCategories(startDate, endDate),
    enabled: Boolean(startDate && endDate),
  });
}

export function useAnalyticsTopSpends(
  categoryId: number,
  startDate: string,
  endDate: string,
  limit: number = 5
) {
  return useQuery({
    queryKey: expenseQueryKeys.analyticsTopSpends(categoryId, startDate, endDate, limit),
    queryFn: () => api.getAnalyticsTopSpends(categoryId, startDate, endDate, limit),
    enabled: Boolean(categoryId && startDate && endDate),
  });
}

export function useAnalyticsMom(
  currentStart: string,
  currentEnd: string,
  prevStart: string,
  prevEnd: string
) {
  return useQuery({
    queryKey: expenseQueryKeys.analyticsMom(currentStart, currentEnd, prevStart, prevEnd),
    queryFn: () => api.getAnalyticsMom(currentStart, currentEnd, prevStart, prevEnd),
    enabled: Boolean(currentStart && currentEnd && prevStart && prevEnd),
  });
}

// --- Mutations with Offline Queue Fallback ---

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AccountCreate) => api.createAccount(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseQueryKeys.accounts });
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TransactionCreate) => {
      // If client is explicitly offline, immediately enqueue
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const queued = offlineQueue.enqueue({
          type: 'CREATE_TRANSACTION',
          payload,
        });
        return {
          id: -Date.now(),
          account_id: payload.account_id,
          amount: payload.amount,
          currency: payload.currency || 'INR',
          is_expense: payload.is_expense ?? true,
          is_transfer: payload.is_transfer ?? false,
          is_settlement: false,
          idempotency_key: queued.idempotencyKey,
          status: 'PENDING_SYNC',
          merchant_name: payload.merchant_name,
          categorization_strategy: 'OFFLINE_QUEUED',
          categorization_confidence: 0,
          timestamp: payload.timestamp,
        };
      }

      try {
        return await api.createTransaction(payload);
      } catch (err: unknown) {
        // Network error fallback
        const status = (err as { status?: number })?.status;
        if (!status || status >= 500) {
          const queued = offlineQueue.enqueue({
            type: 'CREATE_TRANSACTION',
            payload,
          });
          return {
            id: -Date.now(),
            account_id: payload.account_id,
            amount: payload.amount,
            currency: payload.currency || 'INR',
            is_expense: payload.is_expense ?? true,
            is_transfer: payload.is_transfer ?? false,
            is_settlement: false,
            idempotency_key: queued.idempotencyKey,
            status: 'PENDING_SYNC',
            merchant_name: payload.merchant_name,
            categorization_strategy: 'OFFLINE_QUEUED',
            categorization_confidence: 0,
            timestamp: payload.timestamp,
          };
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useSplitTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ txId, splits }: { txId: number; splits: SplitItemDTO[] }) =>
      api.splitTransaction(txId, splits),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useApproveInboxItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ txId, payload }: { txId: number; payload: InboxApproveRequest }) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        offlineQueue.enqueue({
          type: 'APPROVE_INBOX',
          payload: { txId, data: payload },
        });
        return { success: true, queued: true };
      }
      try {
        return await api.approveInboxItem(txId, payload);
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (!status || status >= 500) {
          offlineQueue.enqueue({
            type: 'APPROVE_INBOX',
            payload: { txId, data: payload },
          });
          return { success: true, queued: true };
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useParseSyncText() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SyncParseTextRequest) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        offlineQueue.enqueue({
          type: 'PARSE_SMS',
          payload,
        });
        return {
          status: 'QUEUED',
          action: 'OFFLINE_QUEUED',
          transaction: null,
        };
      }
      try {
        return await api.parseSyncText(payload);
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (!status || status >= 500) {
          offlineQueue.enqueue({
            type: 'PARSE_SMS',
            payload,
          });
          return {
            status: 'QUEUED',
            action: 'OFFLINE_QUEUED',
            transaction: null,
          };
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useSetPeerSplits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ txId, splits }: { txId: number; splits: PeerSplitItemDTO[] }) =>
      api.setPeerSplits(txId, splits),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useTogglePeerSplitPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ txId, peerSplitId }: { txId: number; peerSplitId: number }) =>
      api.togglePeerSplitPaid(txId, peerSplitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

