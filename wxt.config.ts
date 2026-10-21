import { defineConfig } from 'wxt';
import cloud from './src/config/cloud.json';
import selectors from './src/selectors.json';
const cloudEnabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cloud.url) && !!cloud.publishableKey;
const chatHosts = Object.values(selectors.providers).flatMap(provider => provider.hosts.map(host => `https://${host}/*`));

export default defineConfig({
  manifest: {
    name: 'Handoff',
    description: 'Review a compact project brief and continue as a draft in another AI chat.',
    permissions: ['storage', 'tabs', 'activeTab', 'scripting', 'sidePanel', ...(cloudEnabled ? ['identity'] : [])],
    optional_permissions: ['notifications'],
    side_panel: { default_path: 'sidepanel.html' },
    // A persistent sidebar has no activeTab grant after switching tabs.
    host_permissions: [...new Set(chatHosts), ...(cloudEnabled ? [`${cloud.url}/*`] : [])]
  }
});
