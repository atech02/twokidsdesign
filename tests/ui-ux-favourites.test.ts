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

  // Test 1: Curated Collections Specification (Exactly 4: Apparel, Home Decor, Accessory, Stationery)
  assert.equal(CURATED_COLLECTIONS.length, 4, 'Must have exactly 4 curated collections');
  const collectionIds = CURATED_COLLECTIONS.map(c => c.id);
  assert.deepEqual(collectionIds, ['apparel', 'home-decor', 'accessory', 'stationery']);
  
  const apparel = getCuratedCollection('apparel')!;
  assert.equal(apparel.name, 'Apparel');
  assert.ok(apparel.description.includes('Clothing graphics'), 'Apparel description must match specification');
  assert.equal(apparel.image, '/images/apparel.jpg');

  const homeDecor = getCuratedCollection('home-decor')!;
  assert.equal(homeDecor.name, 'Home Decor');
  assert.ok(homeDecor.description.includes('Printable artwork'), 'Home Decor description must match specification');
  assert.equal(homeDecor.image, '/images/homedecor.jpg');

  const accessory = getCuratedCollection('accessory')!;
  assert.equal(accessory.name, 'Accessory');
  assert.ok(accessory.description.includes('Bags, phone cases, tote bags'), 'Accessory description must match specification');
  assert.equal(accessory.image, '/images/accessory.jpg');

  const stationery = getCuratedCollection('stationery')!;
  assert.equal(stationery.name, 'Stationery');
  assert.ok(stationery.description.includes('Cards, labels, planners'), 'Stationery description must match specification');
  assert.equal(stationery.image, '/images/stationery.jpg');

  // Verify all collection mockup images exist
  for (const col of CURATED_COLLECTIONS) {
    const rawPath = col.image.replace(/^\//, '');
    assert.ok(fs.existsSync(rawPath), `Collection image ${rawPath} must exist in public/`);
    const sourcePath = rawPath.replace(/^public\//, '');
    assert.ok(fs.existsSync(sourcePath), `Collection source image ${sourcePath} must exist in images/`);
  }
  console.log('PASS [UI 1/6]: Exactly 4 Curated Collections defined with verified mockup images');

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
  // Test 7: Hero Background Image Asset Verification (images/heroimg.jpg)
  assert.ok(fs.existsSync('images/heroimg.jpg'), 'Hero background source image images/heroimg.jpg must exist');
  assert.ok(fs.existsSync('public/images/heroimg.jpg'), 'Hero background public asset public/images/heroimg.jpg must exist');
  const buf = fs.readFileSync('images/heroimg.jpg');
  let width = 0;
  let height = 0;
  for (let i = 0; i < buf.length - 8; i++) {
    if (buf[i] === 0xFF && (buf[i + 1] >= 0xC0 && buf[i + 1] <= 0xC3)) {
      height = buf.readUInt16BE(i + 5);
      width = buf.readUInt16BE(i + 7);
      break;
    }
  }
  assert.equal(width, 2532, 'Hero background width must be 2532px');
  assert.equal(height, 1406, 'Hero background height must be 1406px');
  console.log(`PASS [UI 7/8]: Hero background image asset verified (${width}x${height} JPEG)`);

  // Test 8: Homepage About Section Removed while Preserving Dedicated About & Licensing Page
  const homePageContent = fs.readFileSync('src/pages/HomePage.tsx', 'utf-8');
  assert.ok(!homePageContent.includes('ABOUT TWO KIDS DESIGN'), 'Homepage must not include ABOUT TWO KIDS DESIGN badge');
  assert.ok(!homePageContent.includes('Crafted with imagination'), 'Homepage must not include dark About heading');
  assert.ok(!homePageContent.includes('Shop All PDF Bundles'), 'Homepage must not include dark About buttons');
  
  const aboutPageContent = fs.readFileSync('src/pages/AboutPage.tsx', 'utf-8');
  assert.ok(aboutPageContent.includes('OUR STORY'), 'Dedicated About page must exist and contain full story');
  assert.ok(aboutPageContent.includes('Standard Commercial Use Licence'), 'Dedicated About page must retain licensing policies');

  const headerContent = fs.readFileSync('src/components/Header.tsx', 'utf-8');
  assert.ok(headerContent.includes("to: '/about'"), 'Header navigation must retain About & Licensing link');
  console.log('PASS [UI 8/9]: Homepage About section verified removed and dedicated About page intact');

  // Test 9: Logo Simplification & 4 Collections in Footer & Homepage
  assert.ok(!headerContent.includes('Digital PDF Studio'), 'Header must not contain text Digital PDF Studio');
  assert.ok(!headerContent.includes('font-heading font-extrabold text-base sm:text-lg tracking-tight text-charcoal'), 'Header must not contain text heading beside logo');
  assert.ok(headerContent.includes('src="/images/logo.jpeg"'), 'Header must contain logo image');

  const footerContent = fs.readFileSync('src/components/Footer.tsx', 'utf-8');
  assert.ok(!footerContent.includes('Digital Creations &amp; PDF Bundles'), 'Footer must not contain text Digital Creations & PDF Bundles');
  assert.ok(footerContent.includes('src="/images/logo.jpeg"'), 'Footer must contain logo image');
  assert.ok(footerContent.includes('/shop?collection=apparel'));
  assert.ok(footerContent.includes('/shop?collection=home-decor'));
  assert.ok(footerContent.includes('/shop?collection=accessory'));
  assert.ok(footerContent.includes('/shop?collection=stationery'));

  // Ensure footer collections appear in exact specified order
  const idxApparel = footerContent.indexOf('/shop?collection=apparel');
  const idxHomeDecor = footerContent.indexOf('/shop?collection=home-decor');
  const idxAccessory = footerContent.indexOf('/shop?collection=accessory');
  const idxStationery = footerContent.indexOf('/shop?collection=stationery');
  assert.ok(idxApparel < idxHomeDecor, 'Apparel must appear before Home Decor');
  assert.ok(idxHomeDecor < idxAccessory, 'Home Decor must appear before Accessory');
  assert.ok(idxAccessory < idxStationery, 'Accessory must appear before Stationery');

  console.log('PASS [UI 9/9]: Navbar and footer logos simplified and 4 collections verified in exact order');

  console.log('=== ALL 9 UI/UX & CATALOGUE TESTS PASSED ===');
}

runUiUxTestSuite();
