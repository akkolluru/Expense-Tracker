import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('motion/react', () => ({
  motion: {
    div: React.forwardRef(({ children, drag, dragConstraints, dragElastic, onDragEnd, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>{children}</div>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useMotionValue: (initial: any) => ({
    get: () => initial,
    set: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
  }),
  useTransform: () => ({
    get: () => 0,
    on: vi.fn(),
    destroy: vi.fn(),
  }),
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
});
