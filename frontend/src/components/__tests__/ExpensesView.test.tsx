import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExpensesView } from '../ExpensesView';
import { Transaction } from '../../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('ExpensesView Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.removeChild(container);
  });

  const createMockTransactions = (count: number): Transaction[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `tx-${i + 1}`,
      amount: 100 * (i + 1),
      type: i % 3 === 0 ? 'CREDIT' : 'DEBIT',
      merchant: i === 0 ? 'Blue Tokai Coffee' : i === 1 ? 'Swiggy Instamart' : `Merchant ${i + 1}`,
      upiVpa: `merchant${i + 1}@upi`,
      category: i === 0 ? 'Food & Dining' : i === 1 ? 'Groceries & Quick-Commerce' : 'Shopping & E-Commerce',
      date: '2026-08-31',
      time: '10:00 AM',
      paymentMethod: i % 2 === 0 ? 'UPI_GPAY' : 'HDFC_CC',
      accountNumberMasked: 'HDFC **4590',
      isVerified: true,
      aiConfidence: 95,
      splitDetails: i === 0 ? [{ id: 's1', name: 'Rahul', shareAmount: 50, isPaid: false }] : undefined,
    }));
  };

  it('renders transactions and filters with debounced search', () => {
    const transactions = createMockTransactions(5);
    const handleSelect = vi.fn();
    const handleOpenAdd = vi.fn();

    const root = createRoot(container);
    act(() => {
      root.render(
        <ExpensesView
          transactions={transactions}
          onSelectTransaction={handleSelect}
          onOpenAddModal={handleOpenAdd}
        />
      );
    });

    // Check all 5 transactions are rendered
    expect(container.querySelectorAll('[data-testid^="transaction-row-"]').length).toBe(5);

    // Find search input
    const searchInput = container.querySelector<HTMLInputElement>('#search-input');
    expect(searchInput).not.toBeNull();

    // Type "Tokai"
    act(() => {
      if (searchInput) {
        setInputValue(searchInput, 'Tokai');
      }
    });

    // Before timer advances, debounce hasn't triggered
    expect(container.querySelectorAll('[data-testid^="transaction-row-"]').length).toBe(5);

    // Fast-forward debounce timer 250ms
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Now only Blue Tokai Coffee is visible
    const filteredRows = container.querySelectorAll('[data-testid^="transaction-row-"]');
    expect(filteredRows.length).toBe(1);
    expect(container.textContent).toContain('Blue Tokai Coffee');
  });

  it('filters by category filter chips', () => {
    const transactions = createMockTransactions(6);
    const handleSelect = vi.fn();
    const handleOpenAdd = vi.fn();

    const root = createRoot(container);
    act(() => {
      root.render(
        <ExpensesView
          transactions={transactions}
          onSelectTransaction={handleSelect}
          onOpenAddModal={handleOpenAdd}
        />
      );
    });

    // Find "Food & Dining" category button
    const categoryButtons = Array.from(container.querySelectorAll('[data-testid="category-filters"] button'));
    const foodChip = categoryButtons.find(b => b.textContent?.includes('Food & Dining'));
    expect(foodChip).toBeDefined();

    act(() => {
      foodChip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const rows = container.querySelectorAll('[data-testid^="transaction-row-"]');
    expect(rows.length).toBe(1);
    expect(container.textContent).toContain('Blue Tokai Coffee');
  });

  it('filters by payment mode and type chips', () => {
    const transactions = createMockTransactions(6);
    const handleSelect = vi.fn();
    const handleOpenAdd = vi.fn();

    const root = createRoot(container);
    act(() => {
      root.render(
        <ExpensesView
          transactions={transactions}
          onSelectTransaction={handleSelect}
          onOpenAddModal={handleOpenAdd}
        />
      );
    });

    // Find "Split" mode filter button
    const modeButtons = Array.from(container.querySelectorAll('[data-testid="mode-filters"] button'));
    const splitChip = modeButtons.find(b => b.textContent?.trim() === 'Split');
    expect(splitChip).toBeDefined();

    act(() => {
      splitChip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Only transaction 1 has splitDetails
    const rows = container.querySelectorAll('[data-testid^="transaction-row-"]');
    expect(rows.length).toBe(1);
    expect(container.textContent).toContain('Blue Tokai Coffee');
  });

  it('paginates transactions in chunks of 20 and loads more when button clicked', () => {
    const transactions = createMockTransactions(25);
    const handleSelect = vi.fn();
    const handleOpenAdd = vi.fn();

    const root = createRoot(container);
    act(() => {
      root.render(
        <ExpensesView
          transactions={transactions}
          onSelectTransaction={handleSelect}
          onOpenAddModal={handleOpenAdd}
        />
      );
    });

    // First page should have 20 items
    expect(container.querySelectorAll('[data-testid^="transaction-row-"]').length).toBe(20);

    const loadMoreBtn = container.querySelector<HTMLButtonElement>('[data-testid="load-more-btn"]');
    expect(loadMoreBtn).not.toBeNull();
    expect(container.textContent).toContain('Showing 20 of 25');

    act(() => {
      loadMoreBtn?.click();
    });

    // After loading more, all 25 items should be rendered and load more button gone
    expect(container.querySelectorAll('[data-testid^="transaction-row-"]').length).toBe(25);
    expect(container.querySelector('[data-testid="load-more-btn"]')).toBeNull();
  });
});
