import React, { useState } from 'react';
import { 
  FileCode2, 
  Palette, 
  Type, 
  Layout, 
  Layers, 
  Database, 
  Copy, 
  Check, 
  Sparkles, 
  Terminal,
  ShieldCheck,
  CheckCircle2,
  Box,
  Eye
} from 'lucide-react';
import { motion } from 'motion/react';
import { DESIGN_TOKENS, SCREEN_BLUEPRINTS } from '../data/designSpecData';
import { 
  INITIAL_TRANSACTIONS, 
  CATEGORY_BREAKDOWN_DATA, 
  INITIAL_CASH_FLOW, 
  ACTIVE_SUBSCRIPTIONS 
} from '../data/mockData';
import { ScreenDesignsGallery } from './ScreenDesignsGallery';
import { ViewTab } from '../types';

interface DesignSpecViewProps {
  onNavigateToTab?: (tab: ViewTab) => void;
}

export const DesignSpecView: React.FC<DesignSpecViewProps> = ({ onNavigateToTab }) => {
  const [activeSubTab, setActiveSubTab] = useState<'gallery' | 'tokens' | 'typography' | 'screens' | 'data' | 'blueprint'>('gallery');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const exportAllJson = () => {
    const fullBundle = {
      appName: 'PaisaIQ - Financial Intelligence & Expense Tracker',
      version: '1.0.0-PROD',
      designTokens: DESIGN_TOKENS,
      screenBlueprints: SCREEN_BLUEPRINTS,
      mockData: {
        transactions: INITIAL_TRANSACTIONS,
        categoryBreakdown: CATEGORY_BREAKDOWN_DATA,
        cashFlow: INITIAL_CASH_FLOW,
        subscriptions: ACTIVE_SUBSCRIPTIONS
      },
      componentHierarchyTree: [
        'App.tsx (Root State, View Routing, Responsive Shell)',
        '├── Navigation.tsx (Bottom Tab Bar & Top Device Controls)',
        '├── HomeView.tsx (Hero Balance, Cash Flow Gauges, Needs Review Alert, Recent Feed)',
        '├── InboxView.tsx (Human-in-the-Loop Review Deck, AI Confidence Meters, 1-Tap Category Chips)',
        '├── ExpensesView.tsx (Smart Filter Bar, Search Index, Chronological Grouping)',
        '├── AnalyticsView.tsx (Category Donut Chart, Daily Trend Velocity, Recurring Mandates)',
        '├── AddTransactionModal.tsx (Smart SMS Auto-Parser, Manual Form, Split Engine)',
        '├── TransactionDetailDrawer.tsx (Beneficiary UPI VPA, Split Expense Ledger)',
        '└── DesignSpecView.tsx (Architectural Spec & Token Explorer)'
      ]
    };
    return JSON.stringify(fullBundle, null, 2);
  };

  return (
    <div id="design-spec-view" className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
              <Sparkles size={11} />
              Principal Design System Spec
            </span>
            <span className="text-[10px] text-slate-400">Antigravity Ready</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-1.5">
            UI/UX Design Architecture & Component Blueprint
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Explore screen mockups, design tokens, color palette, typography ladders, and developer specifications.
          </p>
        </div>

        <button
          onClick={() => copyToClipboard(exportAllJson(), 'full-bundle')}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-950/50 border border-indigo-400/30 transition-all flex-shrink-0"
        >
          {copiedSection === 'full-bundle' ? <Check size={14} /> : <Copy size={14} />}
          <span>{copiedSection === 'full-bundle' ? 'Copied Full Spec JSON' : 'Export Full Spec JSON'}</span>
        </button>
      </div>

      {/* 2. Sub-tab Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs border-b border-white/10">
        <button
          onClick={() => setActiveSubTab('gallery')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-bold transition-all border ${
            activeSubTab === 'gallery'
              ? 'border-indigo-400/40 text-white bg-indigo-600 shadow-md'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Eye size={14} />
          <span>Screen Designs Gallery</span>
        </button>

        <button
          onClick={() => setActiveSubTab('tokens')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-bold transition-all border ${
            activeSubTab === 'tokens'
              ? 'border-indigo-400/40 text-white bg-indigo-600 shadow-md'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Palette size={14} />
          <span>Design Tokens & Colors</span>
        </button>

        <button
          onClick={() => setActiveSubTab('typography')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-bold transition-all border ${
            activeSubTab === 'typography'
              ? 'border-indigo-400/40 text-white bg-indigo-600 shadow-md'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Type size={14} />
          <span>Typography & Spacing</span>
        </button>

        <button
          onClick={() => setActiveSubTab('screens')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-bold transition-all border ${
            activeSubTab === 'screens'
              ? 'border-indigo-400/40 text-white bg-indigo-600 shadow-md'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Layout size={14} />
          <span>Screen Architecture</span>
        </button>

        <button
          onClick={() => setActiveSubTab('blueprint')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-bold transition-all border ${
            activeSubTab === 'blueprint'
              ? 'border-indigo-400/40 text-white bg-indigo-600 shadow-md'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Layers size={14} />
          <span>Component Matrix</span>
        </button>

        <button
          onClick={() => setActiveSubTab('data')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-bold transition-all border ${
            activeSubTab === 'data'
              ? 'border-indigo-400/40 text-white bg-indigo-600 shadow-md'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Database size={14} />
          <span>Mock Data JSON</span>
        </button>
      </div>

      {/* 3. Tab Content */}
      <div className="space-y-4">
        {/* Tab 0: Visual Screen Gallery */}
        {activeSubTab === 'gallery' && (
          <ScreenDesignsGallery onNavigateToTab={onNavigateToTab} />
        )}

        {/* Tab 1: Design Tokens */}
        {activeSubTab === 'tokens' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Frosted Glass & Dark Mode Palette Tokens</h2>
              <button
                onClick={() => copyToClipboard(JSON.stringify(DESIGN_TOKENS.colors.darkMode, null, 2), 'colors-json')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
              >
                {copiedSection === 'colors-json' ? <Check size={12} /> : <Copy size={12} />}
                <span>Copy Colors JSON</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DESIGN_TOKENS.colors.darkMode.map((c) => (
                <div 
                  key={c.name}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 backdrop-blur-xl transition-all"
                >
                  <div 
                    className="w-10 h-10 rounded-xl border border-white/10 flex-shrink-0 shadow-inner"
                    style={{ backgroundColor: c.hexValue.startsWith('#') ? c.hexValue : '#334155' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <strong className="text-xs text-white font-bold truncate">{c.name}</strong>
                      <span className="font-mono text-[11px] text-emerald-400 font-bold">{c.hexValue}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 block">{c.variable}</span>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{c.usage}</p>
                    <span className="text-[10px] text-indigo-300/80 font-mono mt-0.5 block">{c.wcagContrast}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Surface Depth & Radius Blueprint */}
            <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 space-y-3 shadow-lg">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Frosted Glass Elevation & Nested Radius Mathematics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1">
                  <span className="font-bold text-white block">Outer Card Container</span>
                  <p className="text-slate-300 text-[11px]">Radius: 24px (<code className="text-indigo-400">rounded-3xl</code>)</p>
                  <p className="text-slate-300 text-[11px]">Padding: 20px (<code className="text-indigo-400">p-5</code>)</p>
                  <p className="text-slate-400 text-[10px]">Backdrop: <code className="text-emerald-400">backdrop-blur-xl</code></p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1">
                  <span className="font-bold text-white block">Inner Child Element</span>
                  <p className="text-slate-300 text-[11px]">Radius: 16px (<code className="text-indigo-400">rounded-2xl</code>)</p>
                  <p className="text-slate-300 text-[11px]">Formula: <code className="text-emerald-400">24px - 8px = 16px</code></p>
                </div>
                <div className="p-3.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md space-y-1 text-center">
                  <span className="font-bold text-white block">Pills & Badges</span>
                  <p className="text-slate-300 text-[11px]">Radius: 9999px (<code className="text-indigo-400">rounded-full</code>)</p>
                  <p className="text-slate-300 text-[11px]">Padding: <code className="text-indigo-400">py-1 px-3</code></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Typography */}
        {activeSubTab === 'typography' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Typographic Scale & Hierarchy</h2>
              <span className="text-xs text-slate-400">Plus Jakarta Sans & JetBrains Mono</span>
            </div>

            <div className="space-y-2.5">
              {DESIGN_TOKENS.typography.map((t) => (
                <div key={t.role} className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300">{t.role}</span>
                    <span className="font-mono text-[11px] text-slate-400">{t.fontSize} • {t.fontWeight}</span>
                  </div>
                  <div className="text-white text-sm font-medium">
                    {t.targetElements}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono pt-1 border-t border-white/10">
                    <span>Line-Height: {t.lineHeight}</span>
                    <span>Tracking: {t.letterSpacing}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Screen Blueprints */}
        {activeSubTab === 'screens' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Screen Layout Architectures (5 Core Views)</h2>
              <button
                onClick={() => copyToClipboard(JSON.stringify(SCREEN_BLUEPRINTS, null, 2), 'screens-json')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
              >
                {copiedSection === 'screens-json' ? <Check size={12} /> : <Copy size={12} />}
                <span>Copy Blueprints JSON</span>
              </button>
            </div>

            <div className="space-y-4">
              {SCREEN_BLUEPRINTS.map((screen) => (
                <div key={screen.id} className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 space-y-3 shadow-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">{screen.title}</h3>
                      <span className="font-mono text-xs text-indigo-400">{screen.path}</span>
                    </div>
                  </div>

                  {/* Layout Hierarchy Stack */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Visual Hierarchy Flow:
                    </span>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300">
                      {screen.hierarchy.map((step, idx) => (
                        <li key={idx} className="leading-relaxed">{step}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Components */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Component Specifications:
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {screen.components.map((comp) => (
                        <div key={comp.name} className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1">
                          <strong className="text-xs font-bold text-emerald-400 block font-mono">
                            {`<${comp.name} />`}
                          </strong>
                          <p className="text-[11px] text-slate-300">{comp.description}</p>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Props: {comp.props.join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Component State Matrix */}
        {activeSubTab === 'blueprint' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white">Component State Matrix & Error Handling</h2>
            
            <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 space-y-3 shadow-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1.5">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    1. Active / Loaded State
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Full dataset rendered with tabular numerals (<code className="text-indigo-300">font-mono-num</code>), categorized chips, and responsive hover transitions.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1.5">
                  <span className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Box size={14} />
                    2. Empty / Zero State
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    In "Inbox Zero" or empty search, display contextual feedback with clear recovery CTAs ("Simulate SMS" / "Reset Filter").
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1.5">
                  <span className="font-bold text-blue-400 flex items-center gap-1.5">
                    <Sparkles size={14} />
                    3. AI Uncertainty State
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Transactions with AI confidence &lt;70% render with an amber pulse badge and auto-route to the Human-in-the-Loop review deck.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1.5">
                  <span className="font-bold text-rose-400 flex items-center gap-1.5">
                    <Terminal size={14} />
                    4. Parser Error State
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    When pasting non-standard SMS alerts, gracefully fallback to manual input form with extracted numbers prefilled.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Mock Data JSON */}
        {activeSubTab === 'data' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Realistic Indian Transactions & Categories Dataset</h2>
              <button
                onClick={() => copyToClipboard(JSON.stringify(INITIAL_TRANSACTIONS, null, 2), 'mock-tx-json')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
              >
                {copiedSection === 'mock-tx-json' ? <Check size={12} /> : <Copy size={12} />}
                <span>Copy Transactions JSON</span>
              </button>
            </div>

            <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-5 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-96">
              <pre>{JSON.stringify(INITIAL_TRANSACTIONS.slice(0, 4), null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
