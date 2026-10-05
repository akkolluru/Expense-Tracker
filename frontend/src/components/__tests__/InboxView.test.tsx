import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MotionConfig } from 'motion/react';
import { InboxView } from '../InboxView';
import { Transaction } from '../../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('InboxView Component', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) {
      document.body.removeChild(container);
    }
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

  const renderComponent = (props: React.ComponentProps<typeof InboxView>) => {
    act(() => {
      root?.render(
        <MotionConfig transition={{ duration: 0 }}>
          <InboxView {...props} />
        </MotionConfig>
      );
    });
  };

  it('renders selective learning checkbox with default true and passes it on confirm', () => {
    const handleVerify = vi.fn();
    const handleSplit = vi.fn();
    const handleReset = vi.fn();

    renderComponent({
      unverifiedTransactions: [mockTransaction],
      onVerifyTransaction: handleVerify,
      onOpenSplitDrawer: handleSplit,
      onResetInbox: handleReset,
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

    renderComponent({
      unverifiedTransactions: [mockTransaction],
      onVerifyTransaction: handleVerify,
      onOpenSplitDrawer: handleSplit,
      onResetInbox: handleReset,
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

  it('renders 3 minimal tactile symbol action buttons without text labels', () => {
    renderComponent({
      unverifiedTransactions: [mockTransaction],
      onVerifyTransaction: vi.fn(),
      onOpenSplitDrawer: vi.fn(),
      onResetInbox: vi.fn(),
    });

    const reclassifyBtn = container.querySelector<HTMLButtonElement>('#btn-reclassify');
    const splitBtn = container.querySelector<HTMLButtonElement>('#btn-split-inbox');
    const confirmBtn = container.querySelector<HTMLButtonElement>('#btn-confirm-verify');

    expect(reclassifyBtn).not.toBeNull();
    expect(splitBtn).not.toBeNull();
    expect(confirmBtn).not.toBeNull();

    // Verify accessible labels exist
    expect(reclassifyBtn?.getAttribute('aria-label')).toBe('Reclassify / Change Category');
    expect(splitBtn?.getAttribute('aria-label')).toBe('Split Bill with Friends');
    expect(splitBtn?.getAttribute('title')).toBe('Split Bill with Friends');
    expect(confirmBtn?.getAttribute('aria-label')).toBe('Confirm AI Category');

    // Verify buttons are tactile symbols only (no text label inside per User Decision 2A)
    expect(reclassifyBtn?.textContent?.trim()).toBe('');
    expect(splitBtn?.textContent?.trim()).toBe('');
    expect(confirmBtn?.textContent?.trim()).toBe('');
  });

  it('triggers onOpenSplitDrawer with current transaction when center split button is clicked', () => {
    const handleSplit = vi.fn();
    renderComponent({
      unverifiedTransactions: [mockTransaction],
      onVerifyTransaction: vi.fn(),
      onOpenSplitDrawer: handleSplit,
      onResetInbox: vi.fn(),
    });

    const splitBtn = container.querySelector<HTMLButtonElement>('#btn-split-inbox');
    act(() => {
      splitBtn?.click();
    });

    expect(handleSplit).toHaveBeenCalledTimes(1);
    expect(handleSplit).toHaveBeenCalledWith(mockTransaction);
  });

  it('toggles category matrix when reclassify button is clicked and supports selecting a new category', () => {
    const handleVerify = vi.fn();
    renderComponent({
      unverifiedTransactions: [mockTransaction],
      onVerifyTransaction: handleVerify,
      onOpenSplitDrawer: vi.fn(),
      onResetInbox: vi.fn(),
    });

    const reclassifyBtn = container.querySelector<HTMLButtonElement>('#btn-reclassify');
    act(() => {
      reclassifyBtn?.click();
    });

    // Find and select a different category button
    const groceryButtons = Array.from(container.querySelectorAll('button')).filter(
      (btn) => btn.textContent?.includes('Groceries & Quick-Commerce')
    );
    expect(groceryButtons.length).toBeGreaterThan(0);

    act(() => {
      groceryButtons[0]?.click();
    });

    // Confirm verification with the new selected category
    const confirmBtn = container.querySelector<HTMLButtonElement>('#btn-confirm-verify');
    act(() => {
      confirmBtn?.click();
    });

    expect(handleVerify).toHaveBeenCalledWith('tx-unverified-1', 'Groceries & Quick-Commerce', true);
  });

  it('renders celebratory zero-inbox state when queue is empty and triggers reset', () => {
    const handleReset = vi.fn();
    renderComponent({
      unverifiedTransactions: [],
      onVerifyTransaction: vi.fn(),
      onOpenSplitDrawer: vi.fn(),
      onResetInbox: handleReset,
    });

    expect(container.textContent).toContain('All Transactions Verified!');
    expect(container.textContent).toContain('Zero pending items in review queue');

    const resetBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Simulate Demo Alerts')
    );
    expect(resetBtn).toBeDefined();

    act(() => {
      resetBtn?.click();
    });

    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});
