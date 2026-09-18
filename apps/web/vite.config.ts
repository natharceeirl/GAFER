import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Estrategia generateSW: suficiente para el scaffold. La cola de
      // sincronización real (Background Sync API) se construye en Fase 1
      // sobre esta base, en el store local (ver features/operaciones/model).
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      manifest: {
        name: 'GAFER Saneamiento Ambiental',
        short_name: 'GAFER',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1f4d3d',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
