import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddTransactionModal } from '../AddTransactionModal';
import { api } from '../../services/api';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock the API module
vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listAccounts: vi.fn(),
      listCategories: vi.fn(),
      parseSyncText: vi.fn(),
      createTransaction: vi.fn(),
    },
  };
});

function setInputValue(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) {
  const prototype = Object.getPrototypeOf(input);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('AddTransactionModal Component', () => {
  let container: HTMLDivElement;

  const mockAccounts = [
    {
      id: 1,
      name: 'HDFC Salary Account',
      institution: 'HDFC Bank',
      account_type: 'SAVINGS',
      currency: 'INR',
      balance: 154000,
      account_number_last4: '4590',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      name: 'ICICI Savings',
      institution: 'ICICI Bank',
      account_type: 'SAVINGS',
      currency: 'INR',
      balance: 25000,
      account_number_last4: '8812',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  const mockCategories = [
    { id: 1, name: 'Food & Dining', icon: 'Utensils', color: '#DAF1DE', is_income: false },
    { id: 2, name: 'Groceries & Quick-Commerce', icon: 'ShoppingBag', color: '#8EB69B', is_income: false },
    { id: 3, name: 'Transportation', icon: 'Car', color: '#68D391', is_income: false },
  ];

  const waitForQueries = async (ms: number = 20) => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, ms));
    });
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();

    (api.listAccounts as any).mockResolvedValue(mockAccounts);
    (api.listCategories as any).mockResolvedValue(mockCategories);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  async function renderModal(props: Partial<React.ComponentProps<typeof AddTransactionModal>> = {}) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    const root = createRoot(container);
    const defaultProps = {
      isOpen: true,
      initialMode: 'sms' as const,
      onClose: vi.fn(),
      onAddTransaction: vi.fn(),
      ...props,
    };

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AddTransactionModal {...defaultProps} />
        </QueryClientProvider>
      );
    });

    await waitForQueries();

    return { root, queryClient, ...defaultProps };
  }

  it('renders SMS and Manual tabs and switches between them', async () => {
    const { onClose } = await renderModal({ initialMode: 'sms' });

    // Verify SMS tab is active
    expect(container.querySelector('#sms-textarea')).not.toBeNull();
    expect(container.querySelector('#btn-backend-parse')).not.toBeNull();
    expect(container.textContent).toContain('Paste Bank SMS');
    expect(container.textContent).toContain('Quick Examples:');

    // Switch to Manual tab
    const tabs = container.querySelectorAll('button');
    const manualTabBtn = Array.from(tabs).find((b) => b.textContent?.includes('Manual Form'));
    expect(manualTabBtn).toBeDefined();

    await act(async () => {
      manualTabBtn?.click();
    });

    // Verify Manual form elements are rendered
    expect(container.querySelector('#account-select')).not.toBeNull();
    expect(container.querySelector('#manual-amount-input')).not.toBeNull();
    expect(container.querySelector('#manual-merchant-input')).not.toBeNull();
    expect(container.querySelector('#category-select')).not.toBeNull();
    expect(container.querySelector('#btn-save-manual-tx')).not.toBeNull();

    // Close button works
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancel'
    );
    expect(cancelBtn).toBeDefined();
    await act(async () => {
      cancelBtn?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('executes live SMS parse and displays CREATED badge, saving transaction', async () => {
    (api.parseSyncText as any).mockResolvedValue({
      status: 'CREATED',
      action: 'TRANSACTION_CREATED',
      transaction: {
        id: 501,
        account_id: 1,
        amount: 450,
        currency: 'INR',
        is_expense: true,
        is_transfer: false,
        is_settlement: false,
        status: 'POSTED',
        merchant_name: 'Zepto Quick Delivery',
        merchant_vpa: 'zeptonow@axisbank',
        reference_number: 'UTR45012399',
        categorization_strategy: 'SMS_REGEX_ENGINE',
        categorization_confidence: 96,
        timestamp: '2026-08-31T14:30:00Z',
        category_id: 2,
      },
    });

    const { onAddTransaction, onClose } = await renderModal({ initialMode: 'sms' });

    const textarea = container.querySelector<HTMLTextAreaElement>('#sms-textarea')!;
    expect(textarea).not.toBeNull();

    await act(async () => {
      setInputValue(
        textarea,
        'Sent Rs.450.00 from HDFC Bank A/C **4590 to ZEPTO NOW UPI: zeptonow@axisbank on 31-AUG-26 Ref 45012399'
      );
    });

    const parseBtn = container.querySelector<HTMLButtonElement>('#btn-backend-parse')!;
    expect(parseBtn).not.toBeNull();

    await act(async () => {
      parseBtn.click();
    });
    await waitForQueries();

    // Check that api.parseSyncText was invoked with the SMS text
    expect(api.parseSyncText).toHaveBeenCalledWith({
      raw_text:
        'Sent Rs.450.00 from HDFC Bank A/C **4590 to ZEPTO NOW UPI: zeptonow@axisbank on 31-AUG-26 Ref 45012399',
      source: 'SMS_MODAL',
    });

    // Verify CREATED badge is rendered
    const badge = container.querySelector('[data-testid="sync-status-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('CREATED: New Transaction Recorded');
    expect(badge?.className).toContain('emerald');

    // Verify parsed card details
    expect(container.textContent).toContain('Zepto Quick Delivery');
    expect(container.textContent).toContain('₹450.00');
    expect(container.textContent).toContain('UTR45012399');

    // Save transaction
    const saveBtn = container.querySelector<HTMLButtonElement>('#btn-save-parsed-sms')!;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn.disabled).toBe(false);

    await act(async () => {
      saveBtn.click();
    });

    expect(onAddTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant: 'Zepto Quick Delivery',
        amount: 450,
        isVerified: true,
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('displays MERGED badge when backend SMS ingestion performs enrichment merge', async () => {
    (api.parseSyncText as any).mockResolvedValue({
      status: 'MERGED',
      action: 'ENRICHMENT_MERGE',
      transaction: {
        id: 502,
        account_id: 1,
        amount: 1250,
        currency: 'INR',
        is_expense: true,
        is_transfer: false,
        is_settlement: false,
        status: 'POSTED',
        merchant_name: 'Swiggy Gourmet',
        merchant_vpa: 'swiggy@icici',
        reference_number: 'UTR99887766',
        categorization_strategy: 'CROSS_CHANNEL_DEDUPE',
        categorization_confidence: 99,
        timestamp: '2026-08-31T20:15:00Z',
        category_id: 1,
      },
    });

    await renderModal({ initialMode: 'sms' });

    const textarea = container.querySelector<HTMLTextAreaElement>('#sms-textarea')!;
    await act(async () => {
      setInputValue(
        textarea,
        'Paid Rs.1250.00 to SWIGGY GOURMET via UPI Ref UTR99887766 on 31-Aug-2026'
      );
    });

    const parseBtn = container.querySelector<HTMLButtonElement>('#btn-backend-parse')!;
    await act(async () => {
      parseBtn.click();
    });
    await waitForQueries();

    const badge = container.querySelector('[data-testid="sync-status-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('MERGED: Enrichment Merge (Matched via UTR)');
    expect(badge?.className).toContain('sky');
    expect(container.textContent).toContain('Swiggy Gourmet');
    expect(container.textContent).toContain('UTR99887766');
  });

  it('auto-parses when a sample SMS preset button is clicked', async () => {
    (api.parseSyncText as any).mockResolvedValue({
      status: 'CREATED',
      action: 'TRANSACTION_CREATED',
      transaction: {
        id: 503,
        account_id: 1,
        amount: 450,
        currency: 'INR',
        is_expense: true,
        is_transfer: false,
        is_settlement: false,
        status: 'POSTED',
        merchant_name: 'Zepto Instant',
        categorization_strategy: 'SMS_REGEX_ENGINE',
        categorization_confidence: 95,
        timestamp: '2026-08-31T12:00:00Z',
        category_id: 2,
      },
    });

    await renderModal({ initialMode: 'sms' });

    const sampleBtns = container.querySelectorAll('.space-y-1 button');
    expect(sampleBtns.length).toBeGreaterThan(0);

    await act(async () => {
      (sampleBtns[0] as HTMLButtonElement).click();
    });
    await waitForQueries();

    // Auto-parse was triggered without needing to click Parse button
    expect(api.parseSyncText).toHaveBeenCalledTimes(1);
    const badge = container.querySelector('[data-testid="sync-status-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('CREATED: New Transaction Recorded');
  });

  it('falls back to client-side heuristic parser with Offline badge on network failure', async () => {
    (api.parseSyncText as any).mockRejectedValue(new Error('Network offline or backend timeout'));

    const { onAddTransaction, onClose } = await renderModal({ initialMode: 'sms' });

    const textarea = container.querySelector<HTMLTextAreaElement>('#sms-textarea')!;
    await act(async () => {
      setInputValue(
        textarea,
        'Sent Rs.350.00 from HDFC Bank A/C **4590 to SWIGGY DELIVERY UPI: swiggy@hdfc on 31-AUG-26'
      );
    });

    const parseBtn = container.querySelector<HTMLButtonElement>('#btn-backend-parse')!;
    await act(async () => {
      parseBtn.click();
    });
    await waitForQueries();

    // Offline / Local Heuristic fallback badge displayed
    const badge = container.querySelector('[data-testid="sync-status-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('Offline / Local Heuristic');

    // Local heuristic successfully extracted amount and merchant
    expect(container.textContent).toContain('Swiggy');
    expect(container.textContent).toContain('₹350.00');

    // Can still be saved
    const saveBtn = container.querySelector<HTMLButtonElement>('#btn-save-parsed-sms')!;
    await act(async () => {
      saveBtn.click();
    });

    expect(onAddTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant: 'Swiggy',
        amount: 350,
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('submits manual transaction, invoking createTransaction mutation and onAddTransaction', async () => {
    (api.createTransaction as any).mockResolvedValue({
      id: 999,
      account_id: 2,
      amount: 850,
      merchant_name: 'Blue Tokai Coffee',
      timestamp: '2026-08-31T10:00:00Z',
      category_id: 1,
      is_expense: true,
      status: 'POSTED',
    });

    const { onAddTransaction, onClose } = await renderModal({ initialMode: 'manual' });

    const accountSelect = container.querySelector<HTMLSelectElement>('#account-select')!;
    expect(accountSelect).not.toBeNull();

    // Verify accounts loaded into select options
    expect(accountSelect.options.length).toBe(2);

    // Select Account 2 (ICICI)
    await act(async () => {
      setInputValue(accountSelect, '2');
    });

    const amountInput = container.querySelector<HTMLInputElement>('#manual-amount-input')!;
    await act(async () => {
      setInputValue(amountInput, '850');
    });

    const merchantInput = container.querySelector<HTMLInputElement>('#manual-merchant-input')!;
    await act(async () => {
      setInputValue(merchantInput, 'Blue Tokai Coffee');
    });

    const vpaInput = container.querySelector<HTMLInputElement>('#manual-vpa-input')!;
    await act(async () => {
      setInputValue(vpaInput, 'bluetokai@icici');
    });

    const categorySelect = container.querySelector<HTMLSelectElement>('#category-select')!;
    await act(async () => {
      setInputValue(categorySelect, 'Food & Dining');
    });

    const addBtn = container.querySelector<HTMLButtonElement>('#btn-save-manual-tx')!;
    expect(addBtn.disabled).toBe(false);

    await act(async () => {
      addBtn.click();
    });
    await waitForQueries();

    // Check backend mutation parameters
    expect(api.createTransaction).toHaveBeenCalledWith({
      account_id: 2,
      amount: 850,
      merchant_name: 'Blue Tokai Coffee',
      timestamp: expect.any(String),
      category_id: 1,
      is_expense: true,
    });

    // Check optimistic update
    expect(onAddTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 850,
        merchant: 'Blue Tokai Coffee',
        upiVpa: 'bluetokai@icici',
        category: 'Food & Dining',
        type: 'DEBIT',
        isVerified: true,
        aiConfidence: 100,
        accountNumberMasked: expect.stringContaining('ICICI'),
      })
    );

    // Modal closed
    expect(onClose).toHaveBeenCalled();
  });
});
