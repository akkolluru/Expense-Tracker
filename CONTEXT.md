# Expense Tracker Context

A private, self-hosted financial ledger and expense intelligence system that ingests bank notifications, categorizes spending, and tracks personal cash flow across accounts and events.

## Language

### Accounts & Ledger

**Account**:
A distinct financial bucket holding funds or credit, associated with a specific institution (e.g. HDFC Bank, ICICI Credit Card, Physical Cash).
_Avoid_: Wallet, balance source, bank profile

**Transaction**:
A single financial movement representing money entering or leaving an Account, or transferring between two Accounts.
_Avoid_: Entry, payment, expense record

**Expense**:
A Transaction representing an outflow of money to an external party for goods or services.
_Avoid_: Debit, cost, payout

**Income**:
A Transaction representing an inflow of money from an external party (e.g. salary, dividend, cashback).
_Avoid_: Credit, deposit, earning

**Transfer**:
A Transaction moving funds from one owned Account to another without altering net worth or creating an expense/income.
_Avoid_: Internal movement, self-transfer

**Split**:
A line-item division of a single Transaction across multiple Categories with specific amounts.
_Avoid_: Sub-transaction, category breakdown

### Ingestion & Pipeline

**Raw Message**:
An immutable record of an incoming external communication (e.g. Gmail payload, SMS, CSV row) before normalization into a transaction.
_Avoid_: Email, event log, raw body

**Ingestion Event**:
The arrival and capture of a Raw Message into the staging store.
_Avoid_: Poll event, fetch trigger

**Draft Transaction**:
An uncommitted transaction extracted by a parser from a Raw Message, pending categorization and ledger entry.
_Avoid_: Temporary transaction, pending row

### Categorization & Organization

**Category**:
A hierarchical classification (Parent Category and Subcategory) indicating the purpose of an expense or income (e.g. Food > Dining Out).
_Avoid_: Tag, label, bucket

**Group**:
A user-defined collection of related Transactions representing a distinct life event or trip (e.g. "Goa Trip 2026", "Night Out"). Each Transaction belongs to at most one Group at a time, completely independent of its Category.
_Avoid_: Project, tag collection, folder, bundle

**Rule**:
A deterministic pattern matcher (e.g. VPA prefix, merchant name, description keyword, date window) that automatically assigns a Category or Group to matching Transactions.
_Avoid_: Filter, heuristic

**Merchant Memory**:
An auto-learned persistent lookup cache mapping normalized merchant identities and VPAs to previously approved Categories.
_Avoid_: Learned rule, merchant cache

**Categorization Decision**:
A structured output from the categorization engine indicating the assigned Category, confidence score, and matching strategy (Rule, Merchant Memory, or LLM).
_Avoid_: AI guess, classification result

**Financial Recap**:
A periodic narrative summary and statistical insight (monthly, quarterly, bi-annual, annual) highlighting spending patterns, spikes, and habits.
_Avoid_: Wrapped, summary report, spending story
