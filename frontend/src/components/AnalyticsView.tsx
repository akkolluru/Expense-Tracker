import React, { useState } from 'react';
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
import { CategoryBreakdownPoint } from '../types';
import { TimeTravelCard } from './TimeTravelCard';
import { AlertCircle, Zap, ShieldCheck } from 'lucide-react';

interface AnalyticsViewProps {
  totalMonthSpend: number;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  totalMonthSpend,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredData, setHoveredData] = useState<CategoryBreakdownPoint | null>(null);

  const activeBreakdown = hoveredData || (selectedCategory 
    ? CATEGORY_BREAKDOWN_DATA.find(c => c.category === selectedCategory) || null 
    : null);

  const pieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as CategoryBreakdownPoint;
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

  const barTooltip = ({ active, payload }: any) => {
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

      {/* 3. Category Donut Breakdown Card */}
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
                data={CATEGORY_BREAKDOWN_DATA}
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
                {CATEGORY_BREAKDOWN_DATA.map((entry, index) => {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#163832]">
          {CATEGORY_BREAKDOWN_DATA.map((item) => {
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

      {/* 4. Daily Spending Trend */}
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

      {/* 5. Subscriptions & Recurring Mandates with Witty Tags */}
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

              {/* Witty Micro-Copy Tag as specified */}
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
    </div>
  );
};
