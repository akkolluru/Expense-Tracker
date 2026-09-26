import React, { useState } from 'react';
import { 
  Home, 
  Inbox, 
  ListFilter, 
  PieChart, 
  Sparkles, 
  Split, 
  Scan, 
  CheckCircle2, 
  ShieldAlert,
  ArrowRight,
  Maximize2,
  Smartphone,
  Eye,
  Layers,
  Check
} from 'lucide-react';
import { motion } from 'motion/react';
import { ViewTab } from '../types';

interface ScreenDesignsGalleryProps {
  onNavigateToTab?: (tab: ViewTab) => void;
}

export const ScreenDesignsGallery: React.FC<ScreenDesignsGalleryProps> = ({ onNavigateToTab }) => {
  const [selectedScreen, setSelectedScreen] = useState<string>('home');

  const screens = [
    {
      id: 'home',
      tabId: 'home' as ViewTab,
      name: '01. Home & Cash Flow Dashboard',
      badge: 'Primary View',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      description: 'Central command for liquidity, month-to-date burn rate, unverified alert banners, and quick UPI shortcuts.',
      features: [
        'Frosted Glass Hero Net Balance with real-time savings rate indicator (73%)',
        'Monthly Cash Flow Burn Rate Gauge with projected end-of-month spend calculation',
        'Human-in-the-loop Unverified Alert Card prompting 1-tap categorization',
        'Quick Actions Bar for Bank SMS Parser and Manual UPI Entry'
      ],
      tokensUsed: ['--bg-canvas (#0A0A0B)', '--surface-t1 (#121214)', '--accent-primary (#10B981)', 'backdrop-blur-2xl']
    },
    {
      id: 'inbox',
      tabId: 'inbox' as ViewTab,
      name: '02. AI Review & Auto-Parser Inbox',
      badge: 'Human-in-the-Loop',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      description: 'Zero-friction review queue for heuristic-extracted bank SMS transactions with confidence meters.',
      features: [
        'Visual AI Confidence Score Badge (e.g. 98% Confidence for Swiggy -> Food)',
        '1-Tap Fast Approval Button to verify ML classification instantly',
        'Category Quick-Switch Matrix with intuitive colored chips',
        'Integrated Split Bill Drawer trigger for group outings'
      ],
      tokensUsed: ['--color-amber (#F59E0B)', '--color-upi-accent (#6366F1)', 'rounded-3xl', 'backdrop-blur-xl']
    },
    {
      id: 'expenses',
      tabId: 'expenses' as ViewTab,
      name: '03. Transaction Ledger & Smart Search',
      badge: 'Search & Audit',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      description: 'Comprehensive financial journal with multi-token search, category filtering, and UPI payment icons.',
      features: [
        'Real-time filter pills: All, Debit, Credit, and Category-specific slices',
        'UPI Merchant Badge recognition (Google Pay, PhonePe, Paytm, CRED)',
        'Chronological date clustering with subtotal aggregation',
        'Detailed transaction bottom drawer on card press'
      ],
      tokensUsed: ['--color-debit (#F43F5E)', '--color-credit (#22C55E)', 'font-mono-num', 'rounded-2xl']
    },
    {
      id: 'analytics',
      tabId: 'analytics' as ViewTab,
      name: '04. Spend Analytics & Cash Flow Velocity',
      badge: 'Data Visualizer',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      description: 'Rich graphical breakdown of category distribution, daily velocity charts, and recurring subscriptions.',
      features: [
        'Interactive Recharts Spend Donut with legend and percentages',
        'Daily Spending Velocity bar chart with dynamic peak spend badges',
        'Active Recurring Subscriptions Mandate tracker (Netflix, Spotify, Cult.fit)',
        'Month-over-month burn rate comparisons'
      ],
      tokensUsed: ['Recharts SVG', 'linearGradient accents', '--surface-t2 (#1E293B)', 'rounded-3xl']
    },
    {
      id: 'sms-parser',
      tabId: 'home' as ViewTab,
      name: '05. Bank Alert SMS Auto-Parser Modal',
      badge: 'Heuristics Engine',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      description: 'Local regex & NLP extractor for Indian Bank SMS alerts (HDFC, SBI, ICICI, Axis, Kotak).',
      features: [
        'Automatic extraction of Amount (₹), Merchant, Account Last 4 digits, and UPI VPA',
        'AI Confidence calculation with sample bank alert templates',
        'Split-with-Friends calculator with per-person equal or custom share math',
        'Completely client-side and privacy-first (no SMS data leaves the device)'
      ],
      tokensUsed: ['Regex Lexer', 'Modal Portal', 'backdrop-blur-2xl', 'rounded-3xl']
    }
  ];

  const currentScreenData = screens.find(s => s.id === selectedScreen) || screens[0];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
              <Eye size={12} />
              Interactive UI Mockups & Visual Architecture
            </span>
            <span className="text-[10px] text-slate-400">All 5 Core Flows</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1.5">
            App Design System & Screen Gallery
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Explore the visual design language, interface states, and interaction patterns for every screen.
          </p>
        </div>

        {onNavigateToTab && (
          <button
            onClick={() => onNavigateToTab(currentScreenData.tabId)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-950/50 border border-indigo-400/30 transition-all flex-shrink-0"
          >
            <span>Open in Live App</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* Screen Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {screens.map((screen) => (
          <button
            key={screen.id}
            onClick={() => setSelectedScreen(screen.id)}
            className={`p-3 rounded-2xl text-left border transition-all flex flex-col justify-between gap-2 backdrop-blur-md ${
              selectedScreen === screen.id
                ? 'bg-indigo-600/30 border-indigo-400/60 shadow-lg shadow-indigo-950/40 text-white'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-mono font-bold text-indigo-300">
                {screen.name.split('.')[0]}
              </span>
              {selectedScreen === screen.id && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
            <span className="text-xs font-bold line-clamp-1">
              {screen.name.split('. ')[1]}
            </span>
          </button>
        ))}
      </div>

      {/* Selected Screen Detailed Card & Feature Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left / Main: Visual Blueprint Presentation */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${currentScreenData.badgeColor}`}>
                  {currentScreenData.badge}
                </span>
                <h3 className="text-base font-bold text-white">
                  {currentScreenData.name}
                </h3>
              </div>
              <button
                onClick={() => onNavigateToTab && onNavigateToTab(currentScreenData.tabId)}
                className="text-xs text-indigo-300 hover:text-white flex items-center gap-1 font-semibold transition-colors"
              >
                <span>Launch Live</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {currentScreenData.description}
            </p>

            {/* Feature Highlights */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Key UI Patterns & Engineering Specs:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentScreenData.features.map((feat, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-2 text-xs text-slate-200">
                    <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Design Tokens & Classes used */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                <Layers size={11} className="text-indigo-400" />
                Design Tokens & CSS Math
              </span>
              <div className="flex flex-wrap gap-1.5">
                {currentScreenData.tokensUsed.map((tok, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-lg bg-white/10 text-slate-300 text-[10px] font-mono border border-white/10">
                    {tok}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick View Launcher & Architecture Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-4 shadow-xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Smartphone size={14} className="text-indigo-400" />
              Live Interactive Navigation
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Switch immediately to any view inside the live mobile device shell or desktop layout:
            </p>

            <div className="space-y-2">
              <button
                onClick={() => onNavigateToTab && onNavigateToTab('home')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-indigo-600/30 border border-white/10 hover:border-indigo-400/40 text-left transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
                    <Home size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Home View</span>
                    <span className="text-[10px] text-slate-400">Balance, Burn Rate, Shortcuts</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-white transition-colors" />
              </button>

              <button
                onClick={() => onNavigateToTab && onNavigateToTab('inbox')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-amber-600/30 border border-white/10 hover:border-amber-400/40 text-left transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
                    <Inbox size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Review Inbox</span>
                    <span className="text-[10px] text-slate-400">AI Confidence & 1-Tap Approvals</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-white transition-colors" />
              </button>

              <button
                onClick={() => onNavigateToTab && onNavigateToTab('expenses')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-emerald-600/30 border border-white/10 hover:border-emerald-400/40 text-left transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                    <ListFilter size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Expenses Ledger</span>
                    <span className="text-[10px] text-slate-400">Filter Chips & UPI Badges</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-white transition-colors" />
              </button>

              <button
                onClick={() => onNavigateToTab && onNavigateToTab('analytics')}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-purple-600/30 border border-white/10 hover:border-purple-400/40 text-left transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                    <PieChart size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Spend Analytics</span>
                    <span className="text-[10px] text-slate-400">Category Donut & Velocity Chart</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
