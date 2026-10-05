import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  RotateCcw, 
  CheckCircle2, 
  MessageSquareText, 
  ShieldCheck,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Split,
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { Transaction, ExpenseCategory } from '../types';
import { formatINR } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { CATEGORIES_CONFIG } from '../data/mockData';

export type LearningPreference = 'remember' | 'once' | 'never';

export interface InboxViewProps {
  unverifiedTransactions: Transaction[];
  onVerifyTransaction: (
    txId: string,
    assignedCategory: ExpenseCategory,
    learnMerchant?: boolean,
    neverAutoClassify?: boolean
  ) => void;
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
  const [learningPreference, setLearningPreference] = useState<LearningPreference>('remember');
  const [showCategorySelector, setShowCategorySelector] = useState<boolean>(false);

  const currentTx = unverifiedTransactions[0];
  const categorySelectorRef = useRef<HTMLDivElement>(null);

  // Framer Motion drag gestures and transforms
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-8, 8]);
  const acceptOpacity = useTransform(x, [15, 80], [0, 1]);
  const reclassifyOpacity = useTransform(x, [-80, -15], [1, 0]);

  // Reset drag position and selections when current transaction changes
  useEffect(() => {
    x.set(0);
    setSelectedCategoryOverride(null);
    setShowRawSms(false);
    setShowCategorySelector(false);
    setLearningPreference('remember');
  }, [currentTx?.id, x]);

  const handleQuickConfirm = (categoryToUse?: ExpenseCategory) => {
    if (!currentTx) return;
    const finalCategory = categoryToUse || selectedCategoryOverride || currentTx.aiSuggestedCategory || 'Uncategorized';
    
    let learnMerchant = true;
    let neverAutoClassify = false;

    if (learningPreference === 'once') {
      learnMerchant = false;
      neverAutoClassify = false;
    } else if (learningPreference === 'never') {
      learnMerchant = false;
      neverAutoClassify = true;
    }

    onVerifyTransaction(currentTx.id, finalCategory, learnMerchant, neverAutoClassify);
    setSelectedCategoryOverride(null);
    setShowRawSms(false);
    setShowCategorySelector(false);
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const threshold = 100;
    const velocityThreshold = 500;

    if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      handleQuickConfirm();
    } else if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      setShowCategorySelector(true);
      setTimeout(() => {
        categorySelectorRef.current?.scrollIntoView?.({ behavior: 'smooth' });
      }, 100);
    }
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
    <div id="inbox-view" className="space-y-4 pb-6 animate-in fade-in duration-200">
      {/* 1. Header & Protocol Banner */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium tracking-wide uppercase text-[#8EB69B]">
              Review Queue
            </span>
            <h1 className="text-xl font-bold text-[#DAF1DE] tracking-tight">
              Pending Classification ({unverifiedTransactions.length})
            </h1>
          </div>

          {unverifiedTransactions.length === 0 && (
            <button
              onClick={onResetInbox}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#163832] hover:bg-[#235347] border border-[#235347] text-[#DAF1DE] text-xs font-semibold transition-colors touch-press shadow-sm"
            >
              <RotateCcw size={13} />
              <span>Reset Demo</span>
            </button>
          )}
        </div>

        {/* Clean Slate Protocol Banner */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-[#163832] to-[#0B2B26] border border-amber-600/50 flex items-center gap-3 text-xs text-[#DAF1DE] shadow-[0_0_20px_-5px_rgba(245,158,11,0.2)]">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 flex-shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <span className="font-bold block text-[#DAF1DE]">
              The 'Clean Slate' Protocol: Clear your queue for a dopamine hit.
            </span>
            <span className="text-[11px] text-amber-200/90 mt-0.5 block">
              Review and categorize pending bank transactions to keep budgets and ledger accurate.
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
            {/* Card Counter & Pending Total */}
            <div className="flex items-center justify-between text-xs text-[#8EB69B] px-1">
              <span className="font-medium">Card 1 of {unverifiedTransactions.length}</span>
              <span className="font-mono text-amber-300 font-semibold">
                Pending: ₹{unverifiedTransactions.reduce((a, b) => a + b.amount, 0).toLocaleString('en-IN')}
              </span>
            </div>

            {/* Draggable Active Review Card with Depth Stack */}
            <div className="relative">
              {/* Subtle background card teaser for stack depth */}
              {unverifiedTransactions.length > 1 && (
                <div 
                  aria-hidden="true"
                  className="absolute inset-0 top-2.5 scale-[0.96] rounded-2xl bg-[#0B2B26]/80 border border-[#235347]/60 pointer-events-none -z-10 shadow-sm transition-transform duration-200" 
                />
              )}

              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                style={{ x, rotate }}
                onDragEnd={handleDragEnd}
                className="relative touch-pan-y cursor-grab active:cursor-grabbing rounded-2xl bg-gradient-to-b from-[#0B2B26] to-[#07201D] border border-[#235347] p-5 space-y-4 shadow-[0_4px_24px_-4px_rgba(35,83,71,0.35)] overflow-hidden select-none"
              >
                {/* Swipe Right Feedback Overlay (Accept) */}
                <motion.div
                  style={{ opacity: acceptOpacity }}
                  className="absolute top-4 right-4 z-20 pointer-events-none flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-emerald-500 bg-emerald-950/90 text-emerald-400 font-black text-xs tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.4)] rotate-6"
                >
                  <Check size={16} strokeWidth={3} />
                  <span>✓ ACCEPT</span>
                </motion.div>

                {/* Swipe Left Feedback Overlay (Reclassify) */}
                <motion.div
                  style={{ opacity: reclassifyOpacity }}
                  className="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-rose-500 bg-rose-950/90 text-rose-400 font-black text-xs tracking-wider shadow-[0_0_20px_rgba(244,63,94,0.4)] -rotate-6"
                >
                  <X size={16} strokeWidth={3} />
                  <span>✕ RECLASSIFY</span>
                </motion.div>

                {/* Dynamic Subtle Glow Backdrops */}
                <motion.div
                  style={{ opacity: acceptOpacity }}
                  className="absolute inset-0 rounded-2xl bg-emerald-500/10 pointer-events-none z-10"
                />
                <motion.div
                  style={{ opacity: reclassifyOpacity }}
                  className="absolute inset-0 rounded-2xl bg-rose-500/10 pointer-events-none z-10"
                />

                {/* Card Content Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[#163832] border border-[#235347] flex items-center justify-center flex-shrink-0 shadow-sm">
                      <CategoryIcon 
                        category={selectedCategoryOverride || currentTx.aiSuggestedCategory || 'Uncategorized'} 
                        size={20}
                        showBg={false}
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-[#DAF1DE] leading-snug truncate">{currentTx.merchant}</h2>
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

                  <div className="text-right flex-shrink-0">
                    <span className="text-2xl font-black text-rose-400 font-mono-num block">
                      -{formatINR(currentTx.amount)}
                    </span>
                    <span className="text-[10px] text-[#8EB69B] uppercase font-mono tracking-wider">Debit</span>
                  </div>
                </div>

                {/* AI Recommendation Pill & Active Category Preview */}
                <div className="pt-3 border-t border-[#163832] flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1.5 text-[#8EB69B]">
                    <Sparkles size={13} className="text-amber-400" />
                    <span>AI Suggestion:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#DAF1DE] bg-[#163832] border border-[#235347] px-2.5 py-1 rounded-lg">
                      {selectedCategoryOverride || currentTx.aiSuggestedCategory || 'Uncategorized'}
                    </span>
                    {currentTx.aiConfidence && (
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-600/40 px-1.5 py-0.5 rounded">
                        {currentTx.aiConfidence}% match
                      </span>
                    )}
                  </div>
                </div>

                {/* Raw Bank Alert SMS Snippet Dropdown */}
                {currentTx.rawSmsSnippet && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRawSms(!showRawSms)}
                      className="flex items-center justify-between w-full text-[11px] text-[#8EB69B] hover:text-[#DAF1DE] transition-colors py-1.5 px-2.5 rounded-lg bg-[#051F20]/50 border border-[#163832]"
                    >
                      <span className="flex items-center gap-1.5">
                        <MessageSquareText size={13} />
                        Original Bank Alert SMS
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-mono">
                        {showRawSms ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {showRawSms ? 'Hide' : 'Show'}
                      </span>
                    </button>

                    {showRawSms && (
                      <div className="p-3 rounded-xl bg-[#051F20] border border-[#235347] text-[11px] font-mono text-[#DAF1DE] leading-relaxed mt-1.5 select-all">
                        "{currentTx.rawSmsSnippet}"
                      </div>
                    )}
                  </div>
                )}

                {/* Learning Preference Selector (Tier-2 Memory & P2P Friends Guard) */}
                <div className="space-y-2 pt-1 text-left">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold text-[#8EB69B] uppercase tracking-wider">
                      Classification Memory
                    </span>
                    <span className="text-[10px] font-medium text-[#8EB69B]">
                      {learningPreference === 'remember' && 'Rule will be saved'}
                      {learningPreference === 'once' && 'One-time only'}
                      {learningPreference === 'never' && 'Always route to review'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Learning preference">
                    {/* 1. Remember Option */}
                    <label
                      htmlFor="radio-learn-remember"
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none touch-press ${
                        learningPreference === 'remember'
                          ? 'bg-[#163832] border-emerald-500/60 shadow-sm'
                          : 'bg-[#163832]/40 hover:bg-[#163832]/60 border-[#235347]'
                      }`}
                    >
                      <input
                        id="radio-learn-remember"
                        name="learningPreference"
                        type="radio"
                        value="remember"
                        checked={learningPreference === 'remember'}
                        onChange={() => setLearningPreference('remember')}
                        className="mt-0.5 text-emerald-500 border-[#235347] bg-[#051F20] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-[#DAF1DE] block">
                          Remember category
                        </span>
                        <span className="text-[10px] text-[#8EB69B] block mt-0.5 leading-normal">
                          Auto-classify future transactions for this merchant
                        </span>
                      </div>
                    </label>

                    {/* 2. Just this once Option */}
                    <label
                      htmlFor="radio-learn-once"
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none touch-press ${
                        learningPreference === 'once'
                          ? 'bg-[#163832] border-emerald-500/60 shadow-sm'
                          : 'bg-[#163832]/40 hover:bg-[#163832]/60 border-[#235347]'
                      }`}
                    >
                      <input
                        id="radio-learn-once"
                        name="learningPreference"
                        type="radio"
                        value="once"
                        checked={learningPreference === 'once'}
                        onChange={() => setLearningPreference('once')}
                        className="mt-0.5 text-emerald-500 border-[#235347] bg-[#051F20] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-[#DAF1DE] block">
                          Just this once
                        </span>
                        <span className="text-[10px] text-[#8EB69B] block mt-0.5 leading-normal">
                          Don't save pattern to memory
                        </span>
                      </div>
                    </label>

                    {/* 3. Always ask (Never auto-classify) Option */}
                    <label
                      htmlFor="radio-learn-never"
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none touch-press ${
                        learningPreference === 'never'
                          ? 'bg-[#163832] border-amber-500/60 shadow-sm ring-1 ring-amber-500/30'
                          : 'bg-[#163832]/40 hover:bg-[#163832]/60 border-[#235347]'
                      }`}
                    >
                      <input
                        id="radio-learn-never"
                        name="learningPreference"
                        type="radio"
                        value="never"
                        checked={learningPreference === 'never'}
                        onChange={() => setLearningPreference('never')}
                        className="mt-0.5 text-amber-500 border-[#235347] bg-[#051F20] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-amber-300 block">
                            Always ask (Never auto-classify)
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
                            For Friends
                          </span>
                        </div>
                        <span className="text-[10px] text-[#8EB69B] block mt-0.5 leading-normal">
                          Always route this contact to review queue (e.g. friends where expense varies between food and travel)
                        </span>
                      </div>
                    </label>

                    {/* Backward-compatibility toggle mapped to 'remember' vs 'once' */}
                    <input
                      id="checkbox-learn-merchant"
                      type="checkbox"
                      aria-hidden="true"
                      tabIndex={-1}
                      className="sr-only"
                      checked={learningPreference === 'remember'}
                      onChange={(e) => setLearningPreference(e.target.checked ? 'remember' : 'once')}
                    />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* 3. Minimal Tactile Symbol Action Buttons (Per User Decision 2A with symbols only) */}
            <div className="flex items-center justify-center gap-7 pt-2 pb-1">
              {/* Left Button: [ ✕ ] Reclassify (48px circle, rose accent) */}
              <button
                type="button"
                id="btn-reclassify"
                aria-label="Reclassify / Change Category"
                title="Reclassify / Change Category"
                onClick={() => {
                  setShowCategorySelector((prev) => {
                    const next = !prev;
                    if (next) {
                      setTimeout(() => categorySelectorRef.current?.scrollIntoView?.({ behavior: 'smooth' }), 50);
                    }
                    return next;
                  });
                }}
                className="w-12 h-12 rounded-full bg-rose-950/40 border border-rose-600/40 text-rose-400 hover:bg-rose-900/50 active:scale-95 flex items-center justify-center transition-all touch-press shadow-sm"
              >
                <X size={20} strokeWidth={2.5} />
              </button>

              {/* Center Button: [ ⑂ ] Split Bill (44px circle, indigo accent) */}
              <button
                type="button"
                id="btn-split-inbox"
                aria-label="Split Bill with Friends"
                title="Split Bill with Friends"
                onClick={() => onOpenSplitDrawer(currentTx)}
                className="w-11 h-11 rounded-full bg-indigo-950/40 border border-indigo-600/40 text-indigo-400 hover:bg-indigo-900/50 active:scale-95 flex items-center justify-center transition-all touch-press shadow-sm"
              >
                <Split size={18} />
              </button>

              {/* Right Button: [ ✓ ] Confirm AI Category (52px circle, emerald accent with gentle aura pulse) */}
              <div className="relative">
                <div className="absolute -inset-1 rounded-full bg-emerald-500/20 blur-sm animate-pulse pointer-events-none" />
                <button
                  type="button"
                  id="btn-confirm-verify"
                  aria-label="Confirm AI Category"
                  title="Confirm AI Category"
                  onClick={() => handleQuickConfirm()}
                  className="relative w-[52px] h-[52px] rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-lg shadow-emerald-950/50 flex items-center justify-center transition-all touch-press ring-2 ring-emerald-400/40 hover:ring-emerald-400/70"
                >
                  <Check size={26} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Hint to expand category selector if collapsed */}
            {!showCategorySelector && (
              <button
                type="button"
                onClick={() => setShowCategorySelector(true)}
                className="w-full py-1 text-center text-[11px] text-[#8EB69B] hover:text-[#DAF1DE] transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Tap or swipe left to reclassify category</span>
                <ChevronDown size={12} />
              </button>
            )}

            {/* 4. Category Selection Matrix (Expandable via swipe left or [ ✕ ] button) */}
            <AnimatePresence>
              {showCategorySelector && (
                <motion.div
                  ref={categorySelectorRef}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2 pt-1 overflow-hidden"
                >
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-semibold uppercase tracking-wider text-[#8EB69B] flex items-center gap-1.5">
                      <RotateCcw size={12} className="text-amber-400" />
                      Select Reclassification Category
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCategorySelector(false)}
                      className="text-[#8EB69B] hover:text-[#DAF1DE] text-[11px] font-medium px-2 py-0.5 rounded bg-[#163832]/60 hover:bg-[#163832]"
                    >
                      Done
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {commonCategories.map((cat) => {
                      const isSelected = (selectedCategoryOverride || currentTx.aiSuggestedCategory) === cat;
                      const config = CATEGORIES_CONFIG[cat];

                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategoryOverride(cat)}
                          className={`flex items-center gap-2 p-3 min-h-[46px] rounded-xl border text-xs font-medium transition-all text-left touch-press ${
                            isSelected
                              ? 'bg-[#163832] border-[#8EB69B] text-[#DAF1DE] font-bold shadow-sm'
                              : 'bg-[#0B2B26] border-[#235347] text-[#8EB69B] hover:bg-[#163832] hover:text-[#DAF1DE]'
                          }`}
                        >
                          <div 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: config.colorHex }}
                          />
                          <span className="truncate">{cat}</span>
                          {isSelected && <Check size={14} className="ml-auto text-emerald-400 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* Inbox Zero State */
          <div className="rounded-2xl bg-gradient-to-b from-[#0B2B26] to-[#07201D] border border-[#235347] p-8 text-center space-y-4 shadow-[0_4px_24px_-4px_rgba(35,83,71,0.35)]">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-600/40 flex items-center justify-center mx-auto text-emerald-400 shadow-sm">
              <CheckCircle2 size={28} />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#DAF1DE]">All Transactions Verified!</h2>
              <p className="text-xs text-[#8EB69B] max-w-xs mx-auto leading-relaxed">
                Zero pending items in review queue. Your ledger and spending analytics are fully up to date.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onResetInbox}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#163832] hover:bg-[#235347] border border-[#235347] text-[#DAF1DE] text-xs font-semibold transition-colors touch-press shadow-sm"
              >
                <RotateCcw size={14} />
                <span>Simulate Demo Alerts</span>
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
