import type { IncomingMessage, ServerResponse } from 'node:http';
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

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, accept');
  res.end(JSON.stringify(data));
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function createApiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || '';
    if (!rawUrl.startsWith('/api/')) {
      next();
      return;
    }

    // Support CORS across all API endpoints
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, accept');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = new URL(rawUrl, 'http://localhost');
    const pathname = url.pathname;

    try {
      // 0a. GET /api/health (Service Health Check)
      if (req.method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          service: 'Two Kids Design Backend API',
        });
        return;
      }

      // 0b. GET /api/diagnostics (Sanitized Configuration Check — Secrets never exposed)
      if (req.method === 'GET' && pathname === '/api/diagnostics') {
        sendJson(res, 200, {
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
        });
        return;
      }

      // 0c. POST /api/diagnostics/lipila-connectivity (Outbound Connectivity Ping to Lipila Gateway)
      if (req.method === 'POST' && pathname === '/api/diagnostics/lipila-connectivity') {
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
          sendJson(res, 200, {
            success: true,
            target: lipilaClient.getBaseUrl(),
            reachable: true,
            statusCode: pingRes.status,
            latencyMs,
          });
          return;
        } catch (err) {
          sendJson(res, 502, {
            success: false,
            target: lipilaClient.getBaseUrl(),
            reachable: false,
            error: err instanceof Error ? err.message : 'Unable to reach Lipila gateway.',
          });
          return;
        }
      }

      // 1. GET /api/products
      if (req.method === 'GET' && pathname === '/api/products') {
        const published = PRODUCTS.filter(p => p.publicationStatus === 'published');
        sendJson(res, 200, { products: published });
        return;
      }

      // 2. GET /api/products/:slug
      if (req.method === 'GET' && pathname.startsWith('/api/products/')) {
        const slug = pathname.replace('/api/products/', '');
        const product = getProductBySlug(slug);
        if (!product) {
          sendJson(res, 404, { error: 'Product not found' });
          return;
        }
        sendJson(res, 200, { product });
        return;
      }

      // 3. POST /api/checkout/create (Order created BEFORE payment is initiated)
      if (req.method === 'POST' && pathname === '/api/checkout/create') {
        const body = await readJsonBody(req);
        const result = createPendingOrder({
          idempotencyKey: String(body.idempotencyKey || ''),
          customerEmail: String(body.customerEmail || ''),
          customerName: String(body.customerName || ''),
          items: Array.isArray(body.items) ? body.items : [],
          paymentMethod: (body.paymentMethod as PaymentMethodType) || 'card',
          customerPhone: body.customerPhone ? String(body.customerPhone) : undefined,
        });

        if (!result.success || !result.order) {
          sendJson(res, 400, { success: false, error: result.error });
          return;
        }

        sendJson(res, 200, { success: true, order: result.order });
        return;
      }

      // 4. POST /api/payments/lipila/card (Initiates Card Collection with Lipila)
      if (req.method === 'POST' && pathname === '/api/payments/lipila/card') {
        const body = await readJsonBody(req);
        const orderId = String(body.orderId || '');
        const order = getOrderByOrderId(orderId);

        if (!order) {
          sendJson(res, 404, { success: false, error: 'Order not found for card payment.' });
          return;
        }

        if (order.orderStatus === 'paid') {
          sendJson(res, 200, { success: true, order, message: 'Order is already paid.' });
          return;
        }

        const origin = req.headers.origin || `http://${req.headers.host || 'localhost:5173'}`;
        const backUrl = `${origin}/order-confirmation/${encodeURIComponent(order.orderId)}`;

        // Map customer names safely for Lipila requirements
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
          sendJson(res, 502, {
            success: false,
            error:
              lipilaResult.error ||
              'Lipila card checkout initialization failed. Please try again or use mobile money.',
            referenceId: order.referenceId,
          });
          return;
        }

        setOrderCardRedirectionUrl(order.orderId, lipilaResult.data.cardRedirectionUrl);

        sendJson(res, 200, {
          success: true,
          orderId: order.orderId,
          referenceId: order.referenceId,
          cardRedirectionUrl: lipilaResult.data.cardRedirectionUrl,
        });
        return;
      }

      // 5. POST /api/payments/lipila/mobile-money (Initiates Mobile-Money Prompt with Lipila)
      if (req.method === 'POST' && pathname === '/api/payments/lipila/mobile-money') {
        const body = await readJsonBody(req);
        const orderId = String(body.orderId || '');
        const accountNumber = String(body.accountNumber || '').replace(/[\s+-]/g, '');

        const order = getOrderByOrderId(orderId);
        if (!order) {
          sendJson(res, 404, { success: false, error: 'Order not found for mobile money payment.' });
          return;
        }

        const cleanDigits = accountNumber.replace(/[^\d]/g, '');
        if (!cleanDigits || cleanDigits.length < 9 || cleanDigits.length > 15) {
          sendJson(res, 400, {
            success: false,
            error: 'Please enter a valid Zambian mobile money number (e.g. 0971234567 or 260971234567).',
          });
          return;
        }

        // Standardize Zambian mobile numbers to 260... if entered as local 09... or 07...
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
          sendJson(res, clientStatus, {
            success: false,
            error:
              lipilaResult.error ||
              'Lipila mobile money collection request failed. Please check the number and try again.',
          });
          return;
        }

        sendJson(res, 200, {
          success: true,
          orderId: order.orderId,
          referenceId: order.referenceId,
          message:
            lipilaResult.data.message ||
            'Payment prompt sent to your mobile phone. Please check and approve the transaction.',
        });
        return;
      }

      // 6. POST /api/webhooks/lipila (Public HTTPS Callback Endpoint)
      if (req.method === 'POST' && pathname === '/api/webhooks/lipila') {
        const payload = await readJsonBody(req);
        const referenceId = String(payload.referenceId || '');

        if (!referenceId) {
          sendJson(res, 400, { error: 'Missing referenceId in callback payload' });
          return;
        }

        const order = getOrderByReferenceId(referenceId);
        if (!order) {
          // Reject unknown or unmatched references without granting access
          sendJson(res, 404, { error: 'Unrecognized transaction reference' });
          return;
        }

        // Reconcile status with Lipila's official check-status endpoint before releasing files
        let finalStatus = String(payload.status || '');
        let externalId = String(payload.externalId || payload.identifier || '');

        if (lipilaClient.hasApiKey()) {
          const statusCheck = await lipilaClient.checkTransactionStatus(referenceId);
          if (statusCheck.ok && statusCheck.data) {
            finalStatus = statusCheck.data.status;
            externalId = String(statusCheck.data.externalId || externalId);

            // Compare reported amount and currency against expected order
            const reportedAmount = Number(statusCheck.data.amount);
            if (!Number.isNaN(reportedAmount) && reportedAmount !== order.total) {
              markOrderAsFailed(referenceId, 'Amount mismatch detected during status reconciliation');
              sendJson(res, 400, { error: 'Amount mismatch' });
              return;
            }
          }
        }

        if (finalStatus.toLowerCase() === 'successful') {
          const updated = markOrderAsPaid(referenceId, externalId);
          if (updated && claimEmailSendingRights(updated.orderId)) {
            // Asynchronously dispatch confirmation email without blocking webhook response
            sendOrderConfirmationEmail(updated).catch(err => {
              console.error(`[Webhook] Error sending confirmation email for ${updated.orderId}:`, err);
            });
          }
          sendJson(res, 200, { success: true, orderId: updated?.orderId, status: 'paid' });
          return;
        } else if (finalStatus.toLowerCase() === 'failed') {
          markOrderAsFailed(referenceId, String(payload.message || 'Payment failed'));
          sendJson(res, 200, { success: true, status: 'failed' });
          return;
        } else {
          // Pending or unrecognized status: retain pending state, do not grant access
          sendJson(res, 200, { success: true, status: 'pending' });
          return;
        }
      }

      // 7. GET /api/orders/:orderId/status (Checks order status & reconciles with Lipila if pending)
      if (req.method === 'GET' && pathname.startsWith('/api/orders/') && pathname.endsWith('/status')) {
        const orderId = pathname.replace('/api/orders/', '').replace('/status', '');
        const order = getOrderByOrderId(orderId);

        if (!order) {
          sendJson(res, 404, { error: 'Order not found' });
          return;
        }

        // If order is still pending, check Lipila check-status endpoint to reconcile
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
              sendJson(res, 200, { order: paid });
              return;
            } else if (lipilaStatus === 'failed') {
              const failed = markOrderAsFailed(order.referenceId, check.data.message);
              sendJson(res, 200, { order: failed });
              return;
            }
          }
        }

        sendJson(res, 200, { order });
        return;
      }

      // 7b. POST /api/orders/:orderId/resend-email (Manual Resend with Rate Limiting)
      if (req.method === 'POST' && pathname.startsWith('/api/orders/') && pathname.endsWith('/resend-email')) {
        const orderId = pathname.replace('/api/orders/', '').replace('/resend-email', '');
        const body = await readJsonBody(req);
        const email = String(body.email || '').trim().toLowerCase();

        const order = getOrderByOrderId(orderId);
        if (!order) {
          sendJson(res, 404, { success: false, error: 'Order not found.' });
          return;
        }

        // Security check: Must be paid and email must match order customerEmail
        if (order.orderStatus !== 'paid' || order.paymentStatus !== 'successful') {
          sendJson(res, 400, {
            success: false,
            error: 'Confirmation emails can only be sent for verified paid orders.',
          });
          return;
        }

        if (email && order.customerEmail.toLowerCase() !== email) {
          sendJson(res, 403, {
            success: false,
            error: 'Email address does not match this order record.',
          });
          return;
        }

        const canClaim = claimEmailSendingRights(order.orderId, true);
        if (!canClaim) {
          sendJson(res, 429, {
            success: false,
            error: 'A confirmation email was sent recently. Please wait a minute before requesting another.',
          });
          return;
        }

        const emailResult = await sendOrderConfirmationEmail(order);
        if (!emailResult.success) {
          sendJson(res, 502, {
            success: false,
            error: emailResult.error || 'Failed to dispatch email via Resend.',
          });
          return;
        }

        sendJson(res, 200, {
          success: true,
          message: `Confirmation email re-sent to ${order.customerEmail}.`,
          messageId: emailResult.messageId,
        });
        return;
      }

      // 8. GET /api/orders/lookup?email=...&orderId=...
      if (req.method === 'GET' && pathname === '/api/orders/lookup') {
        const email = (url.searchParams.get('email') || '').trim();
        const orderId = (url.searchParams.get('orderId') || '').trim();

        if (!email) {
          sendJson(res, 400, { error: 'Please enter the email address used during checkout.' });
          return;
        }

        if (orderId) {
          const singleOrder = getOrderByIdAndEmail(orderId, email);
          if (!singleOrder) {
            sendJson(res, 404, {
              error: 'No verified paid order found matching that Order ID and email address.',
            });
            return;
          }
          sendJson(res, 200, { orders: [singleOrder] });
          return;
        }

        const orders = getPaidOrdersByEmail(email);
        sendJson(res, 200, { orders });
        return;
      }

      // 9. POST /api/orders/refresh-token
      if (req.method === 'POST' && pathname === '/api/orders/refresh-token') {
        const body = await readJsonBody(req);
        const orderId = String(body.orderId || '');
        const email = String(body.email || '');
        const updated = refreshOrderDownloadTokens(orderId, email);
        if (!updated) {
          sendJson(res, 403, {
            error: 'Unable to verify order entitlement to refresh download links.',
          });
          return;
        }
        sendJson(res, 200, { order: updated });
        return;
      }

      // 10. GET /api/download/:token (Protected PDF Delivery)
      if (req.method === 'GET' && pathname.startsWith('/api/download/')) {
        const token = decodeURIComponent(pathname.replace('/api/download/', ''));
        const verification = verifySignedDownloadToken(token);

        if (!verification.valid || !verification.productId || !verification.orderId || !verification.order) {
          const status = verification.reason === 'expired' ? 410 : 403;
          const message =
            verification.reason === 'expired'
              ? 'This secure download link has expired. You can generate a fresh 24-hour download link anytime from your Customer Downloads page using your email and Order ID.'
              : 'Unauthorized download request. This link is invalid, tampered with, or the order was not verified as paid.';
          sendJson(res, status, {
            error: message,
            reason: verification.reason,
          });
          return;
        }

        const product = getProductById(verification.productId);
        if (!product) {
          sendJson(res, 404, { error: 'Digital bundle file no longer available.' });
          return;
        }

        const pdfBytes = await generateProtectedBundlePdf(
          product,
          verification.orderId,
          verification.order.customerEmail,
          verification.licenseTier || 'personal'
        );

        incrementItemDownloadCount(verification.orderId, product.id);

        const safeFilename = `${product.slug}-${verification.orderId}.pdf`;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.end(Buffer.from(pdfBytes));
        return;
      }

      sendJson(res, 404, { error: 'API route not found' });
    } catch (error) {
      sendJson(res, 500, {
        error: 'Internal server error processing payment or digital order request.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
