import React, { createContext, useContext, useState, useEffect } from 'react';
import type { DigitalProduct, LicenseTierId } from '../data/products';
import { getProductById, calculateItemPrice, LICENSE_OPTIONS } from '../data/products';

export interface CartItem {
  productId: string;
  licenseTier: LicenseTierId;
  addedAt: number;
}

export interface HydratedCartItem {
  product: DigitalProduct;
  licenseTier: LicenseTierId;
  licenseName: string;
  unitPrice: number;
}

interface CartContextValue {
  items: HydratedCartItem[];
  itemCount: number;
  subtotal: number;
  total: number;
  isDrawerOpen: boolean;
  toastMessage: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (productId: string, licenseTier?: LicenseTierId, openCartDrawer?: boolean) => { status: 'added' | 'updated_license' | 'already_in_cart' };
  updateItemLicense: (productId: string, licenseTier: LicenseTierId) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  dismissToast: () => void;
}

const CART_STORAGE_KEY = 'tkd_digital_cart_v1';

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rawItems, setRawItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(rawItems));
    } catch {
      // ignore storage errors
    }
  }, [rawItems]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const hydratedItems: HydratedCartItem[] = rawItems
    .map((item): HydratedCartItem | null => {
      const product = getProductById(item.productId);
      if (!product) return null;
      const tier: LicenseTierId = item.licenseTier || 'standard';
      const licenseInfo = LICENSE_OPTIONS[tier] || LICENSE_OPTIONS.standard;
      return {
        product,
        licenseTier: tier,
        licenseName: licenseInfo.name,
        unitPrice: calculateItemPrice(product, tier),
      };
    })
    .filter((x): x is HydratedCartItem => x !== null);

  const subtotal = Math.round(hydratedItems.reduce((sum, item) => sum + item.unitPrice, 0) * 100) / 100;

  const addItem = (
    productId: string,
    licenseTier: LicenseTierId = 'standard',
    openCartDrawer = true
  ): { status: 'added' | 'updated_license' | 'already_in_cart' } => {
    const product = getProductById(productId);
    if (!product) return { status: 'already_in_cart' };

    const existing = rawItems.find(i => i.productId === productId);
    if (existing) {
      if (existing.licenseTier !== licenseTier) {
        setRawItems(prev =>
          prev.map(i => (i.productId === productId ? { ...i, licenseTier } : i))
        );
        showToast(`Updated "${product.name}" to ${LICENSE_OPTIONS[licenseTier].name}.`);
        if (openCartDrawer) setIsDrawerOpen(true);
        return { status: 'updated_license' };
      } else {
        showToast(`"${product.name}" is already in your cart (1 digital copy per bundle).`);
        if (openCartDrawer) setIsDrawerOpen(true);
        return { status: 'already_in_cart' };
      }
    }

    setRawItems(prev => [...prev, { productId, licenseTier, addedAt: Date.now() }]);
    showToast(`Added "${product.name}" to your digital cart.`);
    if (openCartDrawer) setIsDrawerOpen(true);
    return { status: 'added' };
  };

  const updateItemLicense = (productId: string, licenseTier: LicenseTierId) => {
    setRawItems(prev =>
      prev.map(item => (item.productId === productId ? { ...item, licenseTier } : item))
    );
  };

  const removeItem = (productId: string) => {
    const product = getProductById(productId);
    setRawItems(prev => prev.filter(item => item.productId !== productId));
    if (product) {
      showToast(`Removed "${product.name}" from cart.`);
    }
  };

  const clearCart = () => {
    setRawItems([]);
  };

  return (
    <CartContext.Provider
      value={{
        items: hydratedItems,
        itemCount: hydratedItems.length,
        subtotal,
        total: subtotal,
        isDrawerOpen,
        toastMessage,
        openDrawer: () => setIsDrawerOpen(true),
        closeDrawer: () => setIsDrawerOpen(false),
        addItem,
        updateItemLicense,
        removeItem,
        clearCart,
        dismissToast: () => setToastMessage(null),
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
