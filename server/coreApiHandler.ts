import { PRODUCTS, getProductById, getProductBySlug } from '../src/data/products';
import {
  createPendingOrder,
  markOrderAsPaid,
  markOrderAsFailed,
  setOrderCardRedirectionUrl,
  setOrderProviderReference,
  rehydrateOrder,
  getOrderByOrderId,
  getOrderByReferenceId,
  verifySignedDownloadToken,
  getOrderByIdAndEmail,
  getPaidOrdersByEmail,
  refreshOrderDownloadTokens,
  incrementItemDownloadCount,
  claimEmailSendingRights,
  type PaymentMethodType,
  type OrderRecord,
  type OrderStatusType,
} from './orderStore';
import { generateProtectedBundlePdf } from './pdfGenerator';
import { lipilaClient, type LipilaStatusResponse } from './lipilaClient';
import { sendOrderConfirmationEmail } from './emailService';

export interface CoreApiRequest {
  method: string;
  url: string;
  pathname: string;
  searchParams: URLSearchParams;
  headers: Record<string, string | undefined>;
  body?: any;
}

export interface CoreApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string | Uint8Array;
}

const ALLOWED_ORIGINS = [
  'https://twokidsdesign-aed2d.web.app',
  'https://twokidsdesign-aed2d.firebaseapp.com',
  'https://twokidsdesign.web.app',
  'https://twokidsdesign.firebaseapp.com',
  'https://twokidsdesign2.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

function buildCorsHeaders(requestOrigin?: string): Record<string, string> {
  const origin = requestOrigin && (ALLOWED_ORIGINS.includes(requestOrigin) || requestOrigin.endsWith('.web.app') || requestOrigin.endsWith('.firebaseapp.com'))
    ? requestOrigin
    : '*';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, accept',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(
  statusCode: number,
  data: unknown,
  requestOrigin?: string,
  extraHeaders?: Record<string, string>
): CoreApiResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...buildCorsHeaders(requestOrigin),
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(data),
  };
}


export interface ReconciliationResult {
  order?: OrderRecord;
  paymentStatus: 'successful' | 'failed' | 'pending';
  orderStatus: OrderStatusType;
  failureReason?: string;
  message?: string;
}

/**
 * Robust server-side status reconciliation with Lipila.
 * Checks both merchant referenceId and external gateway reference (e.g. LPLXC-...).
 * Automatically updates order store idempotently and triggers email once upon success.
 */
export async function reconcileOrderStatusWithLipila(
  orderIdOrReference: string,
  statusHint?: { status?: string; externalId?: string; message?: string }
): Promise<ReconciliationResult> {
  const cleanId = (orderIdOrReference || '').trim();
  let order = getOrderByOrderId(cleanId) || getOrderByReferenceId(cleanId);
  if (!order) {
    return {
      paymentStatus: 'pending',
      orderStatus: 'pending_payment',
      message: 'Order not found',
    };
  }

  // Terminal state 1: Already paid
  if (order.paymentStatus === 'successful' || order.orderStatus === 'paid') {
    return {
      order,
      paymentStatus: 'successful',
      orderStatus: 'paid',
      message: 'Payment verified and completed successfully.',
    };
  }

  // Terminal state 2: Already marked failed
  if (order.paymentStatus === 'failed' || order.orderStatus === 'payment_failed') {
    return {
      order,
      paymentStatus: 'failed',
      orderStatus: 'payment_failed',
      failureReason: order.payment?.errorMessage || 'Payment authorization failed',
      message: order.payment?.errorMessage || 'Payment authorization failed or was declined',
    };
  }

  // In test / sandbox mock mode without live API key, use statusHint if provided
  if (!lipilaClient.hasApiKey() && statusHint?.status) {
    const hintLower = statusHint.status.toLowerCase();
    if (hintLower === 'successful' || hintLower === 'success' || hintLower === 'paid') {
      const paid = markOrderAsPaid(order.orderId, statusHint.externalId);
      if (paid && claimEmailSendingRights(paid.orderId)) {
        sendOrderConfirmationEmail(paid).catch(err => {
          console.error(`[Reconcile] Error sending confirmation email for ${paid.orderId}:`, err);
        });
      }
      return {
        order: paid || order,
        paymentStatus: 'successful',
        orderStatus: 'paid',
        message: 'Payment verified and completed successfully.',
      };
    } else if (hintLower === 'failed' || hintLower === 'declined' || hintLower === 'cancelled') {
      let failureCode = 'PAYMENT_FAILED';
      let userMsg = statusHint.message || 'Payment authorization failed or was declined.';
      const hintMsg = (statusHint.message || '').toLowerCase();
      if (hintMsg.includes('insufficient') || hintMsg.includes('balance') || hintMsg.includes('funds')) {
        failureCode = 'INSUFFICIENT_FUNDS';
        userMsg =
          'Payment failed — insufficient mobile money balance. Please top up your Airtel Money wallet and try again.';
      } else if (hintMsg.includes('cancel') || hintMsg.includes('reject') || hintMsg.includes('decline')) {
        failureCode = 'PAYMENT_CANCELLED';
        userMsg = 'Payment was declined or cancelled on your mobile device.';
      } else if (hintMsg.includes('expire') || hintMsg.includes('time')) {
        failureCode = 'PAYMENT_EXPIRED';
        userMsg = 'Payment authorization prompt timed out. Please try again.';
      }

      const failed = markOrderAsFailed(order.orderId, userMsg);
      return {
        order: failed || order,
        paymentStatus: 'failed',
        orderStatus: 'payment_failed',
        failureReason: failureCode,
        message: userMsg,
      };
    }
  }

  // Collect references to check with Lipila
  const referencesToCheck: string[] = [];
  if (order.referenceId) referencesToCheck.push(order.referenceId);
  if (
    order.payment?.externalTransactionId &&
    !referencesToCheck.includes(order.payment.externalTransactionId)
  ) {
    referencesToCheck.push(order.payment.externalTransactionId);
  }
  if (
    order.payment?.referenceId &&
    !referencesToCheck.includes(order.payment.referenceId)
  ) {
    referencesToCheck.push(order.payment.referenceId);
  }
  if (cleanId.startsWith('LPLXC') && !referencesToCheck.includes(cleanId)) {
    referencesToCheck.push(cleanId);
  }

  for (const ref of referencesToCheck) {
    try {
      const check = await lipilaClient.checkTransactionStatus(ref);
      const data = check.data;

      const rawStatus = String(
        data?.status || (check.ok ? 'Pending' : check.status === 400 ? 'Failed' : 'Pending')
      ).trim();
      const statusLower = rawStatus.toLowerCase();
      const rawMsg = String(data?.message || check.error || '').trim();
      const msgLower = rawMsg.toLowerCase();
      const externalId = String(
        data?.externalId ||
        data?.identifier ||
        data?.transactionId ||
        (ref.startsWith('LPLXC') ? ref : '')
      ).trim();

      if (externalId && externalId !== order.referenceId) {
        setOrderProviderReference(order.orderId, externalId);
      }

      // Check SUCCESS
      if (
        statusLower === 'successful' ||
        statusLower === 'success' ||
        statusLower === 'completed' ||
        statusLower === 'approved' ||
        statusLower === 'paid'
      ) {
        const reportedAmount = Number(data?.amount);
        if (!Number.isNaN(reportedAmount) && reportedAmount > 0 && reportedAmount !== order.total) {
          const failed = markOrderAsFailed(
            order.orderId,
            'Amount mismatch detected during status reconciliation'
          );
          return {
            order: failed,
            paymentStatus: 'failed',
            orderStatus: 'payment_failed',
            failureReason: 'AMOUNT_MISMATCH',
            message: 'Payment verification failed due to amount mismatch.',
          };
        }

        const paid = markOrderAsPaid(order.orderId, externalId || undefined);
        if (paid && claimEmailSendingRights(paid.orderId)) {
          sendOrderConfirmationEmail(paid).catch(err => {
            console.error(`[Reconcile] Error sending confirmation email for ${paid.orderId}:`, err);
          });
        }

        return {
          order: paid || order,
          paymentStatus: 'successful',
          orderStatus: 'paid',
          message: 'Payment verified and completed successfully.',
        };
      }

      // Check TERMINAL FAILURE
      const isFailedStatus =
        statusLower === 'failed' ||
        statusLower === 'declined' ||
        statusLower === 'rejected' ||
        statusLower === 'cancelled' ||
        statusLower === 'canceled' ||
        statusLower === 'expired' ||
        statusLower === 'insufficient_funds' ||
        statusLower === 'insufficient-funds' ||
        statusLower === 'timed_out' ||
        statusLower === 'timeout' ||
        statusLower === 'unauthorized_card';

      const isFailedMessage =
        msgLower.includes('insufficient') ||
        msgLower.includes('balance') ||
        msgLower.includes('funds') ||
        msgLower.includes('declined') ||
        msgLower.includes('cancel') ||
        msgLower.includes('reject') ||
        msgLower.includes('expired') ||
        msgLower.includes('timeout') ||
        msgLower.includes('unauthorized');

      if (isFailedStatus || (isFailedMessage && (!check.ok || check.status === 400))) {
        let failureCode = 'PAYMENT_FAILED';
        let userMessage = rawMsg || 'Payment authorization failed or was declined.';

        if (
          statusLower.includes('insufficient') ||
          msgLower.includes('insufficient') ||
          msgLower.includes('balance') ||
          msgLower.includes('funds')
        ) {
          failureCode = 'INSUFFICIENT_FUNDS';
          userMessage =
            'Payment failed — insufficient mobile money balance. Please top up your Airtel Money wallet and try again.';
        } else if (
          statusLower.includes('cancel') ||
          msgLower.includes('cancel') ||
          statusLower.includes('reject') ||
          msgLower.includes('reject') ||
          statusLower.includes('decline') ||
          msgLower.includes('decline')
        ) {
          failureCode = 'PAYMENT_CANCELLED';
          userMessage = 'Payment was declined or cancelled on your mobile device.';
        } else if (
          statusLower.includes('expire') ||
          msgLower.includes('expire') ||
          statusLower.includes('time') ||
          msgLower.includes('time')
        ) {
          failureCode = 'PAYMENT_EXPIRED';
          userMessage = 'Payment authorization prompt timed out. Please try again.';
        }

        const failed = markOrderAsFailed(order.orderId, userMessage);
        return {
          order: failed || order,
          paymentStatus: 'failed',
          orderStatus: 'payment_failed',
          failureReason: failureCode,
          message: userMessage,
        };
      }

      // Authoritatively Pending / Processing confirmed by Lipila
      if (
        check.ok &&
        (statusLower === 'pending' ||
        statusLower === 'in_progress' ||
        statusLower === 'processing')
      ) {
        return {
          order,
          paymentStatus: 'pending',
          orderStatus: 'pending_payment',
          message:
            rawMsg || 'Payment prompt sent to your mobile phone. Please check and approve the transaction.',
        };
      }
    } catch (err) {
      console.warn(`[Reconcile] Error checking status for reference ${ref}:`, err);
    }
  }

  // Fallback to callback statusHint if API query could not resolve a terminal state
  if (statusHint?.status) {
    const hintLower = statusHint.status.toLowerCase();
    if (
      hintLower === 'failed' ||
      hintLower === 'declined' ||
      hintLower === 'cancelled' ||
      hintLower === 'rejected' ||
      hintLower === 'expired'
    ) {
      let failureCode = 'PAYMENT_FAILED';
      let userMsg = statusHint.message || 'Payment authorization failed or was declined.';
      const hintMsg = (statusHint.message || '').toLowerCase();
      if (hintMsg.includes('insufficient') || hintMsg.includes('balance') || hintMsg.includes('funds')) {
        failureCode = 'INSUFFICIENT_FUNDS';
        userMsg =
          'Payment failed — insufficient mobile money balance. Please top up your Airtel Money wallet and try again.';
      } else if (hintMsg.includes('cancel') || hintMsg.includes('reject') || hintMsg.includes('decline')) {
        failureCode = 'PAYMENT_CANCELLED';
        userMsg = 'Payment was declined or cancelled on your mobile device.';
      } else if (hintMsg.includes('expire') || hintMsg.includes('time')) {
        failureCode = 'PAYMENT_EXPIRED';
        userMsg = 'Payment authorization prompt timed out. Please try again.';
      }

      const failed = markOrderAsFailed(order.orderId, userMsg);
      return {
        order: failed || order,
        paymentStatus: 'failed',
        orderStatus: 'payment_failed',
        failureReason: failureCode,
        message: userMsg,
      };
    }
  }

  return {
    order,
    paymentStatus: 'pending',
    orderStatus: 'pending_payment',
    message: 'Awaiting payment authorization...',
  };
}

export async function handleCoreApiRequest(req: CoreApiRequest): Promise<CoreApiResponse> {
  const method = (req.method || 'GET').toUpperCase();
  const rawPath = req.pathname || '/';
  // Strip any trailing slash while keeping base path intact
  const pathname = rawPath.length > 1 ? rawPath.replace(/\/$/, '') : rawPath;
  const requestOrigin = req.headers['origin'] || req.headers['Origin'];

  // 1. Handle CORS Preflight OPTIONS
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...buildCorsHeaders(requestOrigin),
        'Content-Length': '0',
      },
      body: '',
    };
  }

  try {
    // 0a. GET /api/health (Safe Health Check — No secrets or customer data)
    if (method === 'GET' && pathname === '/api/health') {
      return jsonResponse(200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'Two Kids Design Backend API',
        environment: lipilaClient.getEnvironment(),
      }, requestOrigin);
    }

    // 0b. GET /api/diagnostics (Sanitized Configuration Check — Secrets strictly masked)
    if (method === 'GET' && pathname === '/api/diagnostics') {
      return jsonResponse(200, {
        status: 'ready',
        environment: lipilaClient.getEnvironment(),
        lipila: {
          baseUrl: lipilaClient.getBaseUrl(),
          hasApiKey: lipilaClient.hasApiKey(),
          callbackUrl: lipilaClient.getCallbackUrl(),
        },
        email: {
          hasApiKey: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()),
          from: process.env.ORDER_EMAIL_FROM || 'orders@twokidsdesign.com',
        },
        store: {
          name: process.env.STORE_NAME || 'Two Kids Design',
          currency: 'ZMW',
          url: process.env.STORE_URL || 'https://twokidsdesign-aed2d.web.app',
        },
      }, requestOrigin);
    }

    // 0c. POST /api/diagnostics/lipila-connectivity (Outbound Connectivity Ping to Lipila Gateway)
    if (method === 'POST' && pathname === '/api/diagnostics/lipila-connectivity') {
      try {
        const start = Date.now();
        const pingRes = await fetch(lipilaClient.getBaseUrl(), {
          method: 'GET',
          signal: AbortSignal.timeout(6000),
        }).catch(async () => {
          return await fetch(lipilaClient.getBaseUrl(), {
            method: 'HEAD',
            signal: AbortSignal.timeout(6000),
          });
        });
        const latencyMs = Date.now() - start;
        return jsonResponse(200, {
          success: true,
          target: lipilaClient.getBaseUrl(),
          reachable: true,
          statusCode: pingRes.status,
          latencyMs,
        }, requestOrigin);
      } catch (err) {
        return jsonResponse(502, {
          success: false,
          target: lipilaClient.getBaseUrl(),
          reachable: false,
          error: err instanceof Error ? err.message : 'Unable to reach Lipila gateway.',
        }, requestOrigin);
      }
    }

    // 0d. GET /api/diagnostics/lipila-status?referenceId=... (Safe Gateway Reconciliation Status Check)
    if (method === 'GET' && pathname === '/api/diagnostics/lipila-status') {
      const referenceId = req.searchParams.get('referenceId') || '';
      if (!referenceId) {
        return jsonResponse(400, { error: 'Missing referenceId query parameter.' }, requestOrigin);
      }
      const check = await lipilaClient.checkTransactionStatus(referenceId);
      return jsonResponse(check.ok ? 200 : check.status || 500, check, requestOrigin);
    }

    // 1. GET /api/products
    if (method === 'GET' && pathname === '/api/products') {
      const published = PRODUCTS.filter(p => p.publicationStatus === 'published');
      return jsonResponse(200, { products: published }, requestOrigin);
    }

    // 2. GET /api/products/:slug
    if (method === 'GET' && pathname.startsWith('/api/products/')) {
      const slug = pathname.replace('/api/products/', '');
      const product = getProductBySlug(slug);
      if (!product) {
        return jsonResponse(404, { error: 'Product not found' }, requestOrigin);
      }
      return jsonResponse(200, { product }, requestOrigin);
    }

    // 3. POST /api/checkout/create (Order created BEFORE payment is initiated)
    if (method === 'POST' && pathname === '/api/checkout/create') {
      const body = req.body || {};
      const result = createPendingOrder({
        idempotencyKey: String(body.idempotencyKey || ''),
        customerEmail: String(body.customerEmail || ''),
        customerName: String(body.customerName || ''),
        items: Array.isArray(body.items) ? body.items : [],
        paymentMethod: (body.paymentMethod as PaymentMethodType) || 'card',
        customerPhone: body.customerPhone ? String(body.customerPhone) : undefined,
      });

      if (!result.success || !result.order) {
        return jsonResponse(400, { success: false, error: result.error }, requestOrigin);
      }

      return jsonResponse(200, { success: true, order: result.order }, requestOrigin);
    }

    // 4. POST /api/payments/lipila/card (Initiates Card Collection with Lipila)
    if (method === 'POST' && pathname === '/api/payments/lipila/card') {
      const body = req.body || {};
      const orderId = String(body.orderId || '');
      const order = getOrderByOrderId(orderId);

      if (!order) {
        return jsonResponse(404, { success: false, error: 'Order not found for card payment.' }, requestOrigin);
      }

      if (order.orderStatus === 'paid') {
        return jsonResponse(200, { success: true, order, message: 'Order is already paid.' }, requestOrigin);
      }

      // Sanitize client origin for customer return URLs:
      // Replace accidental Netlify deploy-preview or backend URLs with the production frontend URL
      let clientOrigin = process.env.STORE_URL || 'https://twokidsdesign-aed2d.web.app';
      if (
        requestOrigin &&
        (requestOrigin.startsWith('http://localhost') || requestOrigin.startsWith('http://127.0.0.1'))
      ) {
        clientOrigin = requestOrigin;
      }
      const backUrl = `${clientOrigin.replace(/\/$/, '')}/order-confirmation/${encodeURIComponent(order.orderId)}`;

      const nameParts = (order.customerName || 'Valued Creator').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Valued';
      const lastName = nameParts.slice(1).join(' ') || 'Creator';
      const phone = order.payment.customerPhone || '260970000000';

      const lipilaPayload = {
        customerInfo: {
          firstName,
          lastName,
          phoneNumber: phone,
          city: 'Lusaka',
          country: 'Zambia',
          address: 'Digital Download Store',
          zip: '10101',
          email: order.customerEmail,
        },
        collectionRequest: {
          referenceId: order.referenceId,
          amount: order.total,
          narration: `Two Kids Design order ${order.orderId}`,
          accountNumber: phone,
          currency: 'ZMW' as const,
          backUrl,
          referenceData: order.orderId,
        },
      };

      const lipilaResult = await lipilaClient.initiateCardCollection(lipilaPayload);

      if (!lipilaResult.ok || !lipilaResult.data.cardRedirectionUrl) {
        return jsonResponse(502, {
          success: false,
          error:
            lipilaResult.error ||
            'Lipila card checkout initialization failed. Please try again or use mobile money.',
          referenceId: order.referenceId,
        }, requestOrigin);
      }

      setOrderCardRedirectionUrl(order.orderId, lipilaResult.data.cardRedirectionUrl);

      return jsonResponse(200, {
        success: true,
        orderId: order.orderId,
        referenceId: order.referenceId,
        cardRedirectionUrl: lipilaResult.data.cardRedirectionUrl,
      }, requestOrigin);
    }

    // 5. POST /api/payments/lipila/mobile-money (Initiates Mobile-Money Prompt with Lipila)
    if (method === 'POST' && pathname === '/api/payments/lipila/mobile-money') {
      const body = req.body || {};
      const orderId = String(body.orderId || '');
      const accountNumber = String(body.accountNumber || '').replace(/\s+-]/g, '');

      const order = getOrderByOrderId(orderId);
      if (!order) {
        return jsonResponse(404, { success: false, error: 'Order not found for mobile money payment.' }, requestOrigin);
      }

      const cleanDigits = accountNumber.replace(/[^\d]/g, '');
      if (!cleanDigits || cleanDigits.length < 9 || cleanDigits.length > 15) {
        return jsonResponse(400, {
          success: false,
          error: 'Please enter a valid Zambian mobile money number (e.g. 0971234567 or 260971234567).',
        }, requestOrigin);
      }

      // Standardize Zambian mobile numbers to 260...
      let standardizedPhone = cleanDigits;
      if (cleanDigits.startsWith('0') && cleanDigits.length === 10) {
        standardizedPhone = `260${cleanDigits.slice(1)}`;
      } else if ((cleanDigits.startsWith('9') || cleanDigits.startsWith('7')) && cleanDigits.length === 9) {
        standardizedPhone = `260${cleanDigits}`;
      }

      const lipilaPayload = {
        referenceId: order.referenceId,
        amount: order.total,
        narration: `Two Kids Design order ${order.orderId}`,
        accountNumber: standardizedPhone,
        currency: 'ZMW' as const,
        email: order.customerEmail,
        referenceData: order.orderId,
      };

      const lipilaResult = await lipilaClient.initiateMobileMoneyCollection(lipilaPayload);

      const initStatus = String(lipilaResult.data?.status || '').toLowerCase();
      if (!lipilaResult.ok || initStatus === 'failed' || initStatus === 'declined' || initStatus === 'rejected') {
        const clientStatus =
          lipilaResult.status >= 400 && lipilaResult.status < 500 ? lipilaResult.status : 400;
        let errMsg =
          lipilaResult.error ||
          lipilaResult.data?.message ||
          'Lipila mobile money collection request failed. Please check the number and try again.';
        let failureCode = 'PAYMENT_FAILED';
        if (
          errMsg.toLowerCase().includes('insufficient') ||
          errMsg.toLowerCase().includes('balance') ||
          errMsg.toLowerCase().includes('funds')
        ) {
          failureCode = 'INSUFFICIENT_FUNDS';
          errMsg =
            'Payment failed — insufficient mobile money balance. Please top up your Airtel Money wallet and try again.';
        }
        markOrderAsFailed(order.orderId, errMsg);
        return jsonResponse(clientStatus, {
          success: false,
          error: errMsg,
          failureReason: failureCode,
        }, requestOrigin);
      }

      // Check if Lipila returned an external transaction reference (e.g. LPLXC-...)
      const providerRef = String(
        (lipilaResult.data as Record<string, unknown>)?.externalId ||
        (lipilaResult.data as Record<string, unknown>)?.transactionId ||
        (lipilaResult.data as Record<string, unknown>)?.identifier ||
        (lipilaResult.data as Record<string, unknown>)?.externalTransactionId ||
        (lipilaResult.data as Record<string, unknown>)?.reference ||
        lipilaResult.data?.referenceId ||
        ''
      ).trim();

      if (providerRef && providerRef !== order.referenceId) {
        setOrderProviderReference(order.orderId, providerRef);
      }

      return jsonResponse(200, {
        success: true,
        orderId: order.orderId,
        referenceId: order.referenceId,
        providerReference: providerRef || order.referenceId,
        message:
          lipilaResult.data?.message ||
          'Payment prompt sent to your mobile phone. Please check and approve the transaction.',
      }, requestOrigin);
    }

    // 6. POST /api/webhooks/lipila (Public HTTPS Callback Endpoint)
    if (method === 'POST' && pathname === '/api/webhooks/lipila') {
      const payload = req.body || {};
      const incomingRef = String(
        payload.referenceId ||
        payload.reference ||
        payload.externalId ||
        payload.identifier ||
        payload.transactionId ||
        payload.referenceData ||
        payload.orderId ||
        ''
      ).trim();

      if (!incomingRef) {
        return jsonResponse(400, { error: 'Missing referenceId in callback payload' }, requestOrigin);
      }

      let order = getOrderByReferenceId(incomingRef) || getOrderByOrderId(incomingRef);

      if (!order) {
        for (const candidate of [payload.referenceData, payload.externalId, payload.transactionId, payload.orderId]) {
          if (candidate && typeof candidate === 'string') {
            order = getOrderByReferenceId(candidate) || getOrderByOrderId(candidate);
            if (order) break;
          }
        }
      }

      if (!order) {
        console.warn(`[Webhook] Unrecognized transaction reference: ${incomingRef}`);
        return jsonResponse(404, { error: 'Unrecognized transaction reference' }, requestOrigin);
      }

      // Link provider reference if present
      const secondaryRef = String(
        payload.externalId ||
        payload.identifier ||
        payload.transactionId ||
        (incomingRef.startsWith('LPLXC') ? incomingRef : '')
      ).trim();
      if (secondaryRef && secondaryRef !== order.referenceId) {
        setOrderProviderReference(order.orderId, secondaryRef);
      }

      // Reconcile status (passes payload hints for sandbox/fallback verification)
      const reconciliation = await reconcileOrderStatusWithLipila(order.orderId, {
        status: payload.status,
        externalId: payload.externalId || payload.identifier || payload.transactionId,
        message: payload.message,
      });

      return jsonResponse(200, {
        success: true,
        received: true,
        orderId: order.orderId,
        status: reconciliation.orderStatus,
        paymentStatus: reconciliation.paymentStatus,
        orderStatus: reconciliation.orderStatus,
        message: reconciliation.message,
      }, requestOrigin);
    }

    // 7. GET /api/orders/:orderId/status (Checks order status & reconciles with Lipila if pending)
    if (
      (method === 'GET' && pathname.startsWith('/api/orders/') && pathname.endsWith('/status')) ||
      (method === 'GET' && pathname === '/api/orders/status')
    ) {
      let orderId = '';
      if (pathname === '/api/orders/status') {
        orderId = req.searchParams.get('orderId') || req.searchParams.get('referenceId') || '';
      } else {
        orderId = pathname.replace('/api/orders/', '').replace('/status', '');
      }

      let order = getOrderByOrderId(orderId) || getOrderByReferenceId(orderId);
      if (!order) {
        const candidateRef =
          req.searchParams.get('referenceId') ||
          req.searchParams.get('ref') ||
          req.searchParams.get('providerReference') ||
          '';
        if (candidateRef) {
          order = getOrderByReferenceId(candidateRef) || getOrderByOrderId(candidateRef);
        }
      }

      if (!order) {
        return jsonResponse(404, { error: 'Order not found' }, requestOrigin);
      }

      const reconciliation = await reconcileOrderStatusWithLipila(order.orderId);

      return jsonResponse(200, {
        order: reconciliation.order || order,
        paymentStatus: reconciliation.paymentStatus,
        orderStatus: reconciliation.orderStatus,
        failureReason: reconciliation.failureReason,
        message: reconciliation.message,
      }, requestOrigin);
    }

    // 7b. POST /api/orders/:orderId/resend-email (Manual Resend with Rate Limiting)
    if (method === 'POST' && pathname.startsWith('/api/orders/') && pathname.endsWith('/resend-email')) {
      const orderId = pathname.replace('/api/orders/', '').replace('/resend-email', '');
      const body = req.body || {};
      const email = String(body.email || '').trim().toLowerCase();

      const order = getOrderByOrderId(orderId);
      if (!order) {
        return jsonResponse(404, { success: false, error: 'Order not found.' }, requestOrigin);
      }

      if (order.orderStatus !== 'paid' || order.paymentStatus !== 'successful') {
        return jsonResponse(400, {
          success: false,
          error: 'Confirmation emails can only be sent for verified paid orders.',
        }, requestOrigin);
      }

      if (email && order.customerEmail.toLowerCase() !== email) {
        return jsonResponse(403, {
          success: false,
          error: 'Email address does not match this order record.',
        }, requestOrigin);
      }

      const canClaim = claimEmailSendingRights(order.orderId, true);
      if (!canClaim) {
        return jsonResponse(429, {
          success: false,
          error: 'A confirmation email was sent recently. Please wait a minute before requesting another.',
        }, requestOrigin);
      }

      const emailResult = await sendOrderConfirmationEmail(order);
      if (!emailResult.success) {
        return jsonResponse(502, {
          success: false,
          error: emailResult.error || 'Failed to dispatch email via Resend.',
        }, requestOrigin);
      }

      return jsonResponse(200, {
        success: true,
        message: `Confirmation email re-sent to ${order.customerEmail}.`,
        messageId: emailResult.messageId,
      }, requestOrigin);
    }

    // 7c. POST /api/orders/rehydrate (Rehydrates order into store for serverless container resilience)
    if (method === 'POST' && pathname === '/api/orders/rehydrate') {
      const body = req.body || {};
      const backupOrder = body.order as OrderRecord;
      if (backupOrder && backupOrder.orderId && backupOrder.referenceId) {
        const rehydrated = rehydrateOrder(backupOrder);
        return jsonResponse(200, { success: true, order: rehydrated }, requestOrigin);
      }
      return jsonResponse(400, { success: false, error: 'Invalid order structure for rehydration.' }, requestOrigin);
    }

    // 8. GET /api/orders/lookup?email=...&orderId=...
    if (method === 'GET' && pathname === '/api/orders/lookup') {
      const email = (req.searchParams.get('email') || '').trim();
      const orderId = (req.searchParams.get('orderId') || '').trim();

      if (!email) {
        return jsonResponse(400, { error: 'Please enter the email address used during checkout.' }, requestOrigin);
      }

      if (orderId) {
        const singleOrder = getOrderByIdAndEmail(orderId, email);
        if (!singleOrder) {
          return jsonResponse(404, {
            error: 'No verified paid order found matching that Order ID and email address.',
          }, requestOrigin);
        }
        return jsonResponse(200, { orders: [singleOrder] }, requestOrigin);
      }

      const orders = getPaidOrdersByEmail(email);
      return jsonResponse(200, { orders }, requestOrigin);
    }

    // 9. POST /api/orders/refresh-token
    if (method === 'POST' && pathname === '/api/orders/refresh-token') {
      const body = req.body || {};
      const orderId = String(body.orderId || '');
      const email = String(body.email || '');
      const updated = refreshOrderDownloadTokens(orderId, email);
      if (!updated) {
        return jsonResponse(403, {
          error: 'Unable to verify order entitlement to refresh download links.',
        }, requestOrigin);
      }
      return jsonResponse(200, { order: updated }, requestOrigin);
    }

    // 10. GET /api/download/:token (Protected PDF Delivery)
    if (method === 'GET' && pathname.startsWith('/api/download/')) {
      const token = decodeURIComponent(pathname.replace('/api/download/', ''));
      const verification = verifySignedDownloadToken(token);

      if (!verification.valid || !verification.productId || !verification.orderId || !verification.order) {
        const status = verification.reason === 'expired' ? 410 : 403;
        const message =
          verification.reason === 'expired'
            ? 'This secure download link has expired. You can generate a fresh 24-hour download link anytime from your Customer Downloads page using your email and Order ID.'
            : 'Unauthorized download request. This link is invalid, tampered with, or the order was not verified as paid.';
        return jsonResponse(status, {
          error: message,
          reason: verification.reason,
        }, requestOrigin);
      }

      const product = getProductById(verification.productId);
      if (!product) {
        return jsonResponse(404, { error: 'Digital bundle file no longer available.' }, requestOrigin);
      }

      const pdfBytes = await generateProtectedBundlePdf(
        product,
        verification.orderId,
        verification.order.customerEmail,
        verification.licenseTier || 'personal'
      );

      incrementItemDownloadCount(verification.orderId, product.id);

      const safeFilename = `${product.slug}-${verification.orderId}.pdf`;
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeFilename}"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
          ...buildCorsHeaders(requestOrigin),
        },
        body: pdfBytes,
      };
    }

    // Default 404 for unrecognized /api routes
    return jsonResponse(404, {
      error: `API route '${pathname}' not found.`,
      status: 404,
    }, requestOrigin);
  } catch (error) {
    return jsonResponse(500, {
      error: 'Internal server error processing payment or digital order request.',
      details: error instanceof Error ? error.message : String(error),
    }, requestOrigin);
  }
}
