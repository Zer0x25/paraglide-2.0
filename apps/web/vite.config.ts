import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import dotenv from 'dotenv';

// Cargar variables de entorno desde la raíz del monorepo
dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env') });
dotenv.config({ path: path.resolve(import.meta.dirname, '.env') });

const apiHost = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'icons/*.png', 'manifest.json'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // SSE debe ser NetworkOnly (sin caché ni timeout de Workbox)
            urlPattern: ({ url }) => url.pathname.startsWith('/api/eventos'),
            handler: 'NetworkOnly',
          },
          {
            // Cache de API para persistencia offline secundaria
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      'next/link': path.resolve(import.meta.dirname, './src/lib/next-compat/link.tsx'),
      'next/navigation': path.resolve(import.meta.dirname, './src/lib/next-compat/navigation.ts'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: apiHost,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
