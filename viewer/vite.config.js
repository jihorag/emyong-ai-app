import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { brand, surface } from './src/styles/tokens.js'

// ⚠ 빌드마다 달라져야 한다. 기기에 남은 옛 번들을 강제로 갈아치우는 유일한 신호다.
const BUILD_ID = new Date().toISOString().replace(/\D/g, '').slice(0, 14)

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  server: {
    fs: {
      // '..' = viewer의 부모 → viewer 루트 + 원본 자료 폴더까지 접근 허용 (개발 서버 전용)
      allow: ['..'],
    },
  },
  plugins: [
    react(),
    {
      name: 'emit-version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId: BUILD_ID }) })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
          },
          {
            urlPattern: /\/data\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'data-cache' },
          },
          {
            urlPattern: /\/images\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'images-cache' },
          },
        ],
      },
      manifest: {
        name: '이묭AI',
        short_name: '이묭AI',
        description: '초등 임용 1차 학습 PWA — 변형문제로 능동 암기',
        theme_color: brand.primary,
        background_color: surface.white,
        display: 'standalone',
        lang: 'ko',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
