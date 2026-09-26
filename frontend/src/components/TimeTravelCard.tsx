import React, { useState } from 'react';
import { 
  Sparkles, 
  Clock, 
  TrendingUp, 
  ShieldCheck, 
  Calendar, 
  ArrowUpRight,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type TimeTravelSpan = '1M' | '3M' | '6M' | '1Y';

interface TimeTravelData {
  id: TimeTravelSpan;
  label: string;
  badge: string;
  headline: string;
  summaryText: string;
  stat1: { label: string; value: string; positive: boolean };
  stat2: { label: string; value: string; positive: boolean };
  stat3: { label: string; value: string; positive: boolean };
  highlightTag: string;
}

const TIME_TRAVEL_PRESETS: Record<TimeTravelSpan, TimeTravelData> = {
  '1M': {
    id: '1M',
    label: '1 Month',
    badge: 'August 2026 Wrap',
    headline: 'Small Victories in August',
    summaryText: "You survived August! Groceries are up 15%, but you crushed your dining-out budget. Small victories.",
    stat1: { label: 'Net Savings', value: '+78%', positive: true },
    stat2: { label: 'Dining Out', value: '-22%', positive: true },
    stat3: { label: 'Quick Groceries', value: '+15%', positive: false },
    highlightTag: 'Dining Budget Mastered'
  },
  '3M': {
    id: '3M',
    label: '3 Months',
    badge: 'Q2 Performance',
    headline: 'Quarterly Vibe Check',
    summaryText: "Quarterly vibe check: You're consistently saving 20%, but those random weekend cab rides are adding up faster than you think.",
    stat1: { label: 'Quarterly Rate', value: '20.4%', positive: true },
    stat2: { label: 'Weekend Cabs', value: '₹8,420', positive: false },
    stat3: { label: 'Investments', value: '₹75,000', positive: true },
    highlightTag: 'Cab Outflow Warning'
  },
  '6M': {
    id: '6M',
    label: '6 Months',
    badge: 'Half-Year Trajectory',
    headline: 'Impulse Control & Defense',
    summaryText: "Half-year wrap: You successfully avoided buying that expensive gadget you didn't need. Your emergency fund is officially looking robust.",
    stat1: { label: 'Emergency Fund', value: '5.2 Mo', positive: true },
    stat2: { label: 'Gadget Deflected', value: '₹84,900', positive: true },
    stat3: { label: 'Fixed Outflow', value: '-8%', positive: true },
    highlightTag: 'Emergency Buffer Solid'
  },
  '1Y': {
    id: '1Y',
    label: '1 Year',
    badge: '365-Day Retrospective',
    headline: 'Full Trip Around the Sun',
    summaryText: "A full trip around the sun! You've increased your net worth by 32% this year. We won't talk about the 'Great Zomato Incident' of last November.",
    stat1: { label: 'Net Worth Surge', value: '+32.0%', positive: true },
    stat2: { label: 'SIP Compounding', value: '₹3,00,000', positive: true },
    stat3: { label: 'Dopamine Spend', value: 'Disciplined', positive: true },
    highlightTag: 'Wealth Multiplier Active'
  }
};

export const TimeTravelCard: React.FC = () => {
  const [activeSpan, setActiveSpan] = useState<TimeTravelSpan>('1M');
  const currentData = TIME_TRAVEL_PRESETS[activeSpan];

  return (
    <div className="rounded-2xl bg-[#0B2B26] border border-[#235347] p-5 shadow-lg relative overflow-hidden transition-all">
      {/* Decorative ambient background accent */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#DAF1DE]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header with AI Pill */}
      <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[#163832]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#163832] border border-[#235347] flex items-center justify-center text-[#DAF1DE] shadow-inner">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#DAF1DE] tracking-tight">
                AI Financial Time-Travel
              </h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#163832] text-[#DAF1DE] border border-[#235347]">
                Smart Retrospective
              </span>
            </div>
            <p className="text-[11px] text-[#8EB69B]">Adaptive behavioral financial summary</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#8EB69B] font-mono">
          <Clock size={12} />
          <span>Realtime Synthesis</span>
        </div>
      </div>

      {/* Timeframe Toggle Buttons Row */}
      <div className="pt-3.5 pb-2">
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[#051F20] border border-[#235347]">
          {(['1M', '3M', '6M', '1Y'] as TimeTravelSpan[]).map((span) => {
            const isSelected = activeSpan === span;
            const preset = TIME_TRAVEL_PRESETS[span];

            return (
              <button
                key={span}
                id={`btn-timetravel-${span}`}
                onClick={() => setActiveSpan(span)}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all text-center flex items-center justify-center gap-1 ${
                  isSelected
                    ? 'bg-[#163832] text-[#DAF1DE] border border-[#8EB69B] shadow-sm'
                    : 'text-[#8EB69B] hover:text-[#DAF1DE] hover:bg-[#163832]/40 border border-transparent'
                }`}
              >
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive AI Narrative Display */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSpan}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="space-y-3.5 pt-2"
        >
          {/* Main AI Quote Box */}
          <div className="p-4 rounded-xl bg-[#163832]/80 border border-[#235347] relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8EB69B] font-semibold flex items-center gap-1.5">
                <Calendar size={12} className="text-[#DAF1DE]" />
                {currentData.badge}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0B2B26] border border-[#235347] text-[#DAF1DE]">
                {currentData.highlightTag}
              </span>
            </div>

            <p className="text-sm font-medium text-[#DAF1DE] leading-relaxed select-text">
              "{currentData.summaryText}"
            </p>
          </div>

          {/* 3 Companion Mini-Metrics */}
          <div className="grid grid-cols-3 gap-2 pt-0.5">
            <div className="p-2.5 rounded-xl bg-[#051F20]/70 border border-[#235347]">
              <span className="text-[10px] text-[#8EB69B] block truncate">
                {currentData.stat1.label}
              </span>
              <span className="text-xs font-bold text-[#DAF1DE] font-mono-num block mt-0.5">
                {currentData.stat1.value}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#051F20]/70 border border-[#235347]">
              <span className="text-[10px] text-[#8EB69B] block truncate">
                {currentData.stat2.label}
              </span>
              <span className="text-xs font-bold font-mono-num block mt-0.5 text-[#DAF1DE]">
                {currentData.stat2.value}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#051F20]/70 border border-[#235347]">
              <span className="text-[10px] text-[#8EB69B] block truncate">
                {currentData.stat3.label}
              </span>
              <span className="text-xs font-bold font-mono-num block mt-0.5 text-[#DAF1DE]">
                {currentData.stat3.value}
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
