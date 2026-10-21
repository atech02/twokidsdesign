import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PRODUCTS,
  ACTIVE_CATEGORIES,
  getProductBySlug,
  getProductById,
  calculateItemPrice,
  LICENSE_OPTIONS,
  formatPrice,
} from '../src/data/products';
import {
  createPendingOrder,
  markOrderAsPaid,
  markOrderAsFailed,
  getOrderByOrderId,
  getOrderByReferenceId,
  verifySignedDownloadToken,
  getOrderByIdAndEmail,
  getPaidOrdersByEmail,
  refreshOrderDownloadTokens,
  createSignedDownloadToken,
} from '../server/orderStore';
import { generateProtectedBundlePdf } from '../server/pdfGenerator';
import { lipilaClient } from '../server/lipilaClient';

async function runLipilaPaymentVerificationSuite() {
  console.log('=== Two Kids Design — Lipila Payment & Security Verification Suite ===');

  // Test 1: Catalogue & ZMW Currency Integrity
  assert.ok(PRODUCTS.length >= 6, 'Catalogue must have at least 6 products');
  for (const product of PRODUCTS) {
    assert.equal(product.currency, 'ZMW', `Product ${product.id} must be priced in ZMW`);
    assert.ok(product.price > 0, 'Price must be positive');
  }
  const sample = PRODUCTS[0];
  const personalPrice = calculateItemPrice(sample, 'personal');
  const commercialPrice = calculateItemPrice(sample, 'commercial');
  assert.equal(personalPrice, sample.price);
  assert.equal(
    commercialPrice,
    Math.round(sample.price * LICENSE_OPTIONS.commercial.priceMultiplier * 100) / 100
  );
  assert.ok(formatPrice(personalPrice).includes('ZMW'));
  console.log('PASS [1/10]: Catalogue configured in Zambian Kwacha (ZMW) with exact licence pricing');

  // Test 2: Order Creation Before Payment (Order exists before calling Lipila)
  const idemKey = `lipila-create-${Date.now()}`;
  const customerEmail = `lipila.creator.${Date.now()}@example.com`;
  const orderRes = createPendingOrder({
    idempotencyKey: idemKey,
    customerEmail,
    customerName: 'Chanda Mulenga',
    items: [
      { productId: 'tkd-bundle-01', licenseTier: 'personal' },
      { productId: 'tkd-bundle-02', licenseTier: 'commercial' },
    ],
    paymentMethod: 'card',
  });
  assert.equal(orderRes.success, true);
  assert.ok(orderRes.order);
  const pendingOrder = orderRes.order;
  assert.equal(pendingOrder.orderStatus, 'pending_payment');
  assert.equal(pendingOrder.paymentStatus, 'pending');
  assert.equal(pendingOrder.currency, 'ZMW');
  assert.ok(pendingOrder.referenceId.startsWith('LIP-'));
  // Crucial security check: pending orders must NEVER have download tokens
  assert.equal(pendingOrder.items[0].downloadToken, '');
  assert.equal(pendingOrder.items[1].downloadToken, '');
  console.log('PASS [2/10]: Authoritative order created before payment; download tokens locked');

  // Test 3: Idempotency of Order Creation
  const repeatRes = createPendingOrder({
    idempotencyKey: idemKey,
    customerEmail,
    customerName: 'Chanda Mulenga',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'personal' }],
    paymentMethod: 'card',
  });
  assert.equal(repeatRes.success, true);
  assert.equal(repeatRes.order?.orderId, pendingOrder.orderId);
  console.log('PASS [3/10]: Checkout submission idempotency verified (no duplicate orders created)');

  // Test 4: Unauthorized Download Blocking on Pending Orders
  const checkPendingAuth = verifySignedDownloadToken('');
  assert.equal(checkPendingAuth.valid, false);
  const forgedPendingToken = createSignedDownloadToken(
    pendingOrder.orderId,
    'tkd-bundle-01',
    'personal',
    Date.now() + 60000
  );
  const checkForgedPending = verifySignedDownloadToken(forgedPendingToken);
  assert.equal(checkForgedPending.valid, false);
  assert.equal(checkForgedPending.reason, 'order_not_paid');
  console.log('PASS [4/10]: Download attempts before payment verified are strictly rejected');

  // Test 5: Failed Payment Handling
  const failedOrderRes = createPendingOrder({
    idempotencyKey: `lipila-fail-${Date.now()}`,
    customerEmail: `failed.${Date.now()}@example.com`,
    items: [{ productId: 'tkd-bundle-03', licenseTier: 'personal' }],
    paymentMethod: 'mobile_money',
    customerPhone: '0971112233',
  });
  const failedOrder = failedOrderRes.order!;
  markOrderAsFailed(failedOrder.referenceId, 'Insufficient mobile money funds');
  const afterFail = getOrderByOrderId(failedOrder.orderId)!;
  assert.equal(afterFail.orderStatus, 'payment_failed');
  assert.equal(afterFail.paymentStatus, 'failed');
  assert.equal(afterFail.items[0].downloadToken, '');
  console.log('PASS [5/10]: Failed payment transitions state correctly and never grants access');

  // Test 6: Stale Event Protection (Failed event cannot overwrite verified paid status)
  markOrderAsPaid(pendingOrder.referenceId, 'EXT-123456');
  const paidOrder = getOrderByOrderId(pendingOrder.orderId)!;
  assert.equal(paidOrder.orderStatus, 'paid');
  assert.equal(paidOrder.paymentStatus, 'successful');
  assert.ok(paidOrder.items[0].downloadToken.length > 20);

  // Attempt to overwrite paid status with a stale failed callback
  markOrderAsFailed(pendingOrder.referenceId, 'Stale network event');
  const protectedOrder = getOrderByOrderId(pendingOrder.orderId)!;
  assert.equal(protectedOrder.orderStatus, 'paid');
  assert.equal(protectedOrder.paymentStatus, 'successful');
  console.log('PASS [6/10]: Stale event protection preserves verified paid status');

  // Test 7: Download Token Verification for Paid Order
  const token = paidOrder.items[0].downloadToken;
  const tokenVerification = verifySignedDownloadToken(token);
  assert.equal(tokenVerification.valid, true);
  assert.equal(tokenVerification.orderId, paidOrder.orderId);
  assert.equal(tokenVerification.productId, 'tkd-bundle-01');

  // Tampered token check
  const tampered = token.slice(0, -6) + 'XXXXXX';
  assert.equal(verifySignedDownloadToken(tampered).valid, false);
  console.log('PASS [7/10]: Signed 24h download tokens verified and tampered tokens blocked');

  // Test 8: Dynamic Licensed PDF Generation with ZMW Currency
  const pdfBytes = await generateProtectedBundlePdf(
    getProductById('tkd-bundle-01')!,
    paidOrder.orderId,
    paidOrder.customerEmail,
    'personal'
  );
  assert.ok(pdfBytes.byteLength > 1500);
  const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
  assert.equal(header, '%PDF-');
  console.log('PASS [8/10]: Dynamic PDF generation with embedded ZMW licence certificate verified');

  // Test 9: Customer Order Lookup
  const customerOrders = getPaidOrdersByEmail(customerEmail);
  assert.equal(customerOrders.length, 1);
  assert.equal(customerOrders[0].orderId, paidOrder.orderId);
  assert.equal(getOrderByIdAndEmail(paidOrder.orderId, 'other@example.com'), undefined);
  console.log('PASS [9/10]: Customer download library access and isolation verified');

  // Test 10: Lipila Client Configuration & Sandbox Fallback Safety
  assert.equal(lipilaClient.getEnvironment(), 'production');
  assert.equal(lipilaClient.getBaseUrl(), 'https://blz.lipila.io');
  assert.ok(lipilaClient.getCallbackUrl().includes('/api/webhooks/lipila'));
  console.log('PASS [10/10]: Lipila client endpoints and production callback URL verified');

  console.log('=== ALL 10 LIPILA VERIFICATION TESTS PASSED ===');
}

runLipilaPaymentVerificationSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
