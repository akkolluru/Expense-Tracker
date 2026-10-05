import React, { useState } from 'react';
import { 
  Home, 
  Inbox, 
  ListFilter, 
  PieChart, 
  Smartphone, 
  Monitor, 
  Plus, 
  Scan,
  Wifi,
  WifiOff,
  RefreshCw,
  Server,
  CheckCircle2,
  AlertTriangle,
  X
} from 'lucide-react';
import { ViewTab } from '../types';
import { ConnectionState, NetworkStatus } from '../hooks/useNetworkStatus';

export type LayoutMode = 'phone' | 'desktop' | 'studio';

interface NavigationProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  unverifiedCount: number;
  layoutMode: LayoutMode;
  onChangeLayoutMode: (mode: LayoutMode) => void;
  onOpenAddModal: (mode?: 'manual' | 'sms') => void;
  networkStatus?: NetworkStatus;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  unverifiedCount,
  layoutMode,
  onChangeLayoutMode,
  onOpenAddModal,
  networkStatus,
}) => {
  const [showStatusModal, setShowStatusModal] = useState(false);

  const tabs: { id: ViewTab; label: string; icon: any; badge?: number }[] = [
    { id: 'home', label: 'Overview', icon: Home },
    { id: 'inbox', label: 'Review', icon: Inbox, badge: unverifiedCount },
    { id: 'expenses', label: 'Ledger', icon: ListFilter },
    { id: 'analytics', label: 'Insights', icon: PieChart },
  ];

  const connectionState: ConnectionState = networkStatus?.connectionState || 'online';
  const isSyncing = networkStatus?.isSyncing || false;
  const pendingSyncCount = networkStatus?.pendingSyncCount || 0;

  return (
    <>
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 w-full bg-[#051F20]/90 backdrop-blur-md border-b border-[#235347]/80 px-4 sm:px-6 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Logo, Brand & Sync Status */}
          <div className="flex items-center gap-3">
            <div 
              onClick={() => onSelectTab('home')}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-[#163832] border border-[#235347] flex items-center justify-center text-[#DAF1DE] font-bold text-xs">
                ₹
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#DAF1DE] tracking-tight">
                  PaisaIQ
                </span>
                <span className="text-[10px] font-mono text-[#8EB69B] bg-[#163832] px-1.5 py-0.2 rounded border border-[#235347] font-medium">
                  v2.0
                </span>
              </div>
            </div>

            {/* Connectivity / Sync Status Badge */}
            <button
              onClick={() => setShowStatusModal(true)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-mono transition-all ${
                isSyncing
                  ? 'bg-amber-950/40 border-amber-600/50 text-amber-300'
                  : connectionState === 'online'
                  ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300 hover:border-emerald-500'
                  : connectionState === 'degraded'
                  ? 'bg-yellow-950/40 border-yellow-600/40 text-yellow-300'
                  : 'bg-amber-950/40 border-amber-600/50 text-amber-300 hover:border-amber-500'
              }`}
              title="Click to view network and sync status"
            >
              {isSyncing ? (
                <>
                  <RefreshCw size={11} className="animate-spin text-amber-400" />
                  <span className="hidden sm:inline">Syncing</span>
                  {pendingSyncCount > 0 && <span>({pendingSyncCount})</span>}
                </>
              ) : connectionState === 'online' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="hidden sm:inline font-sans font-medium text-[11px]">Live</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="hidden sm:inline font-sans font-medium text-[11px]">Offline</span>
                  {pendingSyncCount > 0 && (
                    <span className="px-1 py-0.2 bg-amber-400/20 text-amber-200 rounded text-[10px] font-bold">
                      +{pendingSyncCount}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>

          {/* Center Layout Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#0B2B26] border border-[#235347]">
            <button
              onClick={() => onChangeLayoutMode('phone')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                layoutMode === 'phone'
                  ? 'bg-[#235347] text-[#DAF1DE] font-semibold shadow-sm'
                  : 'text-[#8EB69B] hover:text-[#DAF1DE]'
              }`}
              title="Mobile View"
            >
              <Smartphone size={13} />
              <span className="hidden sm:inline">Mobile</span>
            </button>

            <button
              onClick={() => onChangeLayoutMode('desktop')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                layoutMode === 'desktop'
                  ? 'bg-[#235347] text-[#DAF1DE] font-semibold shadow-sm'
                  : 'text-[#8EB69B] hover:text-[#DAF1DE]'
              }`}
              title="Expanded View"
            >
              <Monitor size={13} />
              <span className="hidden sm:inline">Expanded</span>
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAddModal('sms')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B2B26] hover:bg-[#163832] text-[#8EB69B] hover:text-[#DAF1DE] border border-[#235347] text-xs font-medium transition-colors"
              title="Parse Bank Alert SMS"
            >
              <Scan size={13} />
              <span className="hidden sm:inline">Parse SMS</span>
            </button>

            <button
              onClick={() => onOpenAddModal('manual')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#DAF1DE] hover:bg-white text-[#051F20] text-xs font-bold transition-colors shadow-sm"
              title="Add Transaction"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Add Entry</span>
            </button>
          </div>
        </div>
      </header>

      {/* Network & Offline Sync Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#0B2B26] border border-[#235347] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#235347]">
              <div className="flex items-center gap-2">
                <Server size={18} className="text-[#8EB69B]" />
                <h3 className="text-sm font-bold text-[#DAF1DE]">System & Offline Sync</h3>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="p-1 rounded-lg hover:bg-[#163832] text-[#8EB69B] hover:text-[#DAF1DE]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#051F20] border border-[#163832]">
                <span className="text-[#8EB69B] flex items-center gap-1.5">
                  {networkStatus?.isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                  Network Status
                </span>
                <span className={`font-semibold ${networkStatus?.isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {networkStatus?.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#051F20] border border-[#163832]">
                <span className="text-[#8EB69B] flex items-center gap-1.5">
                  <Server size={14} />
                  Host Connection
                </span>
                <span className={`font-semibold ${networkStatus?.isBackendReachable ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {networkStatus?.isBackendReachable ? 'Connected' : 'Unreachable'}
                </span>
              </div>

              {networkStatus?.healthData && (
                <>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#051F20] border border-[#163832]">
                    <span className="text-[#8EB69B] flex items-center gap-1.5">
                      <CheckCircle2 size={14} />
                      Database
                    </span>
                    <span className="font-mono text-[#DAF1DE]">
                      {networkStatus.healthData.database}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#051F20] border border-[#163832]">
                    <span className="text-[#8EB69B] flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      LLM Circuit Breaker
                    </span>
                    <span className="font-mono text-[#DAF1DE]">
                      {networkStatus.healthData.llm_circuit_breaker}
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#051F20] border border-[#163832]">
                <span className="text-[#8EB69B]">Pending Sync Queue</span>
                <span className={`font-bold font-mono ${pendingSyncCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {pendingSyncCount} item{pendingSyncCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {/* Flush Button */}
            <div className="pt-2 flex gap-2">
              <button
                disabled={isSyncing || pendingSyncCount === 0 || !networkStatus?.isBackendReachable}
                onClick={async () => {
                  if (networkStatus?.flushPendingQueue) {
                    await networkStatus.flushPendingQueue();
                  }
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  isSyncing || pendingSyncCount === 0 || !networkStatus?.isBackendReachable
                    ? 'bg-[#163832] text-[#8EB69B] opacity-50 cursor-not-allowed'
                    : 'bg-[#DAF1DE] hover:bg-white text-[#051F20]'
                }`}
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Syncing...' : 'Sync Pending Actions Now'}
              </button>

              <button
                onClick={() => {
                  networkStatus?.checkHealth();
                }}
                className="py-2 px-3 rounded-xl text-xs font-semibold bg-[#163832] hover:bg-[#235347] text-[#DAF1DE] transition-colors"
                title="Ping Server Health"
              >
                Check Health
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Mobile Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#051F20]/95 backdrop-blur-md border-t border-[#235347] px-3 py-1.5">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => onSelectTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
                  isActive
                    ? 'text-[#DAF1DE] font-semibold bg-[#163832] border border-[#235347]'
                    : 'text-[#8EB69B] hover:text-[#DAF1DE]'
                }`}
              >
                <div className="relative">
                  <Icon size={17} />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-3.5 h-3.5 px-1 rounded-full bg-[#8EB69B] text-[#051F20] text-[9px] font-extrabold flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
