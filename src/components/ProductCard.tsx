import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import type { DigitalProduct } from '../data/products';
import { formatPrice } from '../data/products';
import { PdfBundleSheetArt } from './PdfBundleSheetArt';
import { useFavourites } from '../context/FavouritesContext';

interface ProductCardProps {
  product: DigitalProduct;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { isFavourite, toggleFavourite } = useFavourites();
  const favourited = isFavourite(product.id);

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavourite(product.id);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col h-full bg-white rounded-xl border border-charcoal/10 shadow-editorial hover:shadow-editorial-hover transition-all duration-200 overflow-hidden"
    >
      <Link
        to={`/product/${product.slug}`}
        className="flex flex-col h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brandBlue rounded-xl"
        aria-label={`View ${product.name} PDF Bundle`}
      >
        {/* 1. Artwork Preview with Heart Icon Overlay */}
        <div className="relative overflow-hidden bg-ivory aspect-[4/3] w-full border-b border-charcoal/5">
          <div className="w-full h-full transition-transform duration-300 ease-out group-hover:scale-[1.03]">
            <PdfBundleSheetArt
              sheet={product.coverPreview}
              variant="card"
              className="w-full h-full border-0"
            />
          </div>

          {/* 4. Heart-shaped Favourite Icon for Guests */}
          <button
            type="button"
            onClick={handleHeartClick}
            aria-label={
              favourited
                ? `Remove ${product.name} from saved favourites`
                : `Save ${product.name} to favourites`
            }
            title={favourited ? 'Saved in favourites' : 'Save to favourites'}
            className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-20 p-1.5 sm:p-2 rounded-full bg-white/95 backdrop-blur-xs border border-charcoal/10 shadow-xs hover:bg-white hover:scale-105 active:scale-90 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <motion.div
              key={favourited ? 'fav-on' : 'fav-off'}
              initial={{ scale: 0.75 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            >
              <Heart
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${
                  favourited
                    ? 'fill-rose-500 text-rose-500'
                    : 'text-charcoal/50 group-hover:text-charcoal stroke-[1.8]'
                }`}
              />
            </motion.div>
          </button>
        </div>

        {/* 2 & 3. Card Body: Title (Max 2 lines) and Price (ZMW) */}
        <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5">
          <h3 className="font-heading font-bold text-[13.5px] sm:text-[15px] text-charcoal leading-snug line-clamp-2 min-h-[2.5rem] group-hover:text-brandBlue-dark transition-colors">
            {product.name}
          </h3>

          <div className="mt-2 pt-2 border-t border-charcoal/5 flex items-baseline justify-between gap-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="font-sans font-bold text-[13.5px] sm:text-[15px] text-charcoal">
                {formatPrice(product.price)}
              </span>
              {product.compareAtPrice && (
                <span className="text-[10px] sm:text-[11px] text-charcoal/40 line-through">
                  {formatPrice(product.compareAtPrice)}
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] font-medium text-charcoal/45 uppercase tracking-wider">
              PDF Bundle
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
};
