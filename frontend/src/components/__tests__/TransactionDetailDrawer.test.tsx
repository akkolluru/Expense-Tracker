import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransactionDetailDrawer } from '../TransactionDetailDrawer';
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

describe('TransactionDetailDrawer Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  const mockTransaction: Transaction = {
    id: 'tx-101',
    amount: 1000,
    type: 'DEBIT',
    merchant: 'Dinner with Team',
    upiVpa: 'teamdinner@upi',
    category: 'Food & Dining',
    date: '2026-08-31',
    time: '08:30 PM',
    paymentMethod: 'UPI_GPAY',
    accountNumberMasked: 'HDFC **4590',
    isVerified: true,
    aiConfidence: 98,
    splitDetails: [
      { id: 'split-1', name: 'Rahul', upiId: 'rahul@upi', shareAmount: 300, isPaid: false },
      { id: 'split-2', name: 'Priya', upiId: 'priya@upi', shareAmount: 200, isPaid: true },
    ],
  };

  it('renders and computes personal share accurately', () => {
    const handleClose = vi.fn();
    const handleCategory = vi.fn();
    const handleSplit = vi.fn();

    const root = createRoot(container);
    act(() => {
      root.render(
        <TransactionDetailDrawer
          transaction={mockTransaction}
          onClose={handleClose}
          onUpdateCategory={handleCategory}
          onUpdateSplit={handleSplit}
        />
      );
    });

    // Total amount: 1000, splits: 300 + 200 = 500, personal share: 1000 - 500 = 500
    const personalShareElem = container.querySelector('[data-testid="personal-share-amount"]');
    expect(personalShareElem).not.toBeNull();
    expect(personalShareElem?.textContent).toContain('500');

    // Rahul is pending, Priya is settled
    const rahulRow = container.querySelector('[data-testid="split-member-split-1"]');
    expect(rahulRow?.textContent).toContain('Rahul');
    expect(rahulRow?.textContent).toContain('Pending');

    const priyaRow = container.querySelector('[data-testid="split-member-split-2"]');
    expect(priyaRow?.textContent).toContain('Priya');
    expect(priyaRow?.textContent).toContain('Settled');
  });

  it('toggles member paid status on one-tap and calls callbacks', () => {
    const handleClose = vi.fn();
    const handleCategory = vi.fn();
    const handleSplit = vi.fn();
    const handleTogglePaid = vi.fn();

    const root = createRoot(container);
    act(() => {
      root.render(
        <TransactionDetailDrawer
          transaction={mockTransaction}
          onClose={handleClose}
          onUpdateCategory={handleCategory}
          onUpdateSplit={handleSplit}
          onTogglePeerSplitPaid={handleTogglePaid}
        />
      );
    });

    const rahulToggleBtn = container.querySelector<HTMLButtonElement>('[data-testid="toggle-paid-split-1"]');
    expect(rahulToggleBtn).not.toBeNull();

    act(() => {
      rahulToggleBtn?.click();
    });

    expect(handleTogglePaid).toHaveBeenCalledWith('tx-101', 'split-1');
    expect(handleSplit).toHaveBeenCalledWith(
      'tx-101',
      expect.arrayContaining([
        expect.objectContaining({ id: 'split-1', name: 'Rahul', isPaid: true }),
      ])
    );
  });

  it('adds a new peer split member in edit mode', () => {
    const handleClose = vi.fn();
    const handleCategory = vi.fn();
    const handleSplit = vi.fn();

    const root = createRoot(container);
    act(() => {
      root.render(
        <TransactionDetailDrawer
          transaction={mockTransaction}
          onClose={handleClose}
          onUpdateCategory={handleCategory}
          onUpdateSplit={handleSplit}
        />
      );
    });

    // Click "Edit Splits" button
    const editToggleBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Edit Splits')
    );
    expect(editToggleBtn).toBeDefined();

    act(() => {
      editToggleBtn?.click();
    });

    // Enter name and amount using setInputValue
    const nameInput = container.querySelector<HTMLInputElement>('[data-testid="new-split-name-input"]');
    const amountInput = container.querySelector<HTMLInputElement>('[data-testid="new-split-amount-input"]');
    const upiInput = container.querySelector<HTMLInputElement>('[data-testid="new-split-upi-input"]');

    expect(nameInput).not.toBeNull();

    act(() => {
      if (nameInput) {
        setInputValue(nameInput, 'Amit');
      }
      if (upiInput) {
        setInputValue(upiInput, 'amit@okaxis');
      }
      if (amountInput) {
        setInputValue(amountInput, '250');
      }
    });

    const addBtn = container.querySelector<HTMLButtonElement>('[data-testid="add-split-btn"]');
    expect(addBtn).not.toBeNull();
    expect(addBtn?.disabled).toBe(false);

    act(() => {
      addBtn?.click();
    });

    expect(handleSplit).toHaveBeenCalledWith(
      'tx-101',
      expect.arrayContaining([
        expect.objectContaining({ name: 'Amit', upiId: 'amit@okaxis', shareAmount: 250, isPaid: false }),
      ])
    );
  });
});
