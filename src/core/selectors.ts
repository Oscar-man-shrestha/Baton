import { z } from 'zod';
import bundled from '../selectors.json';

const providerSchema = z.object({ hosts: z.array(z.string()), turns: z.array(z.string()), editor: z.array(z.string()), artifacts: z.array(z.string()) });
export const selectorSchema = z.object({ version: z.number().int().positive(), updatedAt: z.string(), providers: z.record(z.string(), providerSchema) });
export type SelectorBundle = z.infer<typeof selectorSchema>;
export const bundledSelectors: SelectorBundle = selectorSchema.parse(bundled);
export type ProviderId = keyof typeof bundled.providers;
export const providerIds = Object.keys(bundled.providers) as ProviderId[];

export async function loadSelectors(): Promise<SelectorBundle> {
  const saved = await chrome.storage.local.get('remoteSelectors');
  const parsed = selectorSchema.safeParse(saved.remoteSelectors);
  return parsed.success && parsed.data.version >= bundledSelectors.version ? parsed.data : bundledSelectors;
}

export async function refreshSelectors(url: string, expectedSha256: string): Promise<SelectorBundle> {
  if (!url.startsWith('https://')) throw new Error('HTTPS is required');
  const response = await fetch(url);
  if (!response.ok) throw new Error('Selector download failed');
  const bytes = await response.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== expectedSha256.toLowerCase()) throw new Error('Selector hash mismatch');
  const parsed = selectorSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  if (parsed.version < bundledSelectors.version) throw new Error('Selector version is older than bundled version');
  await chrome.storage.local.set({ remoteSelectors: parsed });
  return parsed;
}
