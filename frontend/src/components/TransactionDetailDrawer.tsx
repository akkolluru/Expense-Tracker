import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Split, 
  Copy, 
  Check, 
  Trash2,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Transaction, ExpenseCategory, SplitMember } from '../types';
import { formatINR, getPaymentMethodLabel } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { CATEGORIES_CONFIG } from '../data/mockData';

interface TransactionDetailDrawerProps {
  transaction: Transaction | null;
  onClose: () => void;
  onUpdateCategory: (txId: string, category: ExpenseCategory) => void;
  onUpdateSplit: (txId: string, splits: SplitMember[]) => void;
  onTogglePeerSplitPaid?: (txId: string, peerSplitId: string | number) => void;
  onDeleteTransaction?: (txId: string) => void;
}

export const TransactionDetailDrawer: React.FC<TransactionDetailDrawerProps> = ({
  transaction,
  onClose,
  onUpdateCategory,
  onUpdateSplit,
  onTogglePeerSplitPaid,
  onDeleteTransaction,
}) => {
  const [copiedVpa, setCopiedVpa] = useState<boolean>(false);
  const [isEditingSplit, setIsEditingSplit] = useState<boolean>(false);
  const [splitMembers, setSplitMembers] = useState<SplitMember[]>([]);

  // Form state for adding/editing split members
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberUpi, setNewMemberUpi] = useState<string>('');
  const [newMemberAmount, setNewMemberAmount] = useState<string>('');

  // Synchronize local splitMembers when transaction prop updates
  useEffect(() => {
    if (transaction) {
      setSplitMembers(transaction.splitDetails || []);
      setNewMemberName('');
      setNewMemberUpi('');
      setNewMemberAmount('');
    }
  }, [transaction?.id, transaction?.splitDetails]);

  if (!transaction) return null;

  const isCredit = transaction.type === 'CREDIT';
  const methodMeta = getPaymentMethodLabel(transaction.paymentMethod);

  // Compute splits sum and personal share
  const peerSplitsTotal = useMemo(() => {
    return splitMembers.reduce((sum, m) => sum + (Number(m.shareAmount) || 0), 0);
  }, [splitMembers]);

  const personalShare = Math.round((transaction.amount - peerSplitsTotal) * 100) / 100;
  const isOverallocated = personalShare < 0;

  const handleCopyVpa = () => {
    if (!transaction.upiVpa) return;
    navigator.clipboard.writeText(transaction.upiVpa);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const handleAddSplitMember = () => {
    if (!newMemberName.trim()) return;

    // Determine share amount: explicit input or remaining split share
    let shareAmount = parseFloat(newMemberAmount);
    if (isNaN(shareAmount) || shareAmount <= 0) {
      const remaining = Math.max(0, transaction.amount - peerSplitsTotal);
      shareAmount = remaining > 0 ? parseFloat(remaining.toFixed(2)) : 0;
    }

    const newMember: SplitMember = {
      id: Date.now().toString(),
      name: newMemberName.trim(),
      upiId: newMemberUpi.trim() || undefined,
      shareAmount,
      isPaid: false,
    };

    const updated = [...splitMembers, newMember];
    setSplitMembers(updated);
    setNewMemberName('');
    setNewMemberUpi('');
    setNewMemberAmount('');
    onUpdateSplit(transaction.id, updated);
  };

  const handleRemoveSplitMember = (memberId: string) => {
    const updated = splitMembers.filter(m => m.id !== memberId);
    setSplitMembers(updated);
    onUpdateSplit(transaction.id, updated);
  };

  const handleUpdateMemberAmount = (memberId: string, amountStr: string) => {
    const val = parseFloat(amountStr) || 0;
    const updated = splitMembers.map(m => m.id === memberId ? { ...m, shareAmount: val } : m);
    setSplitMembers(updated);
    onUpdateSplit(transaction.id, updated);
  };

  const handleToggleMemberPaid = (memberId: string) => {
    const updated = splitMembers.map(m => 
      m.id === memberId ? { ...m, isPaid: !m.isPaid } : m
    );
    setSplitMembers(updated);
    onUpdateSplit(transaction.id, updated);

    if (onTogglePeerSplitPaid) {
      onTogglePeerSplitPaid(transaction.id, memberId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-gradient-to-b from-[#0B2B26] to-[#07201D] border-t sm:border border-[#235347] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] pb-[max(env(safe-area-inset-bottom),0.5rem)]"
        data-testid="transaction-detail-drawer"
      >
        {/* Top Handle for mobile gestures */}
        <div className="w-12 h-1.5 bg-[#235347] rounded-full mx-auto my-2.5 sm:hidden flex-shrink-0" />

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#235347]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#163832] border border-[#235347] flex items-center justify-center flex-shrink-0 shadow-sm">
              <CategoryIcon category={transaction.category} size={16} showBg={false} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#DAF1DE] truncate max-w-[220px]">{transaction.merchant}</h2>
              <span className="text-[10px] text-[#8EB69B] font-mono">{transaction.date} • {transaction.time}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-xl text-[#8EB69B] hover:text-[#DAF1DE] hover:bg-[#163832] transition-colors touch-press"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
          {/* Big Amount Card */}
          <div className="rounded-2xl bg-gradient-to-b from-[#163832] to-[#0E2C26] border border-[#235347] p-4 text-center shadow-sm">
            <span className="text-[10px] text-[#8EB69B] uppercase font-mono tracking-wider">
              {isCredit ? 'Income Received' : 'Amount Paid'}
            </span>
            <div className={`text-2xl font-black font-mono-num mt-0.5 ${isCredit ? 'text-emerald-400' : 'text-[#DAF1DE]'}`}>
              {isCredit ? '+' : '-'}{formatINR(transaction.amount)}
            </div>

            <div className="flex items-center justify-center gap-2 mt-2 text-xs">
              <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${methodMeta.bg} ${methodMeta.text}`}>
                {methodMeta.label}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#0B2B26] border border-[#235347] text-[#DAF1DE] font-mono text-[10px]">
                {transaction.accountNumberMasked}
              </span>
            </div>
          </div>

          {/* UPI VPA & Reference */}
          {transaction.upiVpa && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#163832] border border-[#235347] text-xs">
              <div>
                <span className="text-[10px] text-[#8EB69B] block">UPI ID</span>
                <span className="font-mono text-[#DAF1DE] text-xs">{transaction.upiVpa}</span>
              </div>
              <button
                onClick={handleCopyVpa}
                className="p-1.5 rounded-lg text-[#8EB69B] hover:text-[#DAF1DE] hover:bg-[#0B2B26] transition-colors"
                title="Copy UPI ID"
              >
                {copiedVpa ? <Check size={13} className="text-[#DAF1DE]" /> : <Copy size={13} />}
              </button>
            </div>
          )}

          {/* Category Change */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[#8EB69B] uppercase tracking-wider block">
              Change Category
            </label>
            <select
              value={transaction.category}
              onChange={(e) => onUpdateCategory(transaction.id, e.target.value as ExpenseCategory)}
              className="w-full p-2.5 rounded-xl bg-[#163832] border border-[#235347] text-xs text-[#DAF1DE] focus:outline-none focus:border-[#8EB69B]"
            >
              {Object.keys(CATEGORIES_CONFIG).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Peer Split Bill Module */}
          <div className="space-y-2.5 pt-2 border-t border-[#163832]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#DAF1DE] flex items-center gap-1.5">
                <Split size={14} className="text-[#8EB69B]" />
                Peer Splits & Settlement
              </span>
              <button
                onClick={() => setIsEditingSplit(!isEditingSplit)}
                className="text-[11px] text-[#8EB69B] hover:text-[#DAF1DE] font-medium underline-offset-2 hover:underline"
              >
                {isEditingSplit ? 'Done Editing' : 'Edit Splits'}
              </button>
            </div>

            {/* Personal Share Readout */}
            <div className="p-3 rounded-xl bg-[#0B2B26] border border-[#235347] space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#8EB69B]">Your Personal Share</span>
                <span className="font-bold font-mono-num text-[#DAF1DE]" data-testid="personal-share-amount">
                  {formatINR(Math.max(0, personalShare))}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#8EB69B]">
                <span>Peer Splits Total ({splitMembers.length})</span>
                <span className="font-mono-num">{formatINR(peerSplitsTotal)}</span>
              </div>

              {isOverallocated && (
                <div className="flex items-center gap-1.5 text-rose-300 text-[11px] pt-1 border-t border-rose-500/20">
                  <AlertCircle size={12} className="flex-shrink-0" />
                  <span>Peer splits exceed total expense amount by {formatINR(Math.abs(personalShare))}</span>
                </div>
              )}
            </div>

            {/* Split Members List */}
            {splitMembers.length > 0 ? (
              <div className="space-y-1.5" data-testid="split-members-list">
                {splitMembers.map((member) => (
                  <div 
                    key={member.id}
                    className="p-2.5 rounded-xl bg-[#163832] border border-[#235347] flex items-center justify-between gap-2 text-xs"
                    data-testid={`split-member-${member.id}`}
                  >
                    {/* Left: Member identity & Settlement status */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        onClick={() => handleToggleMemberPaid(member.id)}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
                          member.isPaid
                            ? 'bg-[#235347] text-[#DAF1DE] border border-[#8EB69B]'
                            : 'bg-[#0B2B26] text-[#8EB69B]/50 border border-[#235347] hover:border-[#8EB69B]'
                        }`}
                        title={member.isPaid ? 'Mark as Pending' : 'Mark as Settled'}
                        data-testid={`toggle-paid-${member.id}`}
                      >
                        {member.isPaid ? <CheckCircle2 size={15} /> : <Clock size={14} />}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-[#DAF1DE] truncate">{member.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            member.isPaid
                              ? 'bg-[#235347] text-[#DAF1DE] border border-[#8EB69B]/40'
                              : 'bg-[#0B2B26] text-[#8EB69B] border border-[#235347]'
                          }`}>
                            {member.isPaid ? 'Settled' : 'Pending'}
                          </span>
                        </div>
                        {member.upiId && (
                          <span className="text-[10px] text-[#8EB69B] font-mono block truncate">
                            {member.upiId}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Share Amount & Remove button */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isEditingSplit ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-[#8EB69B]">₹</span>
                          <input
                            type="number"
                            value={member.shareAmount}
                            onChange={(e) => handleUpdateMemberAmount(member.id, e.target.value)}
                            className="w-16 px-1.5 py-1 rounded bg-[#0B2B26] border border-[#235347] text-xs font-mono-num text-[#DAF1DE] text-right focus:outline-none focus:border-[#8EB69B]"
                          />
                          <button
                            onClick={() => handleRemoveSplitMember(member.id)}
                            className="p-1 text-[#8EB69B] hover:text-rose-400 transition-colors"
                            title="Remove split member"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="font-mono-num font-bold text-[#DAF1DE] block">
                            {formatINR(member.shareAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-2 text-[11px] text-[#8EB69B]">
                No peer splits yet. Add a friend below to split this transaction.
              </div>
            )}

            {/* Add New Split Member Section */}
            {isEditingSplit && (
              <div className="p-3 rounded-xl bg-[#0B2B26] border border-[#235347] space-y-2 text-xs">
                <span className="text-[10px] uppercase font-semibold text-[#8EB69B] tracking-wider block">
                  Add Peer Split
                </span>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Friend's name (e.g. Rahul)"
                    className="w-full p-2 rounded-lg bg-[#163832] border border-[#235347] text-xs text-[#DAF1DE] placeholder-[#8EB69B]/60 focus:outline-none focus:border-[#8EB69B]"
                    data-testid="new-split-name-input"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newMemberUpi}
                      onChange={(e) => setNewMemberUpi(e.target.value)}
                      placeholder="UPI ID (optional, e.g. rahul@upi)"
                      className="flex-1 p-2 rounded-lg bg-[#163832] border border-[#235347] text-xs text-[#DAF1DE] placeholder-[#8EB69B]/60 focus:outline-none focus:border-[#8EB69B]"
                      data-testid="new-split-upi-input"
                    />
                    <input
                      type="number"
                      value={newMemberAmount}
                      onChange={(e) => setNewMemberAmount(e.target.value)}
                      placeholder={`₹${Math.max(0, personalShare)}`}
                      className="w-24 p-2 rounded-lg bg-[#163832] border border-[#235347] text-xs font-mono-num text-[#DAF1DE] placeholder-[#8EB69B]/60 focus:outline-none focus:border-[#8EB69B]"
                      data-testid="new-split-amount-input"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddSplitMember}
                  disabled={!newMemberName.trim()}
                  className="w-full py-2 rounded-lg bg-[#235347] hover:bg-[#8EB69B] hover:text-[#051F20] text-[#DAF1DE] text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                  data-testid="add-split-btn"
                >
                  <Plus size={13} />
                  <span>Add Split Member</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Delete option */}
        {onDeleteTransaction && (
          <div className="p-3 border-t border-[#235347] bg-[#051F20]/40 flex justify-end">
            <button
              onClick={() => {
                onDeleteTransaction(transaction.id);
                onClose();
              }}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 size={12} />
              <span>Delete Entry</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
