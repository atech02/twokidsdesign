import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Trash2, ArrowRight, ShoppingBag } from 'lucide-react';
import { useFavourites } from '../context/FavouritesContext';
import { formatPrice } from '../data/products';
import { PdfBundleSheetArt } from './PdfBundleSheetArt';

export const FavouritesDrawer: React.FC = () => {
  const { isDrawerOpen, closeFavourites, favourites, removeFavourite } = useFavourites();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        closeFavourites();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, closeFavourites]);

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Saved Favourites">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeFavourites}
            className="fixed inset-0 bg-charcoal/40 backdrop-blur-xs transition-opacity"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-screen max-w-md bg-white shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-5 border-b border-charcoal/10 flex items-center justify-between bg-ivory/60">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                  <h2 className="font-heading text-lg font-bold text-charcoal">
                    Saved Favourites ({favourites.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeFavourites}
                  className="p-2 rounded-lg text-charcoal/60 hover:text-charcoal hover:bg-softGrey/60 transition-colors focus:outline-none focus:ring-2 focus:ring-brandBlue"
                  aria-label="Close saved favourites"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {favourites.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <div className="w-14 h-14 mx-auto rounded-full bg-peach/40 flex items-center justify-center text-rose-500 mb-4">
                      <Heart className="w-6 h-6 stroke-2" />
                    </div>
                    <h3 className="font-heading font-bold text-lg text-charcoal">No saved designs yet</h3>
                    <p className="text-sm text-charcoal/70 mt-1 max-w-xs mx-auto">
                      Click the heart icon on any digital bundle to bookmark it while browsing.
                    </p>
                    <Link
                      to="/shop"
                      onClick={closeFavourites}
                      className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-charcoal text-white text-xs font-semibold hover:bg-brandBlue-dark transition-colors"
                    >
                      <span>Explore Catalogue</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  favourites.map(product => (
                    <div
                      key={product.id}
                      className="group flex gap-3.5 p-3 rounded-xl border border-charcoal/10 bg-ivory/40 hover:bg-white hover:border-charcoal/20 transition-all shadow-xs"
                    >
                      <Link
                        to={`/product/${product.slug}`}
                        onClick={closeFavourites}
                        className="w-20 h-24 rounded-lg overflow-hidden shrink-0 border border-charcoal/10 bg-white"
                      >
                        <PdfBundleSheetArt sheet={product.coverPreview} variant="card" className="w-full h-full object-cover" />
                      </Link>

                      <div className="flex-1 flex flex-col justify-between py-0.5">
                        <div>
                          <Link
                            to={`/product/${product.slug}`}
                            onClick={closeFavourites}
                            className="font-heading font-bold text-sm text-charcoal hover:text-brandBlue-dark line-clamp-2 transition-colors"
                          >
                            {product.name}
                          </Link>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span className="font-sans font-bold text-sm text-charcoal">
                              {formatPrice(product.price)}
                            </span>
                            <span className="text-[11px] text-charcoal/50">
                              {product.verifiedPageCount} pages
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <Link
                            to={`/product/${product.slug}`}
                            onClick={closeFavourites}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brandBlue-dark hover:underline"
                          >
                            <span>View details</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => removeFavourite(product.id)}
                            className="p-1.5 rounded-md text-charcoal/40 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            aria-label={`Remove ${product.name} from favourites`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {favourites.length > 0 && (
                <div className="p-4 border-t border-charcoal/10 bg-ivory/50 flex items-center justify-between">
                  <span className="text-xs text-charcoal/60">
                    Saved in your browser for this device
                  </span>
                  <Link
                    to="/shop"
                    onClick={closeFavourites}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-charcoal text-white text-xs font-semibold hover:bg-brandBlue-dark transition-colors"
                  >
                    <span>Keep Browsing</span>
                    <ShoppingBag className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
