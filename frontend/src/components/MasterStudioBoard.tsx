import React, { useState } from 'react';
import { 
  Palette, 
  Type, 
  Layers, 
  Database, 
  Copy, 
  Check, 
  Sparkles, 
  Smartphone, 
  ChevronRight, 
  CheckCircle2,
  Maximize2,
  ExternalLink,
  Split,
  Scan,
  ShieldCheck
} from 'lucide-react';
import { DESIGN_TOKENS, SCREEN_BLUEPRINTS } from '../data/designSpecData';
import { INITIAL_TRANSACTIONS } from '../data/mockData';
import { ViewTab } from '../types';

interface MasterStudioBoardProps {
  children?: React.ReactNode;
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  onOpenAddModal: (mode?: 'manual' | 'sms') => void;
}

export const MasterStudioBoard: React.FC<MasterStudioBoardProps> = ({
  children,
  currentTab,
  onSelectTab,
  onOpenAddModal
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  return (
    <div className="w-full max-w-[1550px] mx-auto px-2 sm:px-4 py-3 space-y-4 animate-in fade-in duration-300">
      {/* Studio Header Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
              <Sparkles size={11} />
              Design System Showcase & Studio Board
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Interactive Prototype
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1.5">
            PaisaIQ Design Architecture & Mobile Experience
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            3-Column Master Layout: Left Tokens & Scale, Center Live Device Frame, Right Component Blueprint & Schemas.
          </p>
        </div>

        {/* Quick View Jumper in Header */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(['home', 'inbox', 'expenses', 'analytics', 'spec'] as ViewTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onSelectTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                currentTab === tab
                  ? 'bg-indigo-600 text-white border-indigo-400/30 shadow-md'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Column Master Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Column 1: Design Tokens & Typography Scale (Left Column) */}
        <div className="lg:col-span-3 space-y-4 max-h-[85vh] overflow-y-auto pr-1">
          {/* Color Palette Card */}
          <div className="p-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette size={15} className="text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Color System Tokens
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Dark Frosted</span>
            </div>

            <div className="space-y-2">
              {DESIGN_TOKENS.colors.darkMode.slice(0, 6).map((c) => (
                <div key={c.name} className="p-2.5 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-2.5">
                  <div 
                    className="w-7 h-7 rounded-lg border border-white/15 flex-shrink-0 shadow-inner" 
                    style={{ backgroundColor: c.hexValue }} 
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold text-white block truncate">{c.name}</span>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{c.hexValue}</span>
                      <span className="text-indigo-300/80">{c.variable}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Typography Token Card */}
          <div className="p-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type size={15} className="text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Typography Scale
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Plus Jakarta</span>
            </div>

            <div className="space-y-2">
              {DESIGN_TOKENS.typography.slice(0, 4).map((t) => (
                <div key={t.role} className="p-2.5 rounded-2xl bg-white/5 border border-white/5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-300">{t.role}</span>
                    <span className="font-mono text-[10px] text-slate-400">{t.fontSize}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate">{t.targetElements}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Nested Radius Math Card */}
          <div className="p-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-2 shadow-lg text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-400" />
              Radius Mathematical Rule
            </h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <code className="text-emerald-400 font-bold">R_inner = R_outer - Padding</code>
            </p>
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5 space-y-1 text-[11px] text-slate-300">
              <div>Outer Container: <span className="text-white font-bold">24px (rounded-3xl)</span></div>
              <div>Padding: <span className="text-white font-bold">16px (p-4)</span></div>
              <div>Inner Child: <span className="text-indigo-300 font-bold">16px (rounded-2xl)</span></div>
            </div>
          </div>
        </div>

        {/* Column 2: Live Smartphone Mockup Prototype (Center Column) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-start">
          <div className="w-full max-w-[430px] rounded-[48px] border-[8px] border-[#1C1C1E] bg-[#0A0A0B]/90 backdrop-blur-2xl shadow-2xl ring-1 ring-white/15 px-4 pt-8 pb-10 min-h-[780px] relative overflow-hidden flex flex-col">
            {/* Dynamic Mobile Island / Speaker Bar */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-5 bg-[#1C1C1E] rounded-b-2xl z-50 flex items-center justify-center pointer-events-none">
              <div className="w-10 h-1 bg-white/15 rounded-full" />
            </div>

            {/* Mobile Header State */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pb-2 border-b border-white/5 mb-3">
              <span>9:41 AM</span>
              <div className="flex items-center gap-1 text-slate-300">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>

            {/* Live Interactive View Child */}
            <div className="flex-1 overflow-y-auto max-h-[660px] no-scrollbar">
              {children}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center mt-3 font-medium">
            ✨ Fully functional prototype: tap any buttons, tabs, parse bank SMS, or split bills.
          </p>
        </div>

        {/* Column 3: Component Blueprint & Data Schema (Right Column) */}
        <div className="lg:col-span-4 space-y-4 max-h-[85vh] overflow-y-auto pr-1">
          {/* Active Screen Blueprint Details */}
          <div className="p-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-400" />
                Active View Architecture
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold uppercase">
                {currentTab}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2">
              <span className="text-xs font-bold text-white block">
                {currentTab === 'home' && 'Home & Real-time Cash Flow'}
                {currentTab === 'inbox' && 'Human-in-the-Loop Review Deck'}
                {currentTab === 'expenses' && 'Transaction Ledger & Filters'}
                {currentTab === 'analytics' && 'Spend Velocity & Subscriptions'}
                {currentTab === 'spec' && 'Architectural Specification'}
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {currentTab === 'home' && 'Calculates real-time net liquidity, daily burn rates, and alerts users to unverified bank notifications.'}
                {currentTab === 'inbox' && 'Zero-friction review queue showing heuristic-parsed SMS alerts with confidence meters.'}
                {currentTab === 'expenses' && 'Smart filterable transaction ledger with UPI payment icons and multi-term search.'}
                {currentTab === 'analytics' && 'Interactive Recharts donut of expense categories and daily spending velocity.'}
                {currentTab === 'spec' && 'Comprehensive tokens, typographic hierarchy, and JSON blueprints.'}
              </p>
            </div>

            {/* Quick Actions in Blueprint */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                Interactive Triggers
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onOpenAddModal('sms')}
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left text-xs text-indigo-300 font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Scan size={13} />
                  <span>Parse Bank SMS</span>
                </button>
                <button
                  onClick={() => onOpenAddModal('manual')}
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left text-xs text-slate-300 font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Split size={13} />
                  <span>Add Transaction</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Mock Data Schema Preview */}
          <div className="p-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  JSON Schema Preview
                </h3>
              </div>
              <button
                onClick={() => copyToClipboard(JSON.stringify(INITIAL_TRANSACTIONS[0], null, 2), 'schema-copy')}
                className="text-[10px] text-indigo-300 hover:text-white flex items-center gap-1 font-bold"
              >
                {copiedSection === 'schema-copy' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedSection === 'schema-copy' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-3 rounded-2xl bg-black/50 border border-white/5 font-mono text-[10px] text-slate-300 max-h-48 overflow-x-auto">
              <pre>{JSON.stringify(INITIAL_TRANSACTIONS[0], null, 2)}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
