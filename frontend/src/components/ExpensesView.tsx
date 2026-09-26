import React, { useState, useMemo } from 'react';
import { 
  Search, 
  X,
  Split,
  AlertTriangle
} from 'lucide-react';
import { Transaction } from '../types';
import { formatINR } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';

interface ExpensesViewProps {
  transactions: Transaction[];
  onSelectTransaction: (tx: Transaction) => void;
  onOpenAddModal: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  transactions,
  onSelectTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  const filterChips = [
    { id: 'ALL', label: 'All' },
    { id: 'UPI', label: 'UPI' },
    { id: 'CARDS', label: 'Cards' },
    { id: 'DEBITS', label: 'Debits' },
    { id: 'CREDITS', label: 'Credits' },
    { id: 'SPLIT', label: 'Split' },
  ];

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Search
      const matchesSearch = 
        tx.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.upiVpa && tx.upiVpa.toLowerCase().includes(searchQuery.toLowerCase())) ||
        tx.accountNumberMasked.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.amount.toString().includes(searchQuery);

      if (!matchesSearch) return false;

      // Smart Filter
      if (activeFilter === 'UPI' && !tx.paymentMethod.startsWith('UPI')) return false;
      if (activeFilter === 'CARDS' && !tx.paymentMethod.includes('CC') && !tx.paymentMethod.includes('DEBIT')) return false;
      if (activeFilter === 'DEBITS' && tx.type !== 'DEBIT') return false;
      if (activeFilter === 'CREDITS' && tx.type !== 'CREDIT') return false;
      if (activeFilter === 'SPLIT' && (!tx.splitDetails || tx.splitDetails.length === 0)) return false;

      return true;
    });
  }, [transactions, searchQuery, activeFilter]);

  // Group chronologically
  const groupedData = useMemo(() => {
    const groups: { title: string; subtitle: string; items: Transaction[]; totalDebit: number }[] = [];

    const todayItems = filteredTransactions.filter(t => t.date === '2026-08-31');
    const yesterdayItems = filteredTransactions.filter(t => t.date === '2026-08-30');
    const earlierWeekItems = filteredTransactions.filter(t => t.date >= '2026-08-25' && t.date < '2026-08-30');
    const olderItems = filteredTransactions.filter(t => t.date < '2026-08-25');

    if (todayItems.length > 0) {
      groups.push({
        title: 'Today',
        subtitle: '31 Aug',
        items: todayItems,
        totalDebit: todayItems.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)
      });
    }

    if (yesterdayItems.length > 0) {
      groups.push({
        title: 'Yesterday',
        subtitle: '30 Aug',
        items: yesterdayItems,
        totalDebit: yesterdayItems.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)
      });
    }

    if (earlierWeekItems.length > 0) {
      groups.push({
        title: 'Earlier This Week',
        subtitle: '25-29 Aug',
        items: earlierWeekItems,
        totalDebit: earlierWeekItems.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)
      });
    }

    if (olderItems.length > 0) {
      groups.push({
        title: 'Earlier in August',
        subtitle: 'Past',
        items: olderItems,
        totalDebit: olderItems.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)
      });
    }

    return groups;
  }, [filteredTransactions]);

  const totalFilteredOutflow = filteredTransactions
    .filter(t => t.type === 'DEBIT')
    .reduce((acc, t) => acc + t.amount, 0);

  return (
    <div id="expenses-ledger-view" className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* 1. Header & Summary */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-[11px] font-medium tracking-wide uppercase text-[#8EB69B]">Ledger</span>
          <h1 className="text-lg font-bold text-[#DAF1DE] tracking-tight">Transactions</h1>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-[#8EB69B]">Total Outflow</span>
          <p className="text-xs font-bold text-[#DAF1DE] font-mono-num">
            {formatINR(totalFilteredOutflow)}
          </p>
        </div>
      </div>

      {/* 2. Floating Alert & Search Bar */}
      <div className="p-3 rounded-xl bg-[#0B2B26] border border-[#235347] flex items-center gap-2.5 text-xs text-[#DAF1DE]">
        <AlertTriangle size={15} className="text-[#DAF1DE] flex-shrink-0" />
        <span className="font-medium">
          Alert: 'Accidental' late-night Swiggy spree detected.
        </span>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8EB69B]" />
        <input
          id="search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search merchant, UPI ID, amount..."
          className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#0B2B26] border border-[#235347] text-xs text-[#DAF1DE] placeholder-[#8EB69B]/60 focus:outline-none focus:border-[#8EB69B] transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8EB69B] hover:text-[#DAF1DE]"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* 3. Horizontal Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
        {filterChips.map((chip) => {
          const isActive = activeFilter === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setActiveFilter(chip.id)}
              className={`px-3 py-1 rounded-lg whitespace-nowrap font-medium transition-colors text-xs ${
                isActive
                  ? 'bg-[#163832] text-[#DAF1DE] font-semibold border border-[#235347]'
                  : 'bg-transparent text-[#8EB69B] hover:text-[#DAF1DE] hover:bg-[#0B2B26] border border-transparent'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* 4. Grouped Transaction List */}
      <div className="space-y-4">
        {groupedData.length > 0 ? (
          groupedData.map((group) => (
            <div key={group.title} className="space-y-1.5">
              {/* Group Date Header */}
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="font-semibold text-[#8EB69B] text-xs">{group.title}</span>
                <span className="text-[11px] font-mono-num text-[#DAF1DE]">
                  {formatINR(group.totalDebit, false)}
                </span>
              </div>

              {/* Transaction Items */}
              <div className="divide-y divide-[#163832] rounded-2xl bg-[#0B2B26] border border-[#235347] overflow-hidden">
                {group.items.map((tx) => {
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
                            {!tx.isVerified && (
                              <span className="px-1.5 py-0.2 rounded bg-[#163832] border border-[#235347] text-[#DAF1DE] text-[9px] font-medium">
                                Review
                              </span>
                            )}
                            {tx.splitDetails && tx.splitDetails.length > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-[#163832] border border-[#235347] text-[#8EB69B] text-[9px] font-mono flex items-center gap-0.5">
                                <Split size={9} />
                                Split
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-[#8EB69B] mt-0.5 font-mono">
                            <span>{tx.time}</span>
                            <span>•</span>
                            <span>{tx.paymentMethod.replace('UPI_', '').replace('_', ' ')}</span>
                          </div>
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
          ))
        ) : (
          <div className="rounded-2xl bg-[#0B2B26] border border-[#235347] p-8 text-center space-y-2">
            <h3 className="text-xs font-bold text-[#DAF1DE]">No transactions found</h3>
            <p className="text-xs text-[#8EB69B]">
              Try adjusting your search terms or filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
