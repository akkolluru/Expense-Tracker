import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InboxView } from '../InboxView';
import { Transaction } from '../../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('InboxView Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  const mockTransaction: Transaction = {
    id: 'tx-unverified-1',
    amount: 620,
    type: 'DEBIT',
    merchant: 'Zomato Midnight Bites',
    upiVpa: 'zomatopay@icici',
    category: 'Uncategorized',
    date: '2026-08-31',
    time: '11:45 PM',
    paymentMethod: 'UPI_GPAY',
    accountNumberMasked: 'HDFC Bank **4590',
    isVerified: false,
    aiConfidence: 92,
    aiSuggestedCategory: 'Food & Dining',
  };

  it('renders selective learning checkbox with default true and passes it on confirm', () => {
    const handleVerify = vi.fn();
    const handleSplit = vi.fn();
    const handleReset = vi.fn();

    const root = createRoot(container);
    act(() => {
      root.render(
        <InboxView
          unverifiedTransactions={[mockTransaction]}
          onVerifyTransaction={handleVerify}
          onOpenSplitDrawer={handleSplit}
          onResetInbox={handleReset}
        />
      );
    });

    const checkbox = container.querySelector<HTMLInputElement>('#checkbox-learn-merchant');
    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(true);

    const confirmBtn = container.querySelector<HTMLButtonElement>('#btn-confirm-verify');
    expect(confirmBtn).not.toBeNull();

    act(() => {
      confirmBtn?.click();
    });

    expect(handleVerify).toHaveBeenCalledWith('tx-unverified-1', 'Food & Dining', true);
  });

  it('allows unchecking selective learning and passes false on confirm', () => {
    const handleVerify = vi.fn();
    const handleSplit = vi.fn();
    const handleReset = vi.fn();

    const root = createRoot(container);
    act(() => {
      root.render(
        <InboxView
          unverifiedTransactions={[mockTransaction]}
          onVerifyTransaction={handleVerify}
          onOpenSplitDrawer={handleSplit}
          onResetInbox={handleReset}
        />
      );
    });

    const checkbox = container.querySelector<HTMLInputElement>('#checkbox-learn-merchant');
    expect(checkbox).not.toBeNull();

    act(() => {
      checkbox?.click();
    });

    expect(checkbox?.checked).toBe(false);

    const confirmBtn = container.querySelector<HTMLButtonElement>('#btn-confirm-verify');
    act(() => {
      confirmBtn?.click();
    });

    expect(handleVerify).toHaveBeenCalledWith('tx-unverified-1', 'Food & Dining', false);
  });
});
