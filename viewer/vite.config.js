import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { brand, surface } from './src/styles/tokens.js'

export default defineConfig({
  server: {
    fs: {
      // '..' = viewer의 부모 → viewer 루트 + 원본 자료 폴더까지 접근 허용 (개발 서버 전용)
      allow: ['..'],
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
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
