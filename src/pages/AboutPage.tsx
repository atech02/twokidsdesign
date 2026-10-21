import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ShieldCheck,
  FileText,
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-16">
      {/* 1. Brand Story Section */}
      <section className="bg-white rounded-3xl p-8 sm:p-12 border border-charcoal/15 shadow-editorial">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brandBlue-dark">
              <Sparkles className="w-4 h-4" />
              <span>OUR STORY &amp; CREATIVE MISSION</span>
            </div>
            <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-charcoal tracking-tight leading-tight">
              Designed for people who create things and build businesses.
            </h1>
            <p className="text-base sm:text-lg text-charcoal/85 leading-relaxed font-medium">
              “At Two Kids Design, we create fun and professionally crafted digital products for crafters, entrepreneurs, and print-on-demand businesses.”
            </p>
            <p className="text-sm sm:text-base text-charcoal/75 leading-relaxed">
              We believe great design should be approachable, practical, and ready to use the moment inspiration strikes. That is why we package our work into thoughtfully organized PDF bundles—complete with clear page layouts, print-ready US Letter and A4 sizing, and straightforward usage licensing. Whether you are printing sticker sheets at your kitchen table, preparing small-batch order inserts, or launching new print-on-demand merchandise, our digital bundles help you bring your ideas to life with confidence.
            </p>
            <div className="pt-3">
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 rounded-xl bg-charcoal px-6 py-3.5 text-sm font-semibold text-white hover:bg-brandBlue-dark transition-colors"
              >
                <span>Explore All PDF Design Bundles</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col items-center justify-center bg-ivory rounded-2xl p-8 border border-charcoal/10 text-center">
            <img
              src="/images/logo.jpeg"
              alt="Two Kids Design Official Logo"
              className="w-32 h-32 rounded-full object-cover border-2 border-brandBlue shadow-md mb-4"
            />
            <span className="font-heading font-extrabold text-lg text-charcoal">
              Two Kids Design
            </span>
            <span className="text-xs text-charcoal/65 mt-1">
              100% Digital Download Storefront
            </span>
          </div>
        </div>
      </section>

      {/* 2. Licensing & Permitted Use: Single Standard Commercial Use Licence */}
      <section id="licensing" className="space-y-6 scroll-mt-24">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-brandBlue-dark">
            CLEAR USAGE TERMS
          </span>
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-charcoal mt-1">
            Licensing &amp; Permitted Use
          </h2>
          <p className="text-sm sm:text-base text-charcoal/75 mt-1 max-w-3xl">
            At Two Kids Design, we believe in simple, transparent licensing. Every downloadable PDF bundle automatically includes our <strong>Standard Commercial Use Licence</strong>. There are no complicated tiers, surprise upgrades, or hidden subscription costs.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-charcoal/15 shadow-editorial space-y-6 max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-softGrey pb-4">
            <div>
              <span className="inline-block rounded-md bg-brandBlue-light px-3 py-1 text-xs font-bold text-brandBlue-dark uppercase tracking-wider mb-1">
                Included With Every Bundle
              </span>
              <h3 className="font-heading font-extrabold text-2xl text-charcoal">
                Standard Commercial Use Licence
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-1 text-xs font-bold text-charcoal">
              <CheckCircle2 className="w-4 h-4 text-charcoal" />
              Up to 500 Physical Units Included
            </span>
          </div>

          <p className="text-sm sm:text-base text-charcoal/80 leading-relaxed">
            Our licence allows you to craft for pure personal joy or create and sell finished physical goods in your boutique, online store, or at local craft markets. Your order receipt and digital certificate confirm these rights upon payment verification.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="bg-ivory rounded-xl p-5 border border-charcoal/10 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-brandBlue-dark" />
                <h4 className="font-heading font-bold text-sm sm:text-base text-charcoal">
                  What is Permitted:
                </h4>
              </div>
              <ul className="space-y-2 text-xs sm:text-sm text-charcoal/80">
                <li className="flex items-start gap-2">
                  <span className="text-brandBlue-dark font-bold">✓</span>
                  <span>Unlimited personal crafting, home decor, planners, and gift projects.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brandBlue-dark font-bold">✓</span>
                  <span>Commercial use on physical products for sale (such as t-shirts, mugs, prints, stickers, and stationery) up to 500 physical units per design.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brandBlue-dark font-bold">✓</span>
                  <span>Small-business, handmade boutique, and craft-fair production.</span>
                </li>
              </ul>
            </div>

            <div className="bg-rose-50/50 rounded-xl p-5 border border-red-200 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h4 className="font-heading font-bold text-sm sm:text-base text-charcoal">
                  Strict Restrictions:
                </h4>
              </div>
              <ul className="space-y-2 text-xs sm:text-sm text-charcoal/80">
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✕</span>
                  <span>Reselling, sharing, redistributing, or sublicensing the digital PDF files.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✕</span>
                  <span>Claiming the artwork as your own original design.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✕</span>
                  <span>Using the artwork in print-on-demand services without physical production or significant alteration, unless permitted by the standard terms.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Store Policies Grid (Delivery, Refunds, Privacy, Terms, Support) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          id="delivery"
          className="bg-white rounded-2xl p-6 border border-charcoal/10 shadow-editorial space-y-2 scroll-mt-24"
        >
          <div className="flex items-center gap-2 text-brandBlue-dark font-heading font-bold text-base">
            <FileText className="w-5 h-5" />
            <h3 className="text-charcoal">Digital Product Delivery Policy</h3>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/75 leading-relaxed">
            All products sold on Two Kids Design are digital PDF bundles. No physical items are printed or shipped. Immediately after your payment is verified, you are directed to your Order Confirmation page with signed download links, and you can retrieve your files anytime via our Customer Downloads lookup page.
          </p>
        </div>

        <div
          id="refunds"
          className="bg-white rounded-2xl p-6 border border-charcoal/10 shadow-editorial space-y-2 scroll-mt-24"
        >
          <div className="flex items-center gap-2 text-brandBlue-dark font-heading font-bold text-base">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="text-charcoal">Refunds, Cancellations &amp; Consumer Rights</h3>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/75 leading-relaxed">
            Because digital PDF bundles are delivered immediately upon purchase, refund eligibility depends on whether the files have been downloaded and the applicable consumer protection laws in your jurisdiction (such as UK/EU statutory digital-content rules). If you experience a corrupted file, duplicate charge, or technical issue, contact us and we will promptly resolve or refund the affected order. <em>(Store Owner Note: Review and finalize jurisdiction-specific refund terms before live commercial launch.)</em>
          </p>
        </div>

        <div
          id="privacy"
          className="bg-white rounded-2xl p-6 border border-charcoal/10 shadow-editorial space-y-2 scroll-mt-24"
        >
          <div className="flex items-center gap-2 text-brandBlue-dark font-heading font-bold text-base">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="text-charcoal">Privacy &amp; Terms of Purchase</h3>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/75 leading-relaxed">
            We practice data minimization: we collect only your email address, optional studio/creator name for your licence certificate, and payment verification reference. We never store raw payment card numbers on our servers and we do not request unnecessary physical shipping addresses.
          </p>
        </div>

        <div
          id="support"
          className="bg-white rounded-2xl p-6 border border-charcoal/10 shadow-editorial space-y-2 scroll-mt-24"
        >
          <div className="flex items-center gap-2 text-brandBlue-dark font-heading font-bold text-base">
            <Mail className="w-5 h-5" />
            <h3 className="text-charcoal">Contact &amp; Customer Support</h3>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/75 leading-relaxed">
            Need help accessing a PDF download, refreshing an expired link, or choosing the right licence for your print-on-demand business? Reach our studio support team at{' '}
            <a
              href="mailto:support@twokidsdesign.com"
              className="font-semibold text-brandBlue-dark underline"
            >
              support@twokidsdesign.com
            </a>{' '}
            with your Order ID.
          </p>
        </div>
      </section>
    </div>
  );
};
