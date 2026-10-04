import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:8787' } },
  plugins: [react(), VitePWA({
    strategies: 'injectManifest', srcDir: 'src', filename: 'sw.js', registerType: 'prompt',
    includeAssets: ['icon-192.png', 'icon-512.png', 'favicon.svg'],
    injectManifest: { globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'] },
    manifest: { name: 'LifeOS', short_name: 'LifeOS', description: 'Plan, act, record reality and reflect.', start_url: '/', scope: '/', id: '/', display: 'standalone', orientation: 'any', background_color: '#101719', theme_color: '#8cd5b6',
      icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
      share_target: { action: '/capture', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
      shortcuts: [{ name: 'Capture', url: '/capture' }, { name: 'Money', url: '/finance' }, { name: 'Plan today', url: '/plan' }],
    },
  })],
})
