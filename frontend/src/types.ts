/**
 * Core Types for PaisaIQ - Expense Tracker & Financial Intelligence Design System
 */

export type TransactionType = 'DEBIT' | 'CREDIT';

export type PaymentMethod = 
  | 'UPI_GPAY'
  | 'UPI_PHONEPE'
  | 'UPI_PAYTM'
  | 'UPI_CRED'
  | 'HDFC_CC'
  | 'ICICI_DEBIT'
  | 'SBI_NETBANKING'
  | 'CASH';

export type ExpenseCategory = 
  | 'Food & Dining'
  | 'Groceries & Quick-Commerce'
  | 'Transportation'
  | 'Shopping & E-Commerce'
  | 'Utilities & Bills'
  | 'Entertainment & Subscriptions'
  | 'Health & Medical'
  | 'Investments & Savings'
  | 'Salary & Income'
  | 'Uncategorized';

export interface SplitMember {
  id: string;
  name: string;
  avatar?: string;
  upiId?: string;
  shareAmount: number;
  isPaid: boolean;
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  merchant: string;
  upiVpa?: string;
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM
  paymentMethod: PaymentMethod;
  accountNumberMasked: string; // e.g. HDFC **4590
  isVerified: boolean;
  aiConfidence: number; // 0 to 100
  aiSuggestedCategory?: ExpenseCategory;
  rawSmsSnippet?: string;
  notes?: string;
  splitDetails?: SplitMember[];
  tags?: string[];
  referenceId?: string;
}

export interface CategoryMeta {
  id: ExpenseCategory;
  name: string;
  iconName: string;
  colorHex: string;
  bgTintHex: string;
  budgetMonthly: number;
  currentSpend: number;
}

export interface CashFlowSummary {
  totalBalance: number;
  monthSpend: number;
  monthIncome: number;
  dailyBurnRate: number;
  projectedMonthEnd: number;
  savingsRatePercent: number;
  unverifiedCount: number;
  unverifiedAmount: number;
}

export interface DailySpendPoint {
  date: string;
  dayLabel: string;
  amount: number;
  isWeekend?: boolean;
  peakExpenseMerchant?: string;
}

export interface CategoryBreakdownPoint {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
  color: string;
  transactionCount: number;
}

export interface SubscriptionItem {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  cycle: 'Monthly' | 'Annual';
  category: ExpenseCategory;
  iconName: string;
  paymentMode: PaymentMethod;
}

export type ViewTab = 'home' | 'inbox' | 'expenses' | 'analytics';
