import assert from 'node:assert/strict';
import netlifyV2Handler from '../netlify/functions/api';
import {
  createPendingOrder,
  markOrderAsPaid,
  markOrderAsFailed,
  getOrderByOrderId,
  verifySignedDownloadToken,
} from '../server/orderStore';
import { reconcileOrderStatusWithLipila } from '../server/coreApiHandler';

async function runCardPaymentTests() {
  console.log('=== Two Kids Design — Card Payment & Reconciliation Audit Test Suite ===\n');

  // --------------------------------------------------------------------------
  // TEST 1: Local Zambian Customer Card Checkout Initiation
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Local Zambian Customer Card Checkout ---');
  const createReq1 = new Request('https://twokidsdesign2.netlify.app/api/checkout/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: `CARD-TEST-LOCAL-${Date.now()}`,
      customerEmail: 'local.creator@example.com',
      customerName: 'Mutale Mwila',
      items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
      paymentMethod: 'card',
      customerPhone: '0977123456',
      customerCountry: 'Zambia',
      customerCity: 'Lusaka',
    }),
  });
  const createRes1 = await netlifyV2Handler(createReq1);
  assert.equal(createRes1.status, 200);
  const createData1 = await createRes1.json();
  assert.ok(createData1.success);
  assert.equal(createData1.order.currency, 'ZMW');
  assert.equal(createData1.order.orderStatus, 'pending_payment');
  assert.equal(createData1.order.customerCountry, 'Zambia');
  // Downloads must NOT be granted
  assert.equal(createData1.order.items[0].downloadToken, '');

  // Initiate Card Payment
  const cardReq1 = new Request('https://twokidsdesign2.netlify.app/api/payments/lipila/card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: createData1.order.orderId }),
  });
  const cardRes1 = await netlifyV2Handler(cardReq1);
  assert.equal(cardRes1.status, 200);
  const cardData1 = await cardRes1.json();
  assert.ok(cardData1.success);
  assert.ok(cardData1.cardRedirectionUrl, 'Must return card redirection URL');
  console.log('PASS [Test 1]: Local card checkout initiates with ZMW currency, secure redirect, and locked downloads.\n');

  // --------------------------------------------------------------------------
  // TEST 2: International Customer Card Checkout Data Validation & Clean Phone
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: International Customer Card Checkout ---');
  const createReq2 = new Request('https://twokidsdesign2.netlify.app/api/checkout/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: `CARD-TEST-INTL-${Date.now()}`,
      customerEmail: 'intl.designer@example.co.uk',
      customerName: 'Sarah Jenkins',
      items: [{ productId: 'tkd-bundle-02', licenseTier: 'commercial' }],
      paymentMethod: 'card',
      customerPhone: '+44 7911 123456',
      customerCountry: 'United Kingdom',
      customerCity: 'London',
      customerAddress: '10 Downing Street',
      customerZip: 'SW1A 2AA',
    }),
  });
  const createRes2 = await netlifyV2Handler(createReq2);
  assert.equal(createRes2.status, 200);
  const createData2 = await createRes2.json();
  assert.ok(createData2.success);
  assert.equal(createData2.order.currency, 'ZMW', 'Currency must remain ZMW on backend');
  assert.equal(createData2.order.customerCountry, 'United Kingdom');
  assert.equal(createData2.order.customerCity, 'London');

  // Initiate Card Payment for International Customer
  const cardReq2 = new Request('https://twokidsdesign2.netlify.app/api/payments/lipila/card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: createData2.order.orderId }),
  });
  const cardRes2 = await netlifyV2Handler(cardReq2);
  assert.equal(cardRes2.status, 200);
  const cardData2 = await cardRes2.json();
  assert.ok(cardData2.success);
  assert.ok(cardData2.cardRedirectionUrl);
  console.log('PASS [Test 2]: International customer metadata preserved, currency locked to ZMW, redirect generated.\n');

  // --------------------------------------------------------------------------
  // TEST 3: UNAUTHORIZED_CARD Provider Decline Handling
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: UNAUTHORIZED_CARD Provider Decline Reconciliation ---');
  const orderRes3 = createPendingOrder({
    idempotencyKey: `CARD-TEST-UNAUTH-${Date.now()}`,
    customerEmail: 'declined.card@example.com',
    customerName: 'James Wilson',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'card',
    customerCountry: 'United States',
  });
  const order3 = orderRes3.order!;
  assert.ok(order3);

  // Simulate gateway returning UNAUTHORIZED_CARD status
  const unauthReconcile = await reconcileOrderStatusWithLipila(order3.orderId, {
    status: 'Failed',
    externalId: 'LPLXC-CARD-UNAUTH-001',
    message: 'UNAUTHORIZED_CARD: Card transaction blocked by acquiring bank or network',
  });

  assert.equal(unauthReconcile.paymentStatus, 'failed');
  assert.equal(unauthReconcile.orderStatus, 'payment_failed');
  assert.equal(unauthReconcile.failureReason, 'UNAUTHORIZED_CARD');
  assert.ok(
    unauthReconcile.message?.includes('UNAUTHORIZED_CARD') ||
    unauthReconcile.message?.includes('Unauthorized Card'),
    'Must preserve provider UNAUTHORIZED_CARD diagnostic information'
  );

  // Confirm download tokens remain strictly locked
  const updatedOrder3 = getOrderByOrderId(order3.orderId);
  assert.equal(updatedOrder3?.orderStatus, 'payment_failed');
  assert.equal(updatedOrder3?.items[0].downloadToken, '');
  console.log('PASS [Test 3]: UNAUTHORIZED_CARD decline classified correctly, error preserved, downloads remain locked.\n');

  // --------------------------------------------------------------------------
  // TEST 4: Standard Card Decline (CARD_DECLINED)
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: Standard Card Decline (CARD_DECLINED) ---');
  const orderRes4 = createPendingOrder({
    idempotencyKey: `CARD-TEST-DECLINE-${Date.now()}`,
    customerEmail: 'declined2@example.com',
    customerName: 'Chanda Mulenga',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'card',
    customerCountry: 'Zambia',
  });
  const order4 = orderRes4.order!;

  const declineReconcile = await reconcileOrderStatusWithLipila(order4.orderId, {
    status: 'Declined',
    message: 'Card transaction was declined by issuing bank',
  });

  assert.equal(declineReconcile.paymentStatus, 'failed');
  assert.equal(declineReconcile.orderStatus, 'payment_failed');
  assert.equal(declineReconcile.failureReason, 'CARD_DECLINED');
  assert.ok(
    !declineReconcile.message?.includes('mobile device'),
    'Card decline message must NOT reference mobile device prompt'
  );
  console.log('PASS [Test 4]: Card decline classified without false mobile-money messaging.\n');

  // --------------------------------------------------------------------------
  // TEST 5: Card Session Cancellation (PAYMENT_CANCELLED)
  // --------------------------------------------------------------------------
  console.log('--- TEST 5: Card Session Cancellation ---');
  const orderRes5 = createPendingOrder({
    idempotencyKey: `CARD-TEST-CANCEL-${Date.now()}`,
    customerEmail: 'cancelled.card@example.com',
    customerName: 'Cancelled User',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'card',
    customerCountry: 'Zambia',
  });
  const order5 = orderRes5.order!;

  const cancelReconcile = await reconcileOrderStatusWithLipila(order5.orderId, {
    status: 'Cancelled',
    message: 'User cancelled card transaction on hosted page',
  });

  assert.equal(cancelReconcile.paymentStatus, 'failed');
  assert.equal(cancelReconcile.orderStatus, 'payment_failed');
  assert.equal(cancelReconcile.failureReason, 'PAYMENT_CANCELLED');
  console.log('PASS [Test 5]: Card cancellation handled cleanly.\n');

  // --------------------------------------------------------------------------
  // TEST 6: Successful Card Payment Verification & Token Unlocking
  // --------------------------------------------------------------------------
  console.log('--- TEST 6: Successful Card Payment Verification ---');
  const orderRes6 = createPendingOrder({
    idempotencyKey: `CARD-TEST-SUCCESS-${Date.now()}`,
    customerEmail: 'success.card@example.com',
    customerName: 'Happy Cardholder',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'commercial' }],
    paymentMethod: 'card',
    customerCountry: 'Zambia',
  });
  const order6 = orderRes6.order!;

  const successReconcile = await reconcileOrderStatusWithLipila(order6.orderId, {
    status: 'Successful',
    externalId: 'LPLXC-CARD-PAID-7788',
    message: 'Card payment authorized and debited successfully',
  });

  assert.equal(successReconcile.paymentStatus, 'successful');
  assert.equal(successReconcile.orderStatus, 'paid');
  const paidOrder6 = getOrderByOrderId(order6.orderId);
  assert.ok(paidOrder6);
  assert.equal(paidOrder6.orderStatus, 'paid');
  const token = paidOrder6.items[0].downloadToken;
  assert.ok(token && token.length > 20, 'Download token must be generated upon payment');

  // Verify HMAC-signed download token
  const tokenVerification = verifySignedDownloadToken(token);
  assert.equal(tokenVerification.valid, true, 'Download token must be cryptographically valid');
  assert.equal(tokenVerification.orderId, order6.orderId);
  console.log('PASS [Test 6]: Successful card payment unlocks valid cryptographic download tokens.\n');

  // --------------------------------------------------------------------------
  // TEST 7: Download Security — Unverified / Failed Orders Denied
  // --------------------------------------------------------------------------
  console.log('--- TEST 7: Download Security Verification ---');
  // Attempting to download with empty or fabricated token
  const invalidTokenCheck = verifySignedDownloadToken('fake-token-attempt');
  assert.equal(invalidTokenCheck.valid, false);

  // Attempting to access download for an unpaid order
  const orderRes7 = createPendingOrder({
    idempotencyKey: `CARD-TEST-UNPAID-${Date.now()}`,
    customerEmail: 'unpaid@example.com',
    customerName: 'Unpaid Customer',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'card',
  });
  assert.equal(orderRes7.order?.items[0].downloadToken, '');
  console.log('PASS [Test 7]: Unpaid and failed orders are strictly prevented from downloading files.\n');

  // --------------------------------------------------------------------------
  // TEST 8: Mobile Money Regression Check
  // --------------------------------------------------------------------------
  console.log('--- TEST 8: Mobile Money Regression Check ---');
  const momoOrderRes = createPendingOrder({
    idempotencyKey: `MOMO-REGRESSION-${Date.now()}`,
    customerEmail: 'airtel.user@example.com',
    customerName: 'Airtel Regression Test',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'mobile_money',
    customerPhone: '260978999999',
  });
  const momoOrder = momoOrderRes.order!;

  const momoFailReconcile = await reconcileOrderStatusWithLipila(momoOrder.orderId, {
    status: 'Failed',
    message: 'INSUFFICIENT_FUNDS: Customer wallet balance is below transaction total',
  });
  assert.equal(momoFailReconcile.failureReason, 'INSUFFICIENT_FUNDS');
  assert.ok(momoFailReconcile.message?.includes('Airtel Money'));
  console.log('PASS [Test 8]: Mobile Money reconciliation remains fully functional without regression.\n');

  // --------------------------------------------------------------------------
  // TEST 9: Failed Card Payment Followed by Card Retry
  // --------------------------------------------------------------------------
  console.log('--- TEST 9: Failed Card Payment Followed by Card Retry ---');
  const orderRes9 = createPendingOrder({
    idempotencyKey: `CARD-TEST-RETRY-${Date.now()}`,
    customerEmail: 'retry.card@example.com',
    customerName: 'Retry Customer',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'card',
    customerCountry: 'Zambia',
  });
  const order9 = orderRes9.order!;

  // 1. Initial attempt fails
  await reconcileOrderStatusWithLipila(order9.orderId, {
    status: 'Declined',
    message: 'Card was declined by issuing bank',
  });
  const failedOrder9 = getOrderByOrderId(order9.orderId);
  assert.equal(failedOrder9?.orderStatus, 'payment_failed');
  assert.equal(failedOrder9?.items[0].downloadToken, '');

  // 2. Customer clicks "Try Card Payment Again" on order recovery page
  const retryCardReq = new Request('https://twokidsdesign2.netlify.app/api/payments/lipila/card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: order9.orderId }),
  });
  const retryCardRes = await netlifyV2Handler(retryCardReq);
  assert.equal(retryCardRes.status, 200);
  const retryCardData = await retryCardRes.json();
  assert.ok(retryCardData.success);
  assert.ok(retryCardData.cardRedirectionUrl);
  // Verify order transitioned back to pending_payment with fresh referenceId
  const retriedOrder9 = getOrderByOrderId(order9.orderId);
  assert.equal(retriedOrder9?.orderStatus, 'pending_payment');
  assert.notEqual(retriedOrder9?.referenceId, order9.referenceId, 'Must assign fresh attempt reference');
  // Downloads must remain locked
  assert.equal(retriedOrder9?.items[0].downloadToken, '');
  console.log('PASS [Test 9]: Failed card payment successfully retried with fresh reference and locked downloads.\n');

  // --------------------------------------------------------------------------
  // TEST 10: Customer Leaving PrimeNet Pay & Returning While Order is Pending
  // --------------------------------------------------------------------------
  console.log('--- TEST 10: Abandoned PrimeNet Pay Session / Pending Return ---');
  const orderRes10 = createPendingOrder({
    idempotencyKey: `CARD-TEST-ABANDON-${Date.now()}`,
    customerEmail: 'abandon.customer@example.com',
    customerName: 'Browsing Customer',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'card',
  });
  const order10 = orderRes10.order!;

  // Customer returns to order-confirmation page: triggers GET /api/orders/:orderId/status
  const statusReq10 = new Request(`https://twokidsdesign2.netlify.app/api/orders/${order10.orderId}/status`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const statusRes10 = await netlifyV2Handler(statusReq10);
  assert.equal(statusRes10.status, 200);
  const statusData10 = await statusRes10.json();
  assert.equal(statusData10.orderStatus, 'pending_payment');
  assert.equal(statusData10.paymentStatus, 'pending');
  assert.equal(statusData10.order.items[0].downloadToken, '', 'Pending order must never release downloads');
  console.log('PASS [Test 10]: Customer returning from abandoned checkout cleanly resolves pending status without granting downloads.\n');

  // --------------------------------------------------------------------------
  // TEST 11: Returning to Already Successful Order Without Creating New Payment
  // --------------------------------------------------------------------------
  console.log('--- TEST 11: Already Paid Order Safeguard ---');
  const orderRes11 = createPendingOrder({
    idempotencyKey: `CARD-TEST-ALREADYPAID-${Date.now()}`,
    customerEmail: 'alreadypaid@example.com',
    customerName: 'Paid Creator',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'card',
  });
  const order11 = orderRes11.order!;
  markOrderAsPaid(order11.orderId, 'LPLXC-PAID-ALREADY-999');

  // Attempting to retry card on already paid order
  const retryPaidCardReq = new Request('https://twokidsdesign2.netlify.app/api/payments/lipila/card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: order11.orderId }),
  });
  const retryPaidCardRes = await netlifyV2Handler(retryPaidCardReq);
  assert.equal(retryPaidCardRes.status, 200);
  const retryPaidCardData = await retryPaidCardRes.json();
  assert.ok(retryPaidCardData.success);
  assert.equal(retryPaidCardData.alreadyPaid, true);
  assert.equal(retryPaidCardData.order.orderStatus, 'paid');

  // Attempting to initiate mobile money on already paid order
  const retryPaidMomoReq = new Request('https://twokidsdesign2.netlify.app/api/payments/lipila/mobile-money', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: order11.orderId, accountNumber: '0977112233' }),
  });
  const retryPaidMomoRes = await netlifyV2Handler(retryPaidMomoReq);
  assert.equal(retryPaidMomoRes.status, 200);
  const retryPaidMomoData = await retryPaidMomoRes.json();
  assert.ok(retryPaidMomoData.success);
  assert.equal(retryPaidMomoData.alreadyPaid, true);
  console.log('PASS [Test 11]: Already paid order blocks duplicate payment creation for both card and mobile money.\n');

  // --------------------------------------------------------------------------
  // TEST 12: Switching from Card Payment to Mobile Money
  // --------------------------------------------------------------------------
  console.log('--- TEST 12: Switching from Card to Mobile Money ---');
  const orderRes12 = createPendingOrder({
    idempotencyKey: `CARD-TEST-SWITCH-${Date.now()}`,
    customerEmail: 'switch.payment@example.com',
    customerName: 'Flexible Creator',
    items: [{ productId: 'tkd-bundle-02', licenseTier: 'commercial' }],
    paymentMethod: 'card',
    customerCountry: 'Zambia',
  });
  const order12 = orderRes12.order!;

  // Customer clicks "Pay with Mobile Money" on order confirmation page
  const switchMomoReq = new Request('https://twokidsdesign2.netlify.app/api/payments/lipila/mobile-money', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: order12.orderId, accountNumber: '0971234567' }),
  });
  const switchMomoRes = await netlifyV2Handler(switchMomoReq);
  assert.equal(switchMomoRes.status, 200);
  const switchMomoData = await switchMomoRes.json();
  assert.ok(switchMomoData.success);
  assert.ok(switchMomoData.providerReference);

  const switchedOrder12 = getOrderByOrderId(order12.orderId);
  assert.equal(switchedOrder12?.paymentMethod, 'mobile_money');
  assert.equal(switchedOrder12?.orderStatus, 'pending_payment');
  assert.equal(switchedOrder12?.items[0].downloadToken, '', 'Must remain locked until approved');
  console.log('PASS [Test 12]: Seamless switch from card to mobile money updates payment method and initiates prompt cleanly.\n');

  // --------------------------------------------------------------------------
  // TEST 13: Production backUrl Generation & Formatting
  // --------------------------------------------------------------------------
  console.log('--- TEST 13: Production backUrl Format & Validation ---');
  const orderRes13 = createPendingOrder({
    idempotencyKey: `CARD-TEST-BACKURL-${Date.now()}`,
    customerEmail: 'backurl.test@example.com',
    customerName: 'BackUrl Verifier',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'card',
  });
  const order13 = orderRes13.order!;

  const backUrlReq = new Request('https://twokidsdesign2.netlify.app/api/payments/lipila/card', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://twokidsdesign2.netlify.app',
    },
    body: JSON.stringify({ orderId: order13.orderId }),
  });
  const backUrlRes = await netlifyV2Handler(backUrlReq);
  assert.equal(backUrlRes.status, 200);
  const backUrlData = await backUrlRes.json();
  assert.ok(backUrlData.backUrl, 'Must return backUrl in payload');
  const expectedUrl = `https://twokidsdesign2.netlify.app/order-confirmation/${order13.orderId}`;
  assert.equal(backUrlData.backUrl, expectedUrl);
  assert.ok(!backUrlData.backUrl.includes('{orderId}'), 'Must not contain literal {orderId} placeholder');
  assert.ok(!backUrlData.backUrl.includes('web.app'), 'Must never default to legacy Firebase web.app domain');
  console.log('PASS [Test 13]: Production backUrl strictly uses twokidsdesign2.netlify.app with exact order ID.\n');

  console.log('================================================================');
  console.log('ALL 13 CARD PAYMENT & RETRY RECOVERY TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runCardPaymentTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
