import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  /** GitHub Pages + özel alan kökünde yayın (www.attendordance.app); repo alt dizini için eski: /yoklama-takip/ */
  base: '/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png,woff2}'],
      },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Yoklama takip',
        short_name: 'Yoklama',
        description: 'Üniversite ders programı ve yoklama takibi (yerel veri)',
        theme_color: '#0f1117',
        background_color: '#0f1117',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'tr',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Bugün',
            short_name: 'Bugün',
            description: 'Bugünkü program',
            url: './?view=today',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Yoklama işaretle',
            short_name: 'Yoklama',
            description: 'Bugünkü ders için katılım sor',
            url: './?notif=checkin',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Bugün gitmedim',
            short_name: 'Gitmedim',
            description: 'Bugünkü dersleri devamsız olarak işaretle',
            url: './?action=mark-absent',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
    }),
  ],
})
