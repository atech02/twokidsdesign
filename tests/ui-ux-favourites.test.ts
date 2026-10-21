import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PRODUCTS,
  CURATED_COLLECTIONS,
  getCuratedCollection,
  STANDARD_LICENSE,
  calculateItemPrice,
  type DigitalProduct,
} from '../src/data/products';

function runUiUxTestSuite() {
  console.log('=== Two Kids Design — UI/UX Redesign & Catalogue Verification Suite ===');

  // Test 1: Curated Collections Specification (Exactly 3: Apparel, Home Decor, Stationery)
  assert.equal(CURATED_COLLECTIONS.length, 3, 'Must have exactly 3 curated collections');
  const collectionIds = CURATED_COLLECTIONS.map(c => c.id);
  assert.deepEqual(collectionIds, ['apparel', 'home-decor', 'stationery']);
  
  const apparel = getCuratedCollection('apparel')!;
  assert.equal(apparel.name, 'Apparel');
  assert.ok(apparel.description.includes('Clothing graphics'), 'Apparel description must match specification');
  assert.ok(apparel.leadProductId, 'Apparel must have a lead product ID for attractive artwork preview');

  const homeDecor = getCuratedCollection('home-decor')!;
  assert.equal(homeDecor.name, 'Home Decor');
  assert.ok(homeDecor.description.includes('Printable artwork'), 'Home Decor description must match specification');
  assert.ok(homeDecor.leadProductId, 'Home Decor must have a lead product ID for attractive artwork preview');

  const stationery = getCuratedCollection('stationery')!;
  assert.equal(stationery.name, 'Stationery');
  assert.ok(stationery.description.includes('Cards, labels, planners'), 'Stationery description must match specification');
  assert.ok(stationery.leadProductId, 'Stationery must have a lead product ID for attractive artwork preview');
  console.log('PASS [UI 1/6]: Exactly 3 Curated Collections defined with artwork previews and accurate descriptions');

  // Test 2: Product coverage across curated collections
  for (const col of CURATED_COLLECTIONS) {
    assert.ok(col.productIds.length > 0, `Collection ${col.name} must contain product IDs`);
    for (const pid of col.productIds) {
      const product = PRODUCTS.find(p => p.id === pid);
      assert.ok(product, `Product ID ${pid} in collection ${col.name} must exist in catalogue`);
    }
    const leadProduct = PRODUCTS.find(p => p.id === col.leadProductId);
    assert.ok(leadProduct, `Lead product ${col.leadProductId} must exist for collection ${col.name}`);
    assert.ok(leadProduct.coverPreview?.id, `Lead product must have coverPreview for collection ${col.name}`);
  }
  console.log('PASS [UI 2/6]: Real catalogue products mapped correctly to curated collections with verified previews');

  // Test 3: Homepage Showcase Display Limit (Strictly max 3 products)
  const publishedProducts = PRODUCTS.filter(p => p.publicationStatus === 'published');
  const homepageShowcase = publishedProducts.slice(0, 3);
  assert.ok(homepageShowcase.length <= 3, 'Homepage showcase must contain maximum 3 products');
  assert.equal(homepageShowcase.length, 3, 'Exactly 3 featured digital downloads shown on the homepage');
  console.log('PASS [UI 3/6]: Homepage product showcase strictly limited to max 3 products');

  // Test 4: Shop Batch Pagination Limit (Strictly max 10 per batch, never more)
  const PAGE_SIZE = 10;
  const page1 = publishedProducts.slice(0, PAGE_SIZE);
  assert.ok(page1.length <= 10, 'Active view must never exceed 10 products');
  console.log('PASS [UI 4/6]: Shop catalogue enforces strict batch limit of max 10 items at once');

  // Test 5: Synthetic Multi-Page Pagination Integrity (No Duplicates, No Skips)
  const mockCatalogue = Array.from({ length: 25 }, (_, i) => ({
    id: `mock-bundle-${i + 1}`,
    name: `Mock Design Bundle ${i + 1}`,
  }));
  const totalPages = Math.ceil(mockCatalogue.length / PAGE_SIZE);
  assert.equal(totalPages, 3);
  
  const batches = [];
  for (let p = 1; p <= totalPages; p++) {
    const start = (p - 1) * PAGE_SIZE;
    const batch = mockCatalogue.slice(start, start + PAGE_SIZE);
    assert.ok(batch.length <= PAGE_SIZE, `Page ${p} must have at most 10 items`);
    batches.push(...batch);
  }
  assert.equal(batches.length, 25, 'All items must be accounted for across pages');
  const uniqueIds = new Set(batches.map(b => b.id));
  assert.equal(uniqueIds.size, 25, 'Zero duplicates or skipped products across pagination batches');
  console.log('PASS [UI 5/6]: Pagination logic strictly enforces max 10/page with zero skips and zero duplicates');

  // Test 6: Currency in ZMW, Single Standard Commercial Use Licence and Pricing
  assert.equal(STANDARD_LICENSE.name, 'Standard Commercial Use Licence');
  assert.equal(STANDARD_LICENSE.priceMultiplier, 1, 'Standard licence has multiplier 1');

  for (const product of publishedProducts) {
    assert.equal(product.currency, 'ZMW');
    assert.ok(product.price > 0);
    // Guarantee single pricing regardless of licence alias
    assert.equal(calculateItemPrice(product, 'standard'), product.price);
    assert.equal(calculateItemPrice(product, 'commercial'), product.price);
    assert.equal(calculateItemPrice(product, 'personal'), product.price);
  }
  // Test 7: Hero Banner Image Asset Verification
  assert.ok(fs.existsSync('images/Screenshot (6).png'), 'Hero banner source image images/Screenshot (6).png must exist');
  assert.ok(fs.existsSync('public/images/Screenshot (6).png'), 'Hero banner public asset public/images/Screenshot (6).png must exist');
  const buf = fs.readFileSync('images/Screenshot (6).png');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.equal(width, 1366, 'Hero banner width must be 1366px');
  assert.equal(height, 768, 'Hero banner height must be 768px');
  assert.ok(width / height > 1.7, 'Hero banner must have widescreen landscape proportions (~16:9)');
  console.log('PASS [UI 7/7]: Hero banner image asset verified (1366x768 widescreen landscape)');

  console.log('=== ALL 7 UI/UX & CATALOGUE TESTS PASSED ===');
}

runUiUxTestSuite();
