import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import mkcert from 'vite-plugin-mkcert'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

/** HTTPS via vite-plugin-mkcert (auto-generates trusted certs). Set VITE_DISABLE_HTTPS=true to disable. */
const httpsEnabled = process.env.VITE_DISABLE_HTTPS !== 'true'

// Port is configurable via VITE_PORT env var (default: 3080)
const port = parseInt(process.env.VITE_PORT || '3080', 10)
const apiTarget = `http://localhost:${process.env.PORT || '3081'}`

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(httpsEnabled ? [mkcert()] : []),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port,
    host: process.env.VITE_HOST || '127.0.0.1',
    // mkcert plugin injects cert when httpsEnabled; omit when disabled
    proxy: {
      '/api': apiTarget,
      '/ws': {
        target: apiTarget,
        ws: true,
      },
    },
  },
  build: {
    sourcemap: false, // No sourcemaps in production
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries (most stable, cache-friendly)
          'react-vendor': ['react', 'react-dom'],
          
          // Markdown rendering (heavy with highlight.js)
          'markdown': ['react-markdown', 'remark-gfm', 'highlight.js'],
          
          // UI components (radix + lucide icons)
          'ui-vendor': ['lucide-react'],
          
          // Utility libraries
          'utils': ['clsx', 'tailwind-merge', 'class-variance-authority', 'dompurify'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
