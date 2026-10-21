import http from 'node:http';
import assert from 'node:assert/strict';
import express from 'express';
import { createApiMiddleware } from '../server/apiMiddleware';

async function runHttpIntegrationTests() {
  const app = express();
  app.use(createApiMiddleware());

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    console.log(`=== Two Kids Design — Live HTTP API Integration Tests (${baseUrl}) ===`);

    // 1. GET /api/products
    const prodRes = await fetch(`${baseUrl}/api/products`);
    assert.equal(prodRes.status, 200);
    const prodData = await prodRes.json();
    assert.equal(prodData.products.length, 6);
    console.log('PASS [HTTP 1/6]: GET /api/products returns all 6 published PDF bundles');

    // 2. GET /api/products/:slug
    const detailRes = await fetch(`${baseUrl}/api/products/makers-botanical-craft-sticker-pdf-bundle`);
    assert.equal(detailRes.status, 200);
    const detailData = await detailRes.json();
    assert.equal(detailData.product.verifiedPageCount, 24);
    console.log('PASS [HTTP 2/6]: GET /api/products/:slug returns accurate bundle metadata');

    // 3. POST /api/checkout/verify (Simulate Decline)
    const declineRes = await fetch(`${baseUrl}/api/checkout/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: `http-decline-${Date.now()}`,
        customerEmail: 'http.decline@example.com',
        customerName: 'Decline Tester',
        items: [{ productId: 'tkd-bundle-01', licenseTier: 'personal' }],
        paymentSimulationMode: 'simulate_decline',
      }),
    });
    assert.equal(declineRes.status, 402);
    const declineData = await declineRes.json();
    assert.equal(declineData.success, false);
    console.log('PASS [HTTP 3/6]: POST /api/checkout/verify rejects declined payments with HTTP 402');

    // 4. POST /api/checkout/verify (Authorized Payment)
    const email = `http.buyer.${Date.now()}@example.com`;
    const paidRes = await fetch(`${baseUrl}/api/checkout/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: `http-paid-${Date.now()}`,
        customerEmail: email,
        customerName: 'HTTP Buyer',
        items: [{ productId: 'tkd-bundle-01', licenseTier: 'commercial' }],
        paymentSimulationMode: 'verify_success',
      }),
    });
    assert.equal(paidRes.status, 200);
    const paidData = await paidRes.json();
    assert.equal(paidData.success, true);
    const token = paidData.order.items[0].downloadToken;
    assert.ok(token);
    console.log('PASS [HTTP 4/6]: POST /api/checkout/verify creates paid order & signed token');

    // 5. GET /api/download/:token (Valid vs Tampered)
    const dlRes = await fetch(`${baseUrl}/api/download/${encodeURIComponent(token)}`);
    assert.equal(dlRes.status, 200);
    assert.equal(dlRes.headers.get('content-type'), 'application/pdf');
    const pdfBuf = Buffer.from(await dlRes.arrayBuffer());
    assert.equal(pdfBuf.subarray(0, 5).toString('ascii'), '%PDF-');

    const badDlRes = await fetch(`${baseUrl}/api/download/${encodeURIComponent(token + 'TAMPER')}`);
    assert.equal(badDlRes.status, 403);
    console.log('PASS [HTTP 5/6]: GET /api/download/:token streams licensed PDF and blocks tampered tokens with HTTP 403');

    // 6. GET /api/orders/lookup & POST /api/orders/refresh-token
    const lookupRes = await fetch(`${baseUrl}/api/orders/lookup?email=${encodeURIComponent(email)}`);
    assert.equal(lookupRes.status, 200);
    const lookupData = await lookupRes.json();
    assert.equal(lookupData.orders.length, 1);

    const refreshRes = await fetch(`${baseUrl}/api/orders/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: paidData.order.orderId, email }),
    });
    assert.equal(refreshRes.status, 200);
    console.log('PASS [HTTP 6/6]: GET /api/orders/lookup & POST /api/orders/refresh-token verified');

    console.log('=== ALL HTTP INTEGRATION TESTS PASSED ===');
  } finally {
    server.close();
  }
}

runHttpIntegrationTests().catch(err => {
  console.error(err);
  process.exit(1);
});
