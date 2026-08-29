import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPort = process.env.SERVER_PORT ?? '8787';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.join(here, 'src'),
      '@shared': path.join(here, '..', 'shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: `http://localhost:${serverPort}`, changeOrigin: true },
    },
  },
});
