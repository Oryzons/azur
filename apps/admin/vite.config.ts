import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'azur-mark.svg', 'pwa/icon-180.png'],
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        id: '/tablette/',
        name: 'Azure Agent',
        short_name: 'Agent',
        description: 'Check-in, check-out et planning des bateaux.',
        theme_color: '#416B9F',
        background_color: '#f4f4f5',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/tablette/aujourdhui',
        scope: '/',
        lang: 'fr',
        categories: ['business', 'productivity'],
        icons: [
          { src: 'pwa/icon-180.png', sizes: '180x180', type: 'image/png' },
          { src: 'pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Source TS directe : évite les exports CJS incomplets de dist/ sous Vite.
      '@bleu-calanque/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
