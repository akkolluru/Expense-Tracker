import { describe, it, expect } from 'vitest';
import {
  safeParseFloat,
  normalizeConfidence,
  parseTimestamp,
  mapTransactionResponseToUi,
  mapInboxItemToUi,
  mapSummaryToCashFlow,
  mapCategoryBreakdownToUi,
  mapUiSplitsToPeerSplitDto,
} from '../adapters';
import {
  TransactionResponse,
  InboxItemResponse,
  SummaryResponse,
  CategoryBreakdownItem,
} from '../../services/api';
import { SplitMember } from '../../types';

describe('adapters utility functions', () => {
  describe('safeParseFloat', () => {
    it('parses numeric values and strings correctly', () => {
      expect(safeParseFloat(123.45)).toBe(123.45);
      expect(safeParseFloat('123.45')).toBe(123.45);
      expect(safeParseFloat('0')).toBe(0);
      expect(safeParseFloat(0)).toBe(0);
      expect(safeParseFloat('-50.25')).toBe(-50.25);
    });

    it('returns fallback for null, undefined, or NaN values', () => {
      expect(safeParseFloat(null)).toBe(0);
      expect(safeParseFloat(undefined)).toBe(0);
      expect(safeParseFloat('invalid', 42)).toBe(42);
      expect(safeParseFloat(NaN, 10)).toBe(10);
    });
  });

  describe('normalizeConfidence', () => {
    it('normalizes 0-1 scale to 0-100', () => {
      expect(normalizeConfidence(0.92)).toBe(92);
      expect(normalizeConfidence(0.855)).toBe(86);
      expect(normalizeConfidence(1)).toBe(100);
      expect(normalizeConfidence(0)).toBe(0);
    });

    it('preserves existing 0-100 values and caps at 100', () => {
      expect(normalizeConfidence(95)).toBe(95);
      expect(normalizeConfidence(120)).toBe(100);
      expect(normalizeConfidence(-10)).toBe(0);
    });
  });

  describe('parseTimestamp', () => {
    it('extracts date and time from standard ISO strings', () => {
      const res = parseTimestamp('2026-08-31T14:30:00Z');
      expect(res.date).toBe('2026-08-31');
      expect(res.time).toBe('02:30 PM');
    });

    it('extracts morning AM times correctly', () => {
      const res = parseTimestamp('2026-08-31T09:15:00');
      expect(res.date).toBe('2026-08-31');
      expect(res.time).toBe('09:15 AM');
    });

    it('handles date-only or missing timestamp gracefully', () => {
      expect(parseTimestamp('2026-08-15')).toEqual({ date: '2026-08-15', time: '12:00 PM' });
      expect(parseTimestamp(null)).toEqual({ date: '2026-08-31', time: '12:00 PM' });
      expect(parseTimestamp(undefined)).toEqual({ date: '2026-08-31', time: '12:00 PM' });
    });
  });

  describe('mapTransactionResponseToUi', () => {
    const categoryMap: Record<number, string> = {
      1: 'Food & Dining',
      2: 'Groceries & Quick-Commerce',
      3: 'Transportation',
    };

    it('correctly maps a full TransactionResponse to UI Transaction', () => {
      const apiTx: TransactionResponse = {
        id: 101,
        account_id: 1,
        category_id: 1,
        suggested_category_id: 2,
        amount: '620.50',
        currency: 'INR',
        is_expense: true,
        is_transfer: false,
        is_settlement: false,
        status: 'POSTED',
        merchant_name: 'Zomato Midnight Bites',
        merchant_vpa: 'zomato@icici',
        reference_number: 'REF12345',
        description: 'Late dinner',
        categorization_strategy: 'RULE_EXACT',
        categorization_confidence: 0.95,
        timestamp: '2026-08-31T23:45:00',
        peer_splits: [
          {
            id: 1,
            transaction_id: 101,
            member_name: 'Alice',
            share_amount: '310.25',
            upi_id: 'alice@upi',
            is_paid: true,
          },
        ],
      };

      const uiTx = mapTransactionResponseToUi(apiTx, categoryMap);

      expect(uiTx.id).toBe('101');
      expect(uiTx.amount).toBe(620.5);
      expect(uiTx.type).toBe('DEBIT');
      expect(uiTx.merchant).toBe('Zomato Midnight Bites');
      expect(uiTx.upiVpa).toBe('zomato@icici');
      expect(uiTx.category).toBe('Food & Dining');
      expect(uiTx.aiSuggestedCategory).toBe('Groceries & Quick-Commerce');
      expect(uiTx.isVerified).toBe(true);
      expect(uiTx.aiConfidence).toBe(95);
      expect(uiTx.accountNumberMasked).toBe('Account #1');
      expect(uiTx.notes).toBe('Late dinner');
      expect(uiTx.referenceId).toBe('REF12345');
      expect(uiTx.splitDetails).toHaveLength(1);
      expect(uiTx.splitDetails?.[0]).toEqual({
        id: '1',
        name: 'Alice',
        upiId: 'alice@upi',
        shareAmount: 310.25,
        isPaid: true,
      });
    });

    it('handles unverified transactions and unmapped categories', () => {
      const apiTx: TransactionResponse = {
        id: 102,
        account_id: 0,
        category_id: null,
        amount: 1500,
        currency: 'INR',
        is_expense: false,
        is_transfer: false,
        is_settlement: false,
        status: 'PENDING_REVIEW',
        merchant_name: '',
        categorization_strategy: 'UNSET',
        categorization_confidence: 0,
        timestamp: '',
      };

      const uiTx = mapTransactionResponseToUi(apiTx);

      expect(uiTx.id).toBe('102');
      expect(uiTx.amount).toBe(1500);
      expect(uiTx.type).toBe('CREDIT');
      expect(uiTx.merchant).toBe('Unknown Merchant');
      expect(uiTx.category).toBe('Uncategorized');
      expect(uiTx.isVerified).toBe(false);
      expect(uiTx.aiConfidence).toBe(0);
      expect(uiTx.accountNumberMasked).toBe('Account **0000');
      expect(uiTx.splitDetails).toBeUndefined();
    });

    it('throws error when transaction input is missing', () => {
      expect(() => mapTransactionResponseToUi(null as unknown as TransactionResponse)).toThrow();
    });
  });

  describe('mapInboxItemToUi', () => {
    it('maps an InboxItemResponse to an unverified UI Transaction', () => {
      const item: InboxItemResponse = {
        id: 201,
        amount: '380.00',
        merchant_name: 'Uber Premier Ride',
        merchant_vpa: 'uber.india@axisbank',
        timestamp: '2026-08-31T19:15:00',
        suggested_category: {
          id: 3,
          name: 'Transportation',
        },
        confidence: 0.89,
        reasoning: 'Debited via PhonePe UPI to UBER INDIA',
      };

      const uiTx = mapInboxItemToUi(item);

      expect(uiTx.id).toBe('201');
      expect(uiTx.amount).toBe(380);
      expect(uiTx.type).toBe('DEBIT');
      expect(uiTx.merchant).toBe('Uber Premier Ride');
      expect(uiTx.upiVpa).toBe('uber.india@axisbank');
      expect(uiTx.category).toBe('Uncategorized');
      expect(uiTx.aiSuggestedCategory).toBe('Transportation');
      expect(uiTx.isVerified).toBe(false);
      expect(uiTx.aiConfidence).toBe(89);
      expect(uiTx.rawSmsSnippet).toBe('Debited via PhonePe UPI to UBER INDIA');
    });

    it('handles null or missing optional properties', () => {
      const item: InboxItemResponse = {
        id: 202,
        amount: 0,
        merchant_name: '',
        timestamp: '',
        suggested_category: null,
        confidence: 0,
      };

      const uiTx = mapInboxItemToUi(item);
      expect(uiTx.merchant).toBe('Unknown Merchant');
      expect(uiTx.aiSuggestedCategory).toBeUndefined();
      expect(uiTx.rawSmsSnippet).toBeUndefined();
    });

    it('throws error when inbox item input is missing', () => {
      expect(() => mapInboxItemToUi(null as unknown as InboxItemResponse)).toThrow();
    });
  });

  describe('mapSummaryToCashFlow', () => {
    it('computes cash flow summary correctly from backend SummaryResponse', () => {
      const summary: SummaryResponse = {
        income: 200000,
        burn_rate: 1500,
        savings_rate: 75,
      };

      const res = mapSummaryToCashFlow(summary, 2, 1000);

      expect(res.monthIncome).toBe(200000);
      expect(res.dailyBurnRate).toBe(1500);
      expect(res.monthSpend).toBe(46500); // 1500 * 31
      expect(res.projectedMonthEnd).toBe(48825); // 46500 * 1.05
      expect(res.savingsRatePercent).toBe(75);
      expect(res.unverifiedCount).toBe(2);
      expect(res.unverifiedAmount).toBe(1000);
      expect(res.totalBalance).toBe(217420.5); // 200000 - 46500 + 63920.50
    });

    it('uses fallbackBalance when provided', () => {
      const summary: SummaryResponse = {
        income: 200000,
        burn_rate: 1500,
        savings_rate: 75,
      };

      const res = mapSummaryToCashFlow(summary, 0, 0, 300000);
      expect(res.totalBalance).toBe(300000);
    });

    it('handles undefined summary gracefully with defaults', () => {
      const res = mapSummaryToCashFlow(undefined, 3, '1500.50' as unknown as number);

      expect(res.monthIncome).toBe(185000);
      expect(res.monthSpend).toBe(0);
      expect(res.dailyBurnRate).toBe(0);
      expect(res.projectedMonthEnd).toBe(0);
      expect(res.savingsRatePercent).toBe(70);
      expect(res.unverifiedCount).toBe(3);
      expect(res.unverifiedAmount).toBe(1500.5);
      expect(res.totalBalance).toBe(248920.5); // 185000 + 63920.50
    });
  });

  describe('mapCategoryBreakdownToUi', () => {
    it('calculates percentage shares correctly for categories', () => {
      const items: CategoryBreakdownItem[] = [
        { category_id: 1, name: 'Food & Dining', icon: 'Utensils', color: '#DAF1DE', amount: 300 },
        { category_id: 2, name: 'Transportation', icon: 'Car', color: '#5BA88C', amount: 700 },
      ];

      const res = mapCategoryBreakdownToUi(items);

      expect(res).toHaveLength(2);
      expect(res[0].category).toBe('Food & Dining');
      expect(res[0].amount).toBe(300);
      expect(res[0].percentage).toBe(30);
      expect(res[1].category).toBe('Transportation');
      expect(res[1].amount).toBe(700);
      expect(res[1].percentage).toBe(70);
    });

    it('returns empty array when input is empty or invalid', () => {
      expect(mapCategoryBreakdownToUi([])).toEqual([]);
      expect(mapCategoryBreakdownToUi(null as unknown as CategoryBreakdownItem[])).toEqual([]);
    });

    it('handles zero total gracefully without dividing by zero', () => {
      const items: CategoryBreakdownItem[] = [
        { category_id: 1, name: 'Food & Dining', icon: 'Utensils', color: '#DAF1DE', amount: 0 },
      ];
      const res = mapCategoryBreakdownToUi(items);
      expect(res[0].percentage).toBe(0);
    });
  });

  describe('mapUiSplitsToPeerSplitDto', () => {
    it('maps SplitMember array to PeerSplitItemDTO array', () => {
      const splits: SplitMember[] = [
        { id: '1', name: 'Bob', upiId: 'bob@upi', shareAmount: 250, isPaid: true },
        { id: '2', name: 'Charlie', shareAmount: 150, isPaid: false },
      ];

      const dtos = mapUiSplitsToPeerSplitDto(splits);

      expect(dtos).toEqual([
        {
          member_name: 'Bob',
          share_amount: 250,
          upi_id: 'bob@upi',
          is_paid: true,
        },
        {
          member_name: 'Charlie',
          share_amount: 150,
          upi_id: null,
          is_paid: false,
        },
      ]);
    });

    it('handles empty or undefined splits', () => {
      expect(mapUiSplitsToPeerSplitDto([])).toEqual([]);
      expect(mapUiSplitsToPeerSplitDto(null as unknown as SplitMember[])).toEqual([]);
    });
  });
});
