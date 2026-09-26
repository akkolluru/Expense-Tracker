import React, { useState } from 'react';
import { 
  X, 
  Split, 
  Copy, 
  Check, 
  Trash2
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
  onDeleteTransaction?: (txId: string) => void;
}

export const TransactionDetailDrawer: React.FC<TransactionDetailDrawerProps> = ({
  transaction,
  onClose,
  onUpdateCategory,
  onUpdateSplit,
  onDeleteTransaction,
}) => {
  const [copiedVpa, setCopiedVpa] = useState<boolean>(false);
  const [isEditingSplit, setIsEditingSplit] = useState<boolean>(false);
  const [splitMembers, setSplitMembers] = useState<SplitMember[]>(
    transaction?.splitDetails || [
      { id: '1', name: 'You', shareAmount: transaction ? transaction.amount / 2 : 0, isPaid: true },
      { id: '2', name: 'Friend', upiId: 'friend@okhdfc', shareAmount: transaction ? transaction.amount / 2 : 0, isPaid: false }
    ]
  );
  const [newMemberName, setNewMemberName] = useState<string>('');

  if (!transaction) return null;

  const isCredit = transaction.type === 'CREDIT';
  const methodMeta = getPaymentMethodLabel(transaction.paymentMethod);

  const handleCopyVpa = () => {
    if (!transaction.upiVpa) return;
    navigator.clipboard.writeText(transaction.upiVpa);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const handleAddSplitMember = () => {
    if (!newMemberName.trim()) return;
    const newMembers = [
      ...splitMembers,
      {
        id: Date.now().toString(),
        name: newMemberName.trim(),
        upiId: `${newMemberName.toLowerCase().replace(/\s+/g, '')}@upi`,
        shareAmount: 0,
        isPaid: false
      }
    ];
    const equalShare = parseFloat((transaction.amount / newMembers.length).toFixed(2));
    const balanced = newMembers.map(m => ({ ...m, shareAmount: equalShare }));
    setSplitMembers(balanced);
    setNewMemberName('');
    onUpdateSplit(transaction.id, balanced);
  };

  const handleToggleMemberPaid = (memberId: string) => {
    const updated = splitMembers.map(m => m.id === memberId ? { ...m, isPaid: !m.isPaid } : m);
    setSplitMembers(updated);
    onUpdateSplit(transaction.id, updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-[#0B2B26] border border-[#235347] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Top Handle for mobile */}
        <div className="w-10 h-1 bg-[#235347] rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#235347]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#163832] border border-[#235347] flex items-center justify-center flex-shrink-0">
              <CategoryIcon category={transaction.category} size={16} showBg={false} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#DAF1DE] truncate max-w-[220px]">{transaction.merchant}</h2>
              <span className="text-[10px] text-[#8EB69B] font-mono">{transaction.date} • {transaction.time}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8EB69B] hover:text-[#DAF1DE] hover:bg-[#163832] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
          {/* Big Amount Card */}
          <div className="rounded-xl bg-[#163832] border border-[#235347] p-4 text-center">
            <span className="text-[10px] text-[#8EB69B] uppercase tracking-wider">
              {isCredit ? 'Income Received' : 'Amount Paid'}
            </span>
            <div className={`text-2xl font-bold font-mono-num mt-0.5 ${isCredit ? 'text-[#8EB69B]' : 'text-[#DAF1DE]'}`}>
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

          {/* Split Bill Module */}
          <div className="space-y-2 pt-1 border-t border-[#163832]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#DAF1DE] flex items-center gap-1.5">
                <Split size={13} className="text-[#8EB69B]" />
                Split Bill
              </span>
              <button
                onClick={() => setIsEditingSplit(!isEditingSplit)}
                className="text-[11px] text-[#8EB69B] hover:text-[#DAF1DE] font-medium"
              >
                {isEditingSplit ? 'Done' : 'Edit Split'}
              </button>
            </div>

            <div className="space-y-1.5">
              {splitMembers.map((member) => (
                <div 
                  key={member.id}
                  onClick={() => handleToggleMemberPaid(member.id)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#163832] border border-[#235347] cursor-pointer hover:bg-[#235347]/50 text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                      member.isPaid 
                        ? 'bg-[#DAF1DE] border-[#DAF1DE] text-[#051F20] font-bold' 
                        : 'border-[#235347] bg-[#0B2B26]'
                    }`}>
                      {member.isPaid && '✓'}
                    </div>
                    <div>
                      <span className="font-medium text-[#DAF1DE] block">{member.name}</span>
                      {member.upiId && <span className="text-[10px] text-[#8EB69B] font-mono">{member.upiId}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono-num font-semibold text-[#DAF1DE]">
                      {formatINR(member.shareAmount)}
                    </span>
                    <span className={`text-[10px] block ${member.isPaid ? 'text-[#8EB69B]' : 'text-[#8EB69B]/60'}`}>
                      {member.isPaid ? 'Settled' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {isEditingSplit && (
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Add friend's name..."
                  className="flex-1 p-2 rounded-xl bg-[#163832] border border-[#235347] text-xs text-[#DAF1DE] placeholder-[#8EB69B]/60 focus:outline-none"
                />
                <button
                  onClick={handleAddSplitMember}
                  className="px-3 py-2 rounded-xl bg-[#235347] hover:bg-[#8EB69B] hover:text-[#051F20] text-[#DAF1DE] text-xs font-semibold"
                >
                  Add
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
