import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip 
} from 'recharts';
import { 
  CATEGORY_BREAKDOWN_DATA, 
  DAILY_SPEND_SERIES, 
  ACTIVE_SUBSCRIPTIONS 
} from '../data/mockData';
import { formatINR } from '../utils/formatters';
import { CategoryBreakdownPoint, ExpenseCategory } from '../types';
import { TimeTravelCard } from './TimeTravelCard';
import { CategoryIcon } from './CategoryIcon';
import { AlertCircle, Zap, TrendingUp, X } from 'lucide-react';
import { 
  useAnalyticsCategories, 
  useAnalyticsMom, 
  useAnalyticsTopSpends, 
  useCategories 
} from '../hooks/useExpenseApi';
import { mapCategoryBreakdownToUi, parseTimestamp } from '../utils/adapters';

interface AnalyticsViewProps {
  totalMonthSpend: number;
}

const START_DATE = '2026-08-01T00:00:00Z';
const END_DATE = '2026-08-31T23:59:59Z';
const PREV_START_DATE = '2026-07-01T00:00:00Z';
const PREV_END_DATE = '2026-07-31T23:59:59Z';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  totalMonthSpend,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredData, setHoveredData] = useState<CategoryBreakdownPoint | null>(null);

  // Live queries for analytics
  const categoriesQuery = useAnalyticsCategories(START_DATE, END_DATE);
  const momQuery = useAnalyticsMom(START_DATE, END_DATE, PREV_START_DATE, PREV_END_DATE);
  const allCategoriesQuery = useCategories();

  // Dynamic Category Breakdown: mapped from API with fallback to CATEGORY_BREAKDOWN_DATA
  const categoryBreakdown = useMemo<CategoryBreakdownPoint[]>(() => {
    if (categoriesQuery.data && categoriesQuery.data.length > 0) {
      return mapCategoryBreakdownToUi(categoriesQuery.data);
    }
    return CATEGORY_BREAKDOWN_DATA;
  }, [categoriesQuery.data]);

  // Derive categoryId for top spends drilldown
  const selectedCategoryId = useMemo<number | null>(() => {
    if (!selectedCategory) return null;

    const fromBreakdown = categoriesQuery.data?.find(
      c => c.name.toLowerCase() === selectedCategory.toLowerCase()
    );
    if (fromBreakdown?.category_id) return fromBreakdown.category_id;

    const fromAll = allCategoriesQuery.data?.find(
      c => c.name.toLowerCase() === selectedCategory.toLowerCase()
    );
    if (fromAll?.id) return fromAll.id;

    return 1;
  }, [selectedCategory, categoriesQuery.data, allCategoriesQuery.data]);

  // Query top 5 spends when category is selected
  const topSpendsQuery = useAnalyticsTopSpends(
    selectedCategoryId ?? 0,
    START_DATE,
    END_DATE,
    5
  );

  const activeBreakdown = hoveredData || (selectedCategory 
    ? categoryBreakdown.find(c => c.category === selectedCategory) || null 
    : null);

interface PieTooltipPayload {
  active?: boolean;
  payload?: Array<{
    payload: CategoryBreakdownPoint;
  }>;
}

interface BarTooltipPayload {
  active?: boolean;
  payload?: Array<{
    payload: {
      date: string;
      dayLabel: string;
      amount: number;
      peakExpenseMerchant?: string;
    };
  }>;
}

  const pieTooltip = ({ active, payload }: PieTooltipPayload) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-xl bg-[#0B2B26] border border-[#235347] p-3 shadow-2xl space-y-1 min-w-[140px] pointer-events-none z-50">
          <div className="flex items-center gap-1.5">
            <span 
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: data.color }}
            />
            <p className="text-xs font-bold text-[#DAF1DE] truncate">{data.category}</p>
          </div>
          <div className="pt-0.5">
            <p className="text-sm font-bold text-white font-mono-num">
              {formatINR(data.amount)}
            </p>
            <p className="text-[10px] text-[#8EB69B] font-mono mt-0.5">
              {data.percentage}% of spend • {data.transactionCount} txns
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const barTooltip = ({ active, payload }: BarTooltipPayload) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-xl bg-[#0B2B26] border border-[#235347] p-2.5 shadow-2xl text-xs space-y-0.5 min-w-[110px] pointer-events-none">
          <p className="font-semibold text-[#8EB69B]">{data.date} ({data.dayLabel})</p>
          <p className="text-sm font-bold text-[#DAF1DE] font-mono-num">
            {formatINR(data.amount)}
          </p>
          {data.peakExpenseMerchant && (
            <p className="text-[10px] text-[#8EB69B]/80 truncate max-w-[130px] font-mono">
              Peak: {data.peakExpenseMerchant}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="analytics-view" className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* 1. View Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-[11px] font-medium tracking-wide uppercase text-[#8EB69B]">
            Insights & Mandates
          </span>
          <h1 className="text-lg font-bold text-[#DAF1DE] tracking-tight">Financial Intelligence</h1>
        </div>
        <div className="text-xs text-[#8EB69B] font-mono">
          August 2026
        </div>
      </div>

      {/* 2. AI Time Travel Card */}
      <TimeTravelCard />

      {/* 3. Month-over-Month Variance Card */}
      <div 
        className="rounded-2xl bg-[#0B2B26] border border-[#235347] p-4 shadow-sm space-y-2.5"
        data-testid="mom-variance-card"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-[#8EB69B]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8EB69B]">
              Month-over-Month Variance
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#8EB69B]">Aug vs Jul 2026</span>
        </div>

        {momQuery.isLoading ? (
          <div className="text-xs text-[#8EB69B] animate-pulse">Calculating variance...</div>
        ) : momQuery.data ? (
          <div className="flex items-center justify-between pt-1 text-xs">
            <div>
              <span className="text-[10px] text-[#8EB69B] block">Current Daily Burn</span>
              <span className="text-sm font-bold text-[#DAF1DE] font-mono-num">
                {formatINR(momQuery.data.current_burn, false)}/day
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#8EB69B] block">Previous Daily Burn</span>
              <span className="text-xs font-mono-num text-[#8EB69B]">
                {formatINR(momQuery.data.prev_burn, false)}/day
              </span>
            </div>
            <div className="pl-2">
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono-num border ${
                  momQuery.data.variance_percentage <= 0
                    ? 'bg-[#163832] text-[#8EB69B] border-[#235347]'
                    : 'bg-rose-950/40 text-rose-300 border-rose-800/40'
                }`}
                data-testid="variance-percentage"
              >
                {momQuery.data.variance_percentage > 0 ? '+' : ''}
                {momQuery.data.variance_percentage}%
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-[#8EB69B]">
            <span>Burn rate pacing steady against baseline targets</span>
            <span className="text-[10px] font-mono bg-[#163832] px-2 py-0.5 rounded border border-[#235347] text-[#DAF1DE]">
              Stable
            </span>
          </div>
        )}
      </div>

      {/* 4. Category Donut Breakdown Card */}
      <div className="rounded-2xl bg-[#0B2B26] border border-[#235347] p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8EB69B]">Category Share</h2>
          <span className="text-xs text-[#DAF1DE] font-mono-num font-semibold">
            {formatINR(totalMonthSpend, false)} Total
          </span>
        </div>

        {/* Chart Container with Dynamic Center Readout */}
        <div className="h-48 w-full relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={3}
                dataKey="amount"
                nameKey="category"
                onMouseEnter={(data: any) => {
                  if (data) setHoveredData(data);
                }}
                onMouseLeave={() => {
                  setHoveredData(null);
                }}
                onClick={(entry: any) => {
                  const cat = entry?.category || entry?.name;
                  if (cat) {
                    setSelectedCategory(cat === selectedCategory ? null : cat);
                  }
                }}
              >
                {categoryBreakdown.map((entry, index) => {
                  const isHighlighted = activeBreakdown?.category === entry.category;
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      stroke="#0B2B26"
                      strokeWidth={isHighlighted ? 3 : 2}
                      className="cursor-pointer transition-all outline-none"
                    />
                  );
                })}
              </Pie>
              <Tooltip content={pieTooltip} />
            </PieChart>
          </ResponsiveContainer>

          {/* Centered category label or total spend */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
            <span className="text-[10px] text-[#8EB69B] uppercase font-mono tracking-wider truncate max-w-[110px]">
              {activeBreakdown ? activeBreakdown.category : 'Top Spend'}
            </span>
            <span className="text-sm font-bold text-[#DAF1DE] font-mono-num mt-0.5">
              {activeBreakdown 
                ? formatINR(activeBreakdown.amount, false)
                : formatINR(totalMonthSpend, false)
              }
            </span>
            <span className="text-[10px] text-[#8EB69B] font-mono">
              {activeBreakdown ? `${activeBreakdown.percentage}%` : 'August'}
            </span>
          </div>
        </div>

        {/* Category List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#163832]" data-testid="category-list">
          {categoryBreakdown.map((item) => {
            const isSelected = selectedCategory === item.category;

            return (
              <div
                key={item.category}
                onClick={() => setSelectedCategory(isSelected ? null : item.category)}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-[#163832] border-[#8EB69B]' 
                    : 'bg-[#163832]/40 border-transparent hover:border-[#235347] hover:bg-[#163832]/70'
                }`}
                data-testid={`category-card-${item.category.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: item.color }} 
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-[#DAF1DE] block truncate">{item.category}</span>
                    <span className="text-[10px] text-[#8EB69B] font-mono">{item.transactionCount} transactions</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 pl-2">
                  <span className="text-xs font-bold text-[#DAF1DE] font-mono-num block">
                    {formatINR(item.amount, false)}
                  </span>
                  <span className="text-[10px] text-[#8EB69B] font-mono-num">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Daily Spending Trend */}
      <div className="rounded-2xl bg-[#0B2B26] border border-[#235347] p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8EB69B]">Daily Outflow</h2>
            <p className="text-[11px] text-[#8EB69B]/80 mt-0.5">Past 7 days</p>
          </div>
          <span className="text-xs text-[#DAF1DE] font-mono font-medium">
            Avg: ₹1.4k/day
          </span>
        </div>

        <div className="h-36 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={DAILY_SPEND_SERIES} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
              <XAxis 
                dataKey="date" 
                tick={{ fill: '#8EB69B', fontSize: 10 }} 
                axisLine={false} 
                tickLine={false} 
              />
              <YAxis 
                tick={{ fill: '#8EB69B', fontSize: 10 }} 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(v) => `₹${v/1000}k`}
              />
              <Tooltip content={barTooltip} cursor={{ fill: 'rgba(218, 241, 222, 0.05)' }} />
              <Bar 
                dataKey="amount" 
                radius={[4, 4, 0, 0]}
              >
                {DAILY_SPEND_SERIES.map((entry, index) => (
                  <Cell 
                    key={`bar-${index}`} 
                    fill={entry.amount > 2000 ? '#DAF1DE' : '#8EB69B'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 6. Subscriptions & Recurring Mandates with Witty Tags */}
      <div className="rounded-2xl bg-[#0B2B26] border border-[#235347] p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8EB69B]">Recurring Mandates</h3>
          <span className="text-xs text-[#DAF1DE] font-mono-num font-semibold">
            ₹2,306/mo
          </span>
        </div>

        <div className="divide-y divide-[#163832]">
          {ACTIVE_SUBSCRIPTIONS.map((sub) => (
            <div 
              key={sub.id}
              className="py-3 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#DAF1DE] block">{sub.name}</span>
                  <span className="text-[10px] text-[#8EB69B] font-mono">{sub.dueDate}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-[#DAF1DE] font-mono-num">
                    {formatINR(sub.amount, false)}
                  </span>
                  <span className="text-[10px] text-[#8EB69B] block font-mono">
                    {sub.paymentMode.replace('UPI_', '')}
                  </span>
                </div>
              </div>

              {sub.wittyTag && (
                <div className={`p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                  sub.isZombie 
                    ? 'bg-[#163832] border border-[#235347] text-[#DAF1DE]' 
                    : 'bg-[#163832]/60 text-[#8EB69B]'
                }`}>
                  {sub.isZombie ? <AlertCircle size={13} className="text-[#DAF1DE] flex-shrink-0" /> : <Zap size={13} className="text-[#8EB69B] flex-shrink-0" />}
                  <span>{sub.wittyTag}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 7. Top-5 Largest Spends Drilldown Modal */}
      {selectedCategory && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          data-testid="top-spends-modal"
        >
          <div 
            className="w-full max-w-md rounded-2xl bg-[#0B2B26] border border-[#235347] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#235347]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#163832] border border-[#235347] flex items-center justify-center">
                  <CategoryIcon category={selectedCategory as ExpenseCategory} size={16} showBg={false} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#DAF1DE]">{selectedCategory}</h3>
                  <span className="text-[10px] text-[#8EB69B] font-mono">Top 5 Largest Spends</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCategory(null)}
                aria-label="Close drilldown modal"
                className="p-1.5 rounded-lg text-[#8EB69B] hover:text-[#DAF1DE] hover:bg-[#163832] transition-colors"
                data-testid="close-drilldown-btn"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {topSpendsQuery.isLoading ? (
                <div className="p-8 text-center text-xs text-[#8EB69B]" data-testid="top-spends-loading">
                  Loading top transactions...
                </div>
              ) : topSpendsQuery.data && topSpendsQuery.data.length > 0 ? (
                <div className="divide-y divide-[#163832] rounded-xl bg-[#163832]/40 border border-[#235347] overflow-hidden" data-testid="top-spends-list">
                  {topSpendsQuery.data.map((item, idx) => {
                    const { date, time } = parseTimestamp(item.timestamp);
                    return (
                      <div 
                        key={item.transaction_id || idx} 
                        className="p-3 flex items-center justify-between text-xs hover:bg-[#163832]/70 transition-colors"
                        data-testid={`top-spend-item-${idx}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-[#163832] border border-[#235347] text-[10px] font-mono font-bold text-[#8EB69B] flex items-center justify-center flex-shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-[#DAF1DE] block truncate max-w-[200px]">
                              {item.merchant_name}
                            </span>
                            <span className="text-[10px] text-[#8EB69B] font-mono">
                              {date} • {time}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 pl-2">
                          <span className="font-mono-num font-bold text-[#DAF1DE] text-xs">
                            {formatINR(item.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-[#8EB69B] rounded-xl bg-[#163832]/30 border border-[#235347]" data-testid="top-spends-empty">
                  No transactions in this category.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-[#235347] bg-[#051F20]/40 flex justify-end">
              <button
                onClick={() => setSelectedCategory(null)}
                className="px-3 py-1.5 rounded-lg bg-[#163832] hover:bg-[#235347] border border-[#235347] text-xs font-semibold text-[#DAF1DE] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
