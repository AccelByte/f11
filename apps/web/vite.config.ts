import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
const appRoot = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: resolve(appRoot, 'preview'),
  base: './',
  publicDir: resolve(appRoot, 'public'),
  plugins: [react()],
  resolve: { alias: { '@': appRoot } },
  server: { host: '127.0.0.1', port: 4173 },
  build: { outDir: resolve(appRoot, 'build'), emptyOutDir: true },
});
