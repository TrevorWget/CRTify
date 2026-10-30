import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Custom domain (https://crtify.trevorwilliams.dev) serves from site root.
  // For the project URL https://trevorwget.github.io/CRTify/ use base: '/CRTify/' instead.
  base: '/',
  plugins: [react()],
  // No COOP/COEP headers: the single-threaded ffmpeg core doesn't need
  // SharedArrayBuffer, and GitHub Pages can't send them in production anyway.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', 'wasm-webp'],
  },
})
