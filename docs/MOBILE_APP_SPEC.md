# Mobile App UI/UX Specification & Design System
## Expense Tracker v2.0: React Native (Expo) Client

---

## 1. Design System & Visual Tokens

The mobile app is engineered for **ultra-fast mobile triage, low eye strain, and OLED battery efficiency** using a high-contrast dark theme.

### 1.1 Color Palette

```
Background (OLED Black) : #090A0F
Card Surface            : #131620
Card Surface Elev. 2    : #1B1F2D
Border & Divider        : #232838

Text Primary            : #FFFFFF
Text Secondary          : #94A3B8
Text Muted              : #64748B

Accent / Brand Purple   : #8B5CF6 (Primary Action FABs, Active Tabs)
Accent Light Purple     : #A78BFA
Success Emerald         : #10B981 (Income, Net Positive, Approved)
Danger Rose             : #F43F5E (Expenses, Over-budget Alerts)
Warning Amber           : #F59E0B (Pending Review Chips, MoM Spikes)
Info Cyan               : #06B6D4 (Transfers, System Sync)
```

### 1.2 Typography Hierarchy (System Sans-Serif / Inter)
- **Large Header / Balances**: `32px`, Bold (`700`), Letter Spacing `-0.5px`
- **Card Titles / Section Headers**: `18px`, Semi-Bold (`600`)
- **Body / Merchant Names**: `15px`, Medium (`500`)
- **Metadata / Timestamps**: `13px`, Regular (`400`), `#94A3B8`
- **Micro Badges / Chips**: `11px`, Bold (`700`), Letter Spacing `+0.5px`, Uppercase

### 1.3 Layout & Spacing Tokens
- Base unit: `4px`
- Content padding: `16px`
- Card corner radius: `16px`
- Pill chip corner radius: `20px`
- Elevation / Shadow: Soft purple-tinted ambient glow on primary cards: `shadowColor: '#8B5CF6', shadowOpacity: 0.15, shadowRadius: 10`.

---

## 2. Navigation Architecture

The app employs a 5-tab bottom bar navigation structure with an elevated center Floating Action Button (FAB) for rapid manual entry:

```
[ 🏠 Home ]   [ 📥 Inbox (Badge) ]   [ ➕ Add ]   [ 📊 Analytics ]   [ ⚙️ Settings ]
```

---

## 3. Screen Specifications & Interaction Flows

### 3.1 Home Dashboard (`HomeScreen`)

#### Components:
1. **Header**: User greeting, Tailscale status indicator (Green dot = Connected, Amber = Offline Cache), and Sync Now icon button.
2. **Net Worth & Burn Hero Card**:
   - Total Net Worth across all active accounts (`₹2,45,820.00`).
   - Monthly Burn bar vs Monthly Income (`Spent ₹42,100 / ₹1,20,000`).
   - Calculated Savings Rate badge (`64.9% Savings Rate`).
3. **Account Quick-Scroll Carousel**:
   - Horizontal cards showing HDFC Savings, ICICI Credit Card, Cash with individual running balances and last updated timestamps.
4. **Recent Transactions Feed**:
   - Last 10 posted transactions with category icon, merchant title, time, and formatted ₹ amount (+ green for income, - red for expense, ↔ cyan for transfer).
   - "View All" link directing to `LedgerScreen`.

---

### 3.2 Review Inbox (`InboxScreen`)

#### Purpose:
Zero-friction human-in-the-loop review queue for ambiguous or new transactions.

#### Components & Flow:
1. **Queue Header**: Counter pill (`3 transactions need review`).
2. **Review Card**:
   - **Transaction Details**: Amount in large bold text (`₹450.00`), normalized merchant name (`CHAI POINT`), extracted UPI VPA (`chaipoint@icici`), and date/time.
   - **AI Suggestion Pill**: Highlighted pill showing AI's proposed category (`Food & Dining > Dining Out`) with confidence percentage (`68% confidence`).
   - **Selective Learning Checkbox**: Toggle labeled **"Remember this merchant for future transactions"** (checked by default for merchant VPAs).
   - **Action Buttons**:
     - **"Approve" (One-Tap)**: Commits the suggested category, triggers selective memory upsert, and animates the card away with haptic feedback.
     - **"Change Category"**: Opens the Category Selector Bottom Sheet.
     - **"Split"**: Opens the Line-Item Split Sheet.
     - **"Mark as Transfer"**: Converts transaction to intra-account transfer and prompts for source/destination accounts.

---

### 3.3 Full Ledger (`LedgerScreen`)

#### Components:
1. **Search Bar**: Real-time debounce filter by merchant name, notes, or reference number.
2. **Filter Chip Bar**:
   - Date range selector (This Month, Last Month, Custom).
   - Account filter dropdown.
   - Category filter multi-select.
   - Group filter (e.g. "Goa Trip 2026").
3. **Transaction List**:
   - Infinite scroll list powered by `FlatList` with `onEndReached` pagination.
   - Tap on any transaction opens the **Transaction Detail Modal** to adjust splits, add notes, or reassign groups.

---

### 3.4 Real-Time Analytics (`AnalyticsScreen`)

#### Components:
1. **Month Selector**: Header dropdown / arrows to toggle between calendar months.
2. **Interactive Donut Chart**:
   - Rendered using `react-native-gifted-charts` with smooth opening animation.
   - Slices colored by category palette.
   - Center text shows Total Monthly Spend (`₹68,450`).
3. **Interactive Top-5 Drilldown Modal**:
   - **Gesture**: Tapping any slice on the donut chart triggers a bottom-sheet modal.
   - **Display**: Shows category name, total category spend, percentage of monthly budget, and the **Top 5 largest individual transactions** in that category with dates and amounts.
4. **Month-over-Month (MoM) Variance Section**:
   - Category-by-category cards displaying spending change:
     - `Dining Out`: `₹14,200 vs ₹10,500` ($\color{#F43F5E}\blacktriangle\text{ +35.2\%}$)
     - `Groceries`: `₹8,200 vs ₹9,400` ($\color{#10B981}\blacktriangledown\text{ -12.8\%}$)
5. **Group / Trip Filter Toggle**:
   - Switch between **"All Spending"** and specific active event groups (e.g. "Goa Trip 2026") to analyze vacation costs in complete isolation.

---

### 3.5 Settings & Tools (`SettingsScreen`)

#### Components:
1. **Connection & Security**:
   - Tailscale Backend IP input (`http://100.x.y.z:8000`).
   - Server `X-API-Key` entry (saved securely to Expo SecureStore).
   - "Test Connection" button with latency ping.
2. **Categorization & AI Configuration**:
   - Active AI Mode indicator (`Hybrid (Qwen2.5 Local + Gemini 2.0 Flash)`).
   - Confidence threshold slider (default `70%`).
3. **Rules & Merchant Memory Manager**:
   - View / Delete learned merchant memory mappings.
   - View / Add deterministic categorization rules.
4. **Data Management**:
   - "Trigger Gmail Ingestion Now" button.
   - "Generate Point-in-Time Database Backup" button.
   - Export ledger to CSV.

---

## 4. State Management, Caching & Offline Strategy

- **TanStack Query (React Query v5)**:
  - Manages server query state, caching, and automatic background invalidation.
  - Query keys: `['accounts']`, `['transactions', filters]`, `['inbox']`, `['analytics', month]`, `['groups']`.
- **Offline Persistence**:
  - `createAsyncStoragePersister` serializes query cache to `AsyncStorage`.
  - When the phone is disconnected from Tailscale, the UI renders cached data immediately with a subtle "Offline / Cached" banner.
- **Optimistic Updates**:
  - Approving an Inbox transaction immediately removes it from the UI queue and updates the local cached account balance before the API network roundtrip completes.
