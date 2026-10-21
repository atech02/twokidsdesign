import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Download,
  FileCheck2,
  Sparkles,
  ShieldCheck,
  Printer,
  Layers,
  Briefcase,
} from 'lucide-react';
import { PRODUCTS, CURATED_COLLECTIONS } from '../data/products';
import { ProductCard } from '../components/ProductCard';
import { PdfBundleSheetArt } from '../components/PdfBundleSheetArt';

const easeOutEditorial = [0.22, 1, 0.36, 1] as const;

export const HomePage: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  // Homepage showcase: strictly maximum 3 featured products per specification
  const showcaseProducts = PRODUCTS.filter(p => p.publicationStatus === 'published').slice(0, 3);
  const heroPrimaryBundle = PRODUCTS[0];
  const heroSecondaryBundle = PRODUCTS[1];

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* 1. HOMEPAGE HERO — CLEAN, PRODUCT-CENTRIC & FLOATING MOTION */}
      <section className="relative overflow-hidden pt-8 sm:pt-14 pb-14 sm:pb-20 border-b border-charcoal/10 bg-gradient-to-b from-white via-ivory to-ivory">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeOutEditorial }}
              className="font-heading font-extrabold text-4xl sm:text-6xl lg:text-[68px] text-charcoal tracking-tight leading-[1.08]"
            >
              Creative downloads.{' '}
              <span className="text-brandBlue-dark italic">
                Endless possibilities.
              </span>
            </motion.h1>

            {/* Supporting Copy */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1, ease: easeOutEditorial }}
              className="text-base sm:text-lg text-charcoal/75 max-w-2xl mx-auto leading-relaxed"
            >
              Discover fun, professionally crafted PDF design bundles made for crafters, entrepreneurs, and print-on-demand creators. Inspect every included sheet, enjoy standard commercial use, and download instantly.
            </motion.p>

            {/* Centered Explore All Designs Button */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.18, ease: easeOutEditorial }}
              className="flex justify-center items-center pt-2"
            >
              <Link
                to="/shop"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-charcoal px-8 py-3.5 text-sm sm:text-base font-semibold text-white hover:bg-brandBlue-dark transition-all shadow-editorial hover:shadow-editorial-hover active:scale-[0.99]"
              >
                <span>Explore All Designs</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Trust & Format Indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="pt-4 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs text-charcoal/70"
            >
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-brandBlue" />
                <span>US Letter &amp; A4 PDFs</span>
              </div>
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-brandBlue" />
                <span>Instant Verified Delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brandBlue" />
                <span>Clear Commercial Licences</span>
              </div>
            </motion.div>
          </div>

          {/* Floating Hero Artwork Composition with Parallax Motion */}
          <div className="mt-12 sm:mt-16 max-w-3xl mx-auto relative">
            {/* Secondary offset preview card with subtle floating parallax */}
            <motion.div
              animate={
                shouldReduceMotion
                  ? {}
                  : {
                      y: [0, 10, 0],
                      rotate: [3, 4.5, 3],
                      transition: {
                        duration: 8,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      },
                    }
              }
              className="hidden sm:block absolute -top-6 -right-6 w-[70%] rounded-2xl overflow-hidden shadow-editorial border border-charcoal/15 opacity-80 pointer-events-none z-0"
            >
              <PdfBundleSheetArt sheet={heroSecondaryBundle.coverPreview} variant="hero" />
            </motion.div>

            {/* Primary interactive bundle showcase with floating motion */}
            <motion.div
              animate={
                shouldReduceMotion
                  ? {}
                  : {
                      y: [0, -8, 0],
                      transition: {
                        duration: 6,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      },
                    }
              }
              className="relative z-10 rounded-2xl overflow-hidden shadow-editorial-hover border border-charcoal/20 bg-white"
            >
              <PdfBundleSheetArt sheet={heroPrimaryBundle.coverPreview} variant="hero" />
              <div className="p-4 sm:p-5 bg-white border-t border-charcoal/10 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brandBlue-dark">
                    Featured Studio Bundle · {heroPrimaryBundle.verifiedPageCount} Pages
                  </span>
                  <h2 className="font-heading font-bold text-base sm:text-lg text-charcoal">
                    {heroPrimaryBundle.name}
                  </h2>
                </div>
                <Link
                  to={`/product/${heroPrimaryBundle.slug}`}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-charcoal px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-brandBlue-dark transition-colors"
                >
                  <span>Preview Bundle</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. CURATED DIGITAL COLLECTIONS (EXACTLY THREE: APPAREL, HOME DECOR, STATIONERY) */}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CURATED_COLLECTIONS.map(collection => {
            const count = collection.productIds.length;
            const leadProduct = PRODUCTS.find(p => p.id === collection.leadProductId) || PRODUCTS[0];
            return (
              <Link
                key={collection.id}
                to={`/shop?collection=${collection.id}`}
                className={`group rounded-2xl p-5 sm:p-6 border transition-all flex flex-col justify-between shadow-editorial hover:shadow-editorial-hover bg-white hover:border-charcoal/20`}
              >
                <div>
                  {/* Category Artwork Preview Image */}
                  <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden mb-5 border border-charcoal/10 bg-ivory shadow-xs">
                    <PdfBundleSheetArt
                      sheet={leadProduct.coverPreview}
                      variant="card"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 border-0"
                    />
                    <div className="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur-xs text-[11px] font-bold uppercase tracking-wider text-charcoal px-2.5 py-1 rounded-full border border-charcoal/10 shadow-2xs">
                      {count} {count === 1 ? 'Bundle' : 'Bundles'}
                    </div>
                  </div>

                  {/* Title & Tagline */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading font-extrabold text-2xl text-charcoal group-hover:text-brandBlue-dark transition-colors">
                      {collection.name}
                    </h3>
                  </div>

                  {/* Short Supporting Description */}
                  <p className="text-sm text-charcoal/75 mt-2.5 leading-relaxed">
                    {collection.description}
                  </p>
                </div>

                {/* Clickable Action */}
                <div className="mt-6 pt-4 border-t border-charcoal/10 flex items-center justify-between text-xs font-bold text-charcoal group-hover:text-brandBlue-dark transition-colors">
                  <span>Explore {collection.name} Designs</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
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
            className="inline-flex items-center justify-center rounded-xl border border-charcoal/20 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-charcoal hover:border-charcoal transition-colors shrink-0"
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
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-charcoal px-7 py-3.5 text-sm font-semibold text-white hover:bg-brandBlue-dark transition-all shadow-editorial active:scale-[0.99]"
          >
            <span>Explore All Designs</span>
            <ArrowRight className="w-4 h-4" />
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

      {/* 5. BRAND STORY & STUDIO INTRODUCTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-charcoal text-ivory p-8 sm:p-12 lg:p-16 border border-charcoal shadow-editorial overflow-hidden relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brandBlue">
                <Sparkles className="w-3.5 h-3.5" />
                <span>ABOUT TWO KIDS DESIGN</span>
              </div>
              <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-white leading-tight">
                Crafted with imagination. Engineered for everyday makers and creative businesses.
              </h2>
              <p className="text-base sm:text-lg text-ivory/85 leading-relaxed max-w-2xl">
                At Two Kids Design, we create fun and professionally crafted digital products for crafters, entrepreneurs, and print-on-demand businesses. Every PDF bundle is organized for clarity, effortless printing, and real-world creative utility—helping you bring your ideas to life without starting from a blank page.
              </p>
              <div className="pt-3 flex flex-wrap gap-3">
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 rounded-xl bg-brandBlue px-5 py-3 text-sm font-semibold text-white hover:bg-brandBlue-dark transition-colors"
                >
                  <span>Shop All PDF Bundles</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  <span>Read Licensing &amp; Policies</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col items-center justify-center bg-white/5 rounded-2xl p-6 border border-white/10 text-center">
              <img
                src="/images/logo.jpeg"
                alt="Two Kids Design Official Logo"
                className="w-28 h-28 rounded-full object-cover border-2 border-brandBlue shadow-md mb-4"
              />
              <p className="font-heading font-bold text-base text-white">
                Two Kids Design Studio
              </p>
              <p className="text-xs text-ivory/70 mt-1">
                Digital PDF Bundles · Instant Download
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
