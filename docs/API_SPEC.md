# REST API Specification & Endpoint Contracts
## Expense Tracker v2.0

---

## 1. Authentication & Base Headers

All API endpoints are protected using single-user API Key authentication.

### Headers:
```http
X-API-Key: <configured-server-api-key>
Content-Type: application/json
Accept: application/json
```

### Standard Error Responses:
```json
// 401 Unauthorized
{
  "detail": "Invalid or missing X-API-Key"
}

// 422 Validation Error
{
  "detail": [
    {
      "loc": ["body", "amount"],
      "msg": "Input should be greater than 0",
      "type": "greater_than"
    }
  ]
}

// 500 Internal Server Error
{
  "detail": "An internal server error occurred"
}
```

---

## 2. API Endpoints Catalog

### 2.1 Accounts Management

#### `GET /api/v1/accounts`
Retrieves all configured user accounts with current running balances.

**Response `200 OK`**:
```json
[
  {
    "id": 1,
    "name": "HDFC Salary Account",
    "institution": "HDFC",
    "account_type": "SAVINGS",
    "currency": "INR",
    "balance": "84520.50",
    "account_number_last4": "9482",
    "is_active": true,
    "created_at": "2026-08-01T00:00:00Z"
  }
]
```

#### `POST /api/v1/accounts`
Creates a new financial account.

**Request Body**:
```json
{
  "name": "ICICI Amazon Pay Credit Card",
  "institution": "ICICI",
  "account_type": "CREDIT_CARD",
  "currency": "INR",
  "initial_balance": "0.00",
  "account_number_last4": "1044"
}
```

---

### 2.2 Transactions & Ledger

#### `GET /api/v1/transactions`
Lists transactions with paginated filtering.

**Query Parameters**:
- `page` (int, default: 1)
- `page_size` (int, default: 50, max: 200)
- `account_id` (optional int)
- `category_id` (optional int)
- `group_id` (optional int)
- `is_expense` (optional bool)
- `status` (optional string: `POSTED`, `PENDING_REVIEW`)
- `start_date` (optional ISO date: `YYYY-MM-DD`)
- `end_date` (optional ISO date: `YYYY-MM-DD`)
- `search` (optional string: searches merchant name, notes, VPA)

**Response `200 OK`**:
```json
{
  "items": [
    {
      "id": 104,
      "account_id": 1,
      "destination_account_id": null,
      "category": {
        "id": 5,
        "name": "Dining Out",
        "parent_category": "Food & Dining",
        "icon": "utensils",
        "color": "#F59E0B"
      },
      "group": {
        "id": 2,
        "name": "Goa Trip 2026"
      },
      "amount": "450.00",
      "currency": "INR",
      "is_expense": true,
      "is_transfer": false,
      "status": "POSTED",
      "merchant_name": "Fisherman's Wharf",
      "merchant_vpa": "fishwharf@hdfcbank",
      "reference_number": "424918294821",
      "description": "Lunch with friends",
      "categorization_strategy": "RULE",
      "categorization_confidence": 1.0,
      "timestamp": "2026-08-12T14:32:00Z",
      "splits": []
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 50,
  "total_pages": 1
}
```

#### `POST /api/v1/transactions`
Creates a manual transaction or transfer.

**Request Body**:
```json
{
  "account_id": 1,
  "destination_account_id": 2,
  "category_id": null,
  "group_id": null,
  "amount": "15000.00",
  "currency": "INR",
  "is_expense": false,
  "is_transfer": true,
  "merchant_name": "Credit Card Bill Pay",
  "description": "Paid ICICI Card bill from HDFC Savings",
  "timestamp": "2026-08-15T10:00:00Z"
}
```

#### `POST /api/v1/transactions/{id}/split`
Splits an existing transaction across multiple categories.

**Request Body**:
```json
{
  "splits": [
    { "category_id": 4, "amount": "1200.00", "note": "Groceries" },
    { "category_id": 7, "amount": "800.00", "note": "Kitchenware" }
  ]
}
```

---

### 2.3 Review Inbox & Triage

#### `GET /api/v1/inbox`
Returns all transactions pending human review (`status = 'PENDING_REVIEW'`).

**Response `200 OK`**:
```json
[
  {
    "id": 205,
    "amount": "240.00",
    "merchant_name": "CHAI POINT INDIRANAGAR",
    "merchant_vpa": "chaipoint@icici",
    "timestamp": "2026-08-31T09:15:00Z",
    "suggested_category": {
      "id": 5,
      "name": "Dining Out",
      "parent_category": "Food & Dining"
    },
    "confidence": 0.65,
    "reasoning": "Merchant name indicates a beverage and snacks cafe."
  }
]
```

#### `POST /api/v1/inbox/{id}/approve`
Approves the suggested category with a selective memory toggle.

**Request Body**:
```json
{
  "category_id": 5,
  "learn_merchant": true
}
```

---

### 2.4 Categories & Groups

#### `GET /api/v1/categories/tree`
Returns the full hierarchical category structure.

**Response `200 OK`**:
```json
[
  {
    "parent": "Food & Dining",
    "categories": [
      { "id": 4, "name": "Groceries", "icon": "shopping-cart", "color": "#10B981" },
      { "id": 5, "name": "Dining Out", "icon": "utensils", "color": "#F59E0B" }
    ]
  },
  {
    "parent": "Housing & Utilities",
    "categories": [
      { "id": 10, "name": "Rent", "icon": "home", "color": "#8B5CF6" },
      { "id": 11, "name": "Electricity", "icon": "zap", "color": "#3B82F6" }
    ]
  }
]
```

#### `GET /api/v1/groups/{id}/summary`
Calculates real-time event/trip cost breakdown.

**Response `200 OK`**:
```json
{
  "group_id": 2,
  "name": "Goa Trip 2026",
  "start_date": "2026-08-10",
  "end_date": "2026-08-15",
  "budget": "50000.00",
  "total_spent": "42850.00",
  "budget_remaining": "7150.00",
  "transaction_count": 28,
  "category_breakdown": [
    { "category_name": "Dining Out", "amount": "18400.00", "percentage": 42.9 },
    { "category_name": "Travel & Stay", "amount": "20000.00", "percentage": 46.7 },
    { "category_name": "Activities", "amount": "4450.00", "percentage": 10.4 }
  ]
}
```

---

### 2.5 Real-Time Analytics

#### `GET /api/v1/analytics/summary`
Calculates income, burn rate, and savings for a month.

**Query Parameters**:
- `month` (e.g. `2026-08`)

**Response `200 OK`**:
```json
{
  "month": "2026-08",
  "total_income": "150000.00",
  "total_expenses": "68450.00",
  "net_savings": "81550.00",
  "savings_rate_percent": 54.37,
  "active_accounts_count": 4,
  "transaction_count": 92
}
```

#### `GET /api/v1/analytics/category/{category_id}/drilldown`
Returns the **Top 5 largest transactions** for a specific category in a given month.

**Query Parameters**:
- `month` (e.g. `2026-08`)
- `limit` (default: 5)

**Response `200 OK`**:
```json
{
  "category_id": 5,
  "category_name": "Dining Out",
  "total_category_spend": "14200.00",
  "top_transactions": [
    { "id": 88, "merchant_name": "Fisherman's Wharf", "amount": "4850.00", "timestamp": "2026-08-12T14:32:00Z" },
    { "id": 42, "merchant_name": "Toscano Restaurant", "amount": "3400.00", "timestamp": "2026-08-05T20:15:00Z" },
    { "id": 61, "merchant_name": "Toit Brewpub", "amount": "2900.00", "timestamp": "2026-08-08T22:00:00Z" },
    { "id": 19, "merchant_name": "Swiggy Order", "amount": "1650.00", "timestamp": "2026-08-02T13:10:00Z" },
    { "id": 99, "merchant_name": "Blue Tokai Coffee", "amount": "1400.00", "timestamp": "2026-08-14T11:00:00Z" }
  ]
}
```

#### `GET /api/v1/analytics/mom-comparison`
Calculates Month-over-Month spending variance per category.

**Query Parameters**:
- `current_month` (`2026-08`)
- `previous_month` (`2026-07`)

**Response `200 OK`**:
```json
[
  {
    "category_id": 5,
    "category_name": "Dining Out",
    "current_month_amount": "14200.00",
    "previous_month_amount": "10500.00",
    "delta_amount": "3700.00",
    "delta_percent": 35.24,
    "trend": "UP"
  },
  {
    "category_id": 4,
    "category_name": "Groceries",
    "current_month_amount": "8200.00",
    "previous_month_amount": "9400.00",
    "delta_amount": "-1200.00",
    "delta_percent": -12.77,
    "trend": "DOWN"
  }
]
```

---

### 2.6 Sync & System

#### `POST /api/v1/sync/gmail`
Triggers an immediate background Gmail polling run.

**Response `202 Accepted`**:
```json
{
  "status": "SYNC_STARTED",
  "message": "Gmail poller initiated in background"
}
```

#### `POST /api/v1/system/backup`
Triggers an immediate SQLite `VACUUM INTO` backup.

**Response `200 OK`**:
```json
{
  "status": "SUCCESS",
  "backup_file": "/backups/expense_tracker_20260831_230000.db",
  "size_bytes": 10485760
}
```
