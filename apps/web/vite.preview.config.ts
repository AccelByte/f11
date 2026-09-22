import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const appRoot = fileURLToPath(new URL('.', import.meta.url));

// Browser-only entry retained for lightweight local UI preview. Production is
// built through Vinext because the trusted replay route runs in a Sites Worker.
export default defineConfig(({ mode }) => {
  const publicEnv = loadEnv(mode, appRoot, 'NEXT_PUBLIC_');
  const pages = mode === 'pages';
  const pagesUrl = (process.env.FOOTBALL11_PAGES_URL ?? 'https://accelbyte.github.io/f11/').replace(
    /\/$/,
    '',
  );
  if (pages) {
    for (const key of [
      'NEXT_PUBLIC_ACCELBYTE_BASE_URL',
      'NEXT_PUBLIC_ACCELBYTE_NAMESPACE',
      'NEXT_PUBLIC_ACCELBYTE_CLIENT_ID',
      'NEXT_PUBLIC_POSTHOG_KEY',
    ]) {
      if (!publicEnv[key]?.trim()) throw new Error(`Pages build requires ${key}`);
    }
  }

  return {
    root: resolve(appRoot, 'preview'),
    base: pages ? `${new URL(pagesUrl).pathname}/` : '/',
    publicDir: resolve(appRoot, 'public'),
    plugins: [
      react(),
      {
        name: 'football-11:pages-metadata',
        transformIndexHtml: (html) =>
          pages
            ? html.replaceAll('https://football-11-play.damar-indra.chatgpt.site', pagesUrl)
            : html,
      },
    ],
    resolve: { alias: { '@': appRoot } },
    server: { host: '127.0.0.1', port: 4173 },
    build: { outDir: resolve(appRoot, 'build'), emptyOutDir: true },
    define: {
      'process.env.NEXT_PUBLIC_POSTHOG_KEY': JSON.stringify(
        pages ? publicEnv.NEXT_PUBLIC_POSTHOG_KEY : '',
      ),
      'process.env.NEXT_PUBLIC_POSTHOG_PAGES_URL': JSON.stringify(pages ? pagesUrl : ''),
      'process.env.NEXT_PUBLIC_API_ORIGIN': JSON.stringify(
        pages
          ? 'https://football-11-play.damar-indra.chatgpt.site'
          : (publicEnv.NEXT_PUBLIC_API_ORIGIN ?? ''),
      ),
      'process.env.NEXT_PUBLIC_ACCELBYTE_BASE_URL': JSON.stringify(
        publicEnv.NEXT_PUBLIC_ACCELBYTE_BASE_URL,
      ),
      'process.env.NEXT_PUBLIC_ACCELBYTE_NAMESPACE': JSON.stringify(
        publicEnv.NEXT_PUBLIC_ACCELBYTE_NAMESPACE,
      ),
      'process.env.NEXT_PUBLIC_ACCELBYTE_CLIENT_ID': JSON.stringify(
        publicEnv.NEXT_PUBLIC_ACCELBYTE_CLIENT_ID,
      ),
      'process.env.NEXT_PUBLIC_ACCELBYTE_REDIRECT_URI': JSON.stringify(
        pages ? `${pagesUrl}/` : publicEnv.NEXT_PUBLIC_ACCELBYTE_REDIRECT_URI,
      ),
      'process.env.NEXT_PUBLIC_FRIEND_ROOM_MAX_PLAYERS': JSON.stringify(
        publicEnv.NEXT_PUBLIC_FRIEND_ROOM_MAX_PLAYERS,
      ),
      'process.env.NEXT_PUBLIC_FRIEND_ROOM_ROUND_SECONDS': JSON.stringify(
        publicEnv.NEXT_PUBLIC_FRIEND_ROOM_ROUND_SECONDS,
      ),
      'process.env.NEXT_PUBLIC_FRIEND_ROOM_COUNTDOWN_SECONDS': JSON.stringify(
        publicEnv.NEXT_PUBLIC_FRIEND_ROOM_COUNTDOWN_SECONDS,
      ),
    },
  };
});
