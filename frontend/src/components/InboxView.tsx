import React, { useState } from 'react';
import { 
  Check, 
  Split, 
  RotateCcw, 
  CheckCircle2, 
  MessageSquareText, 
  ShieldCheck 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, ExpenseCategory } from '../types';
import { formatINR } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { CATEGORIES_CONFIG } from '../data/mockData';

interface InboxViewProps {
  unverifiedTransactions: Transaction[];
  onVerifyTransaction: (txId: string, assignedCategory: ExpenseCategory, learnMerchant?: boolean) => void;
  onOpenSplitDrawer: (tx: Transaction) => void;
  onResetInbox: () => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  unverifiedTransactions,
  onVerifyTransaction,
  onOpenSplitDrawer,
  onResetInbox,
}) => {
  const [selectedCategoryOverride, setSelectedCategoryOverride] = useState<ExpenseCategory | null>(null);
  const [showRawSms, setShowRawSms] = useState<boolean>(false);
  const [learnMerchant, setLearnMerchant] = useState<boolean>(true);

  const currentTx = unverifiedTransactions[0];

  const handleQuickConfirm = (categoryToUse?: ExpenseCategory) => {
    if (!currentTx) return;
    const finalCategory = categoryToUse || selectedCategoryOverride || currentTx.aiSuggestedCategory || 'Uncategorized';
    onVerifyTransaction(currentTx.id, finalCategory, learnMerchant);
    setSelectedCategoryOverride(null);
    setShowRawSms(false);
  };

  const commonCategories: ExpenseCategory[] = [
    'Food & Dining',
    'Groceries & Quick-Commerce',
    'Transportation',
    'Shopping & E-Commerce',
    'Utilities & Bills',
    'Entertainment & Subscriptions',
    'Health & Medical',
    'Investments & Savings'
  ];

  return (
    <div id="inbox-view" className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* 1. Header & Protocol Banner */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium tracking-wide uppercase text-[#8EB69B]">
              Review Queue
            </span>
            <h1 className="text-lg font-bold text-[#DAF1DE] tracking-tight">
              Pending Classification ({unverifiedTransactions.length})
            </h1>
          </div>

          {unverifiedTransactions.length === 0 && (
            <button
              onClick={onResetInbox}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#163832] hover:bg-[#235347] border border-[#235347] text-[#DAF1DE] text-xs font-medium transition-colors"
            >
              <RotateCcw size={13} />
              <span>Reset Demo</span>
            </button>
          )}
        </div>

        {/* Clean Slate Protocol Banner as specified */}
        <div className="p-3.5 rounded-2xl bg-[#163832] border border-[#235347] flex items-center gap-2.5 text-xs text-[#DAF1DE]">
          <ShieldCheck size={16} className="text-[#DAF1DE] flex-shrink-0" />
          <div>
            <span className="font-bold block">
              The 'Clean Slate' Protocol: Clear your queue for a dopamine hit.
            </span>
            <span className="text-[11px] text-[#8EB69B]">
              Review and categorize pending bank transactions to keep budgets accurate.
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Verification Deck or Inbox Zero */}
      <AnimatePresence mode="wait">
        {unverifiedTransactions.length > 0 && currentTx ? (
          <motion.div
            key={currentTx.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="space-y-3.5"
          >
            {/* Card Counter */}
            <div className="flex items-center justify-between text-xs text-[#8EB69B] px-0.5">
              <span>Card 1 of {unverifiedTransactions.length}</span>
              <span className="font-mono text-[#DAF1DE]">
                Pending: ₹{unverifiedTransactions.reduce((a, b) => a + b.amount, 0).toLocaleString('en-IN')}
              </span>
            </div>

            {/* Active Transaction Review Card */}
            <div className="rounded-2xl bg-[#0B2B26] border border-[#235347] p-5 space-y-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#163832] border border-[#235347] flex items-center justify-center flex-shrink-0">
                    <CategoryIcon 
                      category={selectedCategoryOverride || currentTx.aiSuggestedCategory || 'Uncategorized'} 
                      size={18}
                      showBg={false}
                    />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#DAF1DE] leading-snug">{currentTx.merchant}</h2>
                    <span className="text-xs text-[#8EB69B] font-mono block mt-0.5">
                      {currentTx.accountNumberMasked} • {currentTx.time}
                    </span>
                    {currentTx.upiVpa && (
                      <span className="inline-block font-mono text-[10px] text-[#DAF1DE] bg-[#163832] border border-[#235347] px-2 py-0.5 rounded mt-1">
                        UPI: {currentTx.upiVpa}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xl font-bold text-[#DAF1DE] font-mono-num">
                    -{formatINR(currentTx.amount)}
                  </span>
                </div>
              </div>

              {/* Category Selection Preview */}
              <div className="pt-3 border-t border-[#163832] flex items-center justify-between text-xs">
                <span className="text-[#8EB69B]">Category:</span>
                <span className="font-semibold text-[#DAF1DE]">
                  {selectedCategoryOverride || currentTx.aiSuggestedCategory || 'Uncategorized'}
                </span>
              </div>

              {/* Raw Bank Alert SMS Snippet Dropdown */}
              {currentTx.rawSmsSnippet && (
                <div className="pt-1">
                  <button
                    onClick={() => setShowRawSms(!showRawSms)}
                    className="flex items-center justify-between w-full text-[11px] text-[#8EB69B] hover:text-[#DAF1DE] transition-colors py-1"
                  >
                    <span className="flex items-center gap-1.5">
                      <MessageSquareText size={13} />
                      Original Bank SMS
                    </span>
                    <span className="text-[#8EB69B]">{showRawSms ? 'Hide' : 'Show'}</span>
                  </button>

                  {showRawSms && (
                    <div className="p-2.5 rounded-xl bg-[#163832] border border-[#235347] text-[11px] font-mono text-[#DAF1DE] leading-relaxed mt-1 select-all">
                      "{currentTx.rawSmsSnippet}"
                    </div>
                  )}
                </div>
              )}

              {/* Selective Learning Option */}
              <label className="flex items-center gap-2 pt-2 text-xs text-[#8EB69B] cursor-pointer select-none">
                <input
                  id="checkbox-learn-merchant"
                  type="checkbox"
                  checked={learnMerchant}
                  onChange={(e) => setLearnMerchant(e.target.checked)}
                  className="rounded border-[#235347] bg-[#163832] text-[#8EB69B] focus:ring-0 w-3.5 h-3.5"
                />
                <span>Remember for future transactions (Selective Learning)</span>
              </label>
            </div>

            {/* Category Selection Grid */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-[#8EB69B]">
                  Select Category
                </span>
                <span className="text-[#8EB69B] text-[11px]">Tap to change</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {commonCategories.map((cat) => {
                  const isSelected = (selectedCategoryOverride || currentTx.aiSuggestedCategory) === cat;
                  const config = CATEGORIES_CONFIG[cat];

                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategoryOverride(cat)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-colors text-left ${
                        isSelected
                          ? 'bg-[#163832] border-[#8EB69B] text-[#DAF1DE] font-semibold'
                          : 'bg-[#0B2B26] border-[#235347] text-[#8EB69B] hover:bg-[#163832] hover:text-[#DAF1DE]'
                      }`}
                    >
                      <div 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: config.colorHex }}
                      />
                      <span className="truncate">{cat}</span>
                      {isSelected && <Check size={13} className="ml-auto text-[#DAF1DE] flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                id="btn-split-inbox"
                onClick={() => onOpenSplitDrawer(currentTx)}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#0B2B26] hover:bg-[#163832] border border-[#235347] text-[#DAF1DE] text-xs font-semibold transition-colors"
              >
                <Split size={14} className="text-[#8EB69B]" />
                <span>Split Bill</span>
              </button>

              <button
                id="btn-confirm-verify"
                onClick={() => handleQuickConfirm()}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#DAF1DE] hover:bg-white text-[#051F20] text-xs font-bold transition-colors shadow-sm"
              >
                <CheckCircle2 size={14} />
                <span>Confirm</span>
              </button>
            </div>
          </motion.div>
        ) : (
          /* Inbox Zero State */
          <div className="rounded-2xl bg-[#0B2B26] border border-[#235347] p-8 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-[#163832] border border-[#235347] flex items-center justify-center mx-auto text-[#DAF1DE]">
              <ShieldCheck size={24} />
            </div>

            <div>
              <h2 className="text-base font-bold text-[#DAF1DE]">All Transactions Verified</h2>
              <p className="text-xs text-[#8EB69B] max-w-xs mx-auto mt-1 leading-relaxed">
                No pending SMS alerts waiting for review. All expenses are categorized.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onResetInbox}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#163832] hover:bg-[#235347] border border-[#235347] text-[#DAF1DE] text-xs font-semibold transition-colors"
              >
                <RotateCcw size={13} />
                <span>Simulate Demo Alerts</span>
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
