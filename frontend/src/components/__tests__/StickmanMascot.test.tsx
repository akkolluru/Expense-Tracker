import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StickmanMascot } from '../StickmanMascot';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('StickmanMascot Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders Stage 1: The Mogul when spend is <= 65% of budget', async () => {
    // 25,000 spend with default 50,000 budget = 50%
    const root = createRoot(container);
    await act(async () => {
      root.render(<StickmanMascot totalMonthSpend={25000} />);
    });

    const stagePill = container.querySelector('[data-testid="stickman-stage-pill"]');
    const quip = container.querySelector('[data-testid="stickman-quip"]');
    const percentBadge = container.querySelector('[data-testid="stickman-percent-badge"]');

    expect(stagePill?.textContent).toContain('Stage 1: The Mogul');
    expect(quip?.textContent).toContain('Looking lavish, financial wizard!');
    expect(percentBadge?.textContent).toContain('50% of budget (50% Saved!)');
  });

  it('renders Stage 2: The Pro when spend is between 66% and 95%', async () => {
    // 40,000 spend with 50,000 budget = 80%
    const root = createRoot(container);
    await act(async () => {
      root.render(<StickmanMascot totalMonthSpend={40000} monthlyBudget={50000} />);
    });

    const stagePill = container.querySelector('[data-testid="stickman-stage-pill"]');
    const quip = container.querySelector('[data-testid="stickman-quip"]');
    const percentBadge = container.querySelector('[data-testid="stickman-percent-badge"]');

    expect(stagePill?.textContent).toContain('Stage 2: The Pro');
    expect(quip?.textContent).toContain('Steady, balanced, and sharp.');
    expect(percentBadge?.textContent).toContain('80% of budget (20% Buffer)');
  });

  it('renders Stage 3: The Hustler when spend is between 96% and 115%', async () => {
    // 52,500 spend with 50,000 budget = 105%
    const root = createRoot(container);
    await act(async () => {
      root.render(<StickmanMascot totalMonthSpend={52500} monthlyBudget={50000} />);
    });

    const stagePill = container.querySelector('[data-testid="stickman-stage-pill"]');
    const quip = container.querySelector('[data-testid="stickman-quip"]');
    const percentBadge = container.querySelector('[data-testid="stickman-percent-badge"]');

    expect(stagePill?.textContent).toContain('Stage 3: The Hustler');
    expect(quip?.textContent).toContain('Comfort mode active — budget tightening.');
    expect(percentBadge?.textContent).toContain('105% of budget (+5% Over)');
  });

  it('renders Stage 4: In Boxers when spend is > 115%', async () => {
    // 70,000 spend with 50,000 budget = 140%
    const root = createRoot(container);
    await act(async () => {
      root.render(<StickmanMascot totalMonthSpend={70000} monthlyBudget={50000} />);
    });

    const stagePill = container.querySelector('[data-testid="stickman-stage-pill"]');
    const quip = container.querySelector('[data-testid="stickman-quip"]');
    const percentBadge = container.querySelector('[data-testid="stickman-percent-badge"]');

    expect(stagePill?.textContent).toContain('Stage 4: In Boxers (Broke)');
    expect(quip?.textContent).toContain('RED ALERT: Down to your boxers!');
    expect(percentBadge?.textContent).toContain('140% of budget (Deficit!)');
  });

  it('supports custom monthlyBudget', async () => {
    // 5,000 spend with 10,000 budget = 50%
    const root = createRoot(container);
    await act(async () => {
      root.render(<StickmanMascot totalMonthSpend={5000} monthlyBudget={10000} />);
    });

    const stagePill = container.querySelector('[data-testid="stickman-stage-pill"]');
    const percentBadge = container.querySelector('[data-testid="stickman-percent-badge"]');

    expect(stagePill?.textContent).toContain('Stage 1: The Mogul');
    expect(percentBadge?.textContent).toContain('50% of budget (50% Saved!)');
  });
});
