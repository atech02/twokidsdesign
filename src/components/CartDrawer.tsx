import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Trash2, ShoppingBag, ArrowRight, ShieldCheck, FileText, Info } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../data/products';

export const CartDrawer: React.FC = () => {
  const {
    items,
    itemCount,
    subtotal,
    total,
    isDrawerOpen,
    closeDrawer,
    removeItem,
  } = useCart();

  const navigate = useNavigate();

  const handleProceedToCheckout = () => {
    closeDrawer();
    navigate('/checkout');
  };

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="cart-drawer-title" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeDrawer}
            className="fixed inset-0 bg-charcoal/50 backdrop-blur-xs"
          />

          <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="w-screen max-w-md bg-ivory shadow-2xl border-l border-charcoal/15 flex flex-col justify-between"
            >
              {/* Drawer Header */}
              <div className="p-5 bg-white border-b border-charcoal/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-5 h-5 text-brandBlue" />
                  <h2 id="cart-drawer-title" className="font-heading font-bold text-lg text-charcoal">
                    Your Digital Cart ({itemCount})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="p-2 rounded-lg text-charcoal/70 hover:text-charcoal hover:bg-ivory transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brandBlue"
                  aria-label="Close cart drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Digital Single-Copy Notice */}
              <div className="bg-brandBlue-light/70 px-5 py-2.5 border-b border-brandBlue/20 flex items-start gap-2 text-xs text-charcoal/85">
                <Info className="w-4 h-4 text-brandBlue-dark shrink-0 mt-0.5" />
                <span>
                  Each item is an instant-download PDF bundle. Every bundle includes our Standard Commercial Use Licence.
                </span>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {items.length === 0 ? (
                  <div className="text-center py-14 px-4 bg-white rounded-xl border border-charcoal/10">
                    <div className="w-12 h-12 rounded-full bg-ivory border border-charcoal/10 flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-6 h-6 text-brandBlue" />
                    </div>
                    <h3 className="font-heading font-bold text-base text-charcoal">
                      Your digital cart is empty
                    </h3>
                    <p className="text-xs text-charcoal/70 mt-1 max-w-xs mx-auto leading-relaxed">
                      Explore our curated PDF bundles for crafting, printables, small business packaging, and print-on-demand designs.
                    </p>
                    <Link
                      to="/shop"
                      onClick={closeDrawer}
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-xs font-semibold text-white hover:bg-brandBlue-dark transition-colors"
                    >
                      <span>Explore All Designs</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  items.map(item => (
                    <div
                      key={item.product.id}
                      className="bg-white rounded-xl p-4 border border-charcoal/10 shadow-xs flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-brandBlue-dark bg-brandBlue-light px-2 py-0.5 rounded mb-1">
                            {item.product.verifiedPageCount} PDF Pages · {item.product.category}
                          </span>
                          <Link
                            to={`/product/${item.product.slug}`}
                            onClick={closeDrawer}
                            className="block font-heading font-bold text-sm text-charcoal hover:text-brandBlue-dark transition-colors"
                          >
                            {item.product.name}
                          </Link>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.product.id)}
                          className="p-1.5 text-charcoal/50 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                          aria-label={`Remove ${item.product.name} from cart`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Standard Commercial Use Licence Included */}
                      <div className="pt-2 border-t border-softGrey flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-charcoal/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-brandBlue shrink-0" />
                          <span className="font-semibold text-brandBlue-dark">Standard Commercial Licence</span>
                        </div>

                        <div className="text-right sm:pl-3">
                          <span className="font-heading font-extrabold text-base text-charcoal">
                            {formatPrice(item.unitPrice)}
                          </span>
                          <span className="block text-[10px] text-charcoal/60">1 Digital Bundle</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Drawer Footer Summary */}
              {items.length > 0 && (
                <div className="p-5 bg-white border-t border-charcoal/15 space-y-4">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-charcoal/75">
                      <span>Subtotal ({itemCount} PDF {itemCount === 1 ? 'bundle' : 'bundles'})</span>
                      <span className="font-semibold text-charcoal">{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-charcoal/60">
                      <span>Digital Delivery (Instant Download)</span>
                      <span className="font-medium text-brandBlue-dark">FREE</span>
                    </div>
                    <div className="pt-2 border-t border-softGrey flex justify-between items-baseline">
                      <span className="font-heading font-bold text-base text-charcoal">Total</span>
                      <span
                        className="font-heading font-extrabold text-xl text-charcoal"
                        data-testid="cart-total-amount"
                      >
                        {formatPrice(total)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleProceedToCheckout}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-charcoal px-5 py-3.5 text-sm font-semibold text-white hover:bg-brandBlue-dark transition-colors shadow-sm"
                    >
                      <span>Proceed to Digital Checkout</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <Link
                      to="/shop"
                      onClick={closeDrawer}
                      className="w-full text-center py-2 text-xs font-semibold text-charcoal/75 hover:text-charcoal transition-colors"
                    >
                      Continue Browsing Bundles
                    </Link>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-charcoal/65 pt-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-brandBlue" />
                    <span>No physical shipping required · Instant verified PDF links</span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
