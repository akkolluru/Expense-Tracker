import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';

import { api } from '../services/api';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('motion/react', () => ({
  motion: {
    div: React.forwardRef(({ children, drag, dragConstraints, dragElastic, onDragEnd, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>{children}</div>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useMotionValue: (initial: any) => {
    const ref = React.useRef({
      get: () => initial,
      set: vi.fn(),
      on: vi.fn(),
      destroy: vi.fn(),
    });
    return ref.current;
  },
  useTransform: () => {
    const ref = React.useRef({
      get: () => 0,
      on: vi.fn(),
      destroy: vi.fn(),
    });
    return ref.current;
  },
}));

// Mock API module
vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listTransactions: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      }),
      listInbox: vi.fn().mockResolvedValue([]),
      listCategories: vi.fn().mockResolvedValue([
        { id: 1, name: 'Food & Dining', icon: 'Utensils', color: '#DAF1DE', is_income: false },
        { id: 2, name: 'Groceries & Quick-Commerce', icon: 'ShoppingBag', color: '#8EB69B', is_income: false },
      ]),
      getAnalyticsSummary: vi.fn().mockResolvedValue({
        income: 185000,
        burn_rate: 2061.95,
        savings_rate: 65,
      }),
      approveInboxItem: vi.fn().mockResolvedValue({
        status: 'SUCCESS',
        transaction_id: 1,
        applied_category: 'Food & Dining',
      }),
    },
  };
});

describe('App Integration', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  it('renders HomeView and navigates to InboxView with selective learning checkbox', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      );
    });

    // Wait for initial queries to settle
    await act(async () => {
      await new Promise(r => setTimeout(r, 10));
    });

    // Verify HomeView is rendered
    expect(container.querySelector('#home-view')).not.toBeNull();

    // Find and click the Inbox navigation tab using its id
    const inboxTab = container.querySelector<HTMLButtonElement>('#tab-inbox');
    expect(inboxTab).not.toBeNull();

    await act(async () => {
      inboxTab?.click();
    });

    // Verify InboxView is rendered
    expect(container.querySelector('#inbox-view')).not.toBeNull();

    // Verify selective learning checkbox is rendered in the inbox view
    const checkbox = container.querySelector<HTMLInputElement>('#checkbox-learn-merchant');
    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(true);

    // Click confirm to verify
    const confirmBtn = container.querySelector<HTMLButtonElement>('#btn-confirm-verify');
    expect(confirmBtn).not.toBeNull();

    await act(async () => {
      confirmBtn?.click();
    });
  });

  it('calls approveInboxItem with never_auto_classify payload when "Always ask" is selected', async () => {
    vi.mocked(api.listInbox).mockResolvedValueOnce([
      {
        id: 42,
        amount: 550,
        merchant_name: 'Rahul Friend UPI',
        merchant_vpa: 'rahul@oksbi',
        timestamp: '2026-10-05T12:00:00Z',
        confidence: 0.5,
        suggested_category: { id: 1, name: 'Food & Dining' },
      },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      );
    });

    // Wait for queries to settle and DOM to update with mock inbox transaction
    await act(async () => {
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 20));
        if (container.textContent?.includes('Rahul Friend UPI')) break;
      }
    });

    // Navigate to Inbox tab
    const inboxTab = container.querySelector<HTMLButtonElement>('#tab-inbox');
    await act(async () => {
      inboxTab?.click();
    });

    // Verify the mock transaction is active in inbox
    expect(container.textContent).toContain('Rahul Friend UPI');

    // Select "Always ask (Never auto-classify)" radio
    const neverRadio = container.querySelector<HTMLInputElement>('#radio-learn-never');
    expect(neverRadio).not.toBeNull();

    await act(async () => {
      neverRadio?.click();
    });
    expect(neverRadio?.checked).toBe(true);

    // Confirm verification
    const confirmBtn = container.querySelector<HTMLButtonElement>('#btn-confirm-verify');
    expect(confirmBtn).not.toBeNull();

    await act(async () => {
      confirmBtn?.click();
    });

    // Assert approveInboxItem was called with never_auto_classify: true and learn_merchant: false
    expect(api.approveInboxItem).toHaveBeenCalledWith(42, {
      category_id: 1,
      learn_merchant: false,
      never_auto_classify: true,
    });
  });

  it('calls approveInboxItem with default payload (learn_merchant: true, never_auto_classify: false)', async () => {
    vi.mocked(api.listInbox).mockResolvedValueOnce([
      {
        id: 99,
        amount: 320,
        merchant_name: 'Swiggy Instamart',
        merchant_vpa: 'swiggy@icici',
        timestamp: '2026-10-05T14:00:00Z',
        confidence: 0.95,
        suggested_category: { id: 2, name: 'Groceries & Quick-Commerce' },
      },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      );
    });

    // Wait for queries to settle
    await act(async () => {
      await new Promise(r => setTimeout(r, 20));
    });

    // Navigate to Inbox tab
    const inboxTab = container.querySelector<HTMLButtonElement>('#tab-inbox');
    await act(async () => {
      inboxTab?.click();
    });

    // Verify default radio is checked
    const rememberRadio = container.querySelector<HTMLInputElement>('#radio-learn-remember');
    expect(rememberRadio?.checked).toBe(true);

    // Confirm verification
    const confirmBtn = container.querySelector<HTMLButtonElement>('#btn-confirm-verify');
    expect(confirmBtn).not.toBeNull();

    await act(async () => {
      confirmBtn?.click();
    });

    // Assert approveInboxItem was called with learn_merchant: true, never_auto_classify: false
    expect(api.approveInboxItem).toHaveBeenCalledWith(99, {
      category_id: 2,
      learn_merchant: true,
      never_auto_classify: false,
    });
  });
});
