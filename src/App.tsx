import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { FavouritesProvider } from './context/FavouritesContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { FavouritesDrawer } from './components/FavouritesDrawer';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { AboutPage } from './pages/AboutPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <FavouritesProvider>
        <CartProvider>
          <div className="min-h-dvh flex flex-col bg-ivory text-charcoal">
            <Header />
            <CartDrawer />
            <FavouritesDrawer />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/shop" element={<ShopPage />} />
                <Route path="/product/:slug" element={<ProductDetailPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
                <Route path="/downloads" element={<DownloadsPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="*" element={<ShopPage />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </CartProvider>
      </FavouritesProvider>
    </BrowserRouter>
  );
};

export default App;
