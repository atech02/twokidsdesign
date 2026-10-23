import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Printer,
  Layers,
  Briefcase,
} from 'lucide-react';
import { PRODUCTS, CURATED_COLLECTIONS } from '../data/products';
import { ProductCard } from '../components/ProductCard';

const easeOutEditorial = [0.22, 1, 0.36, 1] as const;

export const HomePage: React.FC = () => {
  // Homepage showcase: strictly maximum 3 featured products per specification
  const showcaseProducts = PRODUCTS.filter(p => p.publicationStatus === 'published').slice(0, 3);

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* 1. HOMEPAGE HERO — REFINED EDITORIAL BANNER & LIQUID GLASS UI */}
      <section className="relative overflow-hidden border-b border-charcoal/10">
        {/* Animated Cinematic Hero Background Image */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
          <div className="absolute -inset-4 sm:-inset-8 w-[calc(100%+2rem)] sm:w-[calc(100%+4rem)] h-[calc(100%+2rem)] sm:h-[calc(100%+4rem)] hero-bg-animated">
            <img
              src="/images/heroimg.jpg"
              alt="Two Kids Design Creative Studio Background"
              className="w-full h-full object-cover object-[center_35%]"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </div>
          {/* Soft Neutral Editorial Overlay to Ensure Optimal Typography Contrast */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#FAF8F3]/90 via-[#FAF8F3]/78 to-[#FAF8F3]/94" />
        </div>

        {/* Hero Foreground Content — Clean, uncluttered layout with generous breathing room */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-24 pb-16 sm:pb-28">
          <div className="max-w-3xl mx-auto text-center space-y-7 sm:space-y-8">
            {/* 1. Exact Main Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeOutEditorial }}
              className="font-heading font-extrabold text-4xl sm:text-6xl lg:text-7xl text-charcoal tracking-tight leading-[1.12]"
            >
              Fun designs.{' '}
              <span className="text-brandBlue-dark italic">
                Endless possibilities.
              </span>
            </motion.h1>

            {/* 2. Exact Supporting Description */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1, ease: easeOutEditorial }}
              className="text-base sm:text-lg lg:text-[19px] text-charcoal/75 max-w-xl mx-auto leading-relaxed font-normal"
            >
              Creative, memorable and flexible enough to cover apparel, home décor, stationery and other digital products.
            </motion.p>

            {/* 3. Centered Explore All Designs Button with Subtle Liquid Glass UI */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.18, ease: easeOutEditorial }}
              className="flex justify-center items-center pt-2"
            >
              <Link
                to="/shop"
                className="liquid-glass-hero-button text-sm sm:text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-brandBlue"
              >
                <span>Explore All Designs</span>
                <ArrowRight className="w-4 h-4 text-brandBlue" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. CURATED DIGITAL COLLECTIONS (FOUR COLLECTIONS: APPAREL, HOME DECOR, ACCESSORY, STATIONERY) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brandBlue-dark">
              CURATED DIGITAL COLLECTIONS
            </span>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-charcoal mt-1">
              Shop by Creative Project
            </h2>
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-charcoal hover:text-brandBlue-dark transition-colors"
          >
            <span>View Full Catalogue ({PRODUCTS.length} Bundles)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Responsive Grid: 2 cols on mobile/tablet, 4 cols on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {CURATED_COLLECTIONS.map(collection => (
            <Link
              key={collection.id}
              to={`/shop?collection=${collection.id}`}
              className="group flex flex-col rounded-2xl bg-white border border-charcoal/10 overflow-hidden shadow-editorial hover:shadow-editorial-hover hover:border-charcoal/20 transition-all duration-300"
            >
              {/* Prominent Mockup Image with Consistent Aspect Ratio */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-ivory">
                <img
                  src={collection.image}
                  alt={`${collection.name} Collection Mockup`}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                  loading="lazy"
                  decoding="async"
                />
              </div>

              {/* Collection Name Beneath the Image */}
              <div className="p-4 sm:p-5 text-center flex items-center justify-center bg-white">
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-charcoal group-hover:text-brandBlue-dark transition-colors tracking-tight">
                  {collection.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. FEATURED PRODUCT BUNDLES (MAX 3 FEATURED PRODUCTS) */}
      <section id="featured-bundles" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brandBlue-dark">
              SIGNATURE PDF BUNDLES
            </span>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-charcoal mt-1">
              Featured Digital Downloads
            </h2>
            <p className="text-sm sm:text-base text-charcoal/75 mt-1">
              Every bundle includes verified page counts, print-ready US Letter &amp; A4 layouts, and instant download access.
            </p>
          </div>
          <Link
            to="/shop"
            className="liquid-glass-btn-secondary px-4 py-2.5 rounded-xl text-xs sm:text-sm shrink-0"
          >
            Browse All Designs
          </Link>
        </div>

        {/* Responsive Compact Grid: 2 cols on mobile, 3 on tablet/desktop */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {showcaseProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Centered Explore All Designs Button below showcase */}
        <div className="flex justify-center pt-10">
          <Link
            to="/shop"
            className="liquid-glass-hero-button text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brandBlue"
          >
            <span>Explore All Designs</span>
            <ArrowRight className="w-4 h-4 text-brandBlue" />
          </Link>
        </div>
      </section>

      {/* 4. HOW OUR DIGITAL PDF BUNDLES WORK */}
      <section className="bg-white border-y border-charcoal/10 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-brandBlue-dark">
              SIMPLE DIGITAL WORKFLOW
            </span>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-charcoal mt-1">
              From discovery to download in seconds
            </h2>
            <p className="text-sm sm:text-base text-charcoal/75 mt-2">
              No waiting on physical couriers or warehouse shipping. Get straight to making, printing, and launching.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-ivory p-6 border border-charcoal/10">
              <div className="w-10 h-10 rounded-xl bg-brandBlue-light border border-brandBlue/30 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5 text-brandBlue-dark" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-brandBlue-dark">
                Step 01
              </span>
              <h3 className="font-heading font-bold text-lg text-charcoal mt-1">
                Preview Included PDF Sheets
              </h3>
              <p className="text-sm text-charcoal/75 mt-2 leading-relaxed">
                Inspect the exact included filenames, verified page counts, and sample sheet previews before you buy.
              </p>
            </div>

            <div className="rounded-2xl bg-ivory p-6 border border-charcoal/10">
              <div className="w-10 h-10 rounded-xl bg-mint border border-charcoal/15 flex items-center justify-center mb-4">
                <Briefcase className="w-5 h-5 text-charcoal" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-brandBlue-dark">
                Step 02
              </span>
              <h3 className="font-heading font-bold text-lg text-charcoal mt-1">
                Standard Commercial Licence
              </h3>
              <p className="text-sm text-charcoal/75 mt-2 leading-relaxed">
                Every bundle includes our Standard Commercial Use Licence—no tiers, no surprises. Craft for yourself or sell physical products up to 500 units.
              </p>
            </div>

            <div className="rounded-2xl bg-ivory p-6 border border-charcoal/10">
              <div className="w-10 h-10 rounded-xl bg-warmYellow border border-charcoal/15 flex items-center justify-center mb-4">
                <Printer className="w-5 h-5 text-charcoal" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-brandBlue-dark">
                Step 03
              </span>
              <h3 className="font-heading font-bold text-lg text-charcoal mt-1">
                Instant Verified PDF Download
              </h3>
              <p className="text-sm text-charcoal/75 mt-2 leading-relaxed">
                Download your licensed PDF bundle immediately on your order confirmation page, or retrieve it anytime via Customer Downloads.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
