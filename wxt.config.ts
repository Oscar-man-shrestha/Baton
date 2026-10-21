import { defineConfig } from 'wxt';
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
    permissions: ['storage', 'tabs', 'activeTab', 'scripting', 'sidePanel', 'alarms', ...(cloudEnabled ? ['identity'] : [])],
    optional_permissions: ['notifications'],
    side_panel: { default_path: 'sidepanel.html' },
    // A persistent sidebar has no activeTab grant after switching tabs.
    host_permissions: [...new Set(chatHosts), ...(cloudEnabled ? [`${cloud.url}/*`] : [])]
  }
});
