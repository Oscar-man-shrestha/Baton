import { defineConfig } from 'wxt';
import { fileURLToPath } from 'node:url';
import cloud from './src/config/cloud.json';
import selectors from './src/selectors.json';
import { manifestCommands } from './src/core/shortcuts';
const cloudEnabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cloud.url) && !!cloud.publishableKey;
const chatHosts = Object.values(selectors.providers).flatMap(provider => provider.hosts.map(host => `https://${host}/*`));

export default defineConfig({
  manifest: {
    // Shown as “Baton” inside the extension; “Baton Pass” is the official name (a Firefox add-on is called “Baton”).
    name: 'Baton Pass',
    short_name: 'Baton',
    description: 'Continue any AI chat where you left off: save your project, see usage limits, and pass it to another AI as a draft.',
    icons: { 16: 'icon-16.png', 32: 'icon-32.png', 48: 'icon-48.png', 128: 'icon-128.png' },
    action: { default_title: 'Baton', default_icon: { 16: 'icon-16.png', 32: 'icon-32.png', 48: 'icon-48.png' } },
    // No “tabs” permission: Baton only reads the addresses of the six AI sites, which its host access already allows,
    // so Chrome doesn't warn about reading browsing history.
    // offscreen: a hidden extension page that runs the on-device task model (Chrome shows no warning for it).
    permissions: ['storage', 'activeTab', 'scripting', 'sidePanel', 'alarms', 'offscreen', 'contextMenus', ...(cloudEnabled ? ['identity'] : [])],
    // The task model runs as WebAssembly; this is the narrowest setting that allows it (no remote code, no eval).
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" },
    optional_permissions: ['notifications'],
    side_panel: { default_path: 'sidepanel.html' },
    // Keyboard shortcuts, from src/core/shortcuts.ts. (contextMenus above adds “Save selection as a baton” on the chat sites; no install warning.)
    commands: manifestCommands(),
    // A persistent sidebar has no activeTab grant after switching tabs.
    host_permissions: [...new Set(chatHosts), ...(cloudEnabled ? [`${cloud.url}/*`] : [])]
  },
  // Build time, shown next to the version so it's clear which build the browser has loaded.
  vite: () => ({ define: { __BATON_BUILT__: JSON.stringify(new Date().toISOString()) } }),
  hooks: {
    // The WebAssembly engine for the task model ships inside the extension, next to the model.
    'build:publicAssets': (_wxt, files) => { for (const file of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) files.push({ absoluteSrc: fileURLToPath(new URL(`./node_modules/onnxruntime-web/dist/${file}`, import.meta.url)), relativeDest: `ort/${file}` }); }
  }
});
