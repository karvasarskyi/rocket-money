import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, API calls are proxied to the local NestJS server (npm run start:dev in /backend).
// In production (Vercel), the frontend and the API share the same domain, so relative URLs just work.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: process.env.VITE_DEV_API_TARGET || 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
