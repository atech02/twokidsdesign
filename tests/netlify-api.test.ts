import assert from 'node:assert/strict';
import netlifyV2Handler, { handler as netlifyV1Handler } from '../netlify/functions/api';

async function testNetlifyFunctions() {
  console.log('=== Two Kids Design — Netlify Functions Integration Test Suite ===');

  // TEST 1: CORS Preflight OPTIONS Request (v2 & v1)
  const reqOptions = new Request('https://twokidsdesign-api.netlify.app/api/checkout/create', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://twokidsdesign.web.app',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type',
    },
  });
  const resOptions = await netlifyV2Handler(reqOptions);
  assert.equal(resOptions.status, 204, 'Preflight OPTIONS must return HTTP 204');
  assert.equal(
    resOptions.headers.get('Access-Control-Allow-Origin'),
    'https://twokidsdesign.web.app',
    'Preflight must allow live Firebase origin'
  );
  assert.ok(
    resOptions.headers.get('Access-Control-Allow-Methods')?.includes('POST'),
    'Preflight must allow POST'
  );
  console.log('PASS [NETLIFY 1/11]: Preflight OPTIONS returns HTTP 204 with valid CORS headers');

  // TEST 2: GET /api/health (Safe Health Check without secrets)
  const reqHealth = new Request('https://twokidsdesign-api.netlify.app/api/health', {
    method: 'GET',
    headers: { Origin: 'https://twokidsdesign.web.app' },
  });
  const resHealth = await netlifyV2Handler(reqHealth);
  assert.equal(resHealth.status, 200);
  assert.ok(resHealth.headers.get('content-type')?.includes('application/json'));
  const healthJson = await resHealth.json();
  assert.equal(healthJson.status, 'healthy');
  assert.equal(healthJson.service, 'Two Kids Design Backend API');
  assert.equal(healthJson.apiKey, undefined, 'Health check must never leak API keys');
  console.log('PASS [NETLIFY 2/11]: GET /api/health returns safe JSON without leaking credentials');

  // TEST 3: Path Normalization (Works with both /api/... and /.netlify/functions/api/...)
  const reqRewritten = new Request('https://twokidsdesign-api.netlify.app/.netlify/functions/api/health', {
    method: 'GET',
  });
  const resRewritten = await netlifyV2Handler(reqRewritten);
  assert.equal(resRewritten.status, 200);
  const rewrittenJson = await resRewritten.json();
  assert.equal(rewrittenJson.status, 'healthy');
  console.log('PASS [NETLIFY 3/11]: Path normalization cleanly maps /.netlify/functions/api to /api without duplicate segments');

  // TEST 4: POST /api/checkout/create (Creates pending order with locked downloads)
  const orderPayload = {
    idempotencyKey: `TKD-NETLIFY-TEST-${Date.now()}`,
    customerEmail: 'customer@example.com',
    customerName: 'Alex Banda',
    items: [{ productId: 'tkd-bundle-01', licenseTier: 'standard' }],
    paymentMethod: 'card',
  };
  const reqCreateOrder = new Request('https://twokidsdesign-api.netlify.app/api/checkout/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://twokidsdesign.web.app' },
    body: JSON.stringify(orderPayload),
  });
  const resCreateOrder = await netlifyV2Handler(reqCreateOrder);
  assert.equal(resCreateOrder.status, 200);
  const createOrderJson = await resCreateOrder.json();
  assert.equal(createOrderJson.success, true);
  assert.ok(createOrderJson.order?.orderId);
  assert.equal(createOrderJson.order.orderStatus, 'pending_payment');
  assert.equal(createOrderJson.order.items[0].downloadToken, '');
  const orderId = createOrderJson.order.orderId;
  const referenceId = createOrderJson.order.referenceId;
  console.log('PASS [NETLIFY 4/11]: POST /api/checkout/create returns valid JSON with pending order and locked downloads');

  // TEST 5: POST /api/payments/lipila/card (Initiates hosted card checkout redirect)
  const reqCard = new Request('https://twokidsdesign-api.netlify.app/api/payments/lipila/card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://twokidsdesign.web.app' },
    body: JSON.stringify({ orderId }),
  });
  const resCard = await netlifyV2Handler(reqCard);
  assert.equal(resCard.status, 200);
  const cardJson = await resCard.json();
  assert.equal(cardJson.success, true);
  assert.ok(cardJson.cardRedirectionUrl);
  console.log('PASS [NETLIFY 5/11]: POST /api/payments/lipila/card returns valid card redirection URL');

  // TEST 6: POST /api/payments/lipila/mobile-money (Validation & Prompt Initiation)
  const badPhoneReq = new Request('https://twokidsdesign-api.netlify.app/api/payments/lipila/mobile-money', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, accountNumber: '123' }),
  });
  const badPhoneRes = await netlifyV2Handler(badPhoneReq);
  assert.equal(badPhoneRes.status, 400);
  const badPhoneJson = await badPhoneRes.json();
  assert.equal(badPhoneJson.success, false);
  assert.ok(badPhoneJson.error?.includes('valid'));

  const goodPhoneReq = new Request('https://twokidsdesign-api.netlify.app/api/payments/lipila/mobile-money', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://twokidsdesign.web.app' },
    body: JSON.stringify({ orderId, accountNumber: '0971234567' }),
  });
  const goodPhoneRes = await netlifyV2Handler(goodPhoneReq);
  assert.equal(goodPhoneRes.status, 200);
  const goodPhoneJson = await goodPhoneRes.json();
  assert.equal(goodPhoneJson.success, true);
  assert.ok(goodPhoneJson.message);
  console.log('PASS [NETLIFY 6/11]: POST /api/payments/lipila/mobile-money validates numbers and returns prompt status');

  // TEST 7: POST /api/webhooks/lipila (Verifies payment and unlocks order)
  const reqWebhook = new Request('https://twokidsdesign-api.netlify.app/api/webhooks/lipila', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referenceId, status: 'Successful', externalId: 'TXN-LIPILA-9988' }),
  });
  const resWebhook = await netlifyV2Handler(reqWebhook);
  assert.equal(resWebhook.status, 200);
  const webhookJson = await resWebhook.json();
  assert.equal(webhookJson.success, true);
  assert.equal(webhookJson.status, 'paid');
  console.log('PASS [NETLIFY 7/11]: POST /api/webhooks/lipila verifies payment and unlocks order downloads');

  // TEST 8: GET /api/orders/:orderId/status (Returns paid status & signed download tokens)
  const reqStatus = new Request(`https://twokidsdesign-api.netlify.app/api/orders/${orderId}/status`, {
    method: 'GET',
    headers: { Origin: 'https://twokidsdesign.web.app' },
  });
  const resStatus = await netlifyV2Handler(reqStatus);
  assert.equal(resStatus.status, 200);
  const statusJson = await resStatus.json();
  assert.equal(statusJson.order.orderStatus, 'paid');
  const token = statusJson.order.items[0].downloadToken;
  assert.ok(token && token.length > 20, 'Signed download token must be present');
  console.log('PASS [NETLIFY 8/11]: GET /api/orders/:orderId/status returns paid status and signed download token');

  // TEST 9: GET /api/download/:token (Streams licensed PDF bundle)
  const reqDownload = new Request(`https://twokidsdesign-api.netlify.app/api/download/${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: { Origin: 'https://twokidsdesign.web.app' },
  });
  const resDownload = await netlifyV2Handler(reqDownload);
  assert.equal(resDownload.status, 200);
  assert.equal(resDownload.headers.get('content-type'), 'application/pdf');
  assert.ok(resDownload.headers.get('content-disposition')?.includes('.pdf'));
  const pdfBytes = await resDownload.arrayBuffer();
  assert.ok(pdfBytes.byteLength > 1000, 'PDF bundle must be generated with real content');
  console.log('PASS [NETLIFY 9/11]: GET /api/download/:token streams binary PDF with proper headers');

  // TEST 10: Netlify Functions v1 Handler Compatibility (event/context)
  const v1Event = {
    httpMethod: 'GET',
    path: '/api/health',
    headers: { origin: 'https://twokidsdesign.web.app' },
  };
  const v1Res = await netlifyV1Handler(v1Event);
  assert.equal(v1Res.statusCode, 200);
  assert.ok(v1Res.headers['Content-Type'].includes('application/json'));
  const v1Body = JSON.parse(v1Res.body);
  assert.equal(v1Body.status, 'healthy');
  console.log('PASS [NETLIFY 10/11]: Netlify Functions v1 handler compatibility verified');

  // TEST 11: 404 Error handling returns valid JSON (never HTML)
  const req404 = new Request('https://twokidsdesign-api.netlify.app/api/nonexistent-route', {
    method: 'GET',
  });
  const res404 = await netlifyV2Handler(req404);
  assert.equal(res404.status, 404);
  assert.ok(res404.headers.get('content-type')?.includes('application/json'));
  const json404 = await res404.json();
  assert.equal(json404.status, 404);
  assert.ok(json404.error.includes('not found'));
  console.log('PASS [NETLIFY 11/11]: Unmatched API route returns HTTP 404 valid JSON (never HTML)');

  console.log('=== ALL 11 NETLIFY FUNCTIONS TESTS PASSED ===');
}

testNetlifyFunctions().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
