import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Scan, 
  Plus, 
  Wallet,
  CheckCircle2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Transaction, ExpenseCategory, PaymentMethod, SplitMember } from '../types';
import { parseBankSms, formatINR } from '../utils/formatters';
import { CATEGORIES_CONFIG, SAMPLE_BANK_SMS_LIST } from '../data/mockData';
import {
  useParseSyncText,
  useCreateTransaction,
  useAccounts,
  useCategories,
} from '../hooks/useExpenseApi';
import { mapTransactionResponseToUi } from '../utils/adapters';

interface AddTransactionModalProps {
  isOpen: boolean;
  initialMode?: 'manual' | 'sms';
  onClose: () => void;
  onAddTransaction: (tx: Partial<Transaction>) => void;
}

export type SmsSyncStatus = 'IDLE' | 'CREATED' | 'MERGED' | 'OFFLINE';

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  initialMode = 'sms',
  onClose,
  onAddTransaction,
}) => {
  // TanStack Query Hooks
  const parseSyncTextMutation = useParseSyncText();
  const createTransactionMutation = useCreateTransaction();
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();

  const [activeTab, setActiveTab] = useState<'sms' | 'manual'>(initialMode);
  
  // Smart SMS State
  const [smsInput, setSmsInput] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<Partial<Transaction> | null>(null);
  const [syncStatus, setSyncStatus] = useState<SmsSyncStatus>('IDLE');

  // Manual Form State
  const [selectedAccountId, setSelectedAccountId] = useState<number>(1);
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

  // Accounts list and default selection
  const accounts = useMemo(() => accountsQuery.data || [], [accountsQuery.data]);

  useEffect(() => {
    if (accounts.length > 0) {
      setSelectedAccountId((prev) => {
        if (accounts.some((acc) => acc.id === prev)) {
          return prev;
        }
        return accounts[0].id;
      });
    }
  }, [accounts]);

  // Sync mode with initialMode prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
    }
  }, [isOpen, initialMode]);

  // Category mappings between ID and Name
  const categoryNameMap = useMemo<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    if (categoriesQuery.data && Array.isArray(categoriesQuery.data)) {
      for (const cat of categoriesQuery.data) {
        map[cat.id] = cat.name;
      }
    }
    return map;
  }, [categoriesQuery.data]);

  const categoryIdMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    if (categoriesQuery.data && Array.isArray(categoriesQuery.data)) {
      for (const cat of categoriesQuery.data) {
        map[cat.name] = cat.id;
      }
    }
    return map;
  }, [categoriesQuery.data]);

  if (!isOpen) return null;

  // Handle manual SMS text input (client heuristic preview)
  const handleSmsInputChange = (text: string) => {
    setSmsInput(text);
    if (!text.trim()) {
      setParsedPreview(null);
      setSyncStatus('IDLE');
      return;
    }
    const local = parseBankSms(text);
    setParsedPreview(local);
    setSyncStatus('OFFLINE');
  };

  // Live Backend SMS Parsing
  const handleBackendParse = async (text: string) => {
    if (!text.trim()) {
      setParsedPreview(null);
      setSyncStatus('IDLE');
      return;
    }

    try {
      const response = await parseSyncTextMutation.mutateAsync({
        raw_text: text.trim(),
        source: 'SMS_MODAL',
      });

      if (response && response.transaction) {
        const uiTx = mapTransactionResponseToUi(response.transaction, categoryNameMap);
        setParsedPreview({
          ...uiTx,
          rawSmsSnippet: text.trim(),
        });

        if (response.status === 'CREATED' || response.action === 'TRANSACTION_CREATED') {
          setSyncStatus('CREATED');
        } else if (response.status === 'MERGED' || response.action === 'ENRICHMENT_MERGE') {
          setSyncStatus('MERGED');
        } else {
          setSyncStatus('OFFLINE');
        }
      } else {
        const localParsed = parseBankSms(text);
        setParsedPreview({
          ...localParsed,
          rawSmsSnippet: text.trim(),
        });
        setSyncStatus('OFFLINE');
      }
    } catch (err) {
      console.warn('Backend SMS parsing failed or offline, falling back to local heuristic:', err);
      const localParsed = parseBankSms(text);
      setParsedPreview({
        ...localParsed,
        rawSmsSnippet: text.trim(),
      });
      setSyncStatus('OFFLINE');
    }
  };

  // Sample SMS selection auto-parses with backend engine
  const handleApplySampleSms = (sample: string) => {
    setSmsInput(sample);
    handleBackendParse(sample);
  };

  // Save parsed SMS transaction
  const handleSaveParsedSms = () => {
    if (!parsedPreview || !parsedPreview.amount) return;
    onAddTransaction({
      ...parsedPreview,
      date: parsedPreview.date || new Date().toISOString().split('T')[0],
      time: parsedPreview.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVerified: parsedPreview.isVerified ?? true,
    });
    onClose();
  };

  // Save manual form transaction
  const handleSaveManual = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || !merchant.trim()) return;

    const matchedCategory = categoriesQuery.data?.find(
      (c) => c.name.toLowerCase() === category.toLowerCase()
    );
    const categoryId = matchedCategory ? matchedCategory.id : (categoryIdMap[category] ?? 1);
    const now = new Date();
    const timestamp = now.toISOString();
    const isExpense = type === 'DEBIT';

    let finalSplit: SplitMember[] | undefined = undefined;
    if (isSplitEnabled) {
      const share = numAmount / splitMembers.length;
      finalSplit = splitMembers.map((m) => ({ ...m, shareAmount: parseFloat(share.toFixed(2)) }));
    }

    const selectedAcc = accounts.find((a) => a.id === selectedAccountId);
    const maskedAccount = selectedAcc
      ? `${selectedAcc.name} ${selectedAcc.account_number_last4 ? `**${selectedAcc.account_number_last4}` : ''}`.trim()
      : paymentMethod.startsWith('UPI')
      ? 'HDFC UPI **4590'
      : 'ICICI **8812';

    try {
      await createTransactionMutation.mutateAsync({
        account_id: selectedAccountId,
        amount: numAmount,
        merchant_name: merchant.trim(),
        timestamp,
        category_id: categoryId,
        is_expense: isExpense,
      });
    } catch (err) {
      console.error('Failed to create transaction on backend:', err);
    }

    // Call onAddTransaction for instant optimistic UI update
    onAddTransaction({
      amount: numAmount,
      merchant: merchant.trim(),
      upiVpa: upiVpa.trim() || undefined,
      category,
      paymentMethod,
      type,
      date: timestamp.split('T')[0],
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      accountNumberMasked: maskedAccount,
      isVerified: true,
      aiConfidence: 100,
      splitDetails: finalSplit,
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
            type="button"
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
            type="button"
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
                  onChange={(e) => handleSmsInputChange(e.target.value)}
                  placeholder="e.g. Sent Rs.450.00 from HDFC Bank A/C **4590 to ZEPTO NOW UPI: zeptonow@axisbank on 31-AUG-26..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-[#163832] border border-[#235347] text-xs text-[#DAF1DE] placeholder-[#8EB69B]/60 focus:outline-none focus:border-[#8EB69B] font-mono transition-colors"
                />
                
                {/* Parse with Backend Engine Button */}
                <div className="flex items-center justify-between gap-2 pt-1.5">
                  <button
                    type="button"
                    id="btn-backend-parse"
                    onClick={() => handleBackendParse(smsInput)}
                    disabled={!smsInput.trim() || parseSyncTextMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#163832] hover:bg-[#235347] border border-[#235347] disabled:opacity-40 text-xs font-medium text-[#DAF1DE] transition-colors"
                  >
                    {parseSyncTextMutation.isPending ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-[#8EB69B]" />
                        <span>Parsing with Engine...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} className="text-[#8EB69B]" />
                        <span>Parse with Backend Engine</span>
                      </>
                    )}
                  </button>

                  {smsInput.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setSmsInput('');
                        setParsedPreview(null);
                        setSyncStatus('IDLE');
                      }}
                      className="text-[11px] text-[#8EB69B] hover:text-[#DAF1DE] transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
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

              {/* Loading State */}
              {parseSyncTextMutation.isPending && (
                <div
                  data-testid="sms-parsing-loader"
                  className="p-3.5 rounded-xl bg-[#163832] border border-[#235347] flex items-center justify-center gap-2 text-xs text-[#8EB69B]"
                >
                  <Loader2 size={16} className="animate-spin text-[#DAF1DE]" />
                  <span>Processing message with Backend Ingestion Engine...</span>
                </div>
              )}

              {/* Parsed Result Preview Card */}
              {!parseSyncTextMutation.isPending && parsedPreview && parsedPreview.amount && (
                <div className="p-3.5 rounded-xl bg-[#163832] border border-[#235347] space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-[#DAF1DE]">
                      Parsed Details
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {syncStatus === 'CREATED' && (
                        <span
                          data-testid="sync-status-badge"
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-400"
                        >
                          ⚡ CREATED: New Transaction Recorded
                        </span>
                      )}
                      {syncStatus === 'MERGED' && (
                        <span
                          data-testid="sync-status-badge"
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-950/80 border border-sky-500/40 text-sky-400"
                        >
                          ⚡ MERGED: Enrichment Merge (Matched via UTR)
                        </span>
                      )}
                      {syncStatus === 'OFFLINE' && (
                        <span
                          data-testid="sync-status-badge"
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#235347]/80 border border-[#8EB69B]/40 text-[#8EB69B]"
                        >
                          Offline / Local Heuristic
                        </span>
                      )}
                      {parsedPreview.aiConfidence ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0B2B26] border border-[#235347] text-[#DAF1DE] font-mono">
                          {parsedPreview.aiConfidence}% Match
                        </span>
                      ) : null}
                    </div>
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
                      <span className="text-[#DAF1DE]">
                        {parsedPreview.category || parsedPreview.aiSuggestedCategory || 'Uncategorized'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8EB69B] text-[10px] block">Account / VPA:</span>
                      <span className="text-[#8EB69B] font-mono text-[11px]">
                        {parsedPreview.upiVpa || parsedPreview.accountNumberMasked}
                      </span>
                    </div>
                    {parsedPreview.referenceId && (
                      <div className="col-span-2">
                        <span className="text-[#8EB69B] text-[10px] block">Reference / UTR:</span>
                        <span className="text-[#DAF1DE] font-mono text-[11px]">
                          {parsedPreview.referenceId}
                        </span>
                      </div>
                    )}
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

              {/* Account Selector */}
              <div>
                <label htmlFor="account-select" className="text-[11px] text-[#8EB69B] block mb-1">
                  Account
                </label>
                <select
                  id="account-select"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-[#163832] border border-[#235347] text-xs text-[#DAF1DE] focus:outline-none focus:border-[#8EB69B]"
                >
                  {accounts.length > 0 ? (
                    accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} {acc.account_number_last4 ? `(**${acc.account_number_last4})` : ''}
                      </option>
                    ))
                  ) : (
                    <option value={1}>Primary Account (**4590)</option>
                  )}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="text-[11px] text-[#8EB69B] block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  id="manual-amount-input"
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
                  id="manual-merchant-input"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="e.g. Swiggy, Uber, Rent"
                  className="w-full p-2.5 rounded-xl bg-[#163832] border border-[#235347] text-xs text-[#DAF1DE] placeholder-[#8EB69B]/60 focus:outline-none focus:border-[#8EB69B]"
                />
              </div>

              {/* UPI VPA (Optional) */}
              <div>
                <label className="text-[11px] text-[#8EB69B] block mb-1">UPI VPA (Optional)</label>
                <input
                  type="text"
                  id="manual-vpa-input"
                  value={upiVpa}
                  onChange={(e) => setUpiVpa(e.target.value)}
                  placeholder="e.g. merchant@icici"
                  className="w-full p-2.5 rounded-xl bg-[#163832] border border-[#235347] text-xs text-[#DAF1DE] placeholder-[#8EB69B]/60 focus:outline-none focus:border-[#8EB69B]"
                />
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category-select" className="text-[11px] text-[#8EB69B] block mb-1">
                  Category
                </label>
                <select
                  id="category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full p-2.5 rounded-xl bg-[#163832] border border-[#235347] text-xs text-[#DAF1DE] focus:outline-none focus:border-[#8EB69B]"
                >
                  {categoriesQuery.data && categoriesQuery.data.length > 0 ? (
                    categoriesQuery.data.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))
                  ) : (
                    Object.keys(CATEGORIES_CONFIG).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#235347] flex items-center justify-end gap-2 bg-[#051F20]/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-[#8EB69B] hover:text-[#DAF1DE] hover:bg-[#163832] transition-colors"
          >
            Cancel
          </button>

          {activeTab === 'sms' ? (
            <button
              type="button"
              id="btn-save-parsed-sms"
              onClick={handleSaveParsedSms}
              disabled={!parsedPreview || !parsedPreview.amount || parseSyncTextMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#DAF1DE] hover:bg-white disabled:opacity-40 text-[#051F20] text-xs font-bold transition-colors shadow-sm"
            >
              <CheckCircle2 size={14} />
              <span>Save Transaction</span>
            </button>
          ) : (
            <button
              type="button"
              id="btn-save-manual-tx"
              onClick={handleSaveManual}
              disabled={!amount || !merchant.trim() || createTransactionMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#DAF1DE] hover:bg-white disabled:opacity-40 text-[#051F20] text-xs font-bold transition-colors shadow-sm"
            >
              {createTransactionMutation.isPending ? (
                <Loader2 size={14} className="animate-spin text-[#051F20]" />
              ) : (
                <Plus size={14} />
              )}
              <span>{createTransactionMutation.isPending ? 'Saving...' : 'Add Entry'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
