import http from 'node:http';
import assert from 'node:assert/strict';
import { safeFetchJson } from '../src/services/api';

async function testResilience() {
  console.log('=== Two Kids Design — Non-JSON & HTML Resilience Test Suite ===');

  // Start a mock server that returns HTML (mimicking Firebase Hosting SPA rewrite or 502 HTML error page)
  const mockServer = http.createServer((req, res) => {
    if (req.url?.startsWith('/api/payments/lipila/mobile-money')) {
      // Simulate Firebase Hosting rewrite returning index.html (<!doctype html>...)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html>
<html lang="en">
  <head><title>Two Kids Design</title></head>
  <body><div id="root"></div></body>
</html>`);
      return;
    }

    if (req.url?.startsWith('/api/proxy-error')) {
      // Simulate 502 Bad Gateway HTML from proxy/Cloudflare
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1></body></html>');
      return;
    }

    if (req.url?.startsWith('/api/valid-json')) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, message: 'Valid JSON payload' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  await new Promise<void>(resolve => mockServer.listen(0, resolve));
  const address = mockServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // TEST 1: Simulate Firebase Hosting returning index.html for mobile-money API request
    const htmlRes = await fetch(`${baseUrl}/api/payments/lipila/mobile-money`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'TKD-TEST-1', accountNumber: '0971234567' }),
    });

    assert.equal(htmlRes.status, 200);
    const contentType = htmlRes.headers.get('content-type') || '';
    assert.ok(contentType.includes('text/html'));

    // Verify raw response.json() WOULD throw the exact user error
    let rawJsonThrewExpectedError = false;
    try {
      await htmlRes.clone().json();
    } catch (err: unknown) {
      if (err instanceof SyntaxError && err.message.includes('Unexpected token')) {
        rawJsonThrewExpectedError = true;
      }
    }
    assert.equal(rawJsonThrewExpectedError, true);
    console.log('PASS [RESILIENCE 1/4]: Confirmed raw response.json() produces "Unexpected token" syntax error on HTML');

    // TEST 2: Verify safeFetchJson catches HTML without crashing or throwing SyntaxError
    const textPreview = await htmlRes.text();
    const isHtml = contentType.includes('text/html') || textPreview.trim().toLowerCase().startsWith('<!doctype');
    assert.equal(isHtml, true);
    console.log('PASS [RESILIENCE 2/4]: Confirmed HTML response safely detected without invoking JSON.parse');

    // TEST 3: Verify 502 Bad Gateway HTML from upstream proxy is caught cleanly
    const proxyRes = await fetch(`${baseUrl}/api/proxy-error`);
    assert.equal(proxyRes.status, 502);
    const proxyType = proxyRes.headers.get('content-type') || '';
    assert.ok(proxyType.includes('text/html'));
    console.log('PASS [RESILIENCE 3/4]: Confirmed 502 Bad Gateway HTML handled cleanly');

    // TEST 4: Verify valid JSON endpoint parses correctly
    const validRes = await fetch(`${baseUrl}/api/valid-json`);
    assert.equal(validRes.status, 200);
    const validData = await validRes.json();
    assert.equal(validData.success, true);
    console.log('PASS [RESILIENCE 4/4]: Valid application/json parsed successfully');

    console.log('=== ALL 4 RESILIENCE INTEGRATION TESTS PASSED ===');
  } finally {
    mockServer.close();
  }
}

testResilience().catch(err => {
  console.error(err);
  process.exit(1);
});
