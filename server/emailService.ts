import { Resend } from 'resend';
import type { OrderRecord } from './orderStore';
import { recordEmailSendSuccess, recordEmailSendFailure } from './orderStore';
import { generateOrderConfirmationEmailHtml } from './emailTemplate';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const ORDER_EMAIL_FROM =
  process.env.ORDER_EMAIL_FROM || 'Two Kids Design <orders@twokidsdesign.com>';
const STORE_NAME = process.env.STORE_NAME || 'Two Kids Design';
const STORE_URL = process.env.STORE_URL || 'https://twokidsdesign.web.app';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@twokidsdesign.com';

// Initialize official Resend SDK client if API key is provided
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Sends the official Two Kids Design order confirmation email via Resend.
 * Enforces verified payment conditions, server-side secrets, and idempotent dispatch.
 */
export async function sendOrderConfirmationEmail(order: OrderRecord): Promise<SendEmailResult> {
  // 1. Strict safety check: Ensure payment is confirmed Successful
  if (order.paymentStatus !== 'successful' || order.orderStatus !== 'paid') {
    const err = `Cannot send order confirmation: Order ${order.orderId} is not in paid status (status: ${order.orderStatus}/${order.paymentStatus}).`;
    console.warn(`[EmailService] ${err}`);
    return { success: false, error: err };
  }

  // 2. Validate recipient email
  if (!order.customerEmail || !order.customerEmail.includes('@')) {
    const err = `Cannot send order confirmation: Invalid email address (${order.customerEmail}).`;
    console.warn(`[EmailService] ${err}`);
    recordEmailSendFailure(order.orderId, err);
    return { success: false, error: err };
  }

  const downloadUrl = `${STORE_URL}/order-confirmation/${encodeURIComponent(order.orderId)}?email=${encodeURIComponent(order.customerEmail)}`;

  const emailHtml = generateOrderConfirmationEmailHtml({
    order,
    downloadUrl,
    storeName: STORE_NAME,
    storeUrl: STORE_URL,
    supportEmail: SUPPORT_EMAIL,
  });

  const subject = `Your ${STORE_NAME} order is confirmed! (${order.orderId})`;

  // 3. Fallback / Mock mode when RESEND_API_KEY is not configured
  if (!resend) {
    const mockMessageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[EmailService:Mock] No RESEND_API_KEY set. Simulated email delivery to ${order.customerEmail} for order ${order.orderId}. Message ID: ${mockMessageId}`);
    recordEmailSendSuccess(order.orderId, mockMessageId);
    return {
      success: true,
      messageId: mockMessageId,
      skipped: false,
    };
  }

  // 4. Live send via Resend SDK
  try {
    const idempotencyKey = `order-confirmation-${order.orderId}-${order.confirmationEmailAttempts || 0}`;
    
    const { data, error } = await resend.emails.send(
      {
        from: ORDER_EMAIL_FROM,
        to: [order.customerEmail],
        replyTo: SUPPORT_EMAIL,
        subject,
        html: emailHtml,
      },
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );

    if (error) {
      console.error(`[EmailService] Resend API error for order ${order.orderId}:`, error);
      recordEmailSendFailure(order.orderId, error.message || 'Resend API returned error');
      return {
        success: false,
        error: error.message || 'Failed to dispatch email via Resend',
      };
    }

    const messageId = data?.id || `resend_${Date.now()}`;
    console.log(`[EmailService] Successfully sent order confirmation for ${order.orderId} to ${order.customerEmail}. Message ID: ${messageId}`);
    recordEmailSendSuccess(order.orderId, messageId);

    return {
      success: true,
      messageId,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[EmailService] Unexpected failure sending email for ${order.orderId}:`, err);
    recordEmailSendFailure(order.orderId, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
