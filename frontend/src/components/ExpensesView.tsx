import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  X, 
  Split, 
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import { Transaction, ExpenseCategory } from '../types';
import { formatINR } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';

interface ExpensesViewProps {
  transactions: Transaction[];
  onSelectTransaction: (tx: Transaction) => void;
  onOpenAddModal: () => void;
}

const PAGE_SIZE = 20;

export const CATEGORY_FILTERS: { id: ExpenseCategory | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'All Categories' },
  { id: 'Food & Dining', label: 'Food & Dining' },
  { id: 'Groceries & Quick-Commerce', label: 'Groceries' },
  { id: 'Shopping & E-Commerce', label: 'Shopping' },
  { id: 'Transportation', label: 'Transportation' },
  { id: 'Utilities & Bills', label: 'Bills & Utilities' },
  { id: 'Entertainment & Subscriptions', label: 'Entertainment' },
  { id: 'Health & Medical', label: 'Health' },
  { id: 'Investments & Savings', label: 'Investments' },
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  transactions,
  onSelectTransaction,
}) => {
  const [inputSearch, setInputSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [activeCategory, setActiveCategory] = useState<ExpenseCategory | 'ALL'>('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // Debounce search input by 250ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(inputSearch);
    }, 250);
    return () => clearTimeout(handler);
  }, [inputSearch]);

  // Reset pagination to first page whenever search or filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearch, activeFilter, activeCategory]);

  const filterChips = [
    { id: 'ALL', label: 'All' },
    { id: 'UPI', label: 'UPI' },
    { id: 'CARDS', label: 'Cards' },
    { id: 'DEBITS', label: 'Debits' },
    { id: 'CREDITS', label: 'Credits' },
    { id: 'SPLIT', label: 'Split' },
  ];

  // Combined filtering: Search + Payment Mode/Type + Category
  const filteredTransactions = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return transactions.filter((tx) => {
      // 1. Debounced Search filter
      if (query) {
        const matchesSearch =
          tx.merchant.toLowerCase().includes(query) ||
          (tx.upiVpa && tx.upiVpa.toLowerCase().includes(query)) ||
          tx.accountNumberMasked.toLowerCase().includes(query) ||
          tx.category.toLowerCase().includes(query) ||
          tx.amount.toString().includes(query) ||
          (tx.notes && tx.notes.toLowerCase().includes(query));

        if (!matchesSearch) return false;
      }

      // 2. Mode / Type filter
      if (activeFilter === 'UPI' && !tx.paymentMethod.startsWith('UPI')) return false;
      if (activeFilter === 'CARDS' && !tx.paymentMethod.includes('CC') && !tx.paymentMethod.includes('DEBIT')) return false;
      if (activeFilter === 'DEBITS' && tx.type !== 'DEBIT') return false;
      if (activeFilter === 'CREDITS' && tx.type !== 'CREDIT') return false;
      if (activeFilter === 'SPLIT' && (!tx.splitDetails || tx.splitDetails.length === 0)) return false;

      // 3. Category filter
      if (activeCategory !== 'ALL' && tx.category !== activeCategory) {
        return false;
      }

      return true;
    });
  }, [transactions, debouncedSearch, activeFilter, activeCategory]);

  // Pagination slice
  const visibleTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleCount);
  }, [filteredTransactions, visibleCount]);

  // Group chronologically
  const groupedData = useMemo(() => {
    const groups: { title: string; subtitle: string; items: Transaction[]; totalDebit: number }[] = [];

    const todayItems = visibleTransactions.filter(t => t.date >= '2026-08-31');
    const yesterdayItems = visibleTransactions.filter(t => t.date === '2026-08-30');
    const earlierWeekItems = visibleTransactions.filter(t => t.date >= '2026-08-25' && t.date < '2026-08-30');
    const olderItems = visibleTransactions.filter(t => t.date < '2026-08-25');

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
  }, [visibleTransactions]);

  const totalFilteredOutflow = filteredTransactions
    .filter(t => t.type === 'DEBIT')
    .reduce((acc, t) => acc + t.amount, 0);

  const handleClearSearch = () => {
    setInputSearch('');
    setDebouncedSearch('');
  };

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
          value={inputSearch}
          onChange={(e) => setInputSearch(e.target.value)}
          placeholder="Search merchant, UPI ID, amount..."
          className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#0B2B26] border border-[#235347] text-xs text-[#DAF1DE] placeholder-[#8EB69B]/60 focus:outline-none focus:border-[#8EB69B] transition-colors"
        />
        {inputSearch && (
          <button
            onClick={handleClearSearch}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8EB69B] hover:text-[#DAF1DE]"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* 3. Filter Controls: Mode Filter Tabs */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs scrollbar-none" data-testid="mode-filters">
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

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none" data-testid="category-filters">
          {CATEGORY_FILTERS.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-0.5 rounded-full whitespace-nowrap font-medium transition-colors text-[11px] flex items-center gap-1 ${
                  isActive
                    ? 'bg-[#235347] text-[#DAF1DE] border border-[#8EB69B]/60'
                    : 'bg-[#0B2B26]/80 text-[#8EB69B] hover:text-[#DAF1DE] border border-[#163832]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
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
                      data-testid={`transaction-row-${tx.id}`}
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

        {/* 5. Pagination / Load More Button */}
        {filteredTransactions.length > visibleCount && (
          <div className="flex flex-col items-center justify-center pt-2 space-y-1">
            <button
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              className="px-4 py-2 rounded-xl bg-[#163832] border border-[#235347] hover:bg-[#235347] text-xs font-semibold text-[#DAF1DE] transition-colors flex items-center gap-1.5 shadow-sm"
              data-testid="load-more-btn"
            >
              <span>Load More Transactions</span>
              <ChevronDown size={14} className="text-[#8EB69B]" />
            </button>
            <span className="text-[10px] text-[#8EB69B] font-mono">
              Showing {visibleCount} of {filteredTransactions.length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
