import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertCircle, 
  ChevronRight, 
  Plus, 
  Scan,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Receipt,
  Layers
} from 'lucide-react';
import { Transaction, CashFlowSummary } from '../types';
import { formatINR } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { TimeTravelCard } from './TimeTravelCard';

interface HomeViewProps {
  cashFlow: CashFlowSummary;
  recentTransactions: Transaction[];
  unverifiedTransactions: Transaction[];
  onNavigateToInbox: () => void;
  onNavigateToExpenses: () => void;
  onNavigateToAnalytics: () => void;
  onOpenAddModal: (mode?: 'manual' | 'sms') => void;
  onSelectTransaction: (tx: Transaction) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  cashFlow,
  recentTransactions,
  unverifiedTransactions,
  onNavigateToInbox,
  onNavigateToExpenses,
  onOpenAddModal,
  onSelectTransaction,
}) => {
  const verifiedLedgerTransactions = recentTransactions.filter(t => t.isVerified);
  const spendRatio = Math.min(100, Math.round((cashFlow.monthSpend / (cashFlow.monthIncome || 1)) * 100));

  return (
    <div id="home-view" className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-[11px] font-medium tracking-wide uppercase text-[#8EB69B]">
            Overview Dashboard
          </span>
          <h1 className="text-lg font-bold text-[#DAF1DE] tracking-tight">August 2026</h1>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[#8EB69B] font-mono">
          <span className="w-2 h-2 rounded-full bg-[#8EB69B]" />
          <span>Live Sync</span>
        </div>
      </div>

      {/* 2. Bento-Box Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        {/* Main Available Balance Bento Card (Span 12 / 7 on desktop) */}
        <div className="md:col-span-7 rounded-2xl bg-[#0B2B26] border border-[#235347] p-5 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-[#8EB69B] font-medium uppercase tracking-wider">
                  Available Balance
                </p>
              </div>
              <h2 className="text-3xl font-extrabold text-[#DAF1DE] tracking-tight font-mono-num mt-1">
                {formatINR(cashFlow.totalBalance)}
              </h2>
              {/* Micro-copy strictly as requested (no emojis) */}
              <p className="text-xs text-[#8EB69B] font-medium mt-1">
                Stonks are looking promising today, financial wizard.
              </p>
            </div>

            {/* Savings Pill */}
            <div className="flex items-center gap-1 text-xs font-mono font-bold text-[#DAF1DE] bg-[#163832] px-3 py-1.5 rounded-xl border border-[#235347] shadow-sm">
              <TrendingUp size={13} className="text-[#DAF1DE]" />
              <span>+{cashFlow.savingsRatePercent}% saved</span>
            </div>
          </div>

          {/* Cash Flow Details & Progress */}
          <div className="pt-3 border-t border-[#163832] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 text-[#8EB69B]">
                <ArrowDownRight size={14} className="text-[#8EB69B]" />
                <span>Spent: <strong className="text-[#DAF1DE] font-mono-num">{formatINR(cashFlow.monthSpend, false)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-[#8EB69B]">
                <ArrowUpRight size={14} className="text-[#DAF1DE]" />
                <span>Income: <strong className="text-[#DAF1DE] font-mono-num">{formatINR(cashFlow.monthIncome, false)}</strong></span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-[#163832] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#8EB69B] rounded-full transition-all duration-500"
                style={{ width: `${spendRatio}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Action Bento Tiles (Span 12 / 5 on desktop) */}
        <div className="md:col-span-5 grid grid-cols-2 md:grid-cols-1 gap-2.5">
          <button
            id="btn-scan-sms"
            onClick={() => onOpenAddModal('sms')}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0B2B26] hover:bg-[#163832] border border-[#235347] text-left text-xs font-semibold text-[#DAF1DE] transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#163832] border border-[#235347] flex items-center justify-center text-[#DAF1DE] group-hover:bg-[#235347]">
                <Scan size={15} />
              </div>
              <div>
                <span className="block font-bold">Parse Bank SMS</span>
                <span className="text-[10px] text-[#8EB69B] font-normal">Auto-extract transaction</span>
              </div>
            </div>
            <ChevronRight size={14} className="text-[#8EB69B] group-hover:text-[#DAF1DE]" />
          </button>

          <button
            id="btn-manual-add"
            onClick={() => onOpenAddModal('manual')}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#163832] hover:bg-[#235347] border border-[#235347] text-left text-xs font-semibold text-[#DAF1DE] transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0B2B26] border border-[#235347] flex items-center justify-center text-[#DAF1DE]">
                <Plus size={15} />
              </div>
              <div>
                <span className="block font-bold">Record Expense</span>
                <span className="text-[10px] text-[#8EB69B] font-normal">Quick manual entry</span>
              </div>
            </div>
            <ChevronRight size={14} className="text-[#8EB69B] group-hover:text-[#DAF1DE]" />
          </button>
        </div>
      </div>

      {/* 3. Review Queue Banner: The 'Clean Slate' Protocol */}
      {unverifiedTransactions.length > 0 && (
        <div
          id="needs-review-banner"
          onClick={onNavigateToInbox}
          className="cursor-pointer rounded-2xl bg-[#163832] border border-[#235347] p-4 flex items-center justify-between hover:bg-[#163832]/80 transition-all text-xs shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#0B2B26] border border-[#235347] flex items-center justify-center text-[#DAF1DE] flex-shrink-0">
              <AlertCircle size={16} />
            </div>
            <div>
              <span className="font-bold text-[#DAF1DE] text-xs block">
                The 'Clean Slate' Protocol: Clear your queue for a dopamine hit.
              </span>
              <p className="text-[11px] text-[#8EB69B] mt-0.5 font-mono">
                {unverifiedTransactions.length} pending unclassified transactions waiting for review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[#DAF1DE] font-semibold flex-shrink-0 pl-2">
            <span>Review</span>
            <ChevronRight size={14} />
          </div>
        </div>
      )}

      {/* 4. AI Financial Time-Travel Card */}
      <TimeTravelCard />

      {/* 5. Ledger (Recent Activity) with Floating Alert */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8EB69B]">
              Ledger (Recent Activity)
            </h3>
          </div>
          <button
            onClick={onNavigateToExpenses}
            className="text-xs text-[#8EB69B] hover:text-[#DAF1DE] flex items-center gap-0.5 transition-colors font-medium"
          >
            <span>View All Ledger</span>
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Floating Witty Alert as requested */}
        <div className="p-3 rounded-xl bg-[#0B2B26] border border-[#235347] flex items-center gap-2.5 text-xs text-[#DAF1DE]">
          <AlertTriangle size={15} className="text-[#DAF1DE] flex-shrink-0" />
          <span className="font-medium">
            Alert: 'Accidental' late-night Swiggy spree detected.
          </span>
        </div>

        {/* Transaction Ledger Items List */}
        <div className="divide-y divide-[#163832] rounded-2xl bg-[#0B2B26] border border-[#235347] overflow-hidden shadow-sm">
          {verifiedLedgerTransactions.slice(0, 5).map((tx) => {
            const isCredit = tx.type === 'CREDIT';

            return (
              <div
                key={tx.id}
                onClick={() => onSelectTransaction(tx)}
                className="flex items-center justify-between p-3.5 hover:bg-[#163832]/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#163832] border border-[#235347] flex items-center justify-center flex-shrink-0">
                    <CategoryIcon category={tx.category} size={15} showBg={false} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[#DAF1DE] truncate">{tx.merchant}</span>
                    </div>
                    <span className="text-[11px] text-[#8EB69B] block mt-0.5 font-mono">
                      {tx.time} • {tx.paymentMethod.replace('UPI_', '').replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 pl-2">
                  <span className={`text-xs font-bold font-mono-num ${isCredit ? 'text-[#8EB69B]' : 'text-[#DAF1DE]'}`}>
                    {isCredit ? '+' : '-'}{formatINR(tx.amount)}
                  </span>
                  <p className="text-[10px] text-[#8EB69B] mt-0.5 font-mono">{tx.accountNumberMasked.replace('Bank ', '')}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
