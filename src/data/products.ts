export type ProductCategory =
  | 'Crafting Designs'
  | 'Printables'
  | 'Business & Branding'
  | 'Print-on-Demand Designs'
  | 'Design Bundles';

export type LicenseTierId = 'standard' | 'commercial' | 'personal';

export interface LicenseOption {
  id: LicenseTierId;
  name: string;
  priceMultiplier: number;
  summary: string;
  permissions: string[];
  restrictions: string[];
}

export interface ProductPreviewSheet {
  id: string;
  title: string;
  subtitle: string;
  accentColor: string;
  badgeText: string;
  pageNumber: string;
  illustrationType: 'botanical-craft' | 'pod-typography' | 'planner-grid' | 'brand-kit' | 'sticker-sheet' | 'packaging-insert';
  sampleElements: string[];
}

export interface DigitalProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  price: number; // Base price in ZMW
  compareAtPrice?: number;
  currency: 'ZMW' | 'USD';
  category: ProductCategory;
  badge?: string;
  featured: boolean;
  publishedAt: string; // ISO date
  publicationStatus: 'published' | 'draft';
  verifiedPageCount: number;
  verifiedFileCount: number;
  fileFormat: 'PDF Bundle (Standard US Letter & A4 PDF)';
  includedFiles: {
    filename: string;
    pageCount: number;
    description: string;
  }[];
  intendedUses: string[];
  compatibilityNotes: string[];
  accentTheme: 'lavender' | 'peach' | 'mint' | 'yellow' | 'blue';
  coverPreview: ProductPreviewSheet;
  samplePages: ProductPreviewSheet[];
  relatedProductIds: string[];
}

export const STANDARD_LICENSE: LicenseOption = {
  id: 'standard',
  name: 'Standard Commercial Use Licence',
  priceMultiplier: 1,
  summary: 'Full creative freedom: use for all your personal crafting projects and permitted commercial physical end products (up to 500 units per design).',
  permissions: [
    'Print unlimited physical copies for personal craft projects, gifts, and home decor',
    'Use on physical commercial end products for sale (apparel, totes, stickers, mugs, packaging, stationery) up to 500 physical units per design',
    'Use in small business branding, customer order packaging, and print-on-demand production runs',
    'Lifetime access and re-download rights via your customer order library'
  ],
  restrictions: [
    'Strictly prohibited to resell, share, sublicense, or redistribute the original or modified digital PDF files as standalone digital assets',
    'Cannot claim original copyright or trademark ownership of Two Kids Design artwork',
    'Never upload raw digital files to shared drives, torrents, or digital resource libraries for redistribution'
  ]
};

export const LICENSE_OPTIONS: Record<string, LicenseOption> = {
  standard: STANDARD_LICENSE,
  commercial: {
    ...STANDARD_LICENSE,
    id: 'commercial',
  },
  personal: {
    ...STANDARD_LICENSE,
    id: 'personal',
  },
};

export const DEFAULT_LICENSE: LicenseTierId = 'standard';

export const PRODUCTS: DigitalProduct[] = [
  {
    id: 'tkd-bundle-01',
    name: 'The Maker’s Botanical & Craft Sticker PDF Bundle',
    slug: 'makers-botanical-craft-sticker-pdf-bundle',
    shortDescription: '24 print-ready PDF sheets of hand-crafted botanical emblems, studio labels, and cut-friendly craft motifs.',
    fullDescription: 'Designed specifically for home crafters, journaling enthusiasts, and handmade shop owners. The Maker’s Botanical & Craft Sticker PDF Bundle delivers 24 meticulously arranged PDF sheets featuring organic floral illustrations, apothecary-inspired labels, and joyful studio badges. Every sheet is formatted with clean margins for effortless home printing or craft-cutter registration.',
    price: 180.00,
    compareAtPrice: 240.00,
    currency: 'ZMW',
    category: 'Crafting Designs',
    badge: 'Best Seller',
    featured: true,
    publishedAt: '2026-09-15',
    publicationStatus: 'published',
    verifiedPageCount: 24,
    verifiedFileCount: 3,
    fileFormat: 'PDF Bundle (Standard US Letter & A4 PDF)',
    includedFiles: [
      {
        filename: 'TKD-Botanical-Craft-Sheets-US-Letter.pdf',
        pageCount: 12,
        description: '12 full-sheet botanical & craft motif layouts formatted for US Letter (8.5" x 11").'
      },
      {
        filename: 'TKD-Botanical-Craft-Sheets-A4.pdf',
        pageCount: 10,
        description: '10 international A4 formatted sticker & label sheets with trim guides.'
      },
      {
        filename: 'TKD-Botanical-Print-And-Cut-Guide.pdf',
        pageCount: 2,
        description: '2-page quick-start printing guide, paper stock recommendations, and licence certificate.'
      }
    ],
    intendedUses: [
      'Home printing on matte or glossy sticker paper',
      'Scrapbooking, bullet journaling, and gift wrapping',
      'Handmade product packaging seals and envelope stickers'
    ],
    compatibilityNotes: [
      'Opens in any standard PDF viewer (Adobe Acrobat Reader, macOS Preview, Chrome/Edge PDF viewer)',
      'Formatted for standard home inkjet and laser printers (US Letter & A4 included)'
    ],
    accentTheme: 'mint',
    coverPreview: {
      id: 'botanical-cover',
      title: 'Botanical & Studio Sticker Collection',
      subtitle: '24 Curated PDF Pages · US Letter & A4',
      accentColor: '#D9E9DC',
      badgeText: '24 PDF Pages',
      pageNumber: 'Cover · Vol. 01',
      illustrationType: 'botanical-craft',
      sampleElements: ['Wildflower Stamps', 'Handmade With Care Seals', 'Studio Foliage Cutouts', 'Apothecary Labels']
    },
    samplePages: [
      {
        id: 'botanical-p1',
        title: 'Sheet 01–08: Pressed Flora & Leaf Motifs',
        subtitle: 'Clean white kiss-cut borders around every botanical element',
        accentColor: '#D9E9DC',
        badgeText: 'Pages 1–8',
        pageNumber: 'Sheet 01 / 24',
        illustrationType: 'botanical-craft',
        sampleElements: ['Eucalyptus Sprigs', 'Sunburst Daisy', 'Fern Fronds', 'Monstera Cutout']
      },
      {
        id: 'botanical-p2',
        title: 'Sheet 09–18: Maker Seals & Studio Badges',
        subtitle: 'Warm typography badges for craft projects & happy mail',
        accentColor: '#F3E4A9',
        badgeText: 'Pages 9–18',
        pageNumber: 'Sheet 12 / 24',
        illustrationType: 'sticker-sheet',
        sampleElements: ['Crafted by Hand', 'Open With Joy', 'Small Batch Studio', 'One of a Kind']
      },
      {
        id: 'botanical-p3',
        title: 'Sheet 19–24: Grid Labels & Trim Guide',
        subtitle: 'Writable frame labels and printer calibration checklist',
        accentColor: '#FAF8F3',
        badgeText: 'Pages 19–24',
        pageNumber: 'Sheet 24 / 24',
        illustrationType: 'packaging-insert',
        sampleElements: ['Batch No. Labels', 'Date & Maker Tags', 'Print Scale Ruler', 'Paper Guide']
      }
    ],
    relatedProductIds: ['tkd-bundle-03', 'tkd-bundle-05', 'tkd-bundle-02']
  },
  {
    id: 'tkd-bundle-02',
    name: 'Bold Optimist Print-on-Demand Graphic PDF Pack',
    slug: 'bold-optimist-print-on-demand-graphic-pdf-pack',
    shortDescription: '18 contemporary typographic and retro-modern graphic compositions crafted for tote bags, posters, and apparel.',
    fullDescription: 'Built for print-on-demand entrepreneurs and independent merchandise creators. The Bold Optimist PDF Pack contains 18 expressive graphic art sheets blending crisp geometric forms, uplifting editorial slogans, and playful studio emblems. Use the Personal Licence for DIY heat-transfer and wall art, or select the Commercial Licence for physical merchandise runs.',
    price: 260.00,
    compareAtPrice: 340.00,
    currency: 'ZMW',
    category: 'Print-on-Demand Designs',
    badge: 'POD Ready',
    featured: true,
    publishedAt: '2026-09-28',
    publicationStatus: 'published',
    verifiedPageCount: 18,
    verifiedFileCount: 2,
    fileFormat: 'PDF Bundle (Standard US Letter & A4 PDF)',
    includedFiles: [
      {
        filename: 'TKD-Bold-Optimist-Graphics-Collection.pdf',
        pageCount: 16,
        description: '16 full-page graphic art compositions for posters, tote transfers, and apparel placement.'
      },
      {
        filename: 'TKD-POD-Placement-And-Color-Spec.pdf',
        pageCount: 2,
        description: '2-page placement guide, hex/CMYK colour reference sheet, and licence terms.'
      }
    ],
    intendedUses: [
      'Tote bag, mug, and t-shirt transfer printing',
      'Framed studio wall prints and desk art cards',
      'Notebook covers and stationery merchandise'
    ],
    compatibilityNotes: [
      'Standard PDF format readable across Windows, macOS, iOS, and Android',
      'Clean vector-sharp typography inside every PDF sheet'
    ],
    accentTheme: 'lavender',
    coverPreview: {
      id: 'pod-cover',
      title: 'Bold Optimist Graphic Series',
      subtitle: '18 Statement Graphic PDF Sheets',
      accentColor: '#DCD4F2',
      badgeText: '18 PDF Pages',
      pageNumber: 'Cover · Vol. 02',
      illustrationType: 'pod-typography',
      sampleElements: ['Create Every Day', 'Good Energy Club', 'Studio Sunburst', 'Make Things That Matter']
    },
    samplePages: [
      {
        id: 'pod-p1',
        title: 'Compositions 01–06: Editorial Type Posters',
        subtitle: 'High-contrast modern Swiss & playful geometric layouts',
        accentColor: '#DCD4F2',
        badgeText: 'Pages 1–6',
        pageNumber: 'Art Sheet 04 / 18',
        illustrationType: 'pod-typography',
        sampleElements: ['Bold Sans Grids', 'Checkerboard Sun', 'Creative Club Crest', ' Cobalt & Charcoal']
      },
      {
        id: 'pod-p2',
        title: 'Compositions 07–16: Tote & Mug Emblem Layouts',
        subtitle: 'Centered badge compositions balanced for merchandise',
        accentColor: '#F5D5C5',
        badgeText: 'Pages 7–16',
        pageNumber: 'Art Sheet 11 / 18',
        illustrationType: 'sticker-sheet',
        sampleElements: ['Coffee & Concepts', 'Design Dept. 2026', 'Slow Craft Society', 'Playful Geometry']
      },
      {
        id: 'pod-p3',
        title: 'Pages 17–18: Colour Palette & Placement Spec',
        subtitle: 'Exact colour swatches and chest/tote sizing reference',
        accentColor: '#E3F3FA',
        badgeText: 'Pages 17–18',
        pageNumber: 'Spec Sheet 18 / 18',
        illustrationType: 'brand-kit',
        sampleElements: ['CMYK Ink Notes', 'Tote Center Guide', 'Apparel Scale Chart', 'Usage Summary']
      }
    ],
    relatedProductIds: ['tkd-bundle-04', 'tkd-bundle-06', 'tkd-bundle-01']
  },
  {
    id: 'tkd-bundle-03',
    name: 'Small Shop Packaging & Thank-You Card PDF Suite',
    slug: 'small-shop-packaging-thank-you-card-pdf-suite',
    shortDescription: '30 printable packaging inserts, care instruction cards, box seals, and thank-you notes for small business owners.',
    fullDescription: 'Turn every customer unboxing into a memorable brand moment. The Small Shop Packaging & Thank-You Card PDF Suite gives makers, Etsy sellers, and independent brands 30 cohesive PDF pages of printable order inserts, product care cards, fragility seals, and multi-up thank-you postcards.',
    price: 220.00,
    currency: 'ZMW',
    category: 'Business & Branding',
    badge: 'Entrepreneur Pick',
    featured: true,
    publishedAt: '2026-10-01',
    publicationStatus: 'published',
    verifiedPageCount: 30,
    verifiedFileCount: 3,
    fileFormat: 'PDF Bundle (Standard US Letter & A4 PDF)',
    includedFiles: [
      {
        filename: 'TKD-Thank-You-And-Care-Cards-4Up.pdf',
        pageCount: 16,
        description: '16 sheets of 4-up postcard layouts (thank you notes, handmade care instructions, review requests).'
      },
      {
        filename: 'TKD-Box-Seals-And-Shipping-Flair.pdf',
        pageCount: 12,
        description: '12 sheets of wrap-around box seals, tissue paper stickers, and "Packed with Pride" badges.'
      },
      {
        filename: 'TKD-Small-Shop-Cutting-Layout-Guide.pdf',
        pageCount: 2,
        description: '2-page cardstock weight guide and guillotine trim marks reference.'
      }
    ],
    intendedUses: [
      'Customer order inserts and thank-you postcards',
      'Handmade item care instructions (apparel, ceramics, paper goods)',
      'Custom tissue paper and mailer box sealing strips'
    ],
    compatibilityNotes: [
      'Includes single-card and 4-per-page imposition layouts to save cardstock',
      'Works with standard home printers or local print shops via PDF'
    ],
    accentTheme: 'peach',
    coverPreview: {
      id: 'biz-cover',
      title: 'Small Business Unboxing & Insert Suite',
      subtitle: '30 Printable PDF Pages for Makers & Shops',
      accentColor: '#F5D5C5',
      badgeText: '30 PDF Pages',
      pageNumber: 'Cover · Vol. 03',
      illustrationType: 'packaging-insert',
      sampleElements: ['Thank You Postcards', 'Care Instruction Cards', 'Box Seal Strips', 'Small Biz Badges']
    },
    samplePages: [
      {
        id: 'biz-p1',
        title: 'Pages 01–16: 4-Up Thank You & Care Postcards',
        subtitle: 'Print four cards per sheet with precision crop marks',
        accentColor: '#F5D5C5',
        badgeText: 'Pages 1–16',
        pageNumber: 'Layout 05 / 30',
        illustrationType: 'packaging-insert',
        sampleElements: ['You Made Our Day', 'Care Instructions', 'Share Your Snap', 'Support Small']
      },
      {
        id: 'biz-p2',
        title: 'Pages 17–28: Fold-Over Box Seals & Stickers',
        subtitle: 'Colour-coordinated corner seals for mailers and kraft boxes',
        accentColor: '#D9E9DC',
        badgeText: 'Pages 17–28',
        pageNumber: 'Layout 21 / 30',
        illustrationType: 'brand-kit',
        sampleElements: ['Do Not Bend Flair', 'Happy Mail Inside', 'Studio Checked', 'Handle With Joy']
      }
    ],
    relatedProductIds: ['tkd-bundle-04', 'tkd-bundle-01', 'tkd-bundle-06']
  },
  {
    id: 'tkd-bundle-04',
    name: 'Creative Entrepreneur Planner & Launch Workbook PDF',
    slug: 'creative-entrepreneur-planner-launch-workbook-pdf',
    shortDescription: '42 structured printable worksheets for product launches, craft fair prep, pricing calculators, and content calendars.',
    fullDescription: 'Stay organized from initial sketch to product launch. This 42-page PDF workbook is tailored specifically for creative business owners, crafters, and digital/POD shop founders. Includes undated daily studio schedules, craft market inventory trackers, handmade unit cost worksheets, and 90-day launch roadmaps.',
    price: 190.00,
    currency: 'ZMW',
    category: 'Printables',
    badge: '42 Pages',
    featured: true,
    publishedAt: '2026-10-04',
    publicationStatus: 'published',
    verifiedPageCount: 42,
    verifiedFileCount: 2,
    fileFormat: 'PDF Bundle (Standard US Letter & A4 PDF)',
    includedFiles: [
      {
        filename: 'TKD-Entrepreneur-Launch-Workbook-US-Letter.pdf',
        pageCount: 21,
        description: '21 core business planning, pricing, and inventory templates (US Letter).'
      },
      {
        filename: 'TKD-Entrepreneur-Launch-Workbook-A4.pdf',
        pageCount: 21,
        description: '21 core business planning, pricing, and inventory templates (A4 International).'
      }
    ],
    intendedUses: [
      'Desktop binder printing for daily studio management',
      'Tablet PDF annotation apps (GoodNotes, Notability, PDF Expert)',
      'Product pricing, material cost tracking, and launch planning'
    ],
    compatibilityNotes: [
      'Provided in both US Letter and A4 PDF files (21 distinct templates x 2 sizes = 42 total pages)',
      'High-legibility charcoal grid lines engineered for crisp black-and-white or colour printing'
    ],
    accentTheme: 'blue',
    coverPreview: {
      id: 'planner-cover',
      title: 'Creative Studio & Launch Workbook',
      subtitle: '42 Structured PDF Worksheets (Letter & A4)',
      accentColor: '#E3F3FA',
      badgeText: '42 PDF Pages',
      pageNumber: 'Cover · Vol. 04',
      illustrationType: 'planner-grid',
      sampleElements: ['Product Launch Map', 'Pricing Formula Sheet', 'Craft Fair Checklist', 'Weekly Studio Grid']
    },
    samplePages: [
      {
        id: 'planner-p1',
        title: 'Templates 01–10: Product Costing & Profit Margin Sheets',
        subtitle: 'Clear tables to calculate materials, time, packaging, and retail price',
        accentColor: '#E3F3FA',
        badgeText: 'Cost & Margin',
        pageNumber: 'Sheet 03 / 21',
        illustrationType: 'planner-grid',
        sampleElements: ['Bill of Materials', 'Time & Overhead', 'Wholesale vs Retail', 'Bundle Margin']
      },
      {
        id: 'planner-p2',
        title: 'Templates 11–21: Collection Launch & Market Prep',
        subtitle: 'Step-by-step checklists from sample testing to launch day',
        accentColor: '#FAF8F3',
        badgeText: 'Launch Roadmaps',
        pageNumber: 'Sheet 16 / 21',
        illustrationType: 'planner-grid',
        sampleElements: ['30-Day Countdown', 'SKU Tracker', 'Booth Inventory', 'Post-Launch Review']
      }
    ],
    relatedProductIds: ['tkd-bundle-03', 'tkd-bundle-06', 'tkd-bundle-05']
  },
  {
    id: 'tkd-bundle-05',
    name: 'Playful Geometric Pattern & Scrapbooking Paper PDF Pack',
    slug: 'playful-geometric-pattern-scrapbooking-paper-pdf-pack',
    shortDescription: '20 full-bleed patterned PDF sheets for origami, cardmaking, envelope liners, and decoupage crafts.',
    fullDescription: 'Bring modern studio colour to your paper crafts. This collection includes 20 coordinated seamless pattern sheets in our signature palette of sky blue, warm yellow, soft peach, mint, and charcoal. Ideal for cardmaking backgrounds, custom envelope liners, journal dividers, and gift tags.',
    price: 150.00,
    currency: 'ZMW',
    category: 'Crafting Designs',
    featured: false,
    publishedAt: '2026-10-06',
    publicationStatus: 'published',
    verifiedPageCount: 20,
    verifiedFileCount: 2,
    fileFormat: 'PDF Bundle (Standard US Letter & A4 PDF)',
    includedFiles: [
      {
        filename: 'TKD-Geometric-Craft-Papers-Collection.pdf',
        pageCount: 18,
        description: '18 full-page decorative craft patterns in coordinated studio palettes.'
      },
      {
        filename: 'TKD-Envelope-Liner-And-Tag-Templates.pdf',
        pageCount: 2,
        description: '2-page printable trace-and-cut templates for A2/A7 envelope liners and gift tags.'
      }
    ],
    intendedUses: [
      'Handmade greeting cards and envelope liners',
      'Scrapbook page backgrounds and collage art',
      'DIY gift boxes, belly bands, and paper garlands'
    ],
    compatibilityNotes: [
      'Print borderless or trim along outer crop guides',
      'Standard PDF format compatible with all home and print-shop printers'
    ],
    accentTheme: 'yellow',
    coverPreview: {
      id: 'pattern-cover',
      title: 'Playful Geometric Craft Papers',
      subtitle: '20 Coordinated Pattern & Template PDF Pages',
      accentColor: '#F3E4A9',
      badgeText: '20 PDF Pages',
      pageNumber: 'Cover · Vol. 05',
      illustrationType: 'botanical-craft',
      sampleElements: ['Bauhaus Arches', 'Speckled Terrazzo', 'Sky Blue Stripes', 'Envelope Templates']
    },
    samplePages: [
      {
        id: 'pattern-p1',
        title: 'Patterns 01–18: Coordinated Studio Swatches',
        subtitle: 'Mix-and-match geometric, organic dot, and stripe sheets',
        accentColor: '#F3E4A9',
        badgeText: 'Pages 1–18',
        pageNumber: 'Pattern 08 / 20',
        illustrationType: 'brand-kit',
        sampleElements: ['Warm Ivory Grid', 'Cobalt Wave', 'Peach Halftone', 'Mint Check']
      }
    ],
    relatedProductIds: ['tkd-bundle-01', 'tkd-bundle-06', 'tkd-bundle-04']
  },
  {
    id: 'tkd-bundle-06',
    name: 'The Complete Two Kids Studio Master Collection (5-in-1 Bundle)',
    slug: 'complete-two-kids-studio-master-collection-bundle',
    shortDescription: 'All 5 signature Two Kids Design PDF collections in one discounted master download — 134 total PDF pages.',
    fullDescription: 'Our best-value studio collection for serious makers, multi-craft hobbyists, and growing creative businesses. Includes every file from our Botanical Sticker Bundle, Bold Optimist POD Pack, Small Shop Packaging Suite, Entrepreneur Launch Workbook, and Geometric Craft Papers—totalling 134 verified PDF pages across 12 organized PDF documents.',
    price: 680.00,
    compareAtPrice: 1000.00,
    currency: 'ZMW',
    category: 'Design Bundles',
    badge: 'Save 32% · All-In-One',
    featured: true,
    publishedAt: '2026-10-10',
    publicationStatus: 'published',
    verifiedPageCount: 134,
    verifiedFileCount: 12,
    fileFormat: 'PDF Bundle (Standard US Letter & A4 PDF)',
    includedFiles: [
      {
        filename: 'TKD-Master-01-Botanical-Sticker-Bundle.pdf',
        pageCount: 24,
        description: 'Complete 24-page Maker’s Botanical & Craft Sticker PDF Bundle.'
      },
      {
        filename: 'TKD-Master-02-Bold-Optimist-POD-Pack.pdf',
        pageCount: 18,
        description: 'Complete 18-page Bold Optimist Print-on-Demand Graphic PDF Pack.'
      },
      {
        filename: 'TKD-Master-03-Small-Shop-Packaging-Suite.pdf',
        pageCount: 30,
        description: 'Complete 30-page Small Shop Packaging & Thank-You Card PDF Suite.'
      },
      {
        filename: 'TKD-Master-04-Entrepreneur-Workbook.pdf',
        pageCount: 42,
        description: 'Complete 42-page Creative Entrepreneur Planner & Launch Workbook.'
      },
      {
        filename: 'TKD-Master-05-Geometric-Craft-Papers.pdf',
        pageCount: 20,
        description: 'Complete 20-page Playful Geometric Pattern & Scrapbooking Paper Pack.'
      }
    ],
    intendedUses: [
      'Complete creative toolkit for crafting, packaging, planning, and POD merchandise',
      'Ideal starter library for new Etsy, Shopify, or craft market businesses'
    ],
    compatibilityNotes: [
      'Instant access to all 134 pages formatted for standard PDF viewers and printers',
      'Available with Personal Crafter or Commercial Small Business licensing'
    ],
    accentTheme: 'blue',
    coverPreview: {
      id: 'master-cover',
      title: 'Two Kids Studio Master 5-in-1 Anthology',
      subtitle: 'All 134 PDF Pages · Complete Creative Library',
      accentColor: '#DCD4F2',
      badgeText: '134 PDF Pages',
      pageNumber: 'Master Anthology',
      illustrationType: 'brand-kit',
      sampleElements: ['24 Sticker Sheets', '18 POD Graphics', '30 Shop Inserts', '42 Planner Pages', '20 Pattern Papers']
    },
    samplePages: [
      {
        id: 'master-p1',
        title: 'Included Collection 1 & 2: Stickers + POD Graphics',
        subtitle: '42 combined pages of botanical cutouts and bold typographic art',
        accentColor: '#D9E9DC',
        badgeText: '42 Art Pages',
        pageNumber: 'Anthology Part I',
        illustrationType: 'pod-typography',
        sampleElements: ['Botanical Cutouts', 'Studio Seals', 'Tote Graphics', 'Poster Art']
      },
      {
        id: 'master-p2',
        title: 'Included Collection 3, 4 & 5: Business + Printables + Papers',
        subtitle: '92 combined pages of packaging cards, launch planners, and seamless patterns',
        accentColor: '#F5D5C5',
        badgeText: '92 Studio Pages',
        pageNumber: 'Anthology Part II',
        illustrationType: 'packaging-insert',
        sampleElements: ['4-Up Thank You Cards', 'Cost Calculators', 'Launch Checklists', 'Seamless Patterns']
      }
    ],
    relatedProductIds: ['tkd-bundle-01', 'tkd-bundle-02', 'tkd-bundle-03']
  }
];

export const ACTIVE_CATEGORIES: ProductCategory[] = Array.from(
  new Set(PRODUCTS.filter(p => p.publicationStatus === 'published').map(p => p.category))
);

export function getProductBySlug(slug: string): DigitalProduct | undefined {
  return PRODUCTS.find(p => p.slug === slug && p.publicationStatus === 'published');
}

export function getProductById(id: string): DigitalProduct | undefined {
  return PRODUCTS.find(p => p.id === id && p.publicationStatus === 'published');
}

export function calculateItemPrice(product: DigitalProduct, license?: LicenseTierId): number {
  const option = (license && LICENSE_OPTIONS[license]) || STANDARD_LICENSE;
  return Math.round(product.price * option.priceMultiplier * 100) / 100;
}

export const STORE_CURRENCY = 'ZMW' as const;

export function formatPrice(amount: number, currency = 'ZMW'): string {
  return `${currency} ${amount.toFixed(2)}`;
}

export type CuratedCollectionId = 'apparel' | 'home-decor' | 'accessory' | 'stationery';

export interface CuratedCollection {
  id: CuratedCollectionId;
  name: string;
  tagline: string;
  description: string;
  accentBg: string;
  image: string;
  productIds: string[];
  leadProductId: string;
}

export const CURATED_COLLECTIONS: CuratedCollection[] = [
  {
    id: 'apparel',
    name: 'Apparel',
    tagline: 'Clothing graphics & garment designs',
    description: 'Clothing graphics, garment designs and wearable creative projects.',
    accentBg: 'bg-lavender/40 hover:bg-lavender/60 border-lavender/60',
    image: '/images/apparel.jpg',
    productIds: ['tkd-bundle-02', 'tkd-bundle-06'],
    leadProductId: 'tkd-bundle-02',
  },
  {
    id: 'home-decor',
    name: 'Home Decor',
    tagline: 'Printable artwork & living spaces',
    description: 'Printable artwork and creative designs for decorating living spaces.',
    accentBg: 'bg-mint/40 hover:bg-mint/60 border-mint/60',
    image: '/images/homedecor.jpg',
    productIds: ['tkd-bundle-02', 'tkd-bundle-05', 'tkd-bundle-06'],
    leadProductId: 'tkd-bundle-05',
  },
  {
    id: 'accessory',
    name: 'Accessory',
    tagline: 'Bags, phone cases, totes & daily essentials',
    description: 'Bags, phone cases, tote bags and creative designs for daily accessories.',
    accentBg: 'bg-warmYellow/40 hover:bg-warmYellow/60 border-warmYellow/60',
    image: '/images/accessory.jpg',
    productIds: ['tkd-bundle-01', 'tkd-bundle-02', 'tkd-bundle-06'],
    leadProductId: 'tkd-bundle-02',
  },
  {
    id: 'stationery',
    name: 'Stationery',
    tagline: 'Cards, labels, planners & papercraft',
    description: 'Cards, labels, planners and other paper-based creative projects.',
    accentBg: 'bg-peach/40 hover:bg-peach/60 border-peach/60',
    image: '/images/stationery.jpg',
    productIds: ['tkd-bundle-01', 'tkd-bundle-03', 'tkd-bundle-04', 'tkd-bundle-05', 'tkd-bundle-06'],
    leadProductId: 'tkd-bundle-01',
  },
];

export function getCuratedCollection(id: string): CuratedCollection | undefined {
  return CURATED_COLLECTIONS.find(c => c.id === id);
}

