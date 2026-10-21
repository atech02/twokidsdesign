/**
 * Lipila Payment Gateway Client & Types for Two Kids Design
 * Supporting:
 *  - Hosted Card Collections (Visa, Mastercard, American Express)
 *  - Mobile-Money Collections (Airtel, MTN, Zamtel via Lipila)
 *  - Transaction Status Checking & Verification
 */

export type LipilaEnvironment = 'production' | 'sandbox';

export interface LipilaCustomerInfo {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  city: string;
  country: string;
  address: string;
  zip: string;
  email: string;
}

export interface LipilaCardCollectionRequest {
  referenceId: string;
  amount: number;
  narration: string;
  accountNumber: string; // e.g. customer phone or placeholder account per Lipila spec
  currency: 'ZMW';
  backUrl: string;
  referenceData?: string;
}

export interface LipilaCardCollectionPayload {
  customerInfo: LipilaCustomerInfo;
  collectionRequest: LipilaCardCollectionRequest;
}

export interface LipilaMobileMoneyPayload {
  referenceId: string;
  amount: number;
  narration: string;
  accountNumber: string; // Customer's mobile money phone number (e.g. 260971234567)
  currency: 'ZMW';
  email: string;
  referenceData?: string;
}

export interface LipilaCollectionResponse {
  status: 'Successful' | 'Pending' | 'Failed' | string;
  referenceId: string;
  cardRedirectionUrl?: string;
  message?: string;
  [key: string]: unknown;
}

export interface LipilaStatusResponse {
  status: 'Successful' | 'Pending' | 'Failed' | string;
  referenceId: string;
  amount: number | string;
  currency: string;
  accountNumber?: string;
  paymentType?: string;
  message?: string;
  externalId?: string;
  referenceData?: string;
  narration?: string;
  [key: string]: unknown;
}

export class LipilaClient {
  private baseUrl: string;
  private apiKey: string;
  private callbackUrl: string;
  private environment: LipilaEnvironment;

  constructor() {
    this.environment = (process.env.LIPILA_ENV as LipilaEnvironment) || 'production';
    const defaultBaseUrl =
      this.environment === 'production' ? 'https://blz.lipila.io' : 'https://api.lipila.dev';
    this.baseUrl = (process.env.LIPILA_BASE_URL || defaultBaseUrl).replace(/\/$/, '');
    this.apiKey = process.env.lipila_secret_api || process.env.LIPILA_SECRET_API || process.env.LIPILA_API_KEY || '';
    this.callbackUrl =
      process.env.LIPILA_CALLBACK_URL || 'https://twokidsdesign.web.app/api/webhooks/lipila';
  }

  public getEnvironment(): LipilaEnvironment {
    return this.environment;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getCallbackUrl(): string {
    return this.callbackUrl;
  }

  public hasApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Safe headers matching Lipila documented requirements:
   *  - accept: application/json
   *  - x-api-key: <server-side secret>
   *  - Content-Type: application/json
   *  - callbackUrl: <public HTTPS callback endpoint>
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'Content-Type': 'application/json',
      callbackUrl: this.callbackUrl,
    };
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Initiate Card Collection (POST /api/v1/collections/card)
   */
  public async initiateCardCollection(
    payload: LipilaCardCollectionPayload
  ): Promise<{ ok: boolean; status: number; data: LipilaCollectionResponse; error?: string }> {
    const endpoint = `${this.baseUrl}/api/v1/collections/card`;

    // In local sandbox mock mode when no live key is set, simulate Lipila sandbox API response safely
    if (!this.hasApiKey()) {
      return {
        ok: true,
        status: 200,
        data: {
          status: 'Pending',
          referenceId: payload.collectionRequest.referenceId,
          cardRedirectionUrl: `${payload.collectionRequest.backUrl}?referenceId=${encodeURIComponent(
            payload.collectionRequest.referenceId
          )}&sandbox_card_redirect=true`,
          message: 'Sandbox card collection simulated (configure lipila_secret_api for live network)',
        },
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      let json: LipilaCollectionResponse = {
        status: res.ok ? 'Pending' : 'Failed',
        referenceId: payload.collectionRequest.referenceId,
      };

      if (contentType.includes('application/json')) {
        try {
          json = (await res.json()) as LipilaCollectionResponse;
        } catch {
          // ignore parsing error
        }
      }

      let errorMsg: string | undefined = undefined;
      if (!res.ok) {
        errorMsg =
          json.message ||
          ((json as Record<string, unknown>)?.error as string) ||
          ((json as Record<string, unknown>)?.description as string);
        if (!errorMsg && Array.isArray((json as Record<string, unknown>)?.errors)) {
          errorMsg = ((json as Record<string, unknown>)?.errors as string[]).join(', ');
        }
        if (!errorMsg) {
          errorMsg = `Lipila card gateway error (HTTP ${res.status})`;
        }
      }

      return {
        ok: res.ok,
        status: res.status,
        data: json,
        error: errorMsg,
      };
    } catch (err) {
      return {
        ok: false,
        status: 500,
        data: { status: 'Failed', referenceId: payload.collectionRequest.referenceId },
        error: err instanceof Error ? err.message : 'Network error connecting to Lipila card API',
      };
    }
  }

  /**
   * Initiate Mobile-Money Collection (POST /api/v1/collections/mobile-money)
   */
  public async initiateMobileMoneyCollection(
    payload: LipilaMobileMoneyPayload
  ): Promise<{ ok: boolean; status: number; data: LipilaCollectionResponse; error?: string }> {
    const endpoint = `${this.baseUrl}/api/v1/collections/mobile-money`;

    // In local sandbox mock mode when no live key is set, simulate Lipila sandbox API response safely
    if (!this.hasApiKey()) {
      return {
        ok: true,
        status: 200,
        data: {
          status: 'Pending',
          referenceId: payload.referenceId,
          message:
            'Sandbox mobile money prompt sent to device. Simulated pending confirmation for testing.',
        },
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      let json: LipilaCollectionResponse = {
        status: res.ok ? 'Pending' : 'Failed',
        referenceId: payload.referenceId,
      };

      if (contentType.includes('application/json')) {
        try {
          json = (await res.json()) as LipilaCollectionResponse;
        } catch {
          // ignore parsing error
        }
      }

      let errorMsg: string | undefined = undefined;
      if (!res.ok) {
        errorMsg =
          json.message ||
          ((json as Record<string, unknown>)?.error as string) ||
          ((json as Record<string, unknown>)?.description as string);
        if (!errorMsg && Array.isArray((json as Record<string, unknown>)?.errors)) {
          errorMsg = ((json as Record<string, unknown>)?.errors as string[]).join(', ');
        }
        if (!errorMsg) {
          errorMsg = `Lipila mobile money API error (HTTP ${res.status})`;
        }
      }

      return {
        ok: res.ok,
        status: res.status,
        data: json,
        error: errorMsg,
      };
    } catch (err) {
      return {
        ok: false,
        status: 500,
        data: { status: 'Failed', referenceId: payload.referenceId },
        error:
          err instanceof Error ? err.message : 'Network error connecting to Lipila mobile money API',
      };
    }
  }

  /**
   * Check Transaction Status (GET /api/v1/collections/check-status?referenceId={referenceId})
   */
  public async checkTransactionStatus(
    referenceId: string
  ): Promise<{ ok: boolean; status: number; data?: LipilaStatusResponse; error?: string }> {
    const endpoint = `${this.baseUrl}/api/v1/collections/check-status?referenceId=${encodeURIComponent(
      referenceId
    )}`;

    if (!this.hasApiKey()) {
      return {
        ok: true,
        status: 200,
        data: {
          status: 'Pending',
          referenceId,
          amount: 0,
          currency: 'ZMW',
          message: 'Simulated sandbox status',
        },
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-api-key': this.apiKey,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      let json: LipilaStatusResponse = {
        status: 'Pending',
        referenceId,
        amount: 0,
        currency: 'ZMW',
      };

      if (contentType.includes('application/json')) {
        try {
          json = (await res.json()) as LipilaStatusResponse;
        } catch {
          // ignore parsing error
        }
      }

      let errorMsg: string | undefined = undefined;
      if (!res.ok) {
        errorMsg =
          json.message ||
          ((json as Record<string, unknown>)?.error as string) ||
          `Lipila status check error (HTTP ${res.status})`;
      }

      return {
        ok: res.ok,
        status: res.status,
        data: json,
        error: errorMsg,
      };
    } catch (err) {
      return {
        ok: false,
        status: 500,
        error:
          err instanceof Error ? err.message : 'Network error connecting to Lipila status API',
      };
    }
  }
}

export const lipilaClient = new LipilaClient();
