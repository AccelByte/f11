import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
const webRequire = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { default: react } = await import(
  pathToFileURL(webRequire.resolve('@vitejs/plugin-react')).href
);

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('../../apps/web', import.meta.url)) } },
  // Separate local entry: no production routes, environment files, or AGS calls.
  envDir: false,
  server: { host: '127.0.0.1', port: 4187, strictPort: true },
});
