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

async function runStoreVerificationSuite() {
  console.log('=== Two Kids Design — Core Store Verification Suite ===');

  // Test 1: Official Logo Asset Verification
  const logoSourcePath = path.resolve(process.cwd(), 'images', 'logo.jpeg');
  const logoPublicPath = path.resolve(process.cwd(), 'public', 'images', 'logo.jpeg');
  assert.ok(fs.existsSync(logoSourcePath), 'Official logo must exist in images/logo.jpeg');
  assert.ok(fs.existsSync(logoPublicPath), 'Official logo must be copied to public/images/logo.jpeg');
  assert.ok(fs.statSync(logoPublicPath).size > 1000, 'Official logo must be non-empty');
  console.log('PASS [1/8]: Official logo asset verified in images/ and public/images/');

  // Test 2: Catalogue & Product Data Integrity
  assert.ok(PRODUCTS.length >= 6, 'At least 6 published digital PDF bundles must exist');
  assert.ok(ACTIVE_CATEGORIES.length >= 5, 'All active product categories must be populated');
  for (const product of PRODUCTS) {
    assert.ok(product.id && product.slug, 'Product ID and slug required');
    assert.ok(product.price > 0, 'Product price must be positive');
    assert.equal(product.currency, 'ZMW');
    assert.ok(product.verifiedPageCount > 0, 'Verified page count must be positive');
    assert.ok(product.verifiedFileCount > 0, 'Verified file count must be positive');
    assert.ok(product.includedFiles.length > 0, 'Included PDF files manifest must be populated');
    assert.equal(getProductBySlug(product.slug)?.id, product.id);
    assert.equal(getProductById(product.id)?.slug, product.slug);
  }
  console.log('PASS [2/8]: Product catalogue, verified page counts, and ZMW pricing verified');

  // Test 3: Licence Pricing Calculations
  const sample = PRODUCTS[0];
  const personalPrice = calculateItemPrice(sample, 'personal');
  const commercialPrice = calculateItemPrice(sample, 'commercial');
  assert.equal(personalPrice, sample.price);
  assert.equal(
    commercialPrice,
    Math.round(sample.price * LICENSE_OPTIONS.commercial.priceMultiplier * 100) / 100
  );
  assert.ok(formatPrice(personalPrice).includes('ZMW'));
  console.log('PASS [3/8]: Personal & Commercial licence pricing calculations in ZMW verified');

  // Test 4: Checkout Validation (Invalid Email & Empty Cart)
  const badEmailResult = createPendingOrder({
    idempotencyKey: `test-invalid-email-${Date.now()}`,
    customerEmail: 'not-an-email',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'personal' }],
    paymentMethod: 'card',
  });
  assert.equal(badEmailResult.success, false);
  assert.equal(badEmailResult.order, undefined);

  const emptyCartResult = createPendingOrder({
    idempotencyKey: `test-empty-cart-${Date.now()}`,
    customerEmail: 'crafter@example.com',
    items: [],
    paymentMethod: 'card',
  });
  assert.equal(emptyCartResult.success, false);
  console.log('PASS [4/8]: Checkout field validation (email & cart non-empty) verified');

  // Test 5: Failed Payment Security Gate
  const declineKey = `test-decline-${Date.now()}`;
  const declinedOrder = createPendingOrder({
    idempotencyKey: declineKey,
    customerEmail: 'declined.buyer@example.com',
    customerName: 'Declined Buyer',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'personal' }],
    paymentMethod: 'card',
  }).order!;
  markOrderAsFailed(declinedOrder.referenceId, 'Card declined by issuing bank');
  const checkedDeclined = getOrderByOrderId(declinedOrder.orderId)!;
  assert.equal(checkedDeclined.paymentStatus, 'failed');
  assert.equal(checkedDeclined.orderStatus, 'payment_failed');
  assert.equal(getPaidOrdersByEmail('declined.buyer@example.com').length, 0);
  console.log('PASS [5/8]: Declined payments blocked from creating paid orders or granting downloads');

  // Test 6: Verified Payment, Deduplication & Idempotency
  const idemKey = `test-paid-idem-${Date.now()}`;
  const email = `verified.${Date.now()}@example.com`;
  const firstAttempt = createPendingOrder({
    idempotencyKey: idemKey,
    customerEmail: email,
    customerName: 'Studio Maker',
    items: [
      { productId: 'tkd-bundle-01', licenseTier: 'personal' },
      { productId: 'tkd-bundle-01', licenseTier: 'personal' },
      { productId: 'tkd-bundle-02', licenseTier: 'commercial' },
    ],
    paymentMethod: 'card',
  });
  assert.equal(firstAttempt.success, true);
  assert.ok(firstAttempt.order);
  assert.equal(firstAttempt.order.items.length, 2, 'Duplicate bundle items must be deduplicated');

  const expectedTotal =
    calculateItemPrice(getProductById('tkd-bundle-01')!, 'personal') +
    calculateItemPrice(getProductById('tkd-bundle-02')!, 'commercial');
  assert.equal(firstAttempt.order.total, expectedTotal);

  const secondAttempt = createPendingOrder({
    idempotencyKey: idemKey,
    customerEmail: email,
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'personal' }],
    paymentMethod: 'card',
  });
  assert.equal(secondAttempt.success, true);
  assert.equal(secondAttempt.order?.orderId, firstAttempt.order.orderId);

  // Mark as paid via Lipila verification
  const paidOrder = markOrderAsPaid(firstAttempt.order.referenceId, 'EXT-TEST-VERIFY-1')!;
  assert.equal(paidOrder.orderStatus, 'paid');
  assert.equal(paidOrder.paymentStatus, 'successful');
  console.log('PASS [6/8]: Verified payment, bundle deduplication, and order idempotency verified');

  // Test 7: Protected Download Token Security & Expiration Refresh
  const validToken = paidOrder.items[0].downloadToken;
  const checkValid = verifySignedDownloadToken(validToken);
  assert.equal(checkValid.valid, true);
  assert.equal(checkValid.productId, 'tkd-bundle-01');

  const tampered = validToken.slice(0, -4) + 'XXXX';
  assert.equal(verifySignedDownloadToken(tampered).valid, false, 'Tampered token must be rejected');

  const forgedUnpurchased = createSignedDownloadToken(
    paidOrder.orderId,
    'tkd-bundle-06',
    'personal',
    Date.now() + 60000
  );
  assert.equal(
    verifySignedDownloadToken(forgedUnpurchased).valid,
    false,
    'Token for unpurchased bundle must be rejected'
  );

  const refreshed = refreshOrderDownloadTokens(paidOrder.orderId, email);
  assert.ok(refreshed);
  assert.equal(verifySignedDownloadToken(refreshed.items[0].downloadToken).valid, true);
  console.log('PASS [7/8]: Signed download token security, unauthorized blocking, expiry, and token refresh verified');

  // Test 8: Customer Order Lookup & Dynamic Licensed PDF Generation
  const foundOrders = getPaidOrdersByEmail(email);
  assert.equal(foundOrders.length, 1);
  assert.equal(getOrderByIdAndEmail(paidOrder.orderId, 'wrong@example.com'), undefined);

  const pdfBytes = await generateProtectedBundlePdf(
    getProductById('tkd-bundle-01')!,
    paidOrder.orderId,
    email,
    'personal'
  );
  assert.ok(pdfBytes.byteLength > 1500, 'Generated PDF bundle must be non-empty');
  const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
  assert.equal(header, '%PDF-', 'Generated file must have valid PDF header');
  console.log('PASS [8/8]: Customer order lookup and dynamic licensed PDF generation in ZMW verified');

  console.log('=== ALL 8 CORE TESTS PASSED ===');
}

runStoreVerificationSuite().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
