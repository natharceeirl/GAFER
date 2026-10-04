import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // @gafer/contracts se compila a CommonJS: sin esto Vite no resuelve sus exports con nombre (esquemas zod) en el navegador.
  optimizeDeps: {
    include: ['@gafer/contracts'],
  },
  build: {
    commonjsOptions: {
      include: [/packages\/contracts\/dist/, /node_modules/],
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
