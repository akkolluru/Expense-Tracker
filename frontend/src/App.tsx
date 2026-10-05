import React, { useState, useMemo } from 'react';
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
import { useNetworkStatus } from './hooks/useNetworkStatus';

export default function App() {
  const networkStatus = useNetworkStatus();
  const [currentTab, setCurrentTab] = useState<ViewTab>('home');
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('phone');
  
  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addModalInitialMode, setAddModalInitialMode] = useState<'manual' | 'sms'>('sms');
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<Transaction | null>(null);

  // Derived datasets
  const unverifiedTransactions = useMemo(() => {
    return transactions.filter(t => !t.isVerified);
  }, [transactions]);

  // Cash flow analytics calculation
  const cashFlow: CashFlowSummary = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === 'CREDIT')
      .reduce((acc, t) => acc + t.amount, 0);

    const totalSpend = transactions
      .filter(t => t.type === 'DEBIT')
      .reduce((acc, t) => acc + t.amount, 0);

    const burnRate = totalSpend / 31; // 31 days in August
    const totalBalance = 185000 + (totalIncome > 0 ? 0 : 0) - totalSpend + 63920.50;
    const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalSpend) / totalIncome) * 100)) : 70;

    return {
      totalBalance,
      monthSpend: totalSpend,
      monthIncome: totalIncome || 185000,
      dailyBurnRate: burnRate,
      projectedMonthEnd: totalSpend * 1.05,
      savingsRatePercent: savingsRate,
      unverifiedCount: unverifiedTransactions.length,
      unverifiedAmount: unverifiedTransactions.reduce((acc, t) => acc + t.amount, 0)
    };
  }, [transactions, unverifiedTransactions]);

  // Handlers
  const handleVerifyTransaction = (txId: string, assignedCategory: ExpenseCategory) => {
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
  };

  const handleUpdateCategory = (txId: string, category: ExpenseCategory) => {
    setTransactions(prev => prev.map(tx => tx.id === txId ? { ...tx, category } : tx));
    if (selectedTxForDetail && selectedTxForDetail.id === txId) {
      setSelectedTxForDetail(prev => prev ? { ...prev, category } : null);
    }
  };

  const handleUpdateSplit = (txId: string, splits: SplitMember[]) => {
    setTransactions(prev => prev.map(tx => tx.id === txId ? { ...tx, splitDetails: splits } : tx));
    if (selectedTxForDetail && selectedTxForDetail.id === txId) {
      setSelectedTxForDetail(prev => prev ? { ...prev, splitDetails: splits } : null);
    }
  };

  const handleDeleteTransaction = (txId: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== txId));
  };

  const handleAddTransaction = (newTxData: Partial<Transaction>) => {
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      amount: newTxData.amount || 0,
      type: newTxData.type || 'DEBIT',
      merchant: newTxData.merchant || 'Merchant Transfer',
      upiVpa: newTxData.upiVpa,
      category: newTxData.category || 'Food & Dining',
      date: newTxData.date || '2026-08-31',
      time: newTxData.time || '12:00 PM',
      paymentMethod: newTxData.paymentMethod || 'UPI_GPAY',
      accountNumberMasked: newTxData.accountNumberMasked || 'HDFC Bank **4590',
      isVerified: true,
      aiConfidence: newTxData.aiConfidence || 95,
      rawSmsSnippet: newTxData.rawSmsSnippet,
      splitDetails: newTxData.splitDetails
    };

    setTransactions(prev => [newTx, ...prev]);
  };

  const handleResetDemo = () => {
    setTransactions(INITIAL_TRANSACTIONS);
  };

  const handleOpenAddModal = (mode: 'manual' | 'sms' = 'sms') => {
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
    <div className="min-h-screen bg-[#051F20] text-[#DAF1DE] flex flex-col items-center justify-start relative font-sans selection:bg-[#235347] selection:text-[#DAF1DE]">
      <div className="relative z-10 w-full flex flex-col items-center min-h-screen">
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
        <main className="w-full flex-1 flex justify-center p-3 sm:p-5 md:p-6 z-10">
          <div 
            className={`w-full transition-all duration-200 ${
              layoutMode === 'phone'
                ? 'max-w-[430px]' 
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
          onDeleteTransaction={handleDeleteTransaction}
        />
      </div>
    </div>
  );
}
