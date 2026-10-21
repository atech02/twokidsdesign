import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ShieldCheck, Mail, ArrowUpRight } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-charcoal text-ivory border-t border-charcoal/20 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          {/* Brand Column */}
          <div className="lg:col-span-5 space-y-4">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <img
                src="/images/logo.jpeg"
                alt="Two Kids Design Official Logo"
                className="w-12 h-12 rounded-full object-cover border border-white/20"
              />
              <div>
                <span className="font-heading font-extrabold text-xl text-white tracking-tight block">
                  Two Kids <span className="text-brandBlue">Design</span>
                </span>
                <span className="text-xs text-ivory/65 uppercase tracking-widest">
                  Digital Creations &amp; PDF Bundles
                </span>
              </div>
            </Link>
            <p className="text-sm text-ivory/80 max-w-md leading-relaxed">
              At Two Kids Design, we create fun and professionally crafted digital products for crafters, entrepreneurs, and print-on-demand businesses.
            </p>
            <div className="inline-flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-ivory/85">
              <FileText className="w-4 h-4 text-brandBlue shrink-0" />
              <span>100% Digital Download Store · No physical shipping required</span>
            </div>
          </div>

          {/* Navigation Column */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-brandBlue">
              Storefront
            </h3>
            <ul className="space-y-2.5 text-sm text-ivory/80">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/shop" className="hover:text-white transition-colors">
                  All PDF Bundles
                </Link>
              </li>
              <li>
                <Link to="/downloads" className="hover:text-white transition-colors">
                  Customer Downloads
                </Link>
              </li>
              <li>
                <Link to="/checkout" className="hover:text-white transition-colors">
                  Digital Checkout
                </Link>
              </li>
            </ul>
          </div>

          {/* Curated Collections Column (Standardized) */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-brandBlue">
              Collections
            </h3>
            <ul className="space-y-2.5 text-sm text-ivory/80">
              <li>
                <Link to="/shop?collection=apparel" className="hover:text-white transition-colors">
                  Apparel
                </Link>
              </li>
              <li>
                <Link to="/shop?collection=home-decor" className="hover:text-white transition-colors">
                  Home Decor
                </Link>
              </li>
              <li>
                <Link to="/shop?collection=stationery" className="hover:text-white transition-colors">
                  Stationery
                </Link>
              </li>
            </ul>
          </div>

          {/* Policies & Support Column */}
          <div className="lg:col-span-3 space-y-3">
            <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-brandBlue">
              Licensing &amp; Policies
            </h3>
            <ul className="space-y-2.5 text-sm text-ivory/80">
              <li>
                <Link to="/about#licensing" className="hover:text-white transition-colors">
                  Standard Commercial Use Licence
                </Link>
              </li>
              <li>
                <Link to="/about#delivery" className="hover:text-white transition-colors">
                  Instant Digital Delivery Policy
                </Link>
              </li>
              <li>
                <Link to="/about#refunds" className="hover:text-white transition-colors">
                  Refunds &amp; Cancellations
                </Link>
              </li>
              <li>
                <Link to="/about#privacy" className="hover:text-white transition-colors">
                  Privacy &amp; Terms of Purchase
                </Link>
              </li>
            </ul>
            <div className="pt-2">
              <a
                href="mailto:support@twokidsdesign.com"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brandBlue hover:underline"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>support@twokidsdesign.com</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Security Note */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ivory/60">
          <p>© {new Date().getFullYear()} Two Kids Design. All rights reserved. Digital PDF products only.</p>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brandBlue" />
            <span>Protected server-verified PDF downloads · Configurable licensing</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
