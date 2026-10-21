import React, { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ShoppingBag, Menu, X, Download, Sparkles, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useFavourites } from '../context/FavouritesContext';

export const Header: React.FC = () => {
  const { itemCount, openDrawer, toastMessage, dismissToast } = useCart();
  const { favouritesCount, openFavourites } = useFavourites();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { label: 'Home', to: '/' },
    { label: 'Shop All Designs', to: '/shop' },
    { label: 'My Downloads', to: '/downloads' },
    { label: 'About & Licensing', to: '/about' },
  ];

  return (
    <>
      {/* Main Sticky Header - Topmost Element with Subtle Liquid Glass Surface */}
      <header className="sticky top-0 z-40 liquid-glass-nav border-b border-charcoal/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Official Logo + Brand Name (Preserved!) */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-brandBlue rounded-lg p-1"
          >
            <img
              src="/images/logo.jpeg"
              alt="Two Kids Design Official Logo"
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover border border-charcoal/15 shadow-sm group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col">
              <span className="font-heading font-extrabold text-base sm:text-lg tracking-tight text-charcoal leading-none">
                Two Kids <span className="text-brandBlue-dark">Design</span>
              </span>
              <span className="text-[11px] font-medium text-charcoal/65 tracking-wider uppercase mt-1">
                Digital PDF Studio
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2" aria-label="Primary Navigation">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3.5 py-2 rounded-lg text-[14px] font-medium transition-colors ${
                    isActive
                      ? 'bg-charcoal text-white shadow-xs'
                      : 'text-charcoal/80 hover:text-charcoal hover:bg-softGrey/60'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right Action Controls with Liquid Glass Styling */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <Link
              to="/downloads"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-charcoal liquid-glass-control hover:border-charcoal transition-colors"
              title="Retrieve purchased PDF downloads"
            >
              <Download className="w-3.5 h-3.5 text-brandBlue" />
              <span>Order Lookup</span>
            </Link>

            {/* Guest Favourites Button */}
            <button
              type="button"
              onClick={openFavourites}
              className="relative inline-flex items-center justify-center p-2.5 rounded-lg liquid-glass-control text-charcoal hover:border-charcoal transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              aria-label={`Open saved favourites (${favouritesCount} saved)`}
              title="View saved favourites"
            >
              <Heart className={`w-4 h-4 transition-colors ${favouritesCount > 0 ? 'fill-rose-500 text-rose-500' : 'text-charcoal/70'}`} />
              {favouritesCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-xs">
                  {favouritesCount}
                </span>
              )}
            </button>

            {/* Shopping Cart Button */}
            <button
              type="button"
              onClick={openDrawer}
              className="relative inline-flex items-center gap-2 rounded-lg bg-charcoal px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-brandBlue-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brandBlue shadow-xs"
              aria-label={`Open digital cart with ${itemCount} bundles`}
            >
              <ShoppingBag className="w-4 h-4 text-brandBlue" />
              <span className="hidden xs:inline">Cart</span>
              <span
                className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brandBlue text-white text-xs font-bold"
                data-testid="header-cart-count"
              >
                {itemCount}
              </span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="md:hidden inline-flex items-center justify-center p-2.5 rounded-lg liquid-glass-control text-charcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-brandBlue"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer with Liquid Glass Surface */}
        {mobileMenuOpen && (
          <nav
            className="md:hidden liquid-glass-surface border-b border-charcoal/15 px-4 pt-3 pb-5 space-y-2 shadow-lg"
            aria-label="Mobile Navigation"
          >
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `block px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-charcoal text-white'
                      : 'text-charcoal hover:bg-ivory'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openFavourites();
              }}
              className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-charcoal hover:bg-ivory flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Heart className={`w-4 h-4 ${favouritesCount > 0 ? 'fill-rose-500 text-rose-500' : 'text-charcoal/70'}`} />
                <span>Saved Favourites</span>
              </span>
              <span className="text-xs font-bold bg-white px-2 py-0.5 rounded-full border border-charcoal/10 text-charcoal">
                {favouritesCount}
              </span>
            </button>

            <div className="pt-2 border-t border-softGrey flex items-center justify-between text-xs text-charcoal/70 px-2">
              <span>100% Digital PDF Bundles</span>
              <Link to="/shop" className="font-semibold text-brandBlue-dark">
                Explore Catalogue →
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Subtle Floating Cart Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-charcoal text-white px-4 py-3 rounded-xl shadow-editorial-hover border border-white/15 flex items-center gap-3 text-xs sm:text-sm"
        >
          <span className="w-2 h-2 rounded-full bg-brandBlue shrink-0" />
          <span className="flex-1">{toastMessage}</span>
          <button
            type="button"
            onClick={dismissToast}
            className="text-white/70 hover:text-white text-xs font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
};
