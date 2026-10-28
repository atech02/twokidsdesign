import assert from 'node:assert/strict';
import netlifyV2Handler from '../netlify/functions/api';
import {
  createPendingOrder,
  markOrderAsPaid,
  markOrderAsFailed,
  getOrderByOrderId,
  getOrderByReferenceId,
  setOrderProviderReference,
} from '../server/orderStore';
import { reconcileOrderStatusWithLipila } from '../server/coreApiHandler';

async function runMomoReconciliationTests() {
  console.log('=== Two Kids Design — Mobile Money Status Reconciliation Test Suite ===\n');

  // --------------------------------------------------------------------------
  // SCENARIO 1: Successful mobile money payment
  // --------------------------------------------------------------------------
  console.log('--- SCENARIO 1: Successful mobile money payment ---');
  const orderRes1 = createPendingOrder({
    idempotencyKey: `MOMO-TEST-S1-${Date.now()}`,
    customerEmail: 'creator1@example.com',
    customerName: 'Airtel Customer One',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'mobile_money',
    customerPhone: '260971111111',
  });
  const order1 = orderRes1.order!;
  assert.ok(order1);
  assert.equal(order1.orderStatus, 'pending_payment');
  assert.equal(order1.items[0].downloadToken, '');

  // Simulate prompt dispatched with provider reference
  setOrderProviderReference(order1.orderId, 'LPLXC-20261028-SUCCESS-001');

  // Reconcile status to successful
  const s1Result = await reconcileOrderStatusWithLipila(order1.orderId, {
    status: 'Successful',
    externalId: 'LPLXC-20261028-SUCCESS-001',
    message: 'Transaction completed successfully',
  });

  assert.equal(s1Result.paymentStatus, 'successful');
  assert.equal(s1Result.orderStatus, 'paid');
  assert.ok(s1Result.order);
  assert.equal(s1Result.order.orderStatus, 'paid');
  assert.ok(s1Result.order.items[0].downloadToken.length > 20, 'Download token must be generated');
  console.log('PASS [Scenario 1]: Successful mobile money payment unlocks downloads and transitions to paid.\n');

  // --------------------------------------------------------------------------
  // SCENARIO 2: Failed payment due to insufficient balance
  // --------------------------------------------------------------------------
  console.log('--- SCENARIO 2: Failed payment due to insufficient balance ---');
  const orderRes2 = createPendingOrder({
    idempotencyKey: `MOMO-TEST-S2-${Date.now()}`,
    customerEmail: 'creator2@example.com',
    customerName: 'Airtel Customer Two',
    items: [{ productId: 'tkd-bundle-02', licenseTier: 'standard' }],
    paymentMethod: 'mobile_money',
    customerPhone: '260972222222',
  });
  const order2 = orderRes2.order!;
  assert.ok(order2);

  // Link gateway reference (e.g. user provided failed transaction reference)
  setOrderProviderReference(order2.orderId, 'LPLXC-20261028-035015-041-7604');

  const s2Result = await reconcileOrderStatusWithLipila(order2.orderId, {
    status: 'Failed',
    externalId: 'LPLXC-20261028-035015-041-7604',
    message: 'Subscriber has insufficient balance',
  });

  assert.equal(s2Result.paymentStatus, 'failed');
  assert.equal(s2Result.orderStatus, 'payment_failed');
  assert.equal(s2Result.failureReason, 'INSUFFICIENT_FUNDS');
  assert.ok(s2Result.message?.includes('insufficient mobile money balance'));
  assert.equal(s2Result.order?.items[0].downloadToken, '', 'Failed order must never have download tokens');

  // Verify lookup by LPLXC reference also finds the updated order
  const foundByLplxc = getOrderByReferenceId('LPLXC-20261028-035015-041-7604');
  assert.ok(foundByLplxc);
  assert.equal(foundByLplxc.orderId, order2.orderId);
  assert.equal(foundByLplxc.orderStatus, 'payment_failed');
  console.log('PASS [Scenario 2]: Insufficient balance failure is detected, formatted with helpful guidance, and downloads remain locked.\n');

  // --------------------------------------------------------------------------
  // SCENARIO 3: Customer cancellation / rejection
  // --------------------------------------------------------------------------
  console.log('--- SCENARIO 3: Customer cancellation / rejection ---');
  const orderRes3 = createPendingOrder({
    idempotencyKey: `MOMO-TEST-S3-${Date.now()}`,
    customerEmail: 'creator3@example.com',
    customerName: 'Airtel Customer Three',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'mobile_money',
    customerPhone: '260973333333',
  });
  const order3 = orderRes3.order!;
  assert.ok(order3);

  const s3Result = await reconcileOrderStatusWithLipila(order3.orderId, {
    status: 'Failed',
    message: 'Transaction declined or cancelled by subscriber',
  });

  assert.equal(s3Result.paymentStatus, 'failed');
  assert.equal(s3Result.orderStatus, 'payment_failed');
  assert.equal(s3Result.failureReason, 'PAYMENT_CANCELLED');
  assert.ok(s3Result.message?.includes('declined or cancelled'));
  console.log('PASS [Scenario 3]: Rejection / cancellation reflects as PAYMENT_CANCELLED without leaving UI hanging.\n');

  // --------------------------------------------------------------------------
  // SCENARIO 4: Pending transaction with active polling
  // --------------------------------------------------------------------------
  console.log('--- SCENARIO 4: Pending transaction with active polling ---');
  const orderRes4 = createPendingOrder({
    idempotencyKey: `MOMO-TEST-S4-${Date.now()}`,
    customerEmail: 'creator4@example.com',
    customerName: 'Airtel Customer Four',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'mobile_money',
    customerPhone: '260974444444',
  });
  const order4 = orderRes4.order!;
  assert.ok(order4);

  const s4Result = await reconcileOrderStatusWithLipila(order4.orderId, {
    status: 'Pending',
    message: 'Awaiting customer authorization on mobile phone...',
  });

  assert.equal(s4Result.paymentStatus, 'pending');
  assert.equal(s4Result.orderStatus, 'pending_payment');
  assert.equal(s4Result.order?.items[0].downloadToken, '');
  console.log('PASS [Scenario 4]: Pending state remains pending_payment with locked downloads during active polling.\n');

  // --------------------------------------------------------------------------
  // SCENARIO 5: Delayed callback / polling reconciliation
  // --------------------------------------------------------------------------
  console.log('--- SCENARIO 5: Delayed callback resolved via status check ---');
  const orderRes5 = createPendingOrder({
    idempotencyKey: `MOMO-TEST-S5-${Date.now()}`,
    customerEmail: 'creator5@example.com',
    customerName: 'Airtel Customer Five',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'mobile_money',
  });
  const order5 = orderRes5.order!;
  assert.ok(order5);

  // Polling endpoint called by frontend before webhook arrives
  const reqPoll = new Request(`https://twokidsdesign2.netlify.app/api/orders/${order5.orderId}/status`, {
    method: 'GET',
    headers: { Origin: 'https://twokidsdesign.web.app' },
  });
  const resPoll = await netlifyV2Handler(reqPoll);
  assert.equal(resPoll.status, 200);
  const jsonPoll = await resPoll.json();
  assert.ok(jsonPoll.order);
  assert.equal(jsonPoll.order.orderId, order5.orderId);
  console.log('PASS [Scenario 5]: Polling endpoint functions cleanly even when callback has not arrived.\n');

  // --------------------------------------------------------------------------
  // SCENARIO 6: Callback not received, status query with LPLXC reference
  // --------------------------------------------------------------------------
  console.log('--- SCENARIO 6: Status query by referenceId / gateway reference ---');
  const orderRes6 = createPendingOrder({
    idempotencyKey: `MOMO-TEST-S6-${Date.now()}`,
    customerEmail: 'creator6@example.com',
    customerName: 'Airtel Customer Six',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'mobile_money',
  });
  const order6 = orderRes6.order!;
  assert.ok(order6);
  setOrderProviderReference(order6.orderId, 'LPLXC-TEST-REF-006');

  // Query using query parameter: /api/orders/status?referenceId=LPLXC-TEST-REF-006
  const reqByRef = new Request('https://twokidsdesign2.netlify.app/api/orders/status?referenceId=LPLXC-TEST-REF-006', {
    method: 'GET',
    headers: { Origin: 'https://twokidsdesign.web.app' },
  });
  const resByRef = await netlifyV2Handler(reqByRef);
  assert.equal(resByRef.status, 200);
  const jsonByRef = await resByRef.json();
  assert.equal(jsonByRef.order.orderId, order6.orderId);
  console.log('PASS [Scenario 6]: Querying status by gateway reference (LPLXC-...) resolves the correct order.\n');

  // --------------------------------------------------------------------------
  // SCENARIO 7: Gateway network glitch safety (order NOT prematurely failed)
  // --------------------------------------------------------------------------
  console.log('--- SCENARIO 7: Gateway network glitch safety ---');
  const orderRes7 = createPendingOrder({
    idempotencyKey: `MOMO-TEST-S7-${Date.now()}`,
    customerEmail: 'creator7@example.com',
    customerName: 'Airtel Customer Seven',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'mobile_money',
  });
  const order7 = orderRes7.order!;
  assert.ok(order7);

  // When network check cannot be completed, order must remain pending_payment
  const s7Result = await reconcileOrderStatusWithLipila(order7.orderId);
  assert.equal(s7Result.paymentStatus, 'pending');
  assert.equal(s7Result.orderStatus, 'pending_payment');
  assert.notEqual(s7Result.orderStatus, 'payment_failed', 'Temporary network error must NEVER mark order as failed');
  console.log('PASS [Scenario 7]: Temporary gateway glitches safely preserve pending_payment without premature failure.\n');

  // --------------------------------------------------------------------------
  // SCENARIO 8: Customer refreshes or revisits order confirmation page
  // --------------------------------------------------------------------------
  console.log('--- SCENARIO 8: Order page revisit / lookup ---');
  // Revisit of scenario 1 paid order
  const revisitReq = new Request(`https://twokidsdesign2.netlify.app/api/orders/${order1.orderId}/status`, {
    method: 'GET',
  });
  const revisitRes = await netlifyV2Handler(revisitReq);
  assert.equal(revisitRes.status, 200);
  const revisitJson = await revisitRes.json();
  assert.equal(revisitJson.order.orderStatus, 'paid');
  assert.equal(revisitJson.paymentStatus, 'successful');
  assert.ok(revisitJson.order.items[0].downloadToken);
  console.log('PASS [Scenario 8]: Customer revisit returns verified paid order and download links immediately.\n');

  // --------------------------------------------------------------------------
  // SCENARIO 9: Idempotency & duplicate event protection
  // --------------------------------------------------------------------------
  console.log('--- SCENARIO 9: Idempotent status checks and stale event protection ---');
  // Attempt to mark an already paid order as failed
  const staleAttempt = markOrderAsFailed(order1.orderId, 'Stale cancellation event');
  assert.equal(staleAttempt?.orderStatus, 'paid', 'A paid order must NEVER be downgraded to failed');
  assert.equal(staleAttempt?.paymentStatus, 'successful');

  // Multiple webhook calls
  for (let i = 0; i < 5; i++) {
    const dupWebhook = new Request('https://twokidsdesign2.netlify.app/api/webhooks/lipila', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenceId: order1.referenceId, status: 'Successful' }),
    });
    const dupRes = await netlifyV2Handler(dupWebhook);
    assert.equal(dupRes.status, 200);
  }
  console.log('PASS [Scenario 9]: Idempotency guarantees paid order preservation against stale events and duplicate callbacks.\n');

  // --------------------------------------------------------------------------
  // SCENARIO 10: Card payment flow unaffected
  // --------------------------------------------------------------------------
  console.log('--- SCENARIO 10: Card payment flow unaffected ---');
  const orderRes10 = createPendingOrder({
    idempotencyKey: `CARD-TEST-S10-${Date.now()}`,
    customerEmail: 'cardcustomer@example.com',
    customerName: 'Card User',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'card',
  });
  const order10 = orderRes10.order!;
  assert.ok(order10);

  const cardReq = new Request('https://twokidsdesign2.netlify.app/api/payments/lipila/card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: order10.orderId }),
  });
  const cardRes = await netlifyV2Handler(cardReq);
  assert.equal(cardRes.status, 200);
  const cardJson = await cardRes.json();
  assert.equal(cardJson.success, true);
  assert.ok(cardJson.cardRedirectionUrl);
  console.log('PASS [Scenario 10]: Card payment initiation and redirection URL generation remain 100% operational.\n');

  // --------------------------------------------------------------------------
  // SCENARIO 11: Serverless container rehydration & status query resilience
  // --------------------------------------------------------------------------
  console.log('--- SCENARIO 11: Serverless container rehydration & status resilience ---');
  const orderRes11 = createPendingOrder({
    idempotencyKey: `REHYDRATE-TEST-S11-${Date.now()}`,
    customerEmail: 'rehydrate@example.com',
    customerName: 'Rehydration Test User',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'mobile_money',
  });
  const order11 = orderRes11.order!;
  assert.ok(order11);

  // Rehydrate endpoint
  const rehydrateReq = new Request('https://twokidsdesign2.netlify.app/api/orders/rehydrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: order11 }),
  });
  const rehydrateRes = await netlifyV2Handler(rehydrateReq);
  assert.equal(rehydrateRes.status, 200);
  const rehydrateJson = await rehydrateRes.json();
  assert.equal(rehydrateJson.success, true);
  assert.equal(rehydrateJson.order.orderId, order11.orderId);
  console.log('PASS [Scenario 11]: Order rehydration endpoint successfully syncs pending orders across serverless instances.\n');

  console.log('=== ALL 11 MOBILE MONEY & RECONCILIATION SCENARIOS PASSED ===');
}

runMomoReconciliationTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
