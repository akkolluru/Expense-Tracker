import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalyticsView } from '../AnalyticsView';
import { api } from '../../services/api';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div className="recharts-responsive-container" style={{ width: 400, height: 200 }}>
        {children}
      </div>
    ),
  };
});

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getAnalyticsCategories: vi.fn().mockResolvedValue([
        { category_id: 1, name: 'Food & Dining', icon: 'Utensils', color: '#8EB69B', amount: 15400 },
        { category_id: 2, name: 'Shopping & E-Commerce', icon: 'ShoppingBag', color: '#DAF1DE', amount: 8200 },
      ]),
      getAnalyticsMom: vi.fn().mockResolvedValue({
        current_burn: 2100,
        prev_burn: 2350,
        variance_percentage: -10.6,
      }),
      getAnalyticsTopSpends: vi.fn().mockResolvedValue([
        {
          transaction_id: 101,
          merchant_name: 'Taj Dining',
          amount: 4500,
          timestamp: '2026-08-20T19:30:00Z',
        },
        {
          transaction_id: 102,
          merchant_name: 'Blue Tokai Cafe',
          amount: 850,
          timestamp: '2026-08-22T10:15:00Z',
        },
      ]),
      listCategories: vi.fn().mockResolvedValue([
        { id: 1, name: 'Food & Dining', icon: 'Utensils', color: '#8EB69B', is_income: false },
        { id: 2, name: 'Shopping & E-Commerce', icon: 'ShoppingBag', color: '#DAF1DE', is_income: false },
      ]),
    },
  };
});

describe('AnalyticsView Component', () => {
  let container: HTMLDivElement;
  let queryClient: QueryClient;

  const waitForQueries = async (ms: number = 20) => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, ms));
    });
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('renders MoM variance card with live data and percentage badge', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AnalyticsView totalMonthSpend={63920.5} />
        </QueryClientProvider>
      );
    });

    // Wait for queries to settle
    await waitForQueries();

    const momCard = container.querySelector('[data-testid="mom-variance-card"]');
    expect(momCard).not.toBeNull();

    // Check variance percentage readout
    const varianceBadge = container.querySelector('[data-testid="variance-percentage"]');
    expect(varianceBadge).not.toBeNull();
    expect(varianceBadge?.textContent).toContain('-10.6%');
    expect(momCard?.textContent).toContain('2,100');
  });

  it('renders category breakdown share and list', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AnalyticsView totalMonthSpend={63920.5} />
        </QueryClientProvider>
      );
    });

    await waitForQueries();

    const categoryList = container.querySelector('[data-testid="category-list"]');
    expect(categoryList).not.toBeNull();
    expect(container.textContent).toContain('Food & Dining');
  });

  it('opens Top-5 drilldown modal on category click and displays top transactions', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AnalyticsView totalMonthSpend={63920.5} />
        </QueryClientProvider>
      );
    });

    await waitForQueries();

    // Find and click on the "Food & Dining" category card
    const foodCard = container.querySelector<HTMLDivElement>('[data-testid="category-card-food-&-dining"]');
    expect(foodCard).not.toBeNull();

    await act(async () => {
      foodCard?.click();
    });

    // Wait for top spends query to resolve
    await waitForQueries();

    // Check drilldown modal opened
    const modal = container.querySelector('[data-testid="top-spends-modal"]');
    expect(modal).not.toBeNull();
    expect(modal?.textContent).toContain('Top 5 Largest Spends');

    // Check top spend items are rendered
    expect(modal?.textContent).toContain('Taj Dining');
    expect(modal?.textContent).toContain('Blue Tokai Cafe');

    // Click close button
    const closeBtn = container.querySelector<HTMLButtonElement>('[data-testid="close-drilldown-btn"]');
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn?.click();
    });

    // Modal should now be closed
    expect(container.querySelector('[data-testid="top-spends-modal"]')).toBeNull();
  });

  it('handles empty top spends state gracefully in drilldown modal', async () => {
    vi.mocked(api.getAnalyticsTopSpends).mockResolvedValueOnce([]);

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AnalyticsView totalMonthSpend={63920.5} />
        </QueryClientProvider>
      );
    });

    await waitForQueries();

    const foodCard = container.querySelector<HTMLDivElement>('[data-testid="category-card-food-&-dining"]');
    await act(async () => {
      foodCard?.click();
    });

    await waitForQueries();

    const emptyState = container.querySelector('[data-testid="top-spends-empty"]');
    expect(emptyState).not.toBeNull();
    expect(emptyState?.textContent).toContain('No transactions in this category');
  });
});
