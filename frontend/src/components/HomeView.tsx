import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertCircle, 
  ChevronRight, 
  Plus, 
  Scan,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  Building2,
  Wallet,
  Sparkles
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

  // Determine progress bar color gradient based on burn ratio
  const progressBarColor = spendRatio > 85 
    ? 'bg-gradient-to-r from-amber-500 to-rose-500' 
    : spendRatio > 65 
    ? 'bg-gradient-to-r from-emerald-500 to-amber-500' 
    : 'bg-gradient-to-r from-emerald-500 to-[#8EB69B]';

  return (
    <div id="home-view" className="space-y-4 pb-6 animate-in fade-in duration-200">
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-[11px] font-medium tracking-wide uppercase text-[#8EB69B]">
            Overview Dashboard
          </span>
          <h1 className="text-xl font-bold text-[#DAF1DE] tracking-tight">August 2026</h1>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0B2B26] border border-[#235347] text-xs text-[#8EB69B] font-mono shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-[#DAF1DE] font-medium">Live Sync</span>
        </div>
      </div>

      {/* 2. Bento-Box Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        {/* Main Available Balance Bento Card (Span 12 / 7 on desktop) */}
        <div className="md:col-span-7 rounded-2xl bg-gradient-to-b from-[#0B2B26] to-[#07201D] border border-[#235347] p-5 space-y-4 shadow-[0_4px_24px_-4px_rgba(35,83,71,0.35)] flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-[#8EB69B] font-medium uppercase tracking-wider">
                  Available Balance
                </p>
              </div>
              <h2 className="text-3xl font-extrabold text-[#DAF1DE] tracking-tight font-mono-num mt-1">
                {formatINR(cashFlow.totalBalance)}
              </h2>
              <p className="text-xs text-[#8EB69B] font-medium mt-1">
                Stonks are looking promising today, financial wizard.
              </p>
            </div>

            {/* Savings Pill */}
            <div className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-300 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-600/40 shadow-sm flex-shrink-0">
              <TrendingUp size={13} className="text-emerald-400" />
              <span>+{cashFlow.savingsRatePercent}% saved</span>
            </div>
          </div>

          {/* Cash Flow Details & Progress */}
          <div className="pt-3 border-t border-[#163832] space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 text-[#8EB69B]">
                <ArrowDownRight size={14} className="text-rose-400" />
                <span>Spent: <strong className="text-[#DAF1DE] font-mono-num">{formatINR(cashFlow.monthSpend, false)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-[#8EB69B]">
                <ArrowUpRight size={14} className="text-emerald-400" />
                <span>Income: <strong className="text-[#DAF1DE] font-mono-num">{formatINR(cashFlow.monthIncome, false)}</strong></span>
              </div>
            </div>

            {/* Progress bar with percentage marker */}
            <div className="space-y-1">
              <div className="w-full h-2 bg-[#051F20] rounded-full overflow-hidden p-0.5 border border-[#163832]">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`}
                  style={{ width: `${spendRatio}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#8EB69B]">
                <span>{spendRatio}% of income spent</span>
                <span>{100 - spendRatio}% buffer remaining</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Bento Tiles (Span 12 / 5 on desktop) */}
        <div className="md:col-span-5 grid grid-cols-2 md:grid-cols-1 gap-2.5">
          <button
            id="btn-scan-sms"
            onClick={() => onOpenAddModal('sms')}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0B2B26] hover:bg-[#163832] active:bg-[#163832] border border-[#235347] text-left text-xs font-semibold text-[#DAF1DE] transition-all group touch-press shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#163832] border border-[#235347] flex items-center justify-center text-[#DAF1DE] group-hover:bg-[#235347] flex-shrink-0 shadow-sm">
                <Scan size={16} />
              </div>
              <div>
                <span className="block font-bold">Parse Bank SMS</span>
                <span className="text-[10px] text-[#8EB69B] font-normal">Auto-extract alert</span>
              </div>
            </div>
            <ChevronRight size={14} className="text-[#8EB69B] group-hover:text-[#DAF1DE]" />
          </button>

          <button
            id="btn-manual-add"
            onClick={() => onOpenAddModal('manual')}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#163832] hover:bg-[#235347] active:bg-[#235347] border border-[#235347] text-left text-xs font-semibold text-[#DAF1DE] transition-all group touch-press shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#0B2B26] border border-[#235347] flex items-center justify-center text-[#DAF1DE] flex-shrink-0 shadow-sm">
                <Plus size={16} />
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
          className="cursor-pointer rounded-2xl bg-gradient-to-r from-amber-950/40 via-[#163832] to-[#0B2B26] border border-amber-600/50 hover:border-amber-500/80 p-4 flex items-center justify-between transition-all text-xs shadow-[0_0_20px_-5px_rgba(245,158,11,0.2)] touch-press"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 flex-shrink-0 shadow-sm">
              <AlertCircle size={18} />
            </div>
            <div>
              <span className="font-bold text-[#DAF1DE] text-xs block">
                The 'Clean Slate' Protocol: Clear your queue for a dopamine hit.
              </span>
              <p className="text-[11px] text-amber-200/90 mt-0.5 font-mono">
                {unverifiedTransactions.length} pending unclassified transaction{unverifiedTransactions.length === 1 ? '' : 's'} waiting for review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-amber-300 font-bold flex-shrink-0 pl-2">
            <span>Review</span>
            <ChevronRight size={14} />
          </div>
        </div>
      )}

      {/* 4. Accounts Quick Glance Horizontal Carousel */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs px-0.5">
          <span className="font-semibold uppercase tracking-wider text-[#8EB69B]">
            Active Accounts
          </span>
          <span className="text-[11px] text-[#8EB69B] font-mono">3 Connected</span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar snap-x">
          {/* Account Card 1: HDFC */}
          <div className="min-w-[170px] snap-start rounded-xl bg-[#0B2B26] border border-[#235347] p-3 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#DAF1DE] flex items-center gap-1.5">
                <Building2 size={13} className="text-[#8EB69B]" />
                HDFC Bank
              </span>
              <span className="text-[10px] font-mono text-[#8EB69B]">••4590</span>
            </div>
            <div className="mt-2.5">
              <span className="text-[10px] text-[#8EB69B] uppercase font-mono block">Savings Balance</span>
              <span className="text-sm font-bold font-mono-num text-[#DAF1DE]">₹1,85,000.00</span>
            </div>
          </div>

          {/* Account Card 2: ICICI Credit Card */}
          <div className="min-w-[170px] snap-start rounded-xl bg-[#0B2B26] border border-[#235347] p-3 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#DAF1DE] flex items-center gap-1.5">
                <CreditCard size={13} className="text-[#8EB69B]" />
                ICICI Coral
              </span>
              <span className="text-[10px] font-mono text-[#8EB69B]">••8421</span>
            </div>
            <div className="mt-2.5">
              <span className="text-[10px] text-[#8EB69B] uppercase font-mono block">Spent This Month</span>
              <span className="text-sm font-bold font-mono-num text-rose-300">₹38,200.00</span>
            </div>
          </div>

          {/* Account Card 3: Cash Wallet */}
          <div className="min-w-[170px] snap-start rounded-xl bg-[#0B2B26] border border-[#235347] p-3 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#DAF1DE] flex items-center gap-1.5">
                <Wallet size={13} className="text-[#8EB69B]" />
                Cash Wallet
              </span>
              <span className="text-[10px] font-mono text-[#8EB69B]">Cash</span>
            </div>
            <div className="mt-2.5">
              <span className="text-[10px] text-[#8EB69B] uppercase font-mono block">Available Cash</span>
              <span className="text-sm font-bold font-mono-num text-[#DAF1DE]">₹4,200.00</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. AI Financial Time-Travel Card */}
      <TimeTravelCard />

      {/* 6. Ledger (Recent Activity) with Floating Alert */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8EB69B]">
              Ledger (Recent Activity)
            </h3>
          </div>
          <button
            onClick={onNavigateToExpenses}
            className="text-xs text-[#8EB69B] hover:text-[#DAF1DE] flex items-center gap-0.5 transition-colors font-medium touch-press"
          >
            <span>View All Ledger</span>
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Floating Witty Alert as requested */}
        <div className="p-3 rounded-xl bg-[#0B2B26] border border-[#235347] flex items-center gap-2.5 text-xs text-[#DAF1DE] shadow-sm">
          <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />
          <span className="font-medium">
            Alert: 'Accidental' late-night Swiggy spree detected.
          </span>
        </div>

        {/* Transaction Ledger Items List */}
        <div className="divide-y divide-[#163832] rounded-2xl bg-[#0B2B26] border border-[#235347] overflow-hidden shadow-sm">
          {verifiedLedgerTransactions.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8EB69B]">
              No verified transactions yet. Parse a bank SMS or record an expense above.
            </div>
          ) : (
            verifiedLedgerTransactions.slice(0, 5).map((tx) => {
              const isCredit = tx.type === 'CREDIT';

              return (
                <div
                  key={tx.id}
                  onClick={() => onSelectTransaction(tx)}
                  className="flex items-center justify-between p-3.5 hover:bg-[#163832]/60 active:bg-[#163832] cursor-pointer transition-colors touch-press"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#163832] border border-[#235347] flex items-center justify-center flex-shrink-0 shadow-sm">
                      <CategoryIcon category={tx.category} size={16} showBg={false} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-[#DAF1DE] truncate">{tx.merchant}</span>
                      </div>
                      <span className="text-[11px] text-[#8EB69B] block mt-0.5 font-mono">
                        {tx.time} • {tx.paymentMethod.replace('UPI_', '').replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 pl-2">
                    <span className={`text-xs font-bold font-mono-num ${isCredit ? 'text-emerald-400' : 'text-[#DAF1DE]'}`}>
                      {isCredit ? '+' : '-'}{formatINR(tx.amount)}
                    </span>
                    <p className="text-[10px] text-[#8EB69B] mt-0.5 font-mono">{tx.accountNumberMasked.replace('Bank ', '')}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
