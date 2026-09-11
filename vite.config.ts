import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { centralApiMiddleware } from './server/centralApi';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'central-api-server',
      configureServer(server) {
        // Intercepta todas as chamadas /api/central no servidor do Vite
        server.middlewares.use((req, res, next) => {
          centralApiMiddleware(req, res, next);
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          centralApiMiddleware(req, res, next);
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    open: false,
  },
});
