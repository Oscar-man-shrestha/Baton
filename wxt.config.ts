import { defineConfig } from 'wxt';
import { fileURLToPath } from 'node:url';
import cloud from './src/config/cloud.json';
import selectors from './src/selectors.json';
const cloudEnabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cloud.url) && !!cloud.publishableKey;
const chatHosts = Object.values(selectors.providers).flatMap(provider => provider.hosts.map(host => `https://${host}/*`));

export default defineConfig({
  manifest: {
    // Shown as “Baton” inside the extension; “Baton Pass” is the official name (a Firefox add-on is called “Baton”).
    name: 'Baton Pass',
    short_name: 'Baton',
    description: 'Continue any AI chat where you left off: save your project, see usage limits, and pass it to another AI as a draft.',
    action: { default_title: 'Baton' },
    // offscreen: a hidden extension page that runs the on-device task model (Chrome shows no warning for it).
    permissions: ['storage', 'tabs', 'activeTab', 'scripting', 'sidePanel', 'alarms', 'offscreen', ...(cloudEnabled ? ['identity'] : [])],
    // The task model runs as WebAssembly; this is the narrowest setting that allows it (no remote code, no eval).
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" },
    optional_permissions: ['notifications'],
    side_panel: { default_path: 'sidepanel.html' },
    // A persistent sidebar has no activeTab grant after switching tabs.
    host_permissions: [...new Set(chatHosts), ...(cloudEnabled ? [`${cloud.url}/*`] : [])]
  },
  hooks: {
    // The WebAssembly engine for the task model ships inside the extension, next to the model.
    'build:publicAssets': (_wxt, files) => { for (const file of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) files.push({ absoluteSrc: fileURLToPath(new URL(`./node_modules/onnxruntime-web/dist/${file}`, import.meta.url)), relativeDest: `ort/${file}` }); }
  }
});
