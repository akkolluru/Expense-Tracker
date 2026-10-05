import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaisaIQApiClient, ApiError } from '../api';

describe('PaisaIQApiClient', () => {
  let client: PaisaIQApiClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    client = new PaisaIQApiClient('http://localhost:8000/api/v1', 'test-api-key');
  });

  it('initializes with baseUrl and apiKey properly and normalizes trailing slashes', () => {
    const customClient = new PaisaIQApiClient('https://api.paisaiq.com/api/v1///', 'secret-key');
    expect(customClient.getBaseUrl()).toBe('https://api.paisaiq.com/api/v1');
    expect(customClient.getApiKey()).toBe('secret-key');

    customClient.setBaseUrl('http://127.0.0.1:8000/api/v1/');
    expect(customClient.getBaseUrl()).toBe('http://127.0.0.1:8000/api/v1');

    customClient.setApiKey('updated-key');
    expect(customClient.getApiKey()).toBe('updated-key');
  });

  it('fetches system health with X-API-Key header', async () => {
    const healthPayload = {
      status: 'HEALTHY',
      database: 'CONNECTED',
      llm_circuit_breaker: 'CLOSED',
      active_parsers_count: 4,
      timestamp: '2026-10-05T12:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => healthPayload,
    });

    const result = await client.getSystemHealth();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/v1/system/health');
    expect(options.method).toBe('GET');
    expect(options.headers.get('X-API-Key')).toBe('test-api-key');
    expect(result).toEqual(healthPayload);
  });

  it('preserves custom X-API-Key header when passed in options', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    // Explicit custom key
    await client.listAccounts();
    const [, defaultOptions] = mockFetch.mock.calls[0];
    expect(defaultOptions.headers.get('X-API-Key')).toBe('test-api-key');
  });

  it('lists accounts via GET /accounts', async () => {
    const mockAccounts = [
      {
        id: 1,
        name: 'Primary Salary',
        institution: 'HDFC Bank',
        account_type: 'SAVINGS',
        currency: 'INR',
        balance: 145000.5,
        account_number_last4: '4590',
        is_active: true,
        created_at: '2026-08-01T00:00:00Z',
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccounts,
    });

    const accounts = await client.listAccounts();
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/accounts',
      expect.objectContaining({ method: 'GET' })
    );
    expect(accounts).toEqual(mockAccounts);
  });

  it('creates account via POST /accounts with payload', async () => {
    const newAccount = {
      name: 'Emergency Fund',
      institution: 'ICICI Bank',
      initial_balance: 50000,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 2, ...newAccount, currency: 'INR', is_active: true }),
    });

    const res = await client.createAccount(newAccount);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/accounts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(newAccount),
      })
    );
    expect(res.id).toBe(2);
  });

  it('lists transactions with query parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        page: 2,
        page_size: 20,
        total_pages: 1,
      }),
    });

    await client.listTransactions({
      page: 2,
      page_size: 20,
      account_id: 1,
      category_id: 3,
      status: 'POSTED',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'http://localhost:8000/api/v1/transactions?page=2&page_size=20&account_id=1&category_id=3&status=POSTED'
    );
  });

  it('creates transaction with idempotency header', async () => {
    const txResponse = {
      id: 101,
      account_id: 1,
      amount: 450,
      currency: 'INR',
      is_expense: true,
      is_transfer: false,
      is_settlement: false,
      idempotency_key: 'idemp-xyz-123',
      status: 'POSTED',
      merchant_name: 'Blue Tokai Coffee',
      categorization_strategy: 'MERCHANT_MEMORY',
      categorization_confidence: 0.95,
      timestamp: '2026-10-05T10:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => txResponse,
    });

    const result = await client.createTransaction(
      {
        account_id: 1,
        amount: 450,
        merchant_name: 'Blue Tokai Coffee',
        timestamp: '2026-10-05T10:00:00Z',
      },
      'idemp-xyz-123'
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers.get('X-Idempotency-Key')).toBe('idemp-xyz-123');
    expect(result.id).toBe(101);
  });

  it('splits transaction via POST /transactions/:id/split', async () => {
    const splitData = [
      { category_id: 1, amount: 200, note: 'Food' },
      { category_id: 2, amount: 100, note: 'Drinks' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 10, transaction_id: 55, category_id: 1, amount: 200, note: 'Food' },
        { id: 11, transaction_id: 55, category_id: 2, amount: 100, note: 'Drinks' },
      ],
    });

    const res = await client.splitTransaction(55, splitData);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/transactions/55/split',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ splits: splitData }),
      })
    );
    expect(res).toHaveLength(2);
  });

  it('lists inbox items via GET /inbox', async () => {
    const mockInbox = [
      {
        id: 77,
        amount: 1200,
        merchant_name: 'Zomato',
        timestamp: '2026-10-05T12:00:00Z',
        confidence: 0.9,
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockInbox,
    });

    const inbox = await client.listInbox();
    expect(inbox).toEqual(mockInbox);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/inbox',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('approves inbox item via POST /inbox/:id/approve', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 77, status: 'POSTED', category_id: 3 }),
    });

    const res = await client.approveInboxItem(77, { category_id: 3, learn_merchant: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/inbox/77/approve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ category_id: 3, learn_merchant: true }),
      })
    );
    expect(res.id).toBe(77);
  });

  it('parses sync text via POST /sync/parse-text', async () => {
    const payload = {
      raw_text: 'Sent Rs 450 to Starbucks on 05-Oct-2026 via UPI',
      source: 'SMS',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'CREATED',
        action: 'TRANSACTION_CREATED',
        transaction: { id: 88, amount: 450, merchant_name: 'Starbucks' },
      }),
    });

    const res = await client.parseSyncText(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/sync/parse-text',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    expect(res.status).toBe('CREATED');
  });

  it('fetches analytics summary with date range query', async () => {
    const summaryData = {
      income: 185000,
      burn_rate: 1540.2,
      savings_rate: 68.5,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => summaryData,
    });

    const res = await client.getAnalyticsSummary('2026-08-01T00:00:00Z', '2026-08-31T23:59:59Z');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/analytics/summary?start_date=');
    expect(res).toEqual(summaryData);
  });

  it('fetches analytics categories breakdown', async () => {
    const categoriesData = [
      { category_id: 1, name: 'Food & Dining', icon: 'Utensils', color: '#10B981', amount: 15200 },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => categoriesData,
    });

    const res = await client.getAnalyticsCategories('2026-08-01', '2026-08-31');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/analytics/categories?start_date=2026-08-01&end_date=2026-08-31',
      expect.any(Object)
    );
    expect(res).toEqual(categoriesData);
  });

  it('fetches top spends for category with limit query', async () => {
    const topSpends = [
      { transaction_id: 12, merchant_name: 'Nature Basket', amount: 3200, timestamp: '2026-08-15' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => topSpends,
    });

    const res = await client.getAnalyticsTopSpends(1, '2026-08-01', '2026-08-31', 3);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/analytics/categories/1/top-spends?start_date=2026-08-01&end_date=2026-08-31&limit=3',
      expect.any(Object)
    );
    expect(res).toEqual(topSpends);
  });

  it('fetches month-over-month variance analytics', async () => {
    const momData = {
      current_burn: 45000,
      prev_burn: 50000,
      variance_percentage: -10,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => momData,
    });

    const res = await client.getAnalyticsMom(
      '2026-08-01',
      '2026-08-31',
      '2026-07-01',
      '2026-07-31'
    );
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/analytics/mom-variance?current_month_start=2026-08-01&current_month_end=2026-08-31&prev_month_start=2026-07-01&prev_month_end=2026-07-31',
      expect.any(Object)
    );
    expect(res).toEqual(momData);
  });

  // -------------------------------------------------------------------------
  // Edge Case Tests: HTTP Errors & Network Failures
  // -------------------------------------------------------------------------

  it('handles 401 Unauthorized with missing or invalid X-API-Key', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ detail: 'Invalid or missing API key' }),
    });

    try {
      await client.getSystemHealth();
      expect.unreachable('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(401);
      expect(apiErr.message).toBe('Invalid or missing API key');
      expect(apiErr.details).toEqual({ detail: 'Invalid or missing API key' });
    }
  });

  it('handles 404 Not Found error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ detail: 'Transaction #999 not found' }),
    });

    await expect(
      client.splitTransaction(999, [{ category_id: 1, amount: 50 }])
    ).rejects.toThrow(ApiError);
  });

  it('formats 422 Unprocessable Entity detail validation arrays into readable message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({
        detail: [
          { loc: ['body', 'amount'], msg: 'Input should be greater than 0' },
          { loc: ['body', 'merchant_name'], msg: 'Field required' },
        ],
      }),
    });

    try {
      await client.createTransaction({
        account_id: 1,
        amount: 0,
        merchant_name: '',
        timestamp: '2026-10-05T12:00:00Z',
      });
      expect.unreachable('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(422);
      expect(apiErr.message).toContain('body.amount: Input should be greater than 0');
      expect(apiErr.message).toContain('body.merchant_name: Field required');
    }
  });

  it('handles 500 Internal Server Error with JSON payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ message: 'Database connection pool exhausted' }),
    });

    try {
      await client.listAccounts();
      expect.unreachable('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.message).toBe('Database connection pool exhausted');
    }
  });

  it('handles 502/503 non-JSON HTML error pages gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new Error('Unexpected token < in JSON at position 0');
      },
    });

    try {
      await client.getSystemHealth();
      expect.unreachable('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(502);
      expect(apiErr.message).toBe('HTTP Error 502: Bad Gateway');
      expect(apiErr.details).toBeNull();
    }
  });

  it('propagates raw network drops / fetch rejections', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(client.getSystemHealth()).rejects.toThrow(TypeError);
    await expect(client.getSystemHealth()).rejects.toThrow('Failed to fetch');
  });
});
