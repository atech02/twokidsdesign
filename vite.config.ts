import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { ViteDevServer } from 'vite';
import { createApiMiddleware } from './server/apiMiddleware';

function backendApiPlugin() {
  return {
    name: 'two-kids-design-api-middleware',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(createApiMiddleware());
    },
    configurePreviewServer(server: { middlewares: ViteDevServer['middlewares'] }) {
      server.middlewares.use(createApiMiddleware());
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    backendApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['images/logo.jpeg'],
      manifest: {
        name: 'Two Kids Design — Digital PDF Bundles',
        short_name: 'Two Kids Design',
        description: 'Fun and professionally crafted digital PDF bundles for crafters, entrepreneurs, and print-on-demand businesses.',
        theme_color: '#FAF8F3',
        background_color: '#FAF8F3',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          {
            src: '/images/logo.jpeg',
            sizes: '192x192',
            type: 'image/jpeg',
            purpose: 'any maskable'
          },
          {
            src: '/images/logo.jpeg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,jpeg,png,svg}'],
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion', 'lucide-react'],
          'vendor-pdf': ['pdf-lib']
        }
      }
    }
  }
});
