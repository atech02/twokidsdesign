import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PRODUCTS, type DigitalProduct } from '../data/products';

const STORAGE_KEY = 'tkd_guest_favourites_v1';

interface FavouritesContextType {
  favouriteIds: string[];
  favourites: DigitalProduct[];
  favouritesCount: number;
  isFavourite: (productId: string) => boolean;
  toggleFavourite: (productId: string) => void;
  removeFavourite: (productId: string) => void;
  isDrawerOpen: boolean;
  openFavourites: () => void;
  closeFavourites: () => void;
}

const FavouritesContext = createContext<FavouritesContextType | undefined>(undefined);

export const FavouritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favouriteIds, setFavouriteIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Failed to read favourites from localStorage:', e);
      return [];
    }
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favouriteIds));
    } catch (e) {
      console.warn('Failed to save favourites to localStorage:', e);
    }
  }, [favouriteIds]);

  const isFavourite = useCallback(
    (productId: string) => favouriteIds.includes(productId),
    [favouriteIds]
  );

  const toggleFavourite = useCallback((productId: string) => {
    setFavouriteIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  }, []);

  const removeFavourite = useCallback((productId: string) => {
    setFavouriteIds(prev => prev.filter(id => id !== productId));
  }, []);

  const openFavourites = useCallback(() => setIsDrawerOpen(true), []);
  const closeFavourites = useCallback(() => setIsDrawerOpen(false), []);

  const favourites = PRODUCTS.filter(p => favouriteIds.includes(p.id) && p.publicationStatus === 'published');

  return (
    <FavouritesContext.Provider
      value={{
        favouriteIds,
        favourites,
        favouritesCount: favouriteIds.length,
        isFavourite,
        toggleFavourite,
        removeFavourite,
        isDrawerOpen,
        openFavourites,
        closeFavourites,
      }}
    >
      {children}
    </FavouritesContext.Provider>
  );
};

export function useFavourites(): FavouritesContextType {
  const context = useContext(FavouritesContext);
  if (!context) {
    throw new Error('useFavourites must be used within a FavouritesProvider');
  }
  return context;
}
