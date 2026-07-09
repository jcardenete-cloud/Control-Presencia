import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = 'Horario_V2';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? `/Horario_V2/` : '/',
  server: {
    host: true,
    port: 3002,
    strictPort: true
  },
  build: {
    outDir: 'dist'
  }
});
