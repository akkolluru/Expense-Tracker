import React, { useState } from 'react';
import { 
  X, 
  Scan, 
  Plus, 
  Wallet,
  CheckCircle2
} from 'lucide-react';
import { Transaction, ExpenseCategory, PaymentMethod, SplitMember } from '../types';
import { parseBankSms, formatINR } from '../utils/formatters';
import { CATEGORIES_CONFIG, SAMPLE_BANK_SMS_LIST } from '../data/mockData';

interface AddTransactionModalProps {
  isOpen: boolean;
  initialMode?: 'manual' | 'sms';
  onClose: () => void;
  onAddTransaction: (tx: Partial<Transaction>) => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  initialMode = 'sms',
  onClose,
  onAddTransaction,
}) => {
  const [activeTab, setActiveTab] = useState<'sms' | 'manual'>(initialMode);
  
  // Smart SMS State
  const [smsInput, setSmsInput] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<Partial<Transaction> | null>(null);

  // Manual Form State
  const [amount, setAmount] = useState<string>('');
  const [merchant, setMerchant] = useState<string>('');
  const [upiVpa, setUpiVpa] = useState<string>('');
  const [category, setCategory] = useState<ExpenseCategory>('Food & Dining');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI_GPAY');
  const [type, setType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  
  // Split State
  const [isSplitEnabled] = useState<boolean>(false);
  const [splitMembers] = useState<SplitMember[]>([
    { id: '1', name: 'You', shareAmount: 0, isPaid: true },
    { id: '2', name: 'Priya', upiId: 'priya@okaxis', shareAmount: 0, isPaid: false },
    { id: '3', name: 'Rahul', upiId: 'rahul@okhdfc', shareAmount: 0, isPaid: false }
  ]);

  if (!isOpen) return null;

  // Handle SMS parse
  const handleParseSms = (text: string) => {
    setSmsInput(text);
    if (!text.trim()) {
      setParsedPreview(null);
      return;
    }
    const parsed = parseBankSms(text);
    setParsedPreview(parsed);
  };

  const handleApplySampleSms = (sample: string) => {
    handleParseSms(sample);
  };

  const handleSaveParsedSms = () => {
    if (!parsedPreview || !parsedPreview.amount) return;
    onAddTransaction({
      ...parsedPreview,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVerified: true
    });
    onClose();
  };

  const handleSaveManual = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || !merchant.trim()) return;

    let finalSplit: SplitMember[] | undefined = undefined;
    if (isSplitEnabled) {
      const share = numAmount / splitMembers.length;
      finalSplit = splitMembers.map(m => ({ ...m, shareAmount: parseFloat(share.toFixed(2)) }));
    }

    onAddTransaction({
      amount: numAmount,
      merchant: merchant.trim(),
      upiVpa: upiVpa.trim() || undefined,
      category,
      paymentMethod,
      type,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      accountNumberMasked: paymentMethod.startsWith('UPI') ? 'HDFC UPI **4590' : 'ICICI **8812',
      isVerified: true,
      aiConfidence: 100,
      splitDetails: finalSplit
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-[#0B2B26] border border-[#235347] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#235347]">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#DAF1DE]">Record Transaction</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8EB69B] hover:text-[#DAF1DE] hover:bg-[#163832] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex p-2 bg-[#051F20] border-b border-[#235347] gap-1.5">
          <button
            onClick={() => setActiveTab('sms')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'sms'
                ? 'bg-[#163832] text-[#DAF1DE] font-semibold border border-[#235347]'
                : 'text-[#8EB69B] hover:text-[#DAF1DE]'
            }`}
          >
            <Scan size={13} />
            <span>Bank SMS</span>
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'manual'
                ? 'bg-[#163832] text-[#DAF1DE] font-semibold border border-[#235347]'
                : 'text-[#8EB69B] hover:text-[#DAF1DE]'
            }`}
          >
            <Wallet size={13} />
            <span>Manual Form</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
          {activeTab === 'sms' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#DAF1DE] block mb-1">
                  Paste Bank SMS or UPI message:
                </label>
                <textarea
                  id="sms-textarea"
                  value={smsInput}
                  onChange={(e) => handleParseSms(e.target.value)}
                  placeholder="e.g. Sent Rs.450.00 from HDFC Bank A/C **4590 to ZEPTO NOW UPI: zeptonow@axisbank on 31-AUG-26..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-[#163832] border border-[#235347] text-xs text-[#DAF1DE] placeholder-[#8EB69B]/60 focus:outline-none focus:border-[#8EB69B] font-mono transition-colors"
                />
              </div>

              {/* Sample SMS Presets */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8EB69B]">
                  Quick Examples:
                </span>
                <div className="flex flex-col gap-1">
                  {SAMPLE_BANK_SMS_LIST.slice(0, 3).map((sms, i) => (
                    <button
                      key={i}
                      onClick={() => handleApplySampleSms(sms)}
                      className="text-left p-2 rounded-lg bg-[#163832] border border-[#235347] text-[11px] text-[#8EB69B] hover:text-[#DAF1DE] font-mono truncate transition-colors"
                    >
                      {sms}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parsed Result Preview Card */}
              {parsedPreview && parsedPreview.amount && (
                <div className="p-3.5 rounded-xl bg-[#163832] border border-[#235347] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#DAF1DE]">
                      Parsed Details
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0B2B26] border border-[#235347] text-[#DAF1DE] font-mono">
                      {parsedPreview.aiConfidence}% Match
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-[#8EB69B] text-[10px] block">Merchant:</span>
                      <strong className="text-[#DAF1DE] text-xs">{parsedPreview.merchant}</strong>
                    </div>
                    <div>
                      <span className="text-[#8EB69B] text-[10px] block">Amount:</span>
                      <strong className="text-[#DAF1DE] text-xs font-mono-num">
                        {formatINR(parsedPreview.amount)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#8EB69B] text-[10px] block">Category:</span>
                      <span className="text-[#DAF1DE]">{parsedPreview.aiSuggestedCategory}</span>
                    </div>
                    <div>
                      <span className="text-[#8EB69B] text-[10px] block">Account / VPA:</span>
                      <span className="text-[#8EB69B] font-mono text-[11px]">
                        {parsedPreview.upiVpa || parsedPreview.accountNumberMasked}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Manual Form Mode */
            <div className="space-y-3">
              {/* Type Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('DEBIT')}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    type === 'DEBIT'
                      ? 'bg-[#163832] border-[#235347] text-[#DAF1DE] font-semibold'
                      : 'bg-[#0B2B26] border-[#235347] text-[#8EB69B]'
                  }`}
                >
                  Debit (Expense)
                </button>
                <button
                  type="button"
                  onClick={() => setType('CREDIT')}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    type === 'CREDIT'
                      ? 'bg-[#163832] border-[#235347] text-[#DAF1DE] font-semibold'
                      : 'bg-[#0B2B26] border-[#235347] text-[#8EB69B]'
                  }`}
                >
                  Credit (Income)
                </button>
              </div>

              {/* Amount */}
              <div>
                <label className="text-[11px] text-[#8EB69B] block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 450"
                  className="w-full p-2.5 rounded-xl bg-[#163832] border border-[#235347] text-sm font-bold font-mono text-[#DAF1DE] placeholder-[#8EB69B]/60 focus:outline-none focus:border-[#8EB69B]"
                />
              </div>

              {/* Merchant */}
              <div>
                <label className="text-[11px] text-[#8EB69B] block mb-1">Merchant / Recipient</label>
                <input
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="e.g. Swiggy, Uber, Rent"
                  className="w-full p-2.5 rounded-xl bg-[#163832] border border-[#235347] text-xs text-[#DAF1DE] placeholder-[#8EB69B]/60 focus:outline-none focus:border-[#8EB69B]"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-[11px] text-[#8EB69B] block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full p-2.5 rounded-xl bg-[#163832] border border-[#235347] text-xs text-[#DAF1DE] focus:outline-none focus:border-[#8EB69B]"
                >
                  {Object.keys(CATEGORIES_CONFIG).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#235347] flex items-center justify-end gap-2 bg-[#051F20]/60">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-[#8EB69B] hover:text-[#DAF1DE] hover:bg-[#163832] transition-colors"
          >
            Cancel
          </button>

          {activeTab === 'sms' ? (
            <button
              onClick={handleSaveParsedSms}
              disabled={!parsedPreview || !parsedPreview.amount}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#DAF1DE] hover:bg-white disabled:opacity-40 text-[#051F20] text-xs font-bold transition-colors shadow-sm"
            >
              <CheckCircle2 size={14} />
              <span>Save Transaction</span>
            </button>
          ) : (
            <button
              onClick={handleSaveManual}
              disabled={!amount || !merchant.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#DAF1DE] hover:bg-white disabled:opacity-40 text-[#051F20] text-xs font-bold transition-colors shadow-sm"
            >
              <Plus size={14} />
              <span>Add Entry</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
