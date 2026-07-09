import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'Horario_V2';
const isGitHubPages = Boolean(process.env.GITHUB_PAGES || process.env.GITHUB_ACTIONS);

export default defineConfig({
  plugins: [react()],
  base: isGitHubPages ? `/${repoName}/` : '/',
  server: {
    host: true,
    port: 3002,
    strictPort: true
  },
  build: {
    outDir: 'dist'
  }
});
