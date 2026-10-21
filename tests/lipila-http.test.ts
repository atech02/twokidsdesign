import http from 'node:http';
import assert from 'node:assert/strict';
import express from 'express';
import { createApiMiddleware } from '../server/apiMiddleware';

async function runLipilaHttpIntegrationTests() {
  const app = express();
  app.use(createApiMiddleware());

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    console.log(`=== Two Kids Design — Live Lipila HTTP Integration Tests (${baseUrl}) ===`);

    // 1. POST /api/checkout/create (Order Creation Before Payment)
    const orderRes = await fetch(`${baseUrl}/api/checkout/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: `http-lipila-order-${Date.now()}`,
        customerEmail: 'creator.zambia@example.com',
        customerName: 'Mwamba Phiri',
        items: [{ productId: 'tkd-bundle-01', licenseTier: 'personal' }],
        paymentMethod: 'card',
      }),
    });
    assert.equal(orderRes.status, 200);
    const orderData = await orderRes.json();
    assert.equal(orderData.success, true);
    const order = orderData.order;
    assert.equal(order.currency, 'ZMW');
    assert.equal(order.orderStatus, 'pending_payment');
    assert.equal(order.items[0].downloadToken, '');
    console.log('PASS [HTTP 1/7]: POST /api/checkout/create creates pending ZMW order with locked downloads');

    // 2. POST /api/payments/lipila/card (Card Collection Initialization)
    const cardRes = await fetch(`${baseUrl}/api/payments/lipila/card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.orderId }),
    });
    assert.equal(cardRes.status, 200);
    const cardData = await cardRes.json();
    assert.equal(cardData.success, true);
    assert.ok(cardData.cardRedirectionUrl);
    console.log('PASS [HTTP 2/7]: POST /api/payments/lipila/card generates Lipila hosted card redirect URL');

    // 3. POST /api/payments/lipila/mobile-money (Mobile Money Prompt)
    const momoOrderRes = await fetch(`${baseUrl}/api/checkout/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: `http-momo-order-${Date.now()}`,
        customerEmail: 'momo.customer@example.com',
        customerName: 'Kondwani Banda',
        items: [{ productId: 'tkd-bundle-02', licenseTier: 'commercial' }],
        paymentMethod: 'mobile_money',
        customerPhone: '0977654321',
      }),
    });
    const momoOrder = (await momoOrderRes.json()).order;

    const momoRes = await fetch(`${baseUrl}/api/payments/lipila/mobile-money`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: momoOrder.orderId,
        accountNumber: '0977654321',
      }),
    });
    assert.equal(momoRes.status, 200);
    assert.ok(momoRes.headers.get('content-type')?.includes('application/json'));
    const momoData = await momoRes.json();
    assert.equal(momoData.success, true);
    assert.ok(momoData.message);
    console.log('PASS [HTTP 3/9]: POST /api/payments/lipila/mobile-money returns application/json & initiates prompt');

    // 4. POST /api/payments/lipila/mobile-money (Validation: Invalid Phone Number)
    const badPhoneRes = await fetch(`${baseUrl}/api/payments/lipila/mobile-money`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: momoOrder.orderId,
        accountNumber: '123', // invalid short number
      }),
    });
    assert.equal(badPhoneRes.status, 400);
    assert.ok(badPhoneRes.headers.get('content-type')?.includes('application/json'));
    const badPhoneData = await badPhoneRes.json();
    assert.equal(badPhoneData.success, false);
    assert.ok(badPhoneData.error.includes('valid Zambian mobile money number'));
    console.log('PASS [HTTP 4/9]: POST /api/payments/lipila/mobile-money rejects invalid phone numbers with HTTP 400 & valid JSON');

    // 5. POST /api/payments/lipila/mobile-money (Validation: Order Not Found)
    const notFoundRes = await fetch(`${baseUrl}/api/payments/lipila/mobile-money`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'NONEXISTENT-ORDER-1234',
        accountNumber: '0977654321',
      }),
    });
    assert.equal(notFoundRes.status, 404);
    assert.ok(notFoundRes.headers.get('content-type')?.includes('application/json'));
    const notFoundData = await notFoundRes.json();
    assert.equal(notFoundData.success, false);
    assert.ok(notFoundData.error.includes('Order not found'));
    console.log('PASS [HTTP 5/9]: POST /api/payments/lipila/mobile-money returns HTTP 404 & valid JSON for unknown order');

    // 6. POST /api/webhooks/lipila (Reject unknown transaction reference)
    const badHookRes = await fetch(`${baseUrl}/api/webhooks/lipila`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceId: 'UNKNOWN-REFERENCE-999',
        status: 'Successful',
      }),
    });
    assert.equal(badHookRes.status, 404);
    assert.ok(badHookRes.headers.get('content-type')?.includes('application/json'));
    console.log('PASS [HTTP 6/9]: POST /api/webhooks/lipila rejects unmatched references with HTTP 404 JSON');

    // 7. POST /api/webhooks/lipila (Process Verified Callback for momoOrder)
    const hookRes = await fetch(`${baseUrl}/api/webhooks/lipila`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceId: momoOrder.referenceId,
        status: 'Successful',
        amount: momoOrder.total,
        currency: 'ZMW',
        externalId: 'LIP-EXT-TEST-8899',
      }),
    });
    assert.equal(hookRes.status, 200);
    assert.ok(hookRes.headers.get('content-type')?.includes('application/json'));
    const hookData = await hookRes.json();
    assert.equal(hookData.status, 'paid');
    console.log('PASS [HTTP 7/9]: POST /api/webhooks/lipila verifies payment and unlocks order');

    // 8. GET /api/orders/:orderId/status (Order status now confirmed paid with issued download tokens)
    const statusRes = await fetch(`${baseUrl}/api/orders/${momoOrder.orderId}/status`);
    assert.equal(statusRes.status, 200);
    assert.ok(statusRes.headers.get('content-type')?.includes('application/json'));
    const statusData = await statusRes.json();
    assert.equal(statusData.order.orderStatus, 'paid');
    assert.equal(statusData.order.paymentStatus, 'successful');
    const downloadToken = statusData.order.items[0].downloadToken;
    assert.ok(downloadToken.length > 20);
    console.log('PASS [HTTP 8/9]: GET /api/orders/:orderId/status returns paid status & signed download tokens');

    // 9. GET /api/download/:token (Protected PDF download stream with %PDF- header)
    const dlRes = await fetch(`${baseUrl}/api/download/${encodeURIComponent(downloadToken)}`);
    assert.equal(dlRes.status, 200);
    assert.equal(dlRes.headers.get('content-type'), 'application/pdf');
    const pdfBuf = Buffer.from(await dlRes.arrayBuffer());
    assert.equal(pdfBuf.subarray(0, 5).toString('ascii'), '%PDF-');
    console.log('PASS [HTTP 9/13]: GET /api/download/:token streams licensed PDF bundle');

    // 10. GET /api/health (Service Health Check)
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    assert.ok(healthRes.headers.get('content-type')?.includes('application/json'));
    const healthData = await healthRes.json();
    assert.equal(healthData.status, 'healthy');
    assert.ok(healthData.uptime >= 0);
    console.log('PASS [HTTP 10/13]: GET /api/health returns healthy JSON status');

    // 11. GET /api/diagnostics (Sanitized Configuration Check)
    const diagRes = await fetch(`${baseUrl}/api/diagnostics`);
    assert.equal(diagRes.status, 200);
    assert.ok(diagRes.headers.get('content-type')?.includes('application/json'));
    const diagData = await diagRes.json();
    assert.equal(diagData.status, 'ready');
    assert.ok(diagData.lipila.baseUrl.includes('lipila'));
    assert.equal(typeof diagData.lipila.hasApiKey, 'boolean');
    assert.equal((diagData as Record<string, unknown>).apiKey, undefined); // Zero secrets leaked
    assert.equal((diagData as Record<string, unknown>).lipila_secret_api, undefined);
    console.log('PASS [HTTP 11/13]: GET /api/diagnostics returns sanitized environment status without leaking secrets');

    // 12. OPTIONS /api/payments/lipila/mobile-money (CORS Preflight Check)
    const corsRes = await fetch(`${baseUrl}/api/payments/lipila/mobile-money`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://twokidsdesign.web.app',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert.equal(corsRes.status, 204);
    assert.ok(corsRes.headers.get('access-control-allow-origin'));
    console.log('PASS [HTTP 12/13]: OPTIONS preflight returns HTTP 204 with required CORS headers');

    // 13. POST /api/diagnostics/lipila-connectivity (Outbound Connectivity Ping)
    const connRes = await fetch(`${baseUrl}/api/diagnostics/lipila-connectivity`, { method: 'POST' });
    assert.ok(connRes.status === 200 || connRes.status === 502);
    assert.ok(connRes.headers.get('content-type')?.includes('application/json'));
    const connData = await connRes.json();
    assert.ok('reachable' in connData);
    console.log(`PASS [HTTP 13/13]: POST /api/diagnostics/lipila-connectivity returns connectivity response (reachable: ${connData.reachable})`);

    console.log('=== ALL 13 LIPILA HTTP INTEGRATION TESTS PASSED ===');
  } finally {
    server.close();
  }
}

runLipilaHttpIntegrationTests().catch(err => {
  console.error(err);
  process.exit(1);
});
