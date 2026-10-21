import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Layers,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Download,
  Info,
  ArrowRight,
  Heart,
} from 'lucide-react';
import {
  getProductBySlug,
  getProductById,
  STANDARD_LICENSE,
  formatPrice,
} from '../data/products';
import { PdfBundleSheetArt } from '../components/PdfBundleSheetArt';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useFavourites } from '../context/FavouritesContext';

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isFavourite, toggleFavourite } = useFavourites();

  const product = slug ? getProductBySlug(slug) : undefined;

  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);

  useEffect(() => {
    setActiveSheetIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-2xl p-10 border border-charcoal/10 shadow-editorial">
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-charcoal">
            Digital Bundle Not Found
          </h1>
          <p className="text-sm text-charcoal/70 mt-2">
            The PDF design bundle you are looking for may have been moved or is no longer available.
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-charcoal px-5 py-3 text-sm font-semibold text-white hover:bg-brandBlue-dark transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All PDF Bundles</span>
          </Link>
        </div>
      </div>
    );
  }

  const allPreviewSheets = [product.coverPreview, ...product.samplePages];
  const currentSheet = allPreviewSheets[activeSheetIndex] || product.coverPreview;
  const activePrice = product.price;
  const currentLicenseDetails = STANDARD_LICENSE;

  const relatedProducts = product.relatedProductIds
    .map(id => getProductById(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const handleBuyNow = () => {
    addItem(product.id, 'standard', false);
    navigate('/checkout');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-16">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs sm:text-sm text-charcoal/70" aria-label="Breadcrumb">
        <Link to="/shop" className="inline-flex items-center gap-1.5 font-semibold text-charcoal hover:text-brandBlue-dark">
          <ArrowLeft className="w-4 h-4" />
          <span>All Designs</span>
        </Link>
        <span>/</span>
        <Link
          to={`/shop?category=${encodeURIComponent(product.category)}`}
          className="hover:text-charcoal transition-colors"
        >
          {product.category}
        </Link>
        <span>/</span>
        <span className="text-charcoal font-medium truncate max-w-[220px] sm:max-w-md">
          {product.name}
        </span>
      </nav>

      {/* Main Product Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        {/* Left Column: Interactive Multi-Sheet PDF Preview Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl overflow-hidden border border-charcoal/15 bg-white shadow-editorial">
            <PdfBundleSheetArt sheet={currentSheet} variant="detail" className="border-0" />
            <div className="px-5 py-3 bg-white border-t border-charcoal/10 flex flex-wrap items-center justify-between gap-2 text-xs text-charcoal/75">
              <span>
                <strong>Preview Sheet {activeSheetIndex + 1} of {allPreviewSheets.length}:</strong>{' '}
                {currentSheet.title}
              </span>
              <span className="text-[11px] bg-ivory px-2.5 py-0.5 rounded border border-charcoal/10 font-medium">
                Web Preview · Actual Download is Full-Resolution PDF
              </span>
            </div>
          </div>

          {/* Thumbnail Selector for Included Sample Sheets */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-2.5">
              Inspect Sample PDF Sheets in This Bundle ({allPreviewSheets.length} Previews):
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {allPreviewSheets.map((sheet, idx) => {
                const isSelected = idx === activeSheetIndex;
                return (
                  <button
                    key={sheet.id}
                    type="button"
                    onClick={() => setActiveSheetIndex(idx)}
                    className={`text-left rounded-xl p-3 border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brandBlue ${
                      isSelected
                        ? 'bg-white border-brandBlue ring-2 ring-brandBlue/25 shadow-xs'
                        : 'bg-white/70 border-charcoal/15 hover:bg-white hover:border-charcoal/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-brandBlue-dark mb-1">
                      <span>{idx === 0 ? 'Cover' : `Sample 0${idx}`}</span>
                      <span>{sheet.badgeText}</span>
                    </div>
                    <p className="font-heading font-bold text-xs text-charcoal line-clamp-1">
                      {sheet.title}
                    </p>
                    <p className="text-[10px] text-charcoal/65 line-clamp-1 mt-0.5">
                      {sheet.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Verified Included PDF Files Breakdown */}
          <div className="bg-white rounded-2xl p-6 border border-charcoal/10 shadow-editorial space-y-4">
            <div className="flex items-center justify-between border-b border-softGrey pb-3">
              <div>
                <h2 className="font-heading font-bold text-lg text-charcoal">
                  What You Will Receive (Verified PDF Manifest)
                </h2>
                <p className="text-xs text-charcoal/70">
                  Delivered immediately after payment confirmation as downloadable PDF files.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-brandBlue-light px-3 py-1.5 text-xs font-bold text-brandBlue-dark">
                <Layers className="w-3.5 h-3.5" />
                {product.verifiedPageCount} Total Pages
              </span>
            </div>

            <div className="space-y-3">
              {product.includedFiles.map((file, idx) => (
                <div
                  key={file.filename}
                  className="rounded-xl bg-ivory p-4 border border-charcoal/10 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-charcoal/15 flex items-center justify-center shrink-0 mt-0.5 font-heading font-bold text-xs text-brandBlue-dark">
                      0{idx + 1}
                    </div>
                    <div>
                      <p className="font-mono text-xs sm:text-sm font-semibold text-charcoal break-all">
                        {file.filename}
                      </p>
                      <p className="text-xs text-charcoal/75 mt-1 leading-relaxed">
                        {file.description}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-charcoal border border-charcoal/10">
                    {file.pageCount} pages
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Purchase Box, Licence Selection & Specifications */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-charcoal/15 shadow-editorial space-y-6">
            {/* Category & Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-brandBlue-dark">
                {product.category}
              </span>
              {product.badge && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brandBlue px-3 py-0.5 text-xs font-semibold text-white">
                  <Sparkles className="w-3 h-3" />
                  {product.badge}
                </span>
              )}
            </div>

            {/* Title & Price */}
            <div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-charcoal leading-tight">
                {product.name}
              </h1>
              <div className="mt-4 flex items-baseline gap-3">
                <span
                  className="font-heading font-extrabold text-3xl text-charcoal"
                  data-testid="product-detail-price"
                >
                  {formatPrice(activePrice)}
                </span>
                {product.compareAtPrice && (
                  <span className="text-base text-charcoal/45 line-through">
                    {formatPrice(product.compareAtPrice)}
                  </span>
                )}
                <span className="text-xs font-semibold uppercase text-charcoal/65">
                  Instant Digital Download
                </span>
              </div>
            </div>

            {/* Full Description */}
            <p className="text-sm sm:text-[15px] text-charcoal/80 leading-relaxed">
              {product.fullDescription}
            </p>

            {/* Single Standard Commercial Use Licence Feature Box */}
            <div className="rounded-xl p-4 bg-brandBlue-light/50 border border-brandBlue/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brandBlue-dark">
                  <ShieldCheck className="w-4 h-4 text-brandBlue-dark" />
                  Standard Commercial Use Licence Included
                </span>
                <Link
                  to="/about#licensing"
                  className="text-xs font-semibold text-brandBlue-dark hover:underline"
                >
                  Licence Terms →
                </Link>
              </div>
              <p className="text-xs text-charcoal/80 leading-relaxed">
                Every purchase includes our comprehensive licence: personal crafting + commercial sales of physical goods (t-shirts, mugs, stickers, prints) up to 500 units per design. No recurring fees or hidden tiers.
              </p>
              <div className="pt-2 border-t border-brandBlue/20 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-charcoal/70">
                <span className="flex items-center gap-1">
                  <span className="text-brandBlue-dark font-bold">✓</span> Personal Crafting
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-brandBlue-dark font-bold">✓</span> Up to 500 Physical Units
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-brandBlue-dark font-bold">✓</span> Small Business &amp; Craft Fairs
                </span>
              </div>
            </div>

            {/* Primary Add to Cart, Favourite & Buy Now Buttons */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addItem(product.id, 'standard', true)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-charcoal px-6 py-4 text-sm sm:text-base font-semibold text-white hover:bg-brandBlue-dark transition-colors shadow-sm"
                >
                  <ShoppingBag className="w-4 h-4 text-brandBlue" />
                  <span>Add to Cart — {formatPrice(activePrice)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleFavourite(product.id)}
                  className="p-4 rounded-xl border border-charcoal/20 bg-white hover:border-charcoal text-charcoal transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-2xs"
                  aria-label={isFavourite(product.id) ? 'Remove from saved favourites' : 'Save to favourites'}
                  title={isFavourite(product.id) ? 'Saved in favourites' : 'Save to favourites'}
                >
                  <Heart
                    className={`w-5 h-5 transition-colors ${
                      isFavourite(product.id) ? 'fill-rose-500 text-rose-500' : 'text-charcoal/60'
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={handleBuyNow}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-ivory border border-charcoal/25 px-6 py-3.5 text-sm font-semibold text-charcoal hover:border-charcoal hover:bg-softGrey/50 transition-colors"
              >
                <Download className="w-4 h-4 text-brandBlue-dark" />
                <span>Buy Now &amp; Instant Download</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Clear Digital Product Notice */}
            <div className="rounded-xl bg-ivory p-3.5 border border-charcoal/10 flex items-start gap-2.5 text-xs text-charcoal/80">
              <Info className="w-4 h-4 text-brandBlue-dark shrink-0 mt-0.5" />
              <span>
                <strong>Digital Product Notice:</strong> You are purchasing downloadable PDF files ({product.verifiedFileCount} files, {product.verifiedPageCount} pages total). No physical item will be mailed.
              </span>
            </div>

            {/* Specifications & Compatibility List */}
            <div className="space-y-4 pt-3 border-t border-softGrey text-xs sm:text-sm">
              <div>
                <h3 className="font-heading font-bold text-charcoal mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-brandBlue" />
                  <span>Format &amp; Compatibility</span>
                </h3>
                <ul className="space-y-1.5 text-charcoal/75">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brandBlue shrink-0 mt-0.5" />
                    <span>Format: {product.fileFormat}</span>
                  </li>
                  {product.compatibilityNotes.map(note => (
                    <li key={note} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-brandBlue shrink-0 mt-0.5" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-heading font-bold text-charcoal mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brandBlue" />
                  <span>Intended Creative Uses</span>
                </h3>
                <ul className="space-y-1.5 text-charcoal/75">
                  {product.intendedUses.map(use => (
                    <li key={use} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-brandBlue shrink-0 mt-0.5" />
                      <span>{use}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-heading font-bold text-charcoal mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-brandBlue" />
                  <span>Licence Terms ({currentLicenseDetails.name})</span>
                </h3>
                <ul className="space-y-1 text-xs text-charcoal/75">
                  {currentLicenseDetails.permissions.map(perm => (
                    <li key={perm} className="flex items-start gap-2">
                      <span className="text-brandBlue-dark font-bold">✓</span>
                      <span>{perm}</span>
                    </li>
                  ))}
                  {currentLicenseDetails.restrictions.map(rest => (
                    <li key={rest} className="flex items-start gap-2 text-charcoal/65">
                      <span className="text-red-600 font-bold">✕</span>
                      <span>{rest}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <section className="pt-10 border-t border-charcoal/10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-brandBlue-dark">
                COMPLETE YOUR TOOLKIT
              </span>
              <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-charcoal mt-1">
                Related PDF Design Bundles
              </h2>
            </div>
            <Link
              to="/shop"
              className="text-xs sm:text-sm font-semibold text-charcoal hover:text-brandBlue-dark"
            >
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {relatedProducts.map(rel => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
