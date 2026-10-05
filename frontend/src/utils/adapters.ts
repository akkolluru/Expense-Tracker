import {
  Transaction,
  ExpenseCategory,
  CashFlowSummary,
  CategoryBreakdownPoint,
  SplitMember,
  PaymentMethod,
  TransactionType,
} from '../types';
import {
  TransactionResponse,
  InboxItemResponse,
  SummaryResponse,
  CategoryBreakdownItem,
  PeerSplitItemDTO,
} from '../services/api';

/**
 * Safely parses string or number values into a numeric float.
 * Returns the fallback if value is null, undefined, or NaN.
 */
export function safeParseFloat(val: unknown, fallback: number = 0): number {
  if (val === null || val === undefined) {
    return fallback;
  }
  const parsed = parseFloat(String(val));
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Normalizes confidence scores into a 0-100 integer range.
 */
export function normalizeConfidence(confidence: unknown): number {
  const val = safeParseFloat(confidence, 0);
  if (val <= 0) {
    return 0;
  }
  if (val <= 1) {
    return Math.min(100, Math.round(val * 100));
  }
  return Math.min(100, Math.round(val));
}

/**
 * Safely parses date and time from an ISO timestamp string.
 */
export function parseTimestamp(timestamp?: string | null): { date: string; time: string } {
  if (!timestamp) {
    return { date: '2026-08-31', time: '12:00 PM' };
  }

  const match = String(timestamp).match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (match) {
    const date = match[1];
    if (match[2] && match[3]) {
      const hours = parseInt(match[2], 10);
      const minutes = match[3];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
      const padHours = formattedHours < 10 ? `0${formattedHours}` : `${formattedHours}`;
      return { date, time: `${padHours}:${minutes} ${ampm}` };
    }
    return { date, time: '12:00 PM' };
  }

  const dateObj = new Date(timestamp);
  if (!isNaN(dateObj.getTime())) {
    const iso = dateObj.toISOString();
    return {
      date: iso.slice(0, 10),
      time: dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    };
  }

  return { date: '2026-08-31', time: '12:00 PM' };
}

/**
 * Maps a backend TransactionResponse to the UI Transaction model.
 */
export function mapTransactionResponseToUi(
  tx: TransactionResponse,
  categoryNameMap?: Record<number, string>
): Transaction {
  if (!tx) {
    throw new Error('TransactionResponse is required');
  }

  const { date, time } = parseTimestamp(tx.timestamp);
  const amount = safeParseFloat(tx.amount, 0);
  const type: TransactionType = tx.is_expense ? 'DEBIT' : 'CREDIT';

  let category: ExpenseCategory = 'Uncategorized';
  if (tx.category_id != null && categoryNameMap && categoryNameMap[tx.category_id]) {
    category = categoryNameMap[tx.category_id] as ExpenseCategory;
  }

  let aiSuggestedCategory: ExpenseCategory | undefined = undefined;
  if (tx.suggested_category_id != null && categoryNameMap && categoryNameMap[tx.suggested_category_id]) {
    aiSuggestedCategory = categoryNameMap[tx.suggested_category_id] as ExpenseCategory;
  }

  const splitDetails: SplitMember[] | undefined =
    tx.peer_splits && tx.peer_splits.length > 0
      ? tx.peer_splits.map(ps => ({
          id: String(ps.id),
          name: ps.member_name || 'Member',
          upiId: ps.upi_id || undefined,
          shareAmount: safeParseFloat(ps.share_amount, 0),
          isPaid: Boolean(ps.is_paid),
        }))
      : undefined;

  const isVerified = tx.status !== 'PENDING_REVIEW';

  return {
    id: String(tx.id),
    amount,
    type,
    merchant: tx.merchant_name || 'Unknown Merchant',
    upiVpa: tx.merchant_vpa || undefined,
    category,
    date,
    time,
    paymentMethod: 'UPI_GPAY' as PaymentMethod,
    accountNumberMasked: tx.account_id ? `Account #${tx.account_id}` : 'Account **0000',
    isVerified,
    aiConfidence: normalizeConfidence(tx.categorization_confidence),
    aiSuggestedCategory,
    notes: tx.description || undefined,
    referenceId: tx.reference_number || undefined,
    splitDetails,
  };
}

/**
 * Maps an InboxItemResponse to an unverified UI Transaction model.
 */
export function mapInboxItemToUi(item: InboxItemResponse): Transaction {
  if (!item) {
    throw new Error('InboxItemResponse is required');
  }

  const { date, time } = parseTimestamp(item.timestamp);
  const amount = safeParseFloat(item.amount, 0);
  const suggestedCat = item.suggested_category?.name as ExpenseCategory | undefined;

  return {
    id: String(item.id),
    amount,
    type: 'DEBIT',
    merchant: item.merchant_name || 'Unknown Merchant',
    upiVpa: item.merchant_vpa || undefined,
    category: 'Uncategorized',
    date,
    time,
    paymentMethod: 'UPI_GPAY',
    accountNumberMasked: 'UPI Account',
    isVerified: false,
    aiConfidence: normalizeConfidence(item.confidence),
    aiSuggestedCategory: suggestedCat,
    rawSmsSnippet: item.reasoning || undefined,
    notes: item.reasoning || undefined,
  };
}

/**
 * Maps a backend SummaryResponse into the UI CashFlowSummary.
 */
export function mapSummaryToCashFlow(
  summary: SummaryResponse | undefined,
  unverifiedCount: number,
  unverifiedAmount: number,
  fallbackBalance?: number
): CashFlowSummary {
  const safeUnverifiedCount = Math.max(0, unverifiedCount || 0);
  const safeUnverifiedAmount = safeParseFloat(unverifiedAmount, 0);

  if (!summary) {
    const fallbackMonthIncome = 185000;
    const fallbackSpend = 0;
    return {
      totalBalance: fallbackBalance ?? (fallbackMonthIncome + 63920.50),
      monthSpend: fallbackSpend,
      monthIncome: fallbackMonthIncome,
      dailyBurnRate: 0,
      projectedMonthEnd: 0,
      savingsRatePercent: 70,
      unverifiedCount: safeUnverifiedCount,
      unverifiedAmount: safeUnverifiedAmount,
    };
  }

  const monthIncome = safeParseFloat(summary.income, 185000);
  const dailyBurnRate = safeParseFloat(summary.burn_rate, 0);
  const monthSpend = Math.round(dailyBurnRate * 31 * 100) / 100;
  const projectedMonthEnd = Math.round(monthSpend * 1.05 * 100) / 100;
  const savingsRatePercent = Math.round(safeParseFloat(summary.savings_rate, 70));

  const totalBalance = fallbackBalance !== undefined
    ? fallbackBalance
    : Math.round((monthIncome - monthSpend + 63920.50) * 100) / 100;

  return {
    totalBalance,
    monthSpend,
    monthIncome,
    dailyBurnRate,
    projectedMonthEnd,
    savingsRatePercent,
    unverifiedCount: safeUnverifiedCount,
    unverifiedAmount: safeUnverifiedAmount,
  };
}

/**
 * Maps backend CategoryBreakdownItem array to UI CategoryBreakdownPoint array with computed percentages.
 */
export function mapCategoryBreakdownToUi(items: CategoryBreakdownItem[]): CategoryBreakdownPoint[] {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return [];
  }

  const totalAmount = items.reduce((sum, item) => sum + safeParseFloat(item?.amount, 0), 0);

  return items.map(item => {
    const amount = safeParseFloat(item?.amount, 0);
    const percentage = totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0;
    return {
      category: (item?.name || 'Uncategorized') as ExpenseCategory,
      amount,
      percentage,
      color: item?.color || '#8EB69B',
      transactionCount: 0,
    };
  });
}

/**
 * Transforms UI split members into backend PeerSplitItemDTO format.
 */
export function mapUiSplitsToPeerSplitDto(splits: SplitMember[]): PeerSplitItemDTO[] {
  if (!splits || !Array.isArray(splits)) {
    return [];
  }

  return splits.map(s => ({
    member_name: s?.name || 'Anonymous',
    share_amount: safeParseFloat(s?.shareAmount, 0),
    upi_id: s?.upiId ?? null,
    is_paid: Boolean(s?.isPaid),
  }));
}
