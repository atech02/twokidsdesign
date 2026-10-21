import type { OrderRecord } from './orderStore';

export function generateOrderConfirmationEmailHtml(params: {
  order: OrderRecord;
  downloadUrl: string;
  storeName: string;
  storeUrl: string;
  supportEmail: string;
}): string {
  const { order, downloadUrl, storeName, storeUrl, supportEmail } = params;

  // Friendly greeting with customer's first name
  const nameParts = (order.customerName || 'Creator').trim().split(/\s+/);
  const firstName = nameParts[0] || 'Valued Creator';

  const orderDate = new Date(order.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const paymentMethodLabel =
    order.payment.method === 'card'
      ? 'Credit / Debit Card (Visa · Mastercard · Amex)'
      : 'Mobile Money';

  const itemsHtml = order.items
    .map(item => {
      return `
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #E9E7E2;">
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: bold; color: #202020; line-height: 1.3;">
            ${escapeHtml(item.productName)}
          </div>
          <div style="font-size: 12px; color: #2287B8; font-weight: 600; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
            ${escapeHtml(item.licenseName)} · ${item.verifiedPageCount} PDF Pages
          </div>
          <div style="font-size: 12px; color: #666666; margin-top: 2px;">
            Qty: 1 Digital Bundle
          </div>
        </td>
        <td style="padding: 16px 0; border-bottom: 1px solid #E9E7E2; text-align: right; vertical-align: top; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: bold; color: #202020;">
          ${order.currency} ${item.unitPrice.toFixed(2)}
        </td>
      </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${escapeHtml(storeName)} order is confirmed!</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #FAF8F3;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #202020;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border: 1px solid #E9E7E2;
      border-radius: 16px;
      overflow: hidden;
      margin-top: 24px;
      margin-bottom: 24px;
    }
    .button-link:hover {
      background-color: #2287B8 !important;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        margin: 0 !important;
        border-radius: 0 !important;
        border: none !important;
      }
      .content-padding {
        padding: 24px 20px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F3;">
  <div style="background-color: #FAF8F3; padding: 24px 12px;">
    <!-- Main Email Container -->
    <table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E9E7E2; border-radius: 16px; overflow: hidden;">
      
      <!-- Top Brand Header Bar -->
      <tr>
        <td style="background-color: #202020; padding: 20px 32px; text-align: left;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align: middle;">
                <span style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
                  Two Kids <span style="color: #38A3D6;">Design</span>
                </span>
                <div style="font-size: 11px; color: #A0A0A0; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">
                  Digital Creations · PDF Bundles
                </div>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <span style="display: inline-block; background-color: #38A3D6; color: #FFFFFF; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Verified Order
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Accent Cyan Stripe -->
      <tr>
        <td style="height: 4px; background-color: #38A3D6; font-size: 0; line-height: 0;">&nbsp;</td>
      </tr>

      <!-- Main Body Content -->
      <tr>
        <td class="content-padding" style="padding: 36px 32px;">
          <!-- Success Greeting -->
          <div style="margin-bottom: 24px;">
            <div style="font-size: 13px; font-weight: 700; color: #2287B8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
              Payment Successful — Order Confirmed
            </div>
            <h1 style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 800; color: #202020; margin: 0; line-height: 1.2;">
              Thank you, ${escapeHtml(firstName)}!
            </h1>
            <p style="font-size: 15px; color: #4A4A4A; line-height: 1.6; margin: 12px 0 0 0;">
              Thank you for shopping with Two Kids Design! Your payment has been confirmed, and your digital PDF designs are ready for instant access.
            </p>
          </div>

          <!-- Prominent Call to Action Button -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
            <tr>
              <td align="center" style="background-color: #FAF8F3; border: 1px dashed #38A3D6; border-radius: 12px; padding: 24px;">
                <div style="font-size: 13px; font-weight: 600; color: #202020; margin-bottom: 12px;">
                  Access your files anytime via your secure customer order link:
                </div>
                <a href="${escapeHtml(downloadUrl)}" class="button-link" style="display: inline-block; background-color: #202020; color: #FFFFFF; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(32,32,32,0.15);">
                  Download Your Files →
                </a>
                <div style="font-size: 11px; color: #777777; margin-top: 10px;">
                  100% digital PDF bundle download · US Letter &amp; A4 formats
                </div>
              </td>
            </tr>
          </table>

          <!-- Order Summary Metadata Box -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF8F3; border-radius: 10px; padding: 16px 20px; margin-bottom: 28px;">
            <tr>
              <td width="50%" style="font-size: 13px; color: #666666; padding-bottom: 6px;">
                Order Number: <strong style="color: #202020; font-family: monospace;">${escapeHtml(order.orderId)}</strong>
              </td>
              <td width="50%" style="font-size: 13px; color: #666666; padding-bottom: 6px; text-align: right;">
                Date: <strong style="color: #202020;">${orderDate}</strong>
              </td>
            </tr>
            <tr>
              <td width="50%" style="font-size: 13px; color: #666666;">
                Payment Method: <strong style="color: #202020;">${escapeHtml(paymentMethodLabel)}</strong>
              </td>
              <td width="50%" style="font-size: 13px; color: #666666; text-align: right;">
                Payment Ref: <strong style="color: #202020; font-family: monospace;">${escapeHtml(order.referenceId)}</strong>
              </td>
            </tr>
          </table>

          <!-- Purchased Items Table -->
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 700; color: #202020; margin-bottom: 8px;">
            Purchased Digital Bundles
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
            ${itemsHtml}
          </table>

          <!-- Financial Calculation Totals -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 2px solid #202020; padding-top: 12px; margin-bottom: 24px;">
            <tr>
              <td style="font-size: 14px; color: #666666; padding: 4px 0;">Subtotal</td>
              <td style="font-size: 14px; color: #202020; text-align: right; font-weight: 600; padding: 4px 0;">
                ${order.currency} ${order.subtotal.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td style="font-size: 14px; color: #666666; padding: 4px 0;">Digital Delivery (Instant Download)</td>
              <td style="font-size: 14px; color: #2287B8; text-align: right; font-weight: 600; padding: 4px 0;">FREE</td>
            </tr>
            <tr>
              <td style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 800; color: #202020; padding: 8px 0 0 0;">
                Total Paid
              </td>
              <td style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 800; color: #202020; text-align: right; padding: 8px 0 0 0;">
                ${order.currency} ${order.total.toFixed(2)}
              </td>
            </tr>
          </table>

          <!-- Digital Product Notice & Instructions -->
          <div style="background-color: #E3F3FA; border-left: 4px solid #38A3D6; padding: 14px 16px; border-radius: 4px; font-size: 13px; color: #202020; line-height: 1.5; margin-bottom: 24px;">
            <strong>Important Digital Product Notice:</strong> This purchase contains digital PDF files only. No physical package will be shipped. Your purchased files can be downloaded directly using the button above or retrieved at any time by entering your email (<strong>${escapeHtml(order.customerEmail)}</strong>) in our Customer Downloads library on our store.
          </div>

          <!-- Customer Support Contact -->
          <div style="font-size: 13px; color: #666666; line-height: 1.6;">
            Have questions about your files or need printing guidance? We are here to help! Simply reply to this email or contact us at <a href="mailto:${escapeHtml(supportEmail)}" style="color: #2287B8; font-weight: 600; text-decoration: underline;">${escapeHtml(supportEmail)}</a> with your order number (<strong>${escapeHtml(order.orderId)}</strong>).
          </div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background-color: #FAF8F3; border-top: 1px solid #E9E7E2; padding: 24px 32px; text-align: center; font-size: 12px; color: #777777; line-height: 1.5;">
          <p style="margin: 0 0 6px 0; font-weight: 600; color: #202020;">
            ${escapeHtml(storeName)} · Creative PDF Bundles for Crafters &amp; Creators
          </p>
          <p style="margin: 0;">
            <a href="${escapeHtml(storeUrl)}" style="color: #2287B8; text-decoration: none;">Visit Storefront</a> · 
            <a href="${escapeHtml(downloadUrl)}" style="color: #2287B8; text-decoration: none;">Customer Downloads</a>
          </p>
          <p style="margin: 10px 0 0 0; font-size: 11px; color: #999999;">
            © ${new Date().getFullYear()} Two Kids Design. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
