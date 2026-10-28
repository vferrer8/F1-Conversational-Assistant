import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // En desarrollo la Chat API (NestJS) se sirve en :3000.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
