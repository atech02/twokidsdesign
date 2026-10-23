import assert from 'node:assert/strict';

const BASE_URL = 'https://twokidsdesign-aed2d.web.app';

async function verify() {
  console.log(`=== Verifying Deployment at ${BASE_URL} ===`);

  // 1. Homepage loads
  const homeRes = await fetch(BASE_URL);
  assert.equal(homeRes.status, 200, 'Homepage should return 200');
  const homeHtml = await homeRes.text();
  assert.ok(homeHtml.includes('Two Kids Design'), 'Homepage HTML should include store title');
  console.log('PASS [1/7]: Homepage loads with HTTP 200 and valid HTML');

  // 2. Logo image
  const logoRes = await fetch(`${BASE_URL}/images/logo.jpeg`);
  assert.equal(logoRes.status, 200, 'Logo should return 200');
  assert.ok(logoRes.headers.get('content-type')?.includes('image'), 'Logo should have image content-type');
  console.log('PASS [2/7]: Official logo image asset verified');

  // 3. Hero image
  const heroRes = await fetch(`${BASE_URL}/images/heroimg.jpg`);
  assert.equal(heroRes.status, 200, 'Hero image should return 200');
  console.log('PASS [3/7]: Hero background banner image asset verified');

  // 4. Collection assets
  for (const name of ['apparel.jpg', 'accessory.jpg', 'homedecor.jpg', 'stationery.jpg']) {
    const res = await fetch(`${BASE_URL}/images/${name}`);
    assert.equal(res.status, 200, `Collection asset ${name} should return 200`);
  }
  console.log('PASS [4/7]: Curated digital collection mockups verified (apparel, accessory, homedecor, stationery)');

  // 5. SPA routes
  for (const route of ['/shop', '/cart', '/checkout', '/downloads', '/licensing']) {
    const spaRes = await fetch(`${BASE_URL}${route}`);
    assert.equal(spaRes.status, 200, `SPA route ${route} should return 200`);
    const spaHtml = await spaRes.text();
    assert.ok(spaHtml.includes('<div id="root">'), `SPA route ${route} should serve root HTML`);
  }
  console.log('PASS [5/7]: SPA client-side routing rewrites verified (/shop, /cart, /checkout, /downloads, /licensing)');

  // 6. Service worker headers
  const swRes = await fetch(`${BASE_URL}/sw.js`);
  assert.equal(swRes.status, 200, 'sw.js should return 200');
  assert.equal(swRes.headers.get('cache-control'), 'no-cache', 'sw.js should have Cache-Control: no-cache');
  console.log('PASS [6/7]: Service worker PWA assets & caching headers verified');

  // 7. Non-API rewrite safety
  const apiCheck = await fetch(`${BASE_URL}/api/checkout/create`);
  assert.equal(apiCheck.status, 404, 'Direct relative /api call on Firebase Hosting must NOT return SPA index.html (404 expected as backend is Netlify)');
  console.log('PASS [7/7]: SPA rewrite excludes /api/** correctly (prevents invalid HTML responses)');

  console.log('=== ALL 7 DEPLOYMENT VERIFICATION CHECKS PASSED ===');
}

verify().catch((err) => {
  console.error('Deployment verification failed:', err);
  process.exit(1);
});
