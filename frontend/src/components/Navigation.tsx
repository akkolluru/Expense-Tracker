import React from 'react';
import { 
  Home, 
  Inbox, 
  ListFilter, 
  PieChart, 
  Smartphone, 
  Monitor, 
  Plus, 
  Scan
} from 'lucide-react';
import { ViewTab } from '../types';

export type LayoutMode = 'phone' | 'desktop' | 'studio';

interface NavigationProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  unverifiedCount: number;
  layoutMode: LayoutMode;
  onChangeLayoutMode: (mode: LayoutMode) => void;
  onOpenAddModal: (mode?: 'manual' | 'sms') => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  unverifiedCount,
  layoutMode,
  onChangeLayoutMode,
  onOpenAddModal,
}) => {
  const tabs: { id: ViewTab; label: string; icon: any; badge?: number }[] = [
    { id: 'home', label: 'Overview', icon: Home },
    { id: 'inbox', label: 'Review', icon: Inbox, badge: unverifiedCount },
    { id: 'expenses', label: 'Ledger', icon: ListFilter },
    { id: 'analytics', label: 'Insights', icon: PieChart },
  ];

  return (
    <>
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 w-full bg-[#051F20]/90 backdrop-blur-md border-b border-[#235347]/80 px-4 sm:px-6 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div 
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-[#163832] border border-[#235347] flex items-center justify-center text-[#DAF1DE] font-bold text-xs">
              ₹
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#DAF1DE] tracking-tight">
                  PaisaIQ
                </span>
                <span className="text-[10px] font-mono text-[#8EB69B] bg-[#163832] px-1.5 py-0.2 rounded border border-[#235347] font-medium">
                  v1.2
                </span>
              </div>
            </div>
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
