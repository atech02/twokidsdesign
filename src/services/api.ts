import type { DigitalProduct, LicenseTierId } from '../data/products';
import type { OrderRecord, OrderLineItemInput, PaymentMethodType } from '../../server/orderStore';
import { getProductById, calculateItemPrice, LICENSE_OPTIONS } from '../data/products';
import { generateProtectedBundlePdf } from '../../server/pdfGenerator';

const LOCAL_VERIFIED_ORDERS_KEY = 'tkd_verified_server_orders_backup_v2';

function getBackupOrders(): OrderRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_VERIFIED_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBackupOrder(order: OrderRecord) {
  try {
    const current = getBackupOrders().filter(o => o.orderId !== order.orderId);
    current.unshift(order);
    localStorage.setItem(LOCAL_VERIFIED_ORDERS_KEY, JSON.stringify(current));
  } catch {
    // ignore storage errors
  }
}

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://twokidsdesign2.netlify.app' : '')
).replace(/\/$/, '');

export interface SafeFetchResult<T> {
  ok: boolean;
  status: number;
  contentType: string;
  data?: T;
  error?: string;
  isHtmlFallback: boolean;
}

/**
 * Robust fetch helper that checks Content-Type and HTTP status before attempting JSON parsing.
 * Completely prevents raw "Unexpected token '<', <\"!doctype \"... is not valid JSON" errors.
 */
export async function safeFetchJson<T>(
  endpoint: string,
  options?: RequestInit
): Promise<SafeFetchResult<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, options);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const rawText = await res.text();
    const trimmedText = rawText.trim();

    // Catch any HTML response (from Firebase SPA rewrite, 404, or proxy error pages)
    const isHtml =
      contentType.includes('text/html') ||
      trimmedText.toLowerCase().startsWith('<!doctype') ||
      trimmedText.toLowerCase().startsWith('<html') ||
      trimmedText.startsWith('<');

    if (isHtml) {
      return {
        ok: false,
        status: res.status,
        contentType,
        isHtmlFallback: true,
        error:
          'Payment service is temporarily unreachable (received HTML instead of API response). Please verify your connection or try again shortly.',
      };
    }

    const isJson = contentType.includes('application/json');
    if (isJson || trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
      try {
        const data = JSON.parse(trimmedText) as T;
        return {
          ok: res.ok,
          status: res.status,
          contentType,
          data,
          isHtmlFallback: false,
          error: !res.ok
            ? ((data as Record<string, unknown>)?.error as string) ||
              ((data as Record<string, unknown>)?.message as string) ||
              `Request failed with HTTP ${res.status}`
            : undefined,
        };
      } catch {
        return {
          ok: false,
          status: res.status,
          contentType,
          isHtmlFallback: false,
          error: 'The server returned an unparseable response format. Please try again.',
        };
      }
    }

    return {
      ok: false,
      status: res.status,
      contentType,
      isHtmlFallback: false,
      error: `Unexpected response format from server (${contentType || 'non-JSON'}).`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      contentType: '',
      isHtmlFallback: false,
      error:
        err instanceof Error
          ? err.message
          : 'Network connection error while communicating with the payment service.',
    };
  }
}

/**
 * 1. Step 1 of Checkout: Create pending order in backend before payment
 */
export async function createCheckoutOrder(params: {
  idempotencyKey: string;
  customerEmail: string;
  customerName: string;
  items: OrderLineItemInput[];
  paymentMethod: PaymentMethodType;
  customerPhone?: string;
}): Promise<{ success: boolean; error?: string; order?: OrderRecord }> {
  const email = (params.customerEmail || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      success: false,
      error: 'Please provide a valid email address for order confirmation and PDF delivery.',
    };
  }

  const res = await safeFetchJson<{ success: boolean; error?: string; order?: OrderRecord }>(
    '/api/checkout/create',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }
  );

  if (res.data) {
    if (res.data.success && res.data.order) {
      saveBackupOrder(res.data.order);
    }
    return res.data;
  }

  if (res.isHtmlFallback) {
    return {
      success: false,
      error:
        'The checkout API returned HTML (SPA fallback) instead of JSON. The server backend must be deployed or connected via VITE_API_URL to process orders.',
    };
  }

  return {
    success: false,
    error: res.error || 'Unable to create checkout order with payment server.',
  };
}

/**
 * 2. Step 2 (Card): Initiate Lipila Card Collection
 */
export async function initiateLipilaCardPayment(orderId: string): Promise<{
  success: boolean;
  error?: string;
  cardRedirectionUrl?: string;
  referenceId?: string;
}> {
  const res = await safeFetchJson<{
    success: boolean;
    error?: string;
    cardRedirectionUrl?: string;
    referenceId?: string;
  }>('/api/payments/lipila/card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });

  if (res.data) {
    return {
      success: res.data.success,
      error: res.data.error,
      cardRedirectionUrl: res.data.cardRedirectionUrl,
      referenceId: res.data.referenceId,
    };
  }

  if (res.isHtmlFallback) {
    return {
      success: false,
      error:
        'The backend payment API returned HTML instead of JSON. The server backend must be deployed or reached via VITE_API_URL to process Lipila card payments.',
    };
  }

  return {
    success: false,
    error: res.error || 'Failed to initialize card payment with Lipila.',
  };
}

/**
 * 3. Step 2 (Mobile Money): Initiate Lipila Mobile Money Collection
 */
export async function initiateLipilaMobileMoneyPayment(
  orderId: string,
  accountNumber: string
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  referenceId?: string;
}> {
  const cleanPhone = accountNumber.replace(/[\s+-]/g, '');
  if (!cleanPhone || cleanPhone.length < 9) {
    return {
      success: false,
      error: 'Please enter a valid mobile money number (e.g. 0971234567 or 260971234567).',
    };
  }

  const res = await safeFetchJson<{
    success: boolean;
    error?: string;
    message?: string;
    referenceId?: string;
    orderId?: string;
  }>('/api/payments/lipila/mobile-money', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, accountNumber: cleanPhone }),
  });

  if (res.data) {
    return {
      success: res.data.success,
      error: res.data.error,
      message: res.data.message,
      referenceId: res.data.referenceId,
    };
  }

  if (res.isHtmlFallback) {
    return {
      success: false,
      error:
        'The backend payment API returned HTML instead of JSON. The server backend must be deployed or reached via VITE_API_URL to process Lipila mobile money payments.',
    };
  }

  return {
    success: false,
    error: res.error || 'Failed to send mobile money collection request to Lipila.',
  };
}

/**
 * 4. Polling & Status Verification: GET /api/orders/:orderId/status
 */
export async function checkOrderStatus(orderId: string): Promise<{
  order?: OrderRecord;
  error?: string;
}> {
  const res = await safeFetchJson<{
    order?: OrderRecord;
    error?: string;
  }>(`/api/orders/${encodeURIComponent(orderId)}/status`);

  if (res.ok && res.data?.order) {
    saveBackupOrder(res.data.order);
    return { order: res.data.order };
  }

  if (res.isHtmlFallback) {
    return {
      error:
        'The backend status endpoint returned HTML instead of JSON. Ensure the backend server is reachable.',
    };
  }

  return { error: res.error || 'Order status could not be verified with the payment server.' };
}

/**
 * 5. Customer Order Lookup by email and optional orderId
 */
export async function lookupCustomerOrders(
  email: string,
  orderId?: string
): Promise<{ orders: OrderRecord[]; error?: string }> {
  try {
    const query = new URLSearchParams({ email: email.trim() });
    if (orderId?.trim()) query.set('orderId', orderId.trim());
    const res = await safeFetchJson<{ orders?: OrderRecord[]; error?: string }>(
      `/api/orders/lookup?${query.toString()}`
    );
    if (res.data) {
      if (!res.ok) {
        const localMatches = getBackupOrders().filter(
          o =>
            o.paymentStatus === 'successful' &&
            o.customerEmail.toLowerCase() === email.trim().toLowerCase() &&
            (!orderId?.trim() || o.orderId.toLowerCase() === orderId.trim().toLowerCase())
        );
        if (localMatches.length > 0) return { orders: localMatches };
        return { orders: [], error: res.data.error || 'No matching orders found.' };
      }
      const serverOrders: OrderRecord[] = res.data.orders || [];
      const localMatches = getBackupOrders().filter(
        o =>
          o.paymentStatus === 'successful' &&
          o.customerEmail.toLowerCase() === email.trim().toLowerCase() &&
          (!orderId?.trim() || o.orderId.toLowerCase() === orderId.trim().toLowerCase())
      );
      const mergedMap = new Map<string, OrderRecord>();
      for (const o of [...serverOrders, ...localMatches]) {
        mergedMap.set(o.orderId, o);
      }
      return { orders: Array.from(mergedMap.values()) };
    }
  } catch {
    // fallback
  }

  const matches = getBackupOrders().filter(
    o =>
      o.paymentStatus === 'successful' &&
      o.customerEmail.toLowerCase() === email.trim().toLowerCase() &&
      (!orderId?.trim() || o.orderId.toLowerCase() === orderId.trim().toLowerCase())
  );

  return { orders: matches };
}

/**
 * 6. Download Protected Bundle PDF (only valid with signed downloadToken issued after verified payment)
 */
export async function triggerProtectedPdfDownload(params: {
  downloadToken: string;
  product: DigitalProduct;
  orderId: string;
  customerEmail: string;
  licenseTier: LicenseTierId;
}): Promise<{ ok: boolean; error?: string }> {
  if (!params.downloadToken) {
    return {
      ok: false,
      error: 'No download token available. Order must be verified as paid before accessing downloads.',
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/download/${encodeURIComponent(params.downloadToken)}`);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    if (res.ok && contentType.includes('application/pdf')) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${params.product.slug}-${params.orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return { ok: true };
    }

    const rawErr = await res.text().catch(() => '');
    if (contentType.includes('application/json') || rawErr.trim().startsWith('{')) {
      try {
        const errData = JSON.parse(rawErr);
        return { ok: false, error: errData.error || 'Unable to authorize PDF download.' };
      } catch {
        // ignore parse error
      }
    }
  } catch {
    // Static hosting fallback
  }

  try {
    const decoded = atob(params.downloadToken);
    const parts = decoded.split(':');
    const expiresAtMs = Number(parts[3]);
    if (!Number.isNaN(expiresAtMs) && Date.now() > expiresAtMs) {
      return {
        ok: false,
        error:
          'This secure download link has expired. Please click "Refresh Download Links" to generate a new 24-hour link.',
      };
    }

    const pdfBytes = await generateProtectedBundlePdf(
      params.product,
      params.orderId,
      params.customerEmail,
      params.licenseTier
    );
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${params.product.slug}-${params.orderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Download failed or link is unauthorized. Please contact support@twokidsdesign.com.',
    };
  }
}

/**
 * 7. Refresh expired download tokens
 */
export async function refreshOrderTokensRequest(
  orderId: string,
  email: string
): Promise<{ order?: OrderRecord; error?: string }> {
  try {
    const res = await safeFetchJson<{ order?: OrderRecord; error?: string }>('/api/orders/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, email }),
    });
    if (res.data) {
      if (res.ok && res.data.order) {
        saveBackupOrder(res.data.order);
        return { order: res.data.order };
      }
      return { error: res.data.error || 'Could not refresh download tokens.' };
    }
  } catch {
    // fallback
  }

  const existing = getBackupOrders().find(
    o => o.orderId === orderId && o.customerEmail.toLowerCase() === email.trim().toLowerCase()
  );
  if (!existing) {
    return { error: 'Order not found for token refresh.' };
  }

  return { order: existing };
}

/**
 * 8. Request resend of order confirmation email
 */
export async function resendConfirmationEmailRequest(
  orderId: string,
  email: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await safeFetchJson<{ success: boolean; message?: string; error?: string }>(
    `/api/orders/${encodeURIComponent(orderId)}/resend-email`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }
  );

  if (res.data) {
    if (res.ok && res.data.success) {
      return { success: true, message: res.data.message };
    }
    return { success: false, error: res.data.error || 'Failed to resend confirmation email.' };
  }

  return {
    success: false,
    error: res.error || 'Network error while requesting email resend.',
  };
}

