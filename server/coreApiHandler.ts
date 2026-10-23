import { PRODUCTS, getProductById, getProductBySlug } from '../src/data/products';
import {
  createPendingOrder,
  markOrderAsPaid,
  markOrderAsFailed,
  setOrderCardRedirectionUrl,
  getOrderByOrderId,
  getOrderByReferenceId,
  verifySignedDownloadToken,
  getOrderByIdAndEmail,
  getPaidOrdersByEmail,
  refreshOrderDownloadTokens,
  incrementItemDownloadCount,
  claimEmailSendingRights,
  type PaymentMethodType,
} from './orderStore';
import { generateProtectedBundlePdf } from './pdfGenerator';
import { lipilaClient } from './lipilaClient';
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
  'https://twokidsdesign.web.app',
  'https://twokidsdesign.firebaseapp.com',
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
          url: process.env.STORE_URL || 'https://twokidsdesign.web.app',
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

      const clientOrigin = requestOrigin || 'https://twokidsdesign.web.app';
      const backUrl = `${clientOrigin}/order-confirmation/${encodeURIComponent(order.orderId)}`;

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
      const accountNumber = String(body.accountNumber || '').replace(/[\s+-]/g, '');

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

      if (!lipilaResult.ok) {
        const clientStatus =
          lipilaResult.status >= 400 && lipilaResult.status < 500 ? lipilaResult.status : 502;
        return jsonResponse(clientStatus, {
          success: false,
          error:
            lipilaResult.error ||
            'Lipila mobile money collection request failed. Please check the number and try again.',
        }, requestOrigin);
      }

      return jsonResponse(200, {
        success: true,
        orderId: order.orderId,
        referenceId: order.referenceId,
        message:
          lipilaResult.data.message ||
          'Payment prompt sent to your mobile phone. Please check and approve the transaction.',
      }, requestOrigin);
    }

    // 6. POST /api/webhooks/lipila (Public HTTPS Callback Endpoint)
    if (method === 'POST' && pathname === '/api/webhooks/lipila') {
      const payload = req.body || {};
      const referenceId = String(payload.referenceId || '');

      if (!referenceId) {
        return jsonResponse(400, { error: 'Missing referenceId in callback payload' }, requestOrigin);
      }

      const order = getOrderByReferenceId(referenceId);
      if (!order) {
        return jsonResponse(404, { error: 'Unrecognized transaction reference' }, requestOrigin);
      }

      // Reconcile status with Lipila official check-status endpoint before releasing files
      let finalStatus = String(payload.status || '');
      let externalId = String(payload.externalId || payload.identifier || '');

      if (lipilaClient.hasApiKey()) {
        const statusCheck = await lipilaClient.checkTransactionStatus(referenceId);
        if (statusCheck.ok && statusCheck.data) {
          finalStatus = statusCheck.data.status;
          externalId = String(statusCheck.data.externalId || externalId);

          const reportedAmount = Number(statusCheck.data.amount);
          if (!Number.isNaN(reportedAmount) && reportedAmount !== order.total) {
            markOrderAsFailed(referenceId, 'Amount mismatch detected during status reconciliation');
            return jsonResponse(400, { error: 'Amount mismatch' }, requestOrigin);
          }
        }
      }

      if (finalStatus.toLowerCase() === 'successful') {
        const updated = markOrderAsPaid(referenceId, externalId);
        if (updated && claimEmailSendingRights(updated.orderId)) {
          sendOrderConfirmationEmail(updated).catch(err => {
            console.error(`[Webhook] Error sending confirmation email for ${updated.orderId}:`, err);
          });
        }
        return jsonResponse(200, { success: true, orderId: updated?.orderId, status: 'paid' }, requestOrigin);
      } else if (finalStatus.toLowerCase() === 'failed') {
        markOrderAsFailed(referenceId, String(payload.message || 'Payment failed'));
        return jsonResponse(200, { success: true, status: 'failed' }, requestOrigin);
      } else {
        return jsonResponse(200, { success: true, status: 'pending' }, requestOrigin);
      }
    }

    // 7. GET /api/orders/:orderId/status (Checks order status & reconciles with Lipila if pending)
    if (method === 'GET' && pathname.startsWith('/api/orders/') && pathname.endsWith('/status')) {
      const orderId = pathname.replace('/api/orders/', '').replace('/status', '');
      const order = getOrderByOrderId(orderId);

      if (!order) {
        return jsonResponse(404, { error: 'Order not found' }, requestOrigin);
      }

      if (order.orderStatus === 'pending_payment' && order.referenceId) {
        const check = await lipilaClient.checkTransactionStatus(order.referenceId);
        if (check.ok && check.data) {
          const lipilaStatus = String(check.data.status).toLowerCase();
          if (lipilaStatus === 'successful') {
            const paid = markOrderAsPaid(order.referenceId, String(check.data.externalId || ''));
            if (paid && claimEmailSendingRights(paid.orderId)) {
              sendOrderConfirmationEmail(paid).catch(err => {
                console.error(`[StatusCheck] Error sending confirmation email for ${paid.orderId}:`, err);
              });
            }
            return jsonResponse(200, { order: paid }, requestOrigin);
          } else if (lipilaStatus === 'failed') {
            const failed = markOrderAsFailed(order.referenceId, check.data.message);
            return jsonResponse(200, { order: failed }, requestOrigin);
          }
        }
      }

      return jsonResponse(200, { order }, requestOrigin);
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
