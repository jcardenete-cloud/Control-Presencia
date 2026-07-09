import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all network interfaces
    port: 3002,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://192.168.145.122:3001',
        changeOrigin: true
      }
    }
  }
})
