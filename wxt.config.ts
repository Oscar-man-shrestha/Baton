import { defineConfig } from 'wxt';
import cloud from './src/config/cloud.json';
const cloudEnabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cloud.url) && !!cloud.publishableKey;

export default defineConfig({
  manifest: {
    name: 'Handoff',
    description: 'Review a compact project brief and continue as a draft in another AI chat.',
    permissions: ['storage', 'tabs', 'activeTab', 'scripting', 'sidePanel', ...(cloudEnabled ? ['identity'] : [])],
    optional_permissions: ['notifications'],
    side_panel: { default_path: 'sidepanel.html' },
    host_permissions: cloudEnabled ? [`${cloud.url}/*`] : []
  }
});
