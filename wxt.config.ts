import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Handoff',
    description: 'Review a compact project brief and continue as a draft in another AI chat.',
    permissions: ['storage', 'tabs', 'activeTab', 'scripting'],
    optional_permissions: ['notifications'],
    host_permissions: []
  }
});
