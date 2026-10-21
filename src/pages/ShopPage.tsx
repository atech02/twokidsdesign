import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  FileText,
  X,
  ArrowRight,
  ArrowLeft,
  Filter,
  Sparkles,
} from 'lucide-react';
import {
  PRODUCTS,
  CURATED_COLLECTIONS,
} from '../data/products';
import { ProductCard } from '../components/ProductCard';

type SortOption = 'featured' | 'newest' | 'price-asc' | 'price-desc';

const PAGE_SIZE = 10;

export const ShopPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCollection = searchParams.get('collection') || 'ALL';
  const initialQuery = searchParams.get('q') || '';

  const [selectedCollection, setSelectedCollection] = useState<string>(initialCollection);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Sync state with URL query parameters
  useEffect(() => {
    const paramCol = searchParams.get('collection');

    if (paramCol && CURATED_COLLECTIONS.some(c => c.id === paramCol)) {
      setSelectedCollection(paramCol);
    } else {
      setSelectedCollection('ALL');
    }
    // Reset to page 1 on search param changes
    setCurrentPage(1);
  }, [searchParams]);

  const handleCollectionChange = (colId: string) => {
    setSelectedCollection(colId);
    setCurrentPage(1);
    const next = new URLSearchParams(searchParams);
    next.delete('category');
    if (colId === 'ALL') {
      next.delete('collection');
    } else {
      next.set('collection', colId);
    }
    setSearchParams(next, { replace: true });
  };

  const handleResetFilters = () => {
    setSelectedCollection('ALL');
    setSearchQuery('');
    setSortBy('featured');
    setCurrentPage(1);
    setSearchParams({}, { replace: true });
  };

  const filteredAndSortedProducts = useMemo(() => {
    const published = PRODUCTS.filter(p => p.publicationStatus === 'published');
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = published.filter(product => {
      // 1. Curated Collection Filter (Apparel, Home Decor, Stationery)
      if (selectedCollection !== 'ALL') {
        const curated = CURATED_COLLECTIONS.find(c => c.id === selectedCollection);
        if (!curated || !curated.productIds.includes(product.id)) {
          return false;
        }
      }

      // 2. Search query filter
      if (!normalizedQuery) return true;

      const haystack = [
        product.name,
        product.shortDescription,
        product.fullDescription,
        product.category,
        ...product.coverPreview.sampleElements,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'newest') return b.publishedAt.localeCompare(a.publishedAt);
      // default 'featured'
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return b.publishedAt.localeCompare(a.publishedAt);
    });
  }, [selectedCollection, searchQuery, sortBy]);

  // Strictly maximum 10 product cards at once on screen
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedProducts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const displayedProducts = filteredAndSortedProducts.slice(startIndex, startIndex + PAGE_SIZE);
  const hasMore = safePage < totalPages;
  const hasPrev = safePage > 1;

  const hasActiveFilters =
    selectedCollection !== 'ALL' ||
    searchQuery.trim().length > 0 ||
    sortBy !== 'featured';

  const activeCollectionObj = CURATED_COLLECTIONS.find(c => c.id === selectedCollection);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Shop Page Header */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-charcoal/10 shadow-editorial mb-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brandBlue-dark mb-2">
            <FileText className="w-3.5 h-3.5" />
            <span>TWO KIDS DESIGN · DIGITAL CATALOGUE</span>
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-charcoal tracking-tight">
            Shop All PDF Design Bundles
          </h1>
          <p className="mt-3 text-sm sm:text-base text-charcoal/75 leading-relaxed">
            Browse our complete collection of downloadable PDF bundles for crafters, small business owners, and print-on-demand creators. Every bundle includes verified page counts and instant digital delivery.
          </p>
        </div>

        {/* Search, Filter & Sort Bar */}
        <div className="mt-6 pt-6 border-t border-softGrey space-y-4">
          <div className="flex flex-col md:flex-row gap-3.5 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <label htmlFor="shop-search-input" className="sr-only">
                Search digital PDF bundles
              </label>
              <Search className="w-4 h-4 text-charcoal/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="shop-search-input"
                type="search"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by keyword (e.g., botanical, planner, packaging)..."
                className="w-full rounded-xl border border-charcoal/20 bg-ivory pl-10 pr-9 py-2.5 text-sm text-charcoal placeholder:text-charcoal/45 focus:outline-none focus:ring-2 focus:ring-brandBlue focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-charcoal/50 hover:text-charcoal"
                  aria-label="Clear search query"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort Selector & Reset Button */}
            <div className="flex items-center gap-3 self-end md:self-auto">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-charcoal/60 hidden sm:inline" />
                <label htmlFor="shop-sort-select" className="text-xs font-semibold text-charcoal/75">
                  Sort by:
                </label>
                <select
                  id="shop-sort-select"
                  value={sortBy}
                  onChange={e => {
                    setSortBy(e.target.value as SortOption);
                    setCurrentPage(1);
                  }}
                  className="rounded-xl border border-charcoal/20 bg-ivory px-3 py-2 text-xs sm:text-sm font-semibold text-charcoal focus:outline-none focus:ring-2 focus:ring-brandBlue"
                >
                  <option value="featured">Featured</option>
                  <option value="newest">Newest Arrivals</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-charcoal/20 bg-white px-3 py-2 text-xs font-semibold text-charcoal hover:bg-softGrey/60 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Curated Digital Collections Quick-Filters: Strictly Apparel, Home Decor, Stationery */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist" aria-label="Curated collections">
            <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50 shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Collections:
            </span>
            <button
              type="button"
              onClick={() => handleCollectionChange('ALL')}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedCollection === 'ALL'
                  ? 'bg-charcoal text-white shadow-2xs'
                  : 'bg-ivory text-charcoal/80 hover:bg-softGrey border border-charcoal/10'
              }`}
            >
              All Bundles ({PRODUCTS.length})
            </button>

            {CURATED_COLLECTIONS.map(col => {
              const isSelected = selectedCollection === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => handleCollectionChange(col.id)}
                  className={`shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'bg-brandBlue text-white shadow-2xs'
                      : 'bg-ivory text-charcoal/80 hover:bg-softGrey border border-charcoal/10'
                  }`}
                >
                  {col.name} ({col.productIds.length})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Count & Active Filter Indicator */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-charcoal/70 mb-5 px-1">
        <p>
          Showing <strong className="text-charcoal">{displayedProducts.length}</strong> of{' '}
          <strong className="text-charcoal">{filteredAndSortedProducts.length}</strong> verified PDF bundles
          {activeCollectionObj && (
            <span>
              {' '}
              in <strong className="text-charcoal">{activeCollectionObj.name}</strong> collection
            </span>
          )}
          {searchQuery.trim() && (
            <span>
              {' '}
              matching <strong className="text-charcoal">"{searchQuery.trim()}"</strong>
            </span>
          )}
        </p>
      </div>

      {/* Product Grid or Empty State */}
      {filteredAndSortedProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-charcoal/10 p-12 text-center max-w-lg mx-auto my-8 shadow-editorial">
          <div className="w-12 h-12 rounded-full bg-ivory border border-charcoal/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-5 h-5 text-brandBlue" />
          </div>
          <h2 className="font-heading font-bold text-xl text-charcoal">
            {activeCollectionObj
              ? `New ${activeCollectionObj.name} Designs Are Being Prepared`
              : 'No matching PDF bundles found'}
          </h2>
          <p className="text-sm text-charcoal/70 mt-2 leading-relaxed">
            {activeCollectionObj
              ? `We are currently crafting and preparing brand new downloadable PDF bundles for the ${activeCollectionObj.name} collection in our studio. Check back soon or explore our other collections!`
              : 'We couldn’t find any digital bundles matching your current search. Try clearing your search keyword or browse all designs.'}
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-charcoal px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-brandBlue-dark transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Browse All Bundles</span>
          </button>
        </div>
      ) : (
        <>
          {/* Responsive Compact Grid: 2 cols on mobile, 3 on md, 4 on lg */}
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
            data-testid="shop-product-grid"
          >
            <AnimatePresence mode="popLayout">
              {displayedProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </AnimatePresence>
          </div>

          {/* Centered Arrow Button to Navigate Batches (Never more than 10 products at once) */}
          {totalPages > 1 && (
            <div
              className="flex flex-col items-center justify-center mt-12 gap-3"
              aria-label="Catalogue pagination navigation"
            >
              <div className="flex items-center gap-3">
                {hasPrev && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage(prev => Math.max(prev - 1, 1));
                      window.scrollTo({ top: 120, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-charcoal/20 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-charcoal hover:bg-softGrey/50 transition-colors shadow-2xs"
                    aria-label="Show previous products"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>
                )}

                {hasMore ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage(prev => Math.min(prev + 1, totalPages));
                      window.scrollTo({ top: 120, behavior: 'smooth' });
                    }}
                    className="group inline-flex items-center gap-2 rounded-xl bg-charcoal px-6 py-3 text-xs sm:text-sm font-semibold text-white hover:bg-brandBlue-dark transition-all shadow-editorial hover:shadow-editorial-hover active:scale-95"
                    aria-label="Show more products"
                  >
                    <span>Show more products</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-2 rounded-xl bg-charcoal/10 px-5 py-2.5 text-xs font-semibold text-charcoal/40 cursor-not-allowed"
                    aria-label="No more products remaining"
                  >
                    <span>All products viewed</span>
                  </button>
                )}
              </div>

              <span className="text-xs text-charcoal/60">
                Page {safePage} of {totalPages} · Showing {displayedProducts.length} of{' '}
                {filteredAndSortedProducts.length} products
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
