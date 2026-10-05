/**
 * PaisaIQ Strongly Typed API Client
 * Interfaces match backend schemas (FastAPI v1)
 */

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// ----------------------------------------------------------------------
// Backend Schema DTOs
// ----------------------------------------------------------------------

export interface SystemHealthResponse {
  status: 'HEALTHY' | 'DEGRADED' | string;
  database: 'CONNECTED' | 'DISCONNECTED' | string;
  llm_circuit_breaker: 'CLOSED' | 'OPEN' | 'HALF_OPEN' | string;
  active_parsers_count: number;
  timestamp: string;
}

export interface AccountResponse {
  id: number;
  name: string;
  institution: string;
  account_type: string;
  currency: string;
  balance: number | string;
  account_number_last4: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AccountCreate {
  name: string;
  institution: string;
  account_type?: string;
  currency?: string;
  initial_balance?: number | string;
  account_number_last4?: string | null;
}

export interface CategoryResponse {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_income: boolean;
  parent_category?: string | null;
}

export interface PeerSplitItemDTO {
  member_name: string;
  share_amount: number | string;
  upi_id?: string | null;
  is_paid?: boolean;
}

export interface PeerSplitRequest {
  peer_splits: PeerSplitItemDTO[];
}

export interface PeerSplitResponse {
  id: number;
  transaction_id: number;
  member_name: string;
  upi_id?: string | null;
  share_amount: number | string;
  is_paid: boolean;
  settled_at?: string | null;
}

export interface TransactionResponse {
  id: number;
  account_id: number;
  destination_account_id?: number | null;
  category_id?: number | null;
  suggested_category_id?: number | null;
  group_id?: number | null;
  amount: number | string;
  currency: string;
  is_expense: boolean;
  is_transfer: boolean;
  is_settlement: boolean;
  idempotency_key?: string | null;
  status: 'PENDING_REVIEW' | 'POSTED' | 'RECONCILED' | string;
  merchant_name: string;
  merchant_vpa?: string | null;
  reference_number?: string | null;
  description?: string | null;
  categorization_strategy: string;
  categorization_confidence: number;
  timestamp: string;
  peer_splits?: PeerSplitResponse[];
}

export interface TransactionListResponse {
  items: TransactionResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TransactionCreate {
  account_id: number;
  amount: number | string;
  merchant_name: string;
  timestamp: string;
  destination_account_id?: number | null;
  category_id?: number | null;
  group_id?: number | null;
  currency?: string;
  is_expense?: boolean;
  is_transfer?: boolean;
  idempotency_key?: string | null;
  description?: string | null;
}

export interface SplitItemDTO {
  category_id: number;
  amount: number | string;
  note?: string | null;
}

export interface SplitTransactionRequest {
  splits: SplitItemDTO[];
}

export interface SplitResponse {
  id: number;
  transaction_id: number;
  category_id: number;
  amount: number | string;
  note?: string | null;
}

export interface SuggestedCategoryDTO {
  id: number;
  name: string;
  parent_category?: string | null;
}

export interface InboxItemResponse {
  id: number;
  amount: number | string;
  merchant_name: string;
  merchant_vpa?: string | null;
  timestamp: string;
  suggested_category?: SuggestedCategoryDTO | null;
  confidence: number;
  reasoning?: string | null;
}

export interface InboxApproveRequest {
  category_id: number;
  learn_merchant?: boolean;
  never_auto_classify?: boolean;
}

export interface SyncParseTextRequest {
  raw_text: string;
  source?: string;
  account_id?: number | null;
}

export interface SyncParseTextResponse {
  status: 'CREATED' | 'MERGED' | string;
  action: 'TRANSACTION_CREATED' | 'ENRICHMENT_MERGE' | string;
  transaction: TransactionResponse;
}

export interface SummaryResponse {
  income: number;
  burn_rate: number;
  savings_rate: number;
}

export interface CategoryBreakdownItem {
  category_id: number;
  name: string;
  icon: string;
  color: string;
  amount: number;
}

export interface TopSpendItem {
  transaction_id: number;
  merchant_name: string;
  amount: number;
  timestamp: string;
}

export interface MomVarianceResponse {
  current_burn: number;
  prev_burn: number;
  variance_percentage: number;
}

export interface TransactionFilterParams {
  page?: number;
  page_size?: number;
  account_id?: number;
  category_id?: number;
  status?: string;
}

// ----------------------------------------------------------------------
// API Client Class
// ----------------------------------------------------------------------

export class PaisaIQApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(
    baseUrl: string = import.meta.env.VITE_API_BASE_URL || '/api/v1',
    apiKey: string = import.meta.env.VITE_API_KEY || ''
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  public setApiKey(key: string) {
    this.apiKey = key;
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    if (this.apiKey && !headers.has('X-API-Key')) {
      headers.set('X-API-Key', this.apiKey);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorDetails: unknown = null;
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;

      try {
        const errorJson = await response.json();
        errorDetails = errorJson;
        if (errorJson && typeof errorJson.detail === 'string') {
          errorMessage = errorJson.detail;
        } else if (errorJson && Array.isArray(errorJson.detail) && errorJson.detail.length > 0) {
          errorMessage = errorJson.detail
            .map((e: { msg?: string; loc?: (string | number)[] }) =>
              e.msg ? `${e.loc ? e.loc.join('.') + ': ' : ''}${e.msg}` : JSON.stringify(e)
            )
            .join('; ');
        } else if (errorJson && typeof errorJson.message === 'string') {
          errorMessage = errorJson.message;
        }
      } catch {
        // Response is non-JSON
      }

      throw new ApiError(response.status, errorMessage, errorDetails);
    }

    return (await response.json()) as T;
  }

  // System & Health
  async getSystemHealth(): Promise<SystemHealthResponse> {
    return this.request<SystemHealthResponse>('/system/health', {
      method: 'GET',
    });
  }

  // Accounts
  async listAccounts(): Promise<AccountResponse[]> {
    return this.request<AccountResponse[]>('/accounts', {
      method: 'GET',
    });
  }

  async createAccount(payload: AccountCreate): Promise<AccountResponse> {
    return this.request<AccountResponse>('/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Categories
  async listCategories(): Promise<CategoryResponse[]> {
    return this.request<CategoryResponse[]>('/categories', {
      method: 'GET',
    });
  }

  // Transactions
  async listTransactions(params?: TransactionFilterParams): Promise<TransactionListResponse> {
    const query = new URLSearchParams();
    if (params) {
      if (params.page !== undefined) query.set('page', String(params.page));
      if (params.page_size !== undefined) query.set('page_size', String(params.page_size));
      if (params.account_id !== undefined) query.set('account_id', String(params.account_id));
      if (params.category_id !== undefined) query.set('category_id', String(params.category_id));
      if (params.status) query.set('status', params.status);
    }

    const queryString = query.toString();
    const endpoint = `/transactions${queryString ? `?${queryString}` : ''}`;
    return this.request<TransactionListResponse>(endpoint, {
      method: 'GET',
    });
  }

  async createTransaction(
    payload: TransactionCreate,
    idempotencyKey?: string
  ): Promise<TransactionResponse> {
    const headers: Record<string, string> = {};
    const key = idempotencyKey || payload.idempotency_key;
    if (key) {
      headers['X-Idempotency-Key'] = key;
    }

    return this.request<TransactionResponse>('/transactions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload,
        idempotency_key: key,
      }),
    });
  }

  async splitTransaction(txId: number, splits: SplitItemDTO[]): Promise<SplitResponse[]> {
    return this.request<SplitResponse[]>(`/transactions/${txId}/split`, {
      method: 'POST',
      body: JSON.stringify({ splits }),
    });
  }

  async setPeerSplits(txId: number, splits: PeerSplitItemDTO[]): Promise<PeerSplitResponse[]> {
    return this.request<PeerSplitResponse[]>(`/transactions/${txId}/peer-splits`, {
      method: 'POST',
      body: JSON.stringify({ peer_splits: splits }),
    });
  }

  async togglePeerSplitPaid(txId: number, peerSplitId: number): Promise<PeerSplitResponse> {
    return this.request<PeerSplitResponse>(
      `/transactions/${txId}/peer-splits/${peerSplitId}/toggle-paid`,
      {
        method: 'POST',
      }
    );
  }

  // Inbox
  async listInbox(): Promise<InboxItemResponse[]> {
    return this.request<InboxItemResponse[]>('/inbox', {
      method: 'GET',
    });
  }

  async approveInboxItem(
    txId: number,
    payload: InboxApproveRequest
  ): Promise<TransactionResponse> {
    return this.request<TransactionResponse>(`/inbox/${txId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Sync / SMS Parser
  async parseSyncText(payload: SyncParseTextRequest): Promise<SyncParseTextResponse> {
    return this.request<SyncParseTextResponse>('/sync/parse-text', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Analytics
  async getAnalyticsSummary(startDate: string, endDate: string): Promise<SummaryResponse> {
    const query = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    return this.request<SummaryResponse>(`/analytics/summary?${query.toString()}`, {
      method: 'GET',
    });
  }

  async getAnalyticsCategories(startDate: string, endDate: string): Promise<CategoryBreakdownItem[]> {
    const query = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    return this.request<CategoryBreakdownItem[]>(`/analytics/categories?${query.toString()}`, {
      method: 'GET',
    });
  }

  async getAnalyticsTopSpends(
    categoryId: number,
    startDate: string,
    endDate: string,
    limit: number = 5
  ): Promise<TopSpendItem[]> {
    const query = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      limit: String(limit),
    });
    return this.request<TopSpendItem[]>(
      `/analytics/categories/${categoryId}/top-spends?${query.toString()}`,
      { method: 'GET' }
    );
  }

  async getAnalyticsMom(
    currentStart: string,
    currentEnd: string,
    prevStart: string,
    prevEnd: string
  ): Promise<MomVarianceResponse> {
    const query = new URLSearchParams({
      current_month_start: currentStart,
      current_month_end: currentEnd,
      prev_month_start: prevStart,
      prev_month_end: prevEnd,
    });
    return this.request<MomVarianceResponse>(`/analytics/mom-variance?${query.toString()}`, {
      method: 'GET',
    });
  }
}

// Singleton API Client instance
export const api = new PaisaIQApiClient();
