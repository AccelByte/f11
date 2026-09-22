import { sites } from '@openai/sites-vite-plugin';
import vinext from 'vinext';
import { defineConfig, type Plugin } from 'vite';

// Sites packages the Vinext server as a Cloudflare Worker. The trusted replay
// route is deliberately narrow and persists through AGS rather than D1/R2.
const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat', 'nodejs_compat_populate_process_env'],
  d1_databases: [],
  r2_buckets: [],
};

const workerCreateRequirePlugin: Plugin = {
  name: 'football-11:worker-create-require',
  apply: 'build',
  generateBundle(_options, bundle) {
    for (const output of Object.values(bundle)) {
      if (
        output.type === 'chunk' &&
        output.code.includes('node:module') &&
        output.code.includes('import.meta.url')
      ) {
        output.code = output.code.replaceAll('import.meta.url', '"file:///worker/index.js"');
      }
    }
  },
};

export default defineConfig(async ({ command }) => {
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Browser playtests use the lightweight Vite SPA preview. The default dev
  // command stays Vinext-only, while Sites and Cloudflare own the release build.
  if (command === 'serve') return { server: { host: '127.0.0.1' }, plugins: [vinext()] };

  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
      // Workerd does not expose import.meta.url to Vinext's generated CommonJS
      // interop chunk. All dependencies are bundled, so a stable local file URL
      // is sufficient for createRequire() and keeps the artifact Worker-native.
      workerCreateRequirePlugin,
    ],
  };
});
