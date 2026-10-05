import React, { useState, useMemo, useEffect } from 'react';
import { 
  INITIAL_TRANSACTIONS 
} from './data/mockData';
import { 
  Transaction, 
  ExpenseCategory, 
  CashFlowSummary, 
  ViewTab, 
  SplitMember 
} from './types';
import { Navigation, LayoutMode } from './components/Navigation';
import { HomeView } from './components/HomeView';
import { InboxView } from './components/InboxView';
import { ExpensesView } from './components/ExpensesView';
import { AnalyticsView } from './components/AnalyticsView';
import { AddTransactionModal } from './components/AddTransactionModal';
import { TransactionDetailDrawer } from './components/TransactionDetailDrawer';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import {
  useTransactions,
  useInbox,
  useAnalyticsSummary,
  useCategories,
  useApproveInboxItem,
  useSetPeerSplits,
  useTogglePeerSplitPaid,
} from './hooks/useExpenseApi';
import {
  mapTransactionResponseToUi,
  mapInboxItemToUi,
  mapSummaryToCashFlow,
  mapUiSplitsToPeerSplitDto,
  parseNumericId,
} from './utils/adapters';

export default function App() {
  const networkStatus = useNetworkStatus();
  const [currentTab, setCurrentTab] = useState<ViewTab>('home');
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('phone');
  
  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addModalInitialMode, setAddModalInitialMode] = useState<'manual' | 'sms'>('manual');
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<Transaction | null>(null);

  // In-App Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Live API queries & mutations
  const transactionsQuery = useTransactions();
  const inboxQuery = useInbox();
  const categoriesQuery = useCategories();
  const summaryQuery = useAnalyticsSummary('2026-08-01', '2026-08-31');
  const approveInboxMutation = useApproveInboxItem();
  const setPeerSplitsMutation = useSetPeerSplits();
  const togglePeerSplitPaidMutation = useTogglePeerSplitPaid();

  // Category ID <-> Name maps
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

  // Synchronize live transactions and inbox items when available from API
  useEffect(() => {
    const txItems = transactionsQuery.data?.items;
    const inboxItems = inboxQuery.data;

    const hasTx = Boolean(txItems && txItems.length > 0);
    const hasInbox = Boolean(inboxItems && inboxItems.length > 0);

    if (hasTx || hasInbox) {
      const mappedTx = (txItems || []).map(tx => mapTransactionResponseToUi(tx, categoryNameMap));
      const mappedInbox = (inboxItems || []).map(item => mapInboxItemToUi(item));
      setTransactions([...mappedInbox, ...mappedTx]);
    }
  }, [transactionsQuery.data, inboxQuery.data, categoryNameMap]);

  // Derived datasets
  const unverifiedTransactions = useMemo(() => {
    return transactions.filter(t => !t.isVerified);
  }, [transactions]);

  // Cash flow analytics calculation (with live summary support & fallback)
  const cashFlow: CashFlowSummary = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === 'CREDIT')
      .reduce((acc, t) => acc + t.amount, 0);

    const totalSpend = transactions
      .filter(t => t.type === 'DEBIT')
      .reduce((acc, t) => acc + t.amount, 0);

    const fallbackBalance = 185000 + (totalIncome > 0 ? 0 : 0) - totalSpend + 63920.50;
    const unverifiedAmount = unverifiedTransactions.reduce((acc, t) => acc + t.amount, 0);

    if (summaryQuery.data) {
      return mapSummaryToCashFlow(
        summaryQuery.data,
        unverifiedTransactions.length,
        unverifiedAmount,
        fallbackBalance
      );
    }

    const burnRate = totalSpend / 31; // 31 days in August
    const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalSpend) / totalIncome) * 100)) : 70;

    return {
      totalBalance: fallbackBalance,
      monthSpend: totalSpend,
      monthIncome: totalIncome || 185000,
      dailyBurnRate: burnRate,
      projectedMonthEnd: totalSpend * 1.05,
      savingsRatePercent: savingsRate,
      unverifiedCount: unverifiedTransactions.length,
      unverifiedAmount: unverifiedAmount,
    };
  }, [transactions, unverifiedTransactions, summaryQuery.data]);

  // Handlers
  const handleVerifyTransaction = (
    txId: string,
    assignedCategory: ExpenseCategory,
    learnMerchant: boolean = true
  ) => {
    // 1. Immediate optimistic UI feedback
    setTransactions(prev => prev.map(tx => {
      if (tx.id === txId) {
        return {
          ...tx,
          category: assignedCategory,
          isVerified: true
        };
      }
      return tx;
    }));

    // 2. Call backend mutation if numeric ID is present
    const numericId = parseNumericId(txId);

    if (numericId !== null) {
      const catId = categoryIdMap[assignedCategory] || 1;
      approveInboxMutation.mutateAsync({
        txId: numericId,
        payload: {
          category_id: catId,
          learn_merchant: learnMerchant,
        },
      }).catch(err => {
        console.error('Failed to approve inbox item:', err);
      });
    }

    showToast(`Categorized as ${assignedCategory}`);
  };

  const handleUpdateCategory = (txId: string, category: ExpenseCategory) => {
    setTransactions(prev => prev.map(tx => tx.id === txId ? { ...tx, category } : tx));
    if (selectedTxForDetail && selectedTxForDetail.id === txId) {
      setSelectedTxForDetail(prev => prev ? { ...prev, category } : null);
    }
    showToast(`Category updated to ${category}`);
  };

  const handleUpdateSplit = (txId: string, splits: SplitMember[]) => {
    setTransactions(prev => prev.map(tx => tx.id === txId ? { ...tx, splitDetails: splits } : tx));
    if (selectedTxForDetail && selectedTxForDetail.id === txId) {
      setSelectedTxForDetail(prev => prev ? { ...prev, splitDetails: splits } : null);
    }

    const numericId = parseNumericId(txId);

    if (numericId !== null) {
      setPeerSplitsMutation.mutateAsync({
        txId: numericId,
        splits: mapUiSplitsToPeerSplitDto(splits),
      }).catch(err => {
        console.error('Failed to set peer splits:', err);
      });
    }
  };

  const handleTogglePeerSplitPaid = (txId: string, peerSplitId: string | number) => {
    setTransactions(prev => prev.map(tx => {
      if (tx.id !== txId || !tx.splitDetails) return tx;
      const updated = tx.splitDetails.map(m =>
        String(m.id) === String(peerSplitId) ? { ...m, isPaid: !m.isPaid } : m
      );
      return { ...tx, splitDetails: updated };
    }));

    if (selectedTxForDetail && selectedTxForDetail.id === txId && selectedTxForDetail.splitDetails) {
      setSelectedTxForDetail(prev => {
        if (!prev || !prev.splitDetails) return prev;
        const updated = prev.splitDetails.map(m =>
          String(m.id) === String(peerSplitId) ? { ...m, isPaid: !m.isPaid } : m
        );
        return { ...prev, splitDetails: updated };
      });
    }

    const numericTxId = parseNumericId(txId);
    const numericSplitId = parseNumericId(peerSplitId);

    if (numericTxId !== null && numericSplitId !== null) {
      togglePeerSplitPaidMutation.mutateAsync({
        txId: numericTxId,
        peerSplitId: numericSplitId,
      }).catch(err => {
        console.error('Failed to toggle peer split paid:', err);
      });
    }

    showToast('Peer settlement status updated');
  };

  const handleDeleteTransaction = (txId: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== txId));
    showToast('Transaction removed', 'info');
  };

  const handleAddTransaction = (newTxData: Partial<Transaction>) => {
    const newTx: Transaction = {
      id: newTxData.id || `tx-${Date.now()}`,
      amount: newTxData.amount || 0,
      type: newTxData.type || 'DEBIT',
      merchant: newTxData.merchant || 'Merchant Transfer',
      upiVpa: newTxData.upiVpa,
      category: newTxData.category || 'Food & Dining',
      date: newTxData.date || new Date().toISOString().split('T')[0],
      time: newTxData.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      paymentMethod: newTxData.paymentMethod || 'UPI_GPAY',
      accountNumberMasked: newTxData.accountNumberMasked || 'HDFC Bank **4590',
      isVerified: newTxData.isVerified ?? true,
      aiConfidence: newTxData.aiConfidence ?? 95,
      aiSuggestedCategory: newTxData.aiSuggestedCategory,
      notes: newTxData.notes,
      referenceId: newTxData.referenceId,
      tags: newTxData.tags,
      rawSmsSnippet: newTxData.rawSmsSnippet,
      splitDetails: newTxData.splitDetails
    };

    setTransactions(prev => {
      const exists = prev.some(tx => tx.id === newTx.id);
      if (exists) {
        return prev.map(tx => (tx.id === newTx.id ? newTx : tx));
      }
      return [newTx, ...prev];
    });

    showToast(`Recorded: ${newTx.merchant} (${formatINR(newTx.amount)})`);
  };

  const handleResetDemo = () => {
    setTransactions(INITIAL_TRANSACTIONS);
  };

  const handleOpenAddModal = (mode: 'manual' | 'sms' = 'manual') => {
    setAddModalInitialMode(mode);
    setIsAddModalOpen(true);
  };

  // Helper to render active view
  const renderCurrentView = () => {
    switch (currentTab) {
      case 'home':
        return (
          <HomeView
            cashFlow={cashFlow}
            recentTransactions={transactions}
            unverifiedTransactions={unverifiedTransactions}
            onNavigateToInbox={() => setCurrentTab('inbox')}
            onNavigateToExpenses={() => setCurrentTab('expenses')}
            onNavigateToAnalytics={() => setCurrentTab('analytics')}
            onOpenAddModal={handleOpenAddModal}
            onSelectTransaction={setSelectedTxForDetail}
          />
        );
      case 'inbox':
        return (
          <InboxView
            unverifiedTransactions={unverifiedTransactions}
            onVerifyTransaction={handleVerifyTransaction}
            onOpenSplitDrawer={(tx) => setSelectedTxForDetail(tx)}
            onResetInbox={handleResetDemo}
          />
        );
      case 'expenses':
        return (
          <ExpensesView
            transactions={transactions}
            onSelectTransaction={setSelectedTxForDetail}
            onOpenAddModal={() => handleOpenAddModal('manual')}
          />
        );
      case 'analytics':
        return (
          <AnalyticsView
            totalMonthSpend={cashFlow.monthSpend}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#051F20] text-[#DAF1DE] flex flex-col items-center justify-start relative font-sans selection:bg-[#235347] selection:text-[#DAF1DE]">
      <div className="relative z-10 w-full flex flex-col items-center min-h-[100dvh]">
        <Navigation
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          unverifiedCount={unverifiedTransactions.length}
          layoutMode={layoutMode}
          onChangeLayoutMode={setLayoutMode}
          onOpenAddModal={handleOpenAddModal}
          networkStatus={networkStatus}
        />

        {/* Main Content Area */}
        <main className="w-full flex-1 flex justify-center px-3 sm:px-4 pt-2 pb-24 sm:pb-28 z-10">
          <div 
            className={`w-full transition-all duration-200 ${
              layoutMode === 'phone'
                ? 'max-w-[430px] sm:rounded-3xl sm:border sm:border-[#235347]/30 sm:shadow-[0_0_50px_-12px_rgba(35,83,71,0.5)] sm:p-2 sm:bg-[#051F20]' 
                : 'max-w-3xl'
            }`}
          >
            {renderCurrentView()}
          </div>
        </main>

        {/* Add Transaction & Smart SMS Parser Modal */}
        <AddTransactionModal
          isOpen={isAddModalOpen}
          initialMode={addModalInitialMode}
          onClose={() => setIsAddModalOpen(false)}
          onAddTransaction={handleAddTransaction}
        />

        {/* Transaction Detail Bottom Sheet Drawer */}
        <TransactionDetailDrawer
          transaction={selectedTxForDetail}
          onClose={() => setSelectedTxForDetail(null)}
          onUpdateCategory={handleUpdateCategory}
          onUpdateSplit={handleUpdateSplit}
          onTogglePeerSplitPaid={handleTogglePeerSplitPaid}
          onDeleteTransaction={handleDeleteTransaction}
        />

        {/* In-App Toast Notification Stack */}
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </div>
    </div>
  );
}
