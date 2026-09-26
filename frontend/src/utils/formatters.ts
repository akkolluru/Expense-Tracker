/**
 * Formatting and parsing helpers for Indian Financial & UPI data
 */

import { ExpenseCategory, PaymentMethod, Transaction } from '../types';

/**
 * Format numbers according to the Indian Numbering System (Lakhs & Crores)
 * e.g. 185000 -> "₹1,85,000.00"
 */
export function formatINR(amount: number, showDecimals: boolean = true): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(absAmount);

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Compact Indian currency formatting (e.g. ₹1.85L, ₹24.5K)
 */
export function formatINRCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  if (abs >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}k`;
  }
  return `₹${amount.toFixed(0)}`;
}

/**
 * Format payment method into clean brand badges
 */
export function getPaymentMethodLabel(method: PaymentMethod): { label: string; bg: string; text: string } {
  switch (method) {
    case 'UPI_GPAY':
      return { label: 'Google Pay', bg: 'bg-[#163832] border-[#235347]', text: 'text-[#DAF1DE]' };
    case 'UPI_PHONEPE':
      return { label: 'PhonePe', bg: 'bg-[#163832] border-[#235347]', text: 'text-[#DAF1DE]' };
    case 'UPI_PAYTM':
      return { label: 'Paytm', bg: 'bg-[#163832] border-[#235347]', text: 'text-[#DAF1DE]' };
    case 'UPI_CRED':
      return { label: 'CRED UPI', bg: 'bg-[#163832] border-[#235347]', text: 'text-[#DAF1DE]' };
    case 'HDFC_CC':
      return { label: 'HDFC Card', bg: 'bg-[#163832] border-[#235347]', text: 'text-[#DAF1DE]' };
    case 'ICICI_DEBIT':
      return { label: 'ICICI Debit', bg: 'bg-[#163832] border-[#235347]', text: 'text-[#DAF1DE]' };
    case 'SBI_NETBANKING':
      return { label: 'SBI NetBanking', bg: 'bg-[#163832] border-[#235347]', text: 'text-[#DAF1DE]' };
    case 'CASH':
      return { label: 'Cash', bg: 'bg-[#163832] border-[#235347]', text: 'text-[#8EB69B]' };
    default:
      return { label: 'UPI / Digital', bg: 'bg-[#163832] border-[#235347]', text: 'text-[#8EB69B]' };
  }
}

/**
 * Intelligent client-side heuristic parser for Indian Bank and UPI SMS messages
 */
export function parseBankSms(smsText: string): Partial<Transaction> {
  const result: Partial<Transaction> = {
    rawSmsSnippet: smsText,
    type: 'DEBIT',
    isVerified: false,
    aiConfidence: 75,
    category: 'Uncategorized',
  };

  // 1. Check if credit or debit
  if (/credited|received|salary|refund|deposited/i.test(smsText)) {
    result.type = 'CREDIT';
    result.category = 'Salary & Income';
    result.aiConfidence = 95;
  } else {
    result.type = 'DEBIT';
  }

  // 2. Extract Amount (e.g. Rs. 450.00, INR 1,280.00, Rs 349.00)
  const amountMatch = smsText.match(/(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)/i);
  if (amountMatch && amountMatch[1]) {
    const rawNum = amountMatch[1].replace(/,/g, '');
    result.amount = parseFloat(rawNum);
  }

  // 3. Extract Bank Account or Card mask (e.g. A/C **4590, ending 1092, A/C *5678)
  const acctMatch = smsText.match(/(?:A\/C|ending|card ending|account)\s*[*xX]*(\d{4})/i);
  if (acctMatch && acctMatch[1]) {
    result.accountNumberMasked = `A/C **${acctMatch[1]}`;
  } else {
    result.accountNumberMasked = 'Primary UPI Account';
  }

  // 4. Extract UPI VPA (e.g. zeptonow@axisbank, swiggy@icici, uber.india@axisbank)
  const vpaMatch = smsText.match(/[\w.-]+@[\w.-]+/i);
  if (vpaMatch) {
    result.upiVpa = vpaMatch[0].toLowerCase();
  }

  // 5. Merchant extraction and categorization heuristics
  const lower = smsText.toLowerCase();

  if (lower.includes('swiggy') || lower.includes('zomato') || lower.includes('mcdonald') || lower.includes('starbucks') || lower.includes('blue tokai') || lower.includes('dineout')) {
    result.merchant = lower.includes('swiggy') ? 'Swiggy' : lower.includes('zomato') ? 'Zomato' : 'Restaurant & Dining';
    result.aiSuggestedCategory = 'Food & Dining';
    result.aiConfidence = 95;
    result.paymentMethod = 'UPI_PHONEPE';
  } else if (lower.includes('zepto') || lower.includes('blinkit') || lower.includes('instamart') || lower.includes('bigbasket') || lower.includes('nature basket')) {
    result.merchant = lower.includes('zepto') ? 'Zepto Quick Grocery' : lower.includes('blinkit') ? 'Blinkit Instant Mart' : 'Grocery Quick-Commerce';
    result.aiSuggestedCategory = 'Groceries & Quick-Commerce';
    result.aiConfidence = 96;
    result.paymentMethod = 'UPI_GPAY';
  } else if (lower.includes('uber') || lower.includes('ola') || lower.includes('rapido') || lower.includes('irctc') || lower.includes('metro')) {
    result.merchant = lower.includes('uber') ? 'Uber India' : lower.includes('ola') ? 'Ola Cabs' : 'Transit / Rail';
    result.aiSuggestedCategory = 'Transportation';
    result.aiConfidence = 92;
    result.paymentMethod = 'UPI_CRED';
  } else if (lower.includes('amazon') || lower.includes('flipkart') || lower.includes('myntra') || lower.includes('reliance digital') || lower.includes('zara')) {
    result.merchant = lower.includes('amazon') ? 'Amazon India' : lower.includes('reliance digital') ? 'Reliance Digital' : 'E-Commerce / Retail';
    result.aiSuggestedCategory = 'Shopping & E-Commerce';
    result.aiConfidence = 90;
    result.paymentMethod = 'HDFC_CC';
  } else if (lower.includes('bescom') || lower.includes('airtel') || lower.includes('jio') || lower.includes('electricity') || lower.includes('bill')) {
    result.merchant = lower.includes('bescom') ? 'Bescom Electricity' : lower.includes('airtel') ? 'Airtel Broadband' : 'Utility Provider';
    result.aiSuggestedCategory = 'Utilities & Bills';
    result.aiConfidence = 94;
    result.paymentMethod = 'UPI_PHONEPE';
  } else if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('prime') || lower.includes('hotstar') || lower.includes('bookmyshow')) {
    result.merchant = lower.includes('netflix') ? 'Netflix India' : lower.includes('spotify') ? 'Spotify' : 'Entertainment & OTT';
    result.aiSuggestedCategory = 'Entertainment & Subscriptions';
    result.aiConfidence = 98;
    result.paymentMethod = 'HDFC_CC';
  } else if (lower.includes('salary') || lower.includes('razorpay') || lower.includes('infosys') || lower.includes('tcs') || lower.includes('google')) {
    result.merchant = 'Corporate Payroll Credit';
    result.aiSuggestedCategory = 'Salary & Income';
    result.category = 'Salary & Income';
    result.type = 'CREDIT';
    result.aiConfidence = 100;
    result.paymentMethod = 'SBI_NETBANKING';
  } else {
    // Generic fallback
    const toMatch = smsText.match(/(?:to|at|info:)\s*([A-Za-z0-9\s.]+?)(?:\s+UPI|\s+on|\s+ref|\s+dated|$)/i);
    result.merchant = toMatch ? toMatch[1].trim() : 'UPI Merchant Transfer';
    result.aiSuggestedCategory = 'Uncategorized';
    result.aiConfidence = 50;
    result.paymentMethod = 'UPI_GPAY';
  }

  // 6. Generate reference ID
  const refMatch = smsText.match(/(?:ref|ref no|txnid|txn)\s*:?\s*([A-Za-z0-9]+)/i);
  if (refMatch) {
    result.referenceId = `REF/${refMatch[1]}`;
  }

  return result;
}
