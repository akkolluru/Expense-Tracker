import React from 'react';
import { Sparkles, AlertTriangle, ShieldCheck, Flame } from 'lucide-react';
import { formatINR } from '../utils/formatters';

export interface StickmanMascotProps {
  totalMonthSpend: number;
  monthlyBudget?: number;
}

interface StageConfig {
  id: number;
  name: string;
  outfit: string;
  title: string;
  mood: string;
  animClass: string;
  cardBg: string;
  canvasBg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  barColor: string;
  getDesc: (percent: number, spentAmount: number, budget: number, savingsRate: number) => string;
}

const STAGES: Record<number, StageConfig> = {
  1: {
    id: 1,
    name: 'The Mogul',
    outfit: 'Tailored Tuxedo & Top Hat',
    title: '"Looking lavish, financial wizard!"',
    mood: 'Wealth Wizard',
    animClass: 'anim-mogul',
    cardBg: 'from-[#0F1E19] to-[#0A1210]',
    canvasBg: 'bg-[#06100E] border-emerald-900/40',
    border: 'border-emerald-500/40',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-500/30',
    barColor: 'from-emerald-500 to-teal-400',
    getDesc: (percent, spentAmount, _budget, savingsRate) =>
      `You are projected to spend only ${percent}% of your budget (${formatINR(spentAmount, false)}), banking an incredible ${savingsRate}% savings rate! Bespoke tuxedo, silk top hat, and gold-tipped cane active.`,
  },
  2: {
    id: 2,
    name: 'The Pro',
    outfit: 'Crisp Oxford Shirt & Chinos',
    title: '"Steady, balanced, and sharp."',
    mood: 'On Track',
    animClass: 'anim-pro',
    cardBg: 'from-[#0B1A1E] to-[#081114]',
    canvasBg: 'bg-[#040E14] border-teal-900/40',
    border: 'border-teal-500/40',
    badgeBg: 'bg-teal-500/20',
    badgeText: 'text-teal-300',
    badgeBorder: 'border-teal-500/30',
    barColor: 'from-teal-500 to-cyan-400',
    getDesc: (percent, spentAmount) =>
      `Projected spend is at ${percent}% of budget (${formatINR(spentAmount, false)}). Perfectly composed and balanced. Looking sharp in your crisp oxford shirt and sipping hot coffee.`,
  },
  3: {
    id: 3,
    name: 'The Hustler',
    outfit: 'Oversized T-Shirt & Joggers',
    title: '"Comfort mode active — budget tightening."',
    mood: 'Elevated Burn',
    animClass: 'anim-hustler',
    cardBg: 'from-[#1E170A] to-[#120E06]',
    canvasBg: 'bg-[#140F05] border-amber-900/40',
    border: 'border-amber-500/40',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-500/30',
    barColor: 'from-amber-500 to-orange-400',
    getDesc: (percent) =>
      `Pacing at ${percent}% of budget (+${percent - 100}% over planned pace). Comfort-mode streetwear active, scratching head over Swiggy bills. Tighten up before dropping a tier!`,
  },
  4: {
    id: 4,
    name: 'In Boxers (Broke)',
    outfit: 'Heart Boxers & Bare Chest',
    title: '"RED ALERT: Down to your boxers!"',
    mood: 'Discretionary Freeze',
    animClass: 'anim-boxers',
    cardBg: 'from-[#1F0D0D] to-[#140808]',
    canvasBg: 'bg-[#140606] border-rose-900/40',
    border: 'border-rose-500/50',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-300',
    badgeBorder: 'border-rose-500/30',
    barColor: 'from-rose-500 to-red-600',
    getDesc: (percent, _spentAmount, budget) =>
      `Disaster pacing! Spending is tracking at ${percent}% of budget! You've burned through your entire ${formatINR(budget, false)} allowance and then some. Down to your heart boxers and shivering!`,
  },
};

export const StickmanMascot: React.FC<StickmanMascotProps> = ({
  totalMonthSpend,
  monthlyBudget = 50000,
}) => {
  const budget = monthlyBudget > 0 ? monthlyBudget : 50000;
  const percent = Math.round((totalMonthSpend / budget) * 100);
  const savingsRate = Math.max(0, 100 - percent);

  // 4-Stage Dispatcher:
  // Stage 1: <= 65%
  // Stage 2: 66% - 95%
  // Stage 3: 96% - 115%
  // Stage 4: > 115%
  let stageId = 1;
  let percentBadgeText = `${percent}% of budget (${savingsRate}% Saved!)`;

  if (percent <= 65) {
    stageId = 1;
    percentBadgeText = `${percent}% of budget (${savingsRate}% Saved!)`;
  } else if (percent <= 95) {
    stageId = 2;
    percentBadgeText = `${percent}% of budget (${savingsRate}% Buffer)`;
  } else if (percent <= 115) {
    stageId = 3;
    percentBadgeText = `${percent}% of budget (+${percent - 100}% Over)`;
  } else {
    stageId = 4;
    percentBadgeText = `${percent}% of budget (Deficit!)`;
  }

  const stage = STAGES[stageId];
  const progressWidth = Math.min(100, Math.max(0, percent));

  return (
    <div
      data-testid="stickman-mascot"
      className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-b ${stage.cardBg} border ${stage.border} space-y-4 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] transition-all duration-300`}
    >
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            data-testid="stickman-stage-pill"
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${stage.badgeBg} ${stage.badgeText} ${stage.badgeBorder}`}
          >
            Stage {stage.id}: {stage.name}
          </span>
          <span className="hidden sm:inline text-xs text-slate-400 font-mono">
            {stage.outfit}
          </span>
        </div>

        <span
          data-testid="stickman-percent-badge"
          className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border ${stage.badgeBg} ${stage.badgeText} ${stage.badgeBorder} ${
            stageId === 4 ? 'animate-pulse' : ''
          }`}
        >
          {percentBadgeText}
        </span>
      </div>

      {/* Main Mascot Stage + Status Quip */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Animated Canvas Stage Box */}
        <div
          className={`relative w-44 h-48 sm:w-48 sm:h-52 rounded-xl ${stage.canvasBg} border flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner`}
        >
          <div className={`w-36 h-44 sm:w-40 sm:h-48 flex items-center justify-center ${stage.animClass}`}>
            {stageId === 1 && <MogulSvg />}
            {stageId === 2 && <ProSvg />}
            {stageId === 3 && <HustlerSvg percent={percent} />}
            {stageId === 4 && <BoxersSvg />}
          </div>

          {/* Floating Outfit & Mood Tags */}
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] font-mono pointer-events-none">
            <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-slate-300 border border-white/10 truncate max-w-[100px]">
              {stage.outfit}
            </span>
            <span className={`px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md font-bold flex items-center gap-1 ${stage.badgeText}`}>
              {stageId === 1 && <Sparkles size={11} />}
              {stageId === 2 && <ShieldCheck size={11} />}
              {stageId === 3 && <Flame size={11} />}
              {stageId === 4 && <AlertTriangle size={11} />}
              {stage.mood}
            </span>
          </div>
        </div>

        {/* Narrative & Progress Bar */}
        <div className="space-y-3 flex-1 min-w-0 w-full">
          <div>
            <h3 data-testid="stickman-quip" className="text-sm sm:text-base font-extrabold text-white tracking-tight">
              {stage.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mt-1">
              {stage.getDesc(percent, totalMonthSpend, budget, savingsRate)}
            </p>
          </div>

          {/* Micro Progress Bar */}
          <div className="pt-2 border-t border-white/10 space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-slate-400">Monthly Budget Spent:</span>
              <span className={`font-bold ${stage.badgeText}`}>
                {percent}% / 100% ({formatINR(totalMonthSpend, false)} / {formatINR(budget, false)})
              </span>
            </div>
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/10 p-0.5">
              <div
                className={`h-full bg-gradient-to-r ${stage.barColor} rounded-full transition-all duration-500`}
                style={{ width: `${progressWidth}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ======================================================== */
/* 1. THE MOGUL SVG (Stage 1: Spend <= 65%)                  */
/* ======================================================== */
const MogulSvg: React.FC = () => (
  <svg viewBox="0 0 200 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mogul-tux-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E293B" />
        <stop offset="60%" stopColor="#0F172A" />
        <stop offset="100%" stopColor="#050811" />
      </linearGradient>
      <linearGradient id="mogul-lapel-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <linearGradient id="mogul-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#B45309" />
      </linearGradient>
      <linearGradient id="mogul-shoe-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="50%" stopColor="#0F172A" />
        <stop offset="100%" stopColor="#020408" />
      </linearGradient>
      <radialGradient id="mogul-shadow-grad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(0,0,0,0.6)" />
        <stop offset="80%" stopColor="rgba(0,0,0,0.2)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
      </radialGradient>
    </defs>

    {/* Ground Contact Shadow */}
    <ellipse cx="106" cy="225" rx="46" ry="6" fill="url(#mogul-shadow-grad)" />

    {/* Cane Tip Shadow */}
    <ellipse cx="145" cy="224" rx="6" ry="2.5" fill="rgba(0,0,0,0.4)" />

    {/* WALKING CANE SHAFT & FERRULE */}
    <path d="M 140,119 L 145,222" stroke="#0F172A" strokeWidth="3.2" strokeLinecap="round" />
    <path d="M 140.5,122 L 145.5,216" stroke="#475569" strokeWidth="0.8" strokeLinecap="round" />
    <path d="M 144.5,216 L 145.2,223" stroke="url(#mogul-gold-grad)" strokeWidth="3.6" strokeLinecap="round" />

    {/* LEGS & TAILORED TROUSERS */}
    <path d="M 87,133 C 85,156 86,186 89,217" stroke="#0A0F1D" strokeWidth="6.5" strokeLinecap="round" />
    <path d="M 88,135 L 89,215" stroke="#334155" strokeWidth="1.2" />
    <path d="M 107,133 C 110,156 115,186 119,217" stroke="#0A0F1D" strokeWidth="6.5" strokeLinecap="round" />
    <path d="M 108,135 L 120,215" stroke="#334155" strokeWidth="1.2" />
    <path d="M 98,131 L 98,144 C 98,148 95,150 92,150" fill="none" stroke="#1E293B" strokeWidth="1.2" />

    {/* POLISHED OXFORD DRESS SHOES */}
    <path d="M 81,216 C 81,213 93,213 96,217 C 98,220 95,224 81,224 Z" fill="url(#mogul-shoe-grad)" stroke="#05070B" strokeWidth="1.2" />
    <path d="M 85,215 Q 90,213 93,215" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.8" />
    <line x1="81" y1="223" x2="84" y2="223" stroke="#475569" strokeWidth="1.5" />
    <path d="M 112,216 C 112,213 124,213 127,217 C 129,220 126,224 112,224 Z" fill="url(#mogul-shoe-grad)" stroke="#05070B" strokeWidth="1.2" />
    <path d="M 116,215 Q 121,213 124,215" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.8" />
    <line x1="112" y1="223" x2="115" y2="223" stroke="#475569" strokeWidth="1.5" />

    {/* TUXEDO COAT TAILS */}
    <path d="M 82,133 C 80,146 81,154 84,160 L 89,145" fill="none" stroke="#090D16" strokeWidth="2" strokeLinecap="round" />
    <path d="M 114,133 C 116,146 115,154 112,160 L 107,145" fill="none" stroke="#090D16" strokeWidth="2" strokeLinecap="round" />

    {/* TORSO & VEST */}
    <polygon points="95,73 101,73 98,90" fill="#FFFFFF" />
    <circle cx="98" cy="81" r="0.9" fill="url(#mogul-gold-grad)" />
    <path d="M 93,76 L 103,76 L 105,104 L 98,110 L 91,104 Z" fill="#1E293B" stroke="#0F172A" strokeWidth="1" />
    <circle cx="98" cy="89" r="1.1" fill="url(#mogul-gold-grad)" />
    <circle cx="98" cy="97" r="1.1" fill="url(#mogul-gold-grad)" />
    <circle cx="98" cy="105" r="1.1" fill="url(#mogul-gold-grad)" />

    {/* TAILORED TUXEDO JACKET */}
    <path d="M 92,75 L 78,82 C 76,96 77,116 82,135 L 95,130 C 92,115 92,94 95,82 Z" fill="url(#mogul-tux-grad)" stroke="#090D16" strokeWidth="1.5" />
    <path d="M 92,75 L 85,86 L 93,89 L 91,105 L 94,81 Z" fill="url(#mogul-lapel-grad)" stroke="#1E293B" strokeWidth="0.8" />
    <line x1="81" y1="94" x2="89" y2="94" stroke="#475569" strokeWidth="1" />
    <path d="M 83,93 L 85,88 L 87,93 Z" fill="#FFFFFF" />
    <path d="M 104,75 L 118,82 C 120,96 119,116 114,135 L 101,130 C 104,115 104,94 101,82 Z" fill="url(#mogul-tux-grad)" stroke="#090D16" strokeWidth="1.5" />
    <path d="M 104,75 L 111,86 L 103,89 L 105,105 L 102,81 Z" fill="url(#mogul-lapel-grad)" stroke="#1E293B" strokeWidth="0.8" />

    {/* LEFT ARM */}
    <path d="M 78,82 C 67,93 64,106 70,122 L 77,120 C 73,108 75,98 83,86 Z" fill="url(#mogul-tux-grad)" stroke="#090D16" strokeWidth="1.5" />
    <path d="M 70,120 L 75,118 L 77,123 L 72,125 Z" fill="#FFFFFF" />
    <circle cx="74" cy="121" r="1" fill="url(#mogul-gold-grad)" />
    <path d="M 72,125 C 74,130 79,132 83,130" fill="none" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />

    {/* RIGHT ARM */}
    <path d="M 118,82 C 126,94 132,106 135,117 L 129,119 C 126,110 121,98 113,86 Z" fill="url(#mogul-tux-grad)" stroke="#090D16" strokeWidth="1.5" />
    <path d="M 132,115 L 137,117 L 135,122 L 130,120 Z" fill="#FFFFFF" />
    <circle cx="134" cy="118" r="1" fill="url(#mogul-gold-grad)" />
    <path d="M 134,116 C 138,114 143,116 141,121 C 139,124 134,123 132,120" fill="#F8FAFC" stroke="#0F172A" strokeWidth="1.8" />

    {/* CANE POMMEL */}
    <circle cx="140" cy="114" r="5.2" fill="url(#mogul-gold-grad)" stroke="#B45309" strokeWidth="1" />
    <circle cx="138.5" cy="112.5" r="1.5" fill="#FEF08A" />
    <rect x="138.5" y="118" width="3" height="3" rx="0.5" fill="url(#mogul-gold-grad)" />

    {/* WING-TIP COLLAR & GOLD BOW TIE */}
    <polygon points="94,70 98,77 91,74" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.8" />
    <polygon points="102,70 98,77 105,74" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.8" />
    <path d="M 97,72 L 89,68 L 89,76 Z" fill="url(#mogul-gold-grad)" stroke="#B45309" strokeWidth="0.8" />
    <path d="M 99,72 L 107,68 L 107,76 Z" fill="url(#mogul-gold-grad)" stroke="#B45309" strokeWidth="0.8" />
    <rect x="96.5" y="70.5" width="3.5" height="3.5" rx="0.8" fill="#F59E0B" stroke="#92400E" strokeWidth="0.6" />

    {/* HEAD & SMUG CHARISMATIC EXPRESSION */}
    <circle cx="98" cy="56" r="16" fill="#F8FAFC" stroke="#0F172A" strokeWidth="2.5" />
    <path d="M 83,49 C 85,45 89,46 91,50" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="92" cy="54" r="2" fill="#0F172A" />
    <path d="M 88,48 Q 93,44 97,48" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
    <circle cx="106" cy="54" r="1.8" fill="#0F172A" />
    <circle cx="106" cy="54" r="7" fill="rgba(245,158,11,0.18)" stroke="url(#mogul-gold-grad)" strokeWidth="1.8" />
    <path d="M 103,50 L 108,50" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
    <path d="M 113,57 C 120,68 116,84 107,95" fill="none" stroke="url(#mogul-gold-grad)" strokeWidth="1.2" strokeDasharray="2 1.5" />
    <path d="M 91,63 Q 97,69 105,62" fill="none" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M 106,60 L 108,62" fill="none" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" />

    {/* SILK TOP HAT */}
    <path d="M 83,16 C 88,14 112,17 117,19 L 114,41 C 109,39 88,36 80,38 Z" fill="#0A0F1D" stroke="#1E293B" strokeWidth="1.5" />
    <path d="M 86,18 L 92,19 L 89,39 L 83,38 Z" fill="rgba(255,255,255,0.08)" />
    <path d="M 80,38 C 90,36 109,39 114,41 L 113,45 C 108,43 89,40 79,42 Z" fill="url(#mogul-gold-grad)" />
    <rect x="94" y="39" width="4" height="4" rx="0.5" fill="#FEF08A" stroke="#B45309" strokeWidth="0.6" />
    <path d="M 68,43 C 78,39 122,43 128,47 C 122,51 76,47 68,43 Z" fill="#0A0F1D" stroke="#334155" strokeWidth="1.2" />
    <path d="M 68,43 Q 66,41 70,41" stroke="#475569" strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </svg>
);

/* ======================================================== */
/* 2. THE PRO SVG (Stage 2: Spend 66% - 95%)                 */
/* ======================================================== */
const ProSvg: React.FC = () => (
  <svg viewBox="0 0 200 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pro-shirt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#0284C7" />
      </linearGradient>
      <linearGradient id="pro-chino-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="100%" stopColor="#1E293B" />
      </linearGradient>
      <linearGradient id="pro-loafer-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#78350F" />
        <stop offset="100%" stopColor="#451A03" />
      </linearGradient>
      <radialGradient id="pro-shadow-grad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(0,0,0,0.6)" />
        <stop offset="80%" stopColor="rgba(0,0,0,0.2)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
      </radialGradient>
    </defs>

    {/* Ground Shadow */}
    <ellipse cx="100" cy="225" rx="42" ry="6" fill="url(#pro-shadow-grad)" />

    {/* LEGS & SLIM CHINOS */}
    <path d="M 90,134 C 88,160 88,186 90,216" stroke="#1E293B" strokeWidth="6.5" strokeLinecap="round" />
    <path d="M 90,137 L 90,214" stroke="#334155" strokeWidth="1.2" />
    <path d="M 110,134 C 111,160 111,186 110,216" stroke="#1E293B" strokeWidth="6.5" strokeLinecap="round" />
    <path d="M 110,137 L 110,214" stroke="#334155" strokeWidth="1.2" />
    <path d="M 100,134 L 100,148 C 100,152 97,154 94,154" stroke="#0F172A" strokeWidth="1.2" fill="none" />

    {/* LEATHER PENNY LOAFERS */}
    <path d="M 83,216 C 83,213 94,213 97,217 C 98,221 95,224 83,224 Z" fill="url(#pro-loafer-grad)" stroke="#1F2937" strokeWidth="1.2" />
    <path d="M 88,215 L 92,215" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M 104,216 C 104,213 115,213 118,217 C 119,221 116,224 104,224 Z" fill="url(#pro-loafer-grad)" stroke="#1F2937" strokeWidth="1.2" />
    <path d="M 109,215 L 113,215" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round" />

    {/* CRISP OXFORD SHIRT BODY */}
    <path d="M 92,70 L 82,78 L 84,130 C 90,132 110,132 116,130 L 118,78 L 108,70 Z" fill="url(#pro-shirt-grad)" stroke="#0284C7" strokeWidth="1.5" />
    <path d="M 87,90 L 92,90 L 92,98 L 89.5,100 L 87,98 Z" fill="#38BDF8" stroke="#0284C7" strokeWidth="1" />
    <line x1="100" y1="74" x2="100" y2="130" stroke="#BAE6FD" strokeWidth="2" />
    <circle cx="100" cy="84" r="1.1" fill="#FFFFFF" stroke="#0284C7" strokeWidth="0.6" />
    <circle cx="100" cy="98" r="1.1" fill="#FFFFFF" stroke="#0284C7" strokeWidth="0.6" />
    <circle cx="100" cy="112" r="1.1" fill="#FFFFFF" stroke="#0284C7" strokeWidth="0.6" />
    <circle cx="100" cy="124" r="1.1" fill="#FFFFFF" stroke="#0284C7" strokeWidth="0.6" />
    <path d="M 88,88 Q 91,98 89,112" stroke="#0284C7" strokeWidth="0.8" fill="none" opacity="0.6" />

    {/* LEATHER BELT & SILVER BUCKLE */}
    <path d="M 84,129 L 116,129 L 116,134 L 84,134 Z" fill="#451A03" stroke="#1E293B" strokeWidth="1" />
    <rect x="97" y="128" width="6" height="7" rx="1" fill="none" stroke="#E2E8F0" strokeWidth="1.2" />
    <line x1="97" y1="131.5" x2="101" y2="131.5" stroke="#E2E8F0" strokeWidth="1.2" />

    {/* LEFT ARM */}
    <path d="M 82,78 C 76,88 73,98 75,106 L 81,106 C 80,98 83,90 88,82 Z" fill="url(#pro-shirt-grad)" stroke="#0284C7" strokeWidth="1.2" />
    <rect x="73" y="104" width="9" height="5" rx="1.5" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1" />
    <path d="M 77,109 L 76,130" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
    <rect x="74" y="125" width="5" height="4" rx="1" fill="#0F172A" />
    <circle cx="76.5" cy="127" r="1.2" fill="#38BDF8" />
    <path d="M 76,130 C 76,136 80,137 82,133" stroke="#0F172A" strokeWidth="2.5" fill="none" strokeLinecap="round" />

    {/* RIGHT ARM & ARTISAN COFFEE MUG */}
    <path d="M 118,78 C 124,88 126,96 128,104 L 122,106 C 120,98 118,90 112,82 Z" fill="url(#pro-shirt-grad)" stroke="#0284C7" strokeWidth="1.2" />
    <rect x="121" y="103" width="9" height="5" rx="1.5" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1" />
    <path d="M 125,108 L 133,115" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
    <path d="M 133,113 C 137,113 138,119 134,121" stroke="#0F172A" strokeWidth="2.2" fill="none" strokeLinecap="round" />

    {/* Ceramic Coffee Mug */}
    <rect x="135" y="108" width="15" height="18" rx="2.5" fill="#F8FAFC" stroke="#0F172A" strokeWidth="1.5" />
    <rect x="135" y="112" width="15" height="3" fill="#0D9488" />
    <path d="M 150,112 C 155,112 155,122 150,122" fill="none" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" />
    <ellipse cx="142.5" cy="108" rx="7.5" ry="2" fill="#451A03" stroke="#0F172A" strokeWidth="1" />

    {/* ANIMATED STEAM PLUMES */}
    <path d="M 139,103 C 136,95 142,89 138,81" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" className="anim-steam" />
    <path d="M 145,103 C 148,95 142,89 146,81" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" className="anim-steam" style={{ animationDelay: '0.9s' }} />

    {/* BUTTON-DOWN COLLAR */}
    <path d="M 94,66 L 100,70 L 106,66 L 104,74 L 100,77 L 96,74 Z" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.2" />
    <circle cx="96" cy="73" r="0.7" fill="#0284C7" />
    <circle cx="104" cy="73" r="0.7" fill="#0284C7" />

    {/* HEAD & CONFIDENT EXPRESSION */}
    <circle cx="100" cy="52" r="16" fill="#F8FAFC" stroke="#0F172A" strokeWidth="2.5" />
    <path d="M 84,48 C 84,36 104,33 116,42 C 110,41 98,41 92,47 Z" fill="#1E293B" stroke="#0F172A" strokeWidth="1.5" />
    <path d="M 89,39 Q 101,36 110,42" stroke="#475569" strokeWidth="1.2" fill="none" />
    <circle cx="94" cy="51" r="2" fill="#0F172A" />
    <circle cx="106" cy="51" r="2" fill="#0F172A" />
    <path d="M 91,46 Q 94,43 98,46" stroke="#0F172A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    <path d="M 102,46 Q 106,43 109,46" stroke="#0F172A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    <path d="M 95,59 Q 100,64 105,59" stroke="#0F172A" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

/* ======================================================== */
/* 3. THE HUSTLER SVG (Stage 3: Spend 96% - 115%)            */
/* ======================================================== */
interface HustlerSvgProps {
  percent: number;
}

const HustlerSvg: React.FC<HustlerSvgProps> = ({ percent }) => (
  <svg viewBox="0 0 200 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hustler-tee-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#64748B" />
        <stop offset="100%" stopColor="#475569" />
      </linearGradient>
      <linearGradient id="hustler-jogger-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="100%" stopColor="#1E293B" />
      </linearGradient>
      <radialGradient id="hustler-shadow-grad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(0,0,0,0.6)" />
        <stop offset="80%" stopColor="rgba(0,0,0,0.2)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
      </radialGradient>
    </defs>

    {/* Ground Shadow */}
    <ellipse cx="100" cy="225" rx="42" ry="6" fill="url(#hustler-shadow-grad)" />

    {/* SLOUCHY JOGGERS */}
    <path d="M 86,148 C 82,170 83,192 86,214" stroke="#1E293B" strokeWidth="7.5" strokeLinecap="round" />
    <path d="M 83,182 Q 87,185 85,189" stroke="#475569" strokeWidth="1.2" fill="none" />
    <rect x="82" y="212" width="8" height="4" rx="1" fill="#334155" stroke="#0F172A" strokeWidth="1" />
    <path d="M 116,146 C 118,170 116,192 113,214" stroke="#1E293B" strokeWidth="7.5" strokeLinecap="round" />
    <path d="M 116,182 Q 113,185 115,189" stroke="#475569" strokeWidth="1.2" fill="none" />
    <rect x="109" y="212" width="8" height="4" rx="1" fill="#334155" stroke="#0F172A" strokeWidth="1" />

    {/* CHUNKY SKATE SNEAKERS */}
    <path d="M 78,216 C 78,213 91,213 94,216 L 94,222 L 78,222 Z" fill="#F1F5F9" stroke="#0F172A" strokeWidth="1.2" />
    <rect x="77" y="221" width="18" height="4" rx="1" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1" />
    <line x1="83" y1="216" x2="87" y2="216" stroke="#EF4444" strokeWidth="1" />
    <path d="M 105,216 C 105,213 118,213 121,216 L 121,222 L 105,222 Z" fill="#F1F5F9" stroke="#0F172A" strokeWidth="1.2" />
    <rect x="104" y="221" width="18" height="4" rx="1" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1" />
    <line x1="110" y1="216" x2="114" y2="216" stroke="#EF4444" strokeWidth="1" />

    {/* OVERSIZED STREETWEAR T-SHIRT */}
    <path d="M 92,72 C 85,76 77,80 73,86 L 66,116 L 78,119 L 80,102 L 80,144 C 90,147 112,146 122,142 L 121,102 L 123,118 L 135,115 L 129,86 C 124,80 117,76 108,72 Z" fill="url(#hustler-tee-grad)" stroke="#334155" strokeWidth="1.5" />
    <path d="M 92,72 C 95,78 105,78 108,72 C 105,75 95,75 92,72 Z" fill="#475569" stroke="#334155" strokeWidth="1" />
    <path d="M 80,106 Q 87,112 82,124" stroke="#334155" strokeWidth="1.2" fill="none" />
    <path d="M 119,126 Q 113,134 117,142" stroke="#334155" strokeWidth="1.2" fill="none" />
    <path d="M 85,135 Q 100,139 116,133" stroke="#334155" strokeWidth="1.2" fill="none" />

    {/* DISTRESSED CHEST PRINT */}
    <rect x="94" y="93" width="12" height="7" rx="1.5" fill="none" stroke="#CBD5E1" strokeWidth="1" />
    <rect x="106" y="95" width="1.5" height="3" rx="0.5" fill="#CBD5E1" />
    <rect x="95.5" y="94.5" width="2.5" height="4" fill="#EF4444" />
    <text x="100" y="110" fontSize="6.5" fontFamily="monospace" fill="#CBD5E1" fontWeight="bold" textAnchor="middle">BURN: {percent}%</text>

    {/* JOGGER WAISTBAND & DRAWSTRINGS */}
    <path d="M 80,143 C 90,146 112,145 122,141 L 122,146 C 112,150 90,151 80,148 Z" fill="#1E293B" stroke="#0F172A" strokeWidth="1" />
    <path d="M 99,147 Q 97,155 95,160" stroke="#F1F5F9" strokeWidth="1.2" fill="none" />
    <path d="M 103,147 Q 105,156 106,162" stroke="#F1F5F9" strokeWidth="1.2" fill="none" />

    {/* LEFT ARM */}
    <path d="M 73,118 L 70,138" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
    <path d="M 70,138 C 69,144 73,146 75,142" stroke="#0F172A" strokeWidth="2.2" fill="none" strokeLinecap="round" />

    {/* RIGHT ARM */}
    <path d="M 129,100 L 136,78 L 123,45" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 123,45 C 120,43 117,45 119,48" stroke="#0F172A" strokeWidth="2" fill="none" strokeLinecap="round" />

    {/* HEAD & WORRIED EXPRESSION */}
    <g transform="rotate(-5 100 54)">
      <circle cx="100" cy="54" r="16" fill="#F8FAFC" stroke="#0F172A" strokeWidth="2.5" />
      <path d="M 83,50 C 81,40 88,35 93,39 C 96,32 106,33 109,38 C 114,34 120,40 117,48 Z" fill="#334155" stroke="#0F172A" strokeWidth="1.5" />
      <path d="M 96,33 L 98,26 L 102,33" fill="#334155" stroke="#0F172A" strokeWidth="1.2" />
      <path d="M 106,35 L 110,29 L 112,37" fill="#334155" stroke="#0F172A" strokeWidth="1.2" />
      <path d="M 90,47 Q 95,44 98,48" stroke="#0F172A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 103,48 Q 106,44 111,46" stroke="#0F172A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="94" cy="52" r="3.2" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
      <circle cx="94" cy="52" r="1.3" fill="#0F172A" />
      <circle cx="106" cy="52" r="3.2" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
      <circle cx="106" cy="52" r="1.3" fill="#0F172A" />
      <path d="M 93,62 Q 96,58 99,62 Q 102,66 105,61 Q 108,58 110,62" stroke="#0F172A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 117,44 C 115,48 120,52 122,49 C 124,46 119,42 117,44 Z" fill="#38BDF8" stroke="#0284C7" strokeWidth="0.8" className="anim-sweat" />
    </g>
  </svg>
);

/* ======================================================== */
/* 4. IN BOXERS SVG (Stage 4: Spend > 115%)                  */
/* ======================================================== */
const BoxersSvg: React.FC = () => (
  <svg viewBox="0 0 200 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="boxer-fabric-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#F1F5F9" />
      </linearGradient>
      <linearGradient id="boxer-heart-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FB7185" />
        <stop offset="100%" stopColor="#E11D48" />
      </linearGradient>
      <radialGradient id="boxer-shadow-grad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(0,0,0,0.6)" />
        <stop offset="80%" stopColor="rgba(0,0,0,0.2)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
      </radialGradient>
    </defs>

    {/* Ground Shadow */}
    <ellipse cx="100" cy="225" rx="42" ry="6" fill="url(#boxer-shadow-grad)" />

    {/* KNOCKED KNEES, SHIVERING SHINS & BARE TOES */}
    <path d="M 90,169 L 98,190" stroke="#0F172A" strokeWidth="3.2" strokeLinecap="round" />
    <path d="M 110,169 L 102,190" stroke="#0F172A" strokeWidth="3.2" strokeLinecap="round" />
    <circle cx="98" cy="190" r="3" fill="#F1F5F9" stroke="#0F172A" strokeWidth="1.8" />
    <circle cx="102" cy="190" r="3" fill="#F1F5F9" stroke="#0F172A" strokeWidth="1.8" />
    <path d="M 98,193 L 88,220" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
    <path d="M 102,193 L 112,220" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />

    {/* Shivering Bare Feet with curled toes */}
    <path d="M 88,220 C 86,220 80,221 78,220 C 76,218 77,215 80,216 C 83,217 85,219 88,220" fill="#F1F5F9" stroke="#0F172A" strokeWidth="1.5" />
    <circle cx="77" cy="217" r="1.5" fill="#F1F5F9" stroke="#0F172A" strokeWidth="1" />
    <path d="M 112,220 C 114,220 120,221 122,220 C 124,218 123,215 120,216 C 117,217 115,219 112,220" fill="#F1F5F9" stroke="#0F172A" strokeWidth="1.5" />
    <circle cx="123" cy="217" r="1.5" fill="#F1F5F9" stroke="#0F172A" strokeWidth="1" />

    {/* Knee Vibration Shiver Lines */}
    <path d="M 91,187 L 88,190 L 91,193" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M 109,187 L 112,190 L 109,193" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />

    {/* BARE SKINNY TORSO WITH STICK RIBS */}
    <line x1="100" y1="70" x2="100" y2="136" stroke="#0F172A" strokeWidth="3.5" />
    <path d="M 92,74 Q 100,77 108,74" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M 92,90 Q 100,86 108,90" fill="none" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M 91,101 Q 100,97 109,101" fill="none" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M 93,112 Q 100,108 107,112" fill="none" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="100" cy="125" r="1.2" fill="#94A3B8" />

    {/* Torso Shiver Vibration Lines */}
    <path d="M 82,100 L 79,103 L 82,106" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M 118,100 L 121,103 L 118,106" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />

    {/* BESPOKE HEART-PATTERNED BOXER SHORTS */}
    <path d="M 82,140 L 80,168 C 82,170 93,171 96,168 L 100,156 L 104,168 C 107,171 118,170 120,168 L 118,140 Z" fill="url(#boxer-fabric-grad)" stroke="#0F172A" strokeWidth="1.8" />
    <path d="M 80,164 L 83,162" stroke="#0F172A" strokeWidth="1.5" />
    <path d="M 120,164 L 117,162" stroke="#0F172A" strokeWidth="1.5" />
    <path d="M 119,144 C 126,145 127,152 123,156 C 120,158 118,150 118,146" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.2" />

    {/* Gathered Elastic Waistband */}
    <path d="M 82,134 C 90,136 110,136 118,134 L 118,140 C 110,142 90,142 82,140 Z" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1.5" />
    <line x1="88" y1="135" x2="88" y2="141" stroke="#94A3B8" strokeWidth="0.8" />
    <line x1="94" y1="135.5" x2="94" y2="141.5" stroke="#94A3B8" strokeWidth="0.8" />
    <line x1="106" y1="135.5" x2="106" y2="141.5" stroke="#94A3B8" strokeWidth="0.8" />
    <line x1="112" y1="135" x2="112" y2="141" stroke="#94A3B8" strokeWidth="0.8" />
    <path d="M 100,141 L 100,156" stroke="#CBD5E1" strokeWidth="1.2" />
    <circle cx="100" cy="148" r="1" fill="#94A3B8" />

    {/* Red Hearts on Boxer Fabric */}
    <path d="M 88,150 C 88,147 85,146 84,148 C 83,146 80,147 80,150 C 80,153 84,156 84,156 C 84,156 88,153 88,150 Z" fill="url(#boxer-heart-grad)" className="anim-heart" />
    <path d="M 96,156 C 96,153 93,152 92,154 C 91,152 88,153 88,156 C 88,159 92,162 92,162 C 92,162 96,159 96,156 Z" fill="url(#boxer-heart-grad)" className="anim-heart" />
    <path d="M 112,148 C 112,145 109,144 108,146 C 107,144 104,145 104,148 C 104,151 108,154 108,154 C 108,154 112,151 112,148 Z" fill="url(#boxer-heart-grad)" className="anim-heart" />
    <path d="M 116,158 C 116,155 113,154 112,156 C 111,154 108,155 108,158 C 108,161 112,164 112,164 C 112,164 116,161 116,158 Z" fill="url(#boxer-heart-grad)" className="anim-heart" />

    {/* SHIVERING ARMS */}
    <path d="M 92,70 C 82,72 72,64 78,52 C 81,45 87,49 88,55" fill="none" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 86,52 C 85,48 88,47 89,51" stroke="#0F172A" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <path d="M 84,55 C 83,52 86,51 87,54" stroke="#0F172A" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <path d="M 108,70 C 118,72 128,64 122,52 C 119,45 113,49 112,55" fill="none" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 114,52 C 115,48 112,47 111,51" stroke="#0F172A" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <path d="M 116,55 C 117,52 114,51 113,54" stroke="#0F172A" strokeWidth="1.8" fill="none" strokeLinecap="round" />

    {/* PANICKED HEAD & EXPRESSION */}
    <circle cx="100" cy="52" r="17" fill="#F8FAFC" stroke="#EF4444" strokeWidth="2.5" />
    <path d="M 86,40 Q 92,35 96,40" stroke="#0F172A" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M 104,40 Q 108,35 114,40" stroke="#0F172A" strokeWidth="2" fill="none" strokeLinecap="round" />
    <circle cx="92" cy="49" r="6" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.8" />
    <circle cx="92" cy="49" r="1.5" fill="#EF4444" />
    <circle cx="90.5" cy="47.5" r="0.8" fill="#FFFFFF" />
    <circle cx="108" cy="49" r="6" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.8" />
    <circle cx="108" cy="49" r="1.5" fill="#EF4444" />
    <circle cx="106.5" cy="47.5" r="0.8" fill="#FFFFFF" />
    <ellipse cx="100" cy="62" rx="6" ry="7" fill="#991B1B" stroke="#0F172A" strokeWidth="1.8" />
    <rect x="96" y="56" width="8" height="3" rx="0.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="0.8" />
    <rect x="97" y="65" width="6" height="2.5" rx="0.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="0.8" />
    <path d="M 78,42 Q 74,44 76,48 Q 80,46 78,42 Z" fill="#38BDF8" stroke="#0284C7" strokeWidth="0.8" />
    <path d="M 122,42 Q 126,44 124,48 Q 120,46 122,42 Z" fill="#38BDF8" stroke="#0284C7" strokeWidth="0.8" />
  </svg>
);
